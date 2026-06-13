"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/game/types";
import { getModeConfig } from "@/lib/config/modeRegistry";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";
import { difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import { audioEngine } from "@/lib/services/audioEngine";
import { StorageEngine } from "@/lib/utils/storage";

interface UseBaseGameEngineOptions {
  modeId: string;
  overrideSettings?: {
    difficulty: Difficulty;
    duration: number;
    taskId?: string;
  };
  onSessionComplete?: (res: GameResult) => void;
}

export function useBaseGameEngine({
  modeId,
  overrideSettings,
  onSessionComplete,
}: UseBaseGameEngineOptions) {
  const [phase, setPhase] = useState<"menu" | "countdown" | "live" | "finished">("menu");
  // Keep phaseRef in sync so mouse-event closures always read the current phase.
  const _setPhaseWithRef = (p: "menu" | "countdown" | "live" | "finished") => {
    phaseRef.current = p;
    setPhase(p);
  };
  const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
  const [duration, setDuration] = useState<number>(overrideSettings?.duration ?? 30);
  const [timeLeft, setTimeLeft] = useState<number>(overrideSettings?.duration ?? 30);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
  const [missedByTimeout, setMissedByTimeout] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  const scoreRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const totalSpawnedRef = useRef(0);
  const missedByTimeoutRef = useRef(0);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  // Mirror of `phase` state accessible inside event-listener closures without stale captures.
  const phaseRef = useRef<"menu" | "countdown" | "live" | "finished">("menu");
  /**
   * Side-channel for kinematics-enabled game modes (StaticFlick, FlickBenchmark).
   * Updated by the mode on every hit; merged into extraStats at endSession.
   * Use a ref so writes are zero-cost (no re-renders).
   */
  const kinematicsExtraStatsRef = useRef<Record<string, number>>({});
  const [feedback, setFeedback] = useState<"hit" | "miss" | null>(null);

  // --- Ghost Recording & Replay State & Refs ---
  const [loadedGhost, setLoadedGhost] = useState<any>(null);
  const loadedGhostRef = useRef<any>(null);
  const recordingPathRef = useRef<[number, number, number][]>([]);
  const recordingTargetsRef = useRef<{ x: number; y: number; radius: number }[]>([]);
  const recordingHitsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const lastPathRecordTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(0);
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostAnimFrameRef = useRef<number | null>(null);
  const missQuadrantsRef = useRef({ topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 });
  const hitTimestampsRef = useRef<number[]>([]);


  const recordSpawnedTarget = useCallback((x: number, y: number, radius: number) => {
    const { width, height } = dimensionsRef.current;
    if (width <= 0 || height <= 0) return;
    const normX = (x / width) * 1000;
    const normY = (y / height) * 1000;
    const normR = (radius / Math.min(width, height)) * 1000;
    recordingTargetsRef.current.push({ x: normX, y: normY, radius: normR });
  }, []);

  const recordHitEvent = useCallback((x: number, y: number, t: number) => {
    const { width, height } = dimensionsRef.current;
    if (width <= 0 || height <= 0) return;
    const normX = (x / width) * 1000;
    const normY = (y / height) * 1000;
    recordingHitsRef.current.push({ x: normX, y: normY, t });
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1600, height: 900 });
  const dimensionsRef = useRef({ width: 1600, height: 900 });

  const isMountedRef = useRef(true);
  const sessionIdxRef = useRef(0);

  const timeoutRefs = useRef<number[]>([]);
  const intervalRefs = useRef<number[]>([]);
  const animationFrameRefs = useRef<number[]>([]);

  const addTimeout = useCallback((cb: () => void, delay: number) => {
    const id = window.setTimeout(cb, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  const addInterval = useCallback((cb: () => void, delay: number) => {
    const id = window.setInterval(cb, delay);
    intervalRefs.current.push(id);
    return id;
  }, []);

  const addAnimationFrame = useCallback((cb: (t: number) => void) => {
    const id = requestAnimationFrame(cb);
    animationFrameRefs.current.push(id);
    return id;
  }, []);

  const muteAudioPool = useCallback(() => {
    // Legacy window.audioPool has been removed.
    // Suspend the Web Audio API context to silence all synthesis immediately.
    audioEngine.suspend();
  }, []);

  const clearAllTimersAndLoops = useCallback(() => {
    timeoutRefs.current.forEach(window.clearTimeout);
    timeoutRefs.current = [];
    intervalRefs.current.forEach(window.clearInterval);
    intervalRefs.current = [];
    animationFrameRefs.current.forEach(cancelAnimationFrame);
    animationFrameRefs.current = [];
  }, []);

  // Update parameters from overrideSettings if they change
  useEffect(() => {
    if (overrideSettings?.difficulty) setDifficulty(overrideSettings.difficulty);
    if (overrideSettings?.duration) {
      setDuration(overrideSettings.duration);
      setTimeLeft(overrideSettings.duration);
    }
  }, [overrideSettings]);

  // Handle unmount cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimersAndLoops();
      muteAudioPool();
    };
  }, [clearAllTimersAndLoops, muteAudioPool]);


  // Canvas Resize Observer & High-DPI context scaling
  useEffect(() => {
    if (phase !== "live" && phase !== "countdown") return;
    const updateSize = () => {
      const canvas = canvasRef.current;
      const bgCanvas = bgCanvasRef.current;
      const ghostCanvas = ghostCanvasRef.current;
      const uiCanvas = uiCanvasRef.current;
      const parent = canvas?.parentElement;
      if (parent) {
        const { clientWidth, clientHeight } = parent;
        const dims = { width: clientWidth, height: clientHeight };
        setDimensions(dims);
        dimensionsRef.current = dims;

        const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

        [bgCanvas, canvas, ghostCanvas, uiCanvas].forEach((c) => {
          if (!c) return;
          const targetWidth = clientWidth * dpr;
          const targetHeight = clientHeight * dpr;
          if (c.width !== targetWidth || c.height !== targetHeight) {
            c.width = targetWidth;
            c.height = targetHeight;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale to avoid accumulation
              ctx.scale(dpr, dpr);
            }
          }
        });

        // Redraw static background grid
        if (bgCanvas) {
          const { drawBackgroundGrid } = require("@/lib/utils/canvasHelpers");
          drawBackgroundGrid(bgCanvas, clientWidth, clientHeight, modeId);
        }
      }
    };
    const observer = new ResizeObserver(updateSize);
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }
    updateSize();
    return () => observer.disconnect();
  }, [phase, modeId]);

  // Dynamic stacked canvas elements injection for Layered Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Ensure parent is styled for absolute stacking
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === "static") {
      parent.style.position = "relative";
    }

    // Hide default cursor on game canvas to use custom crosshair
    canvas.style.cursor = "none";

    // 1. Setup Layer 1: bg-canvas
    let bgCanvas = parent.querySelector(".aimsync-bg-canvas") as HTMLCanvasElement;
    if (!bgCanvas) {
      bgCanvas = document.createElement("canvas");
      bgCanvas.className = "aimsync-bg-canvas absolute inset-0 block pointer-events-none";
      bgCanvas.style.zIndex = "1";
      bgCanvas.style.position = "absolute";
      bgCanvas.style.top = "0";
      bgCanvas.style.left = "0";
      bgCanvas.style.width = "100%";
      bgCanvas.style.height = "100%";
      parent.insertBefore(bgCanvas, canvas);
    }
    bgCanvasRef.current = bgCanvas;

    // Structure Layer 2: game-canvas
    canvas.classList.add("absolute", "inset-0", "block");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "2";

    // Setup Layer 2.5: ghost-canvas
    let ghostCanvas = parent.querySelector(".aimsync-ghost-canvas") as HTMLCanvasElement;
    if (!ghostCanvas) {
      ghostCanvas = document.createElement("canvas");
      ghostCanvas.className = "aimsync-ghost-canvas absolute inset-0 block pointer-events-none";
      ghostCanvas.style.zIndex = "2.5";
      ghostCanvas.style.position = "absolute";
      ghostCanvas.style.top = "0";
      ghostCanvas.style.left = "0";
      ghostCanvas.style.width = "100%";
      ghostCanvas.style.height = "100%";
      parent.appendChild(ghostCanvas);
    }
    ghostCanvasRef.current = ghostCanvas;

    // 2. Setup Layer 3: ui-canvas
    let uiCanvas = parent.querySelector(".aimsync-ui-canvas") as HTMLCanvasElement;
    if (!uiCanvas) {
      uiCanvas = document.createElement("canvas");
      uiCanvas.className = "aimsync-ui-canvas absolute inset-0 block pointer-events-none";
      uiCanvas.style.zIndex = "3";
      uiCanvas.style.position = "absolute";
      uiCanvas.style.top = "0";
      uiCanvas.style.left = "0";
      uiCanvas.style.width = "100%";
      uiCanvas.style.height = "100%";
      parent.appendChild(uiCanvas);
    }
    uiCanvasRef.current = uiCanvas;

    // ─── Pointer Lock request ────────────────────────────────────────────────
    // Acquire pointer lock on mousedown only while a session is live so the
    // user can still interact with the menu / results screens normally.
    const handleStageMouseDown = () => {
      if (phaseRef.current === "live" && document.pointerLockElement !== canvas) {
        // unadjustedMovement bypasses OS mouse-acceleration curves for raw data.
        // Cast to `any` to pass the non-standard options object without TS union errors.
        try {
          const result = (canvas.requestPointerLock as (opts?: Record<string, unknown>) => Promise<void> | void)(
            { unadjustedMovement: true }
          );
          // Modern browsers return a Promise; swallow rejection gracefully.
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch(() => {
              // Fallback: retry without the unadjustedMovement hint.
              canvas.requestPointerLock();
            });
          }
        } catch {
          canvas.requestPointerLock();
        }
      }
    };

    // ─── Coalesced Pointer-Lock mouse-move handler ────────────────────────────
    // When pointer lock is active, movementX/Y are OS-raw deltas (no acceleration).
    // We accumulate sub-frame coalesced packets to prevent data loss between rAF
    // ticks on high-polling-rate mice (1000 Hz – 8000 Hz).
    const handleMouseMove = (e: MouseEvent) => {
      const { drawCrosshair } = require("@/lib/utils/canvasHelpers");
      const { width, height } = dimensionsRef.current;

      if (document.pointerLockElement === canvas) {
        // ── Accumulate coalesced sub-frame deltas ──────────────────────────
        let accX = 0;
        let accY = 0;

        // getCoalescedEvents() is part of the PointerEvent spec (MDN). Cast from
        // MouseEvent so TypeScript's lib.dom.d.ts can resolve the method signature.
        const pe = e as PointerEvent;
        if (typeof pe.getCoalescedEvents === "function") {
          const packets = pe.getCoalescedEvents();
          for (const evt of packets) {
            accX += evt.movementX;
            accY += evt.movementY;
          }
        } else {
          // Graceful fallback: use single-event deltas.
          accX = e.movementX;
          accY = e.movementY;
        }

        // Ensure cursor clamping bounds are tracking the dynamic client bounding rectangle of the canvas element container
        const rect = canvas.getBoundingClientRect();
        const minX = 0;
        const maxX = rect.width;
        const minY = 0;
        const maxY = rect.height;

        mousePosRef.current = {
          x: Math.min(maxX, Math.max(minX, mousePosRef.current.x + accX)),
          y: Math.min(maxY, Math.max(minY, mousePosRef.current.y + accY)),
        };
      } else {
        // ── Standard absolute positioning (no pointer lock) ───────────────
        const rect = canvas.getBoundingClientRect();
        mousePosRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }

      // Record telemetry if session is live
      if (phaseRef.current === "live") {
        const now = performance.now();
        const elapsed = now - sessionStartTimeRef.current;
        if (now - lastPathRecordTimeRef.current >= 30) {
          const normX = (mousePosRef.current.x / width) * 1000;
          const normY = (mousePosRef.current.y / height) * 1000;
          recordingPathRef.current.push([normX, normY, elapsed]);
          lastPathRecordTimeRef.current = now;
        }
      }

      // Crosshair draw is synchronous within the event callback —
      // completely decoupled from the rAF canvas loop.
      const { x, y } = mousePosRef.current;
      drawCrosshair(uiCanvas, width, height, x, y, null);
    };

    canvas.addEventListener("mousedown", handleStageMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);

    // Initial renders
    const { drawBackgroundGrid, drawCrosshair } = require("@/lib/utils/canvasHelpers");
    drawBackgroundGrid(bgCanvas, dimensionsRef.current.width, dimensionsRef.current.height, modeId);

    const initialX = modeId === "echolocation" ? dimensionsRef.current.width / 2 : mousePosRef.current.x || dimensionsRef.current.width / 2;
    const initialY = modeId === "echolocation" ? dimensionsRef.current.height / 2 : mousePosRef.current.y || dimensionsRef.current.height / 2;
    drawCrosshair(uiCanvas, dimensionsRef.current.width, dimensionsRef.current.height, initialX, initialY, null);

    return () => {
      canvas.removeEventListener("mousedown", handleStageMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [canvasRef.current, modeId, dimensions.width, dimensions.height]);

  // Redraw custom crosshair on feedback changes
  useEffect(() => {
    const uiCanvas = uiCanvasRef.current;
    if (!uiCanvas) return;
    const { drawCrosshair } = require("@/lib/utils/canvasHelpers");
    const initialX = modeId === "echolocation" ? dimensions.width / 2 : mousePosRef.current.x || dimensions.width / 2;
    const initialY = modeId === "echolocation" ? dimensions.height / 2 : mousePosRef.current.y || dimensions.height / 2;
    drawCrosshair(uiCanvas, dimensions.width, dimensions.height, initialX, initialY, feedback);
  }, [feedback, dimensions, modeId]);

  // Countdown Loop
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      _setPhaseWithRef("live");
      return;
    }
    const id = window.setTimeout(() => {
      if (isMountedRef.current) {
        setCountdown((c) => (c !== null ? c - 1 : null));
      }
    }, 1000);
    timeoutRefs.current.push(id);
    return () => window.clearTimeout(id);
  }, [countdown]);

  // Ghost Playback Loop and Lifecycle
  useEffect(() => {
    if (phase === "live") {
      sessionStartTimeRef.current = performance.now();
      recordingPathRef.current = [];
      recordingTargetsRef.current = [];
      recordingHitsRef.current = [];
      lastPathRecordTimeRef.current = 0;

      // Initialize Ghost playback
      const activeGhostStr = localStorage.getItem("aimsync_active_ghost");
      if (activeGhostStr) {
        try {
          const { decompressGhost } = require("@/lib/utils/ghostCompression");
          const decompressed = decompressGhost(activeGhostStr);
          if (decompressed.modeId === modeId) {
            setLoadedGhost(decompressed);
            loadedGhostRef.current = decompressed;

            // Start replaying path
            const runPlayback = () => {
              if (phaseRef.current !== "live") return;
              
              const now = performance.now();
              const elapsed = now - sessionStartTimeRef.current;
              const ghostCanvas = ghostCanvasRef.current;
              if (ghostCanvas && loadedGhostRef.current) {
                const { width, height } = dimensionsRef.current;
                const ctx = ghostCanvas.getContext("2d");
                if (ctx) {
                  ctx.clearRect(0, 0, width, height);

                  const ghost = loadedGhostRef.current;
                  const path = ghost.path;
                  
                  if (path.length > 0) {
                    // Find current coordinates by interpolating path samples at `elapsed`
                    let x = path[0][0];
                    let y = path[0][1];

                    let idx = 0;
                    while (idx < path.length - 1 && path[idx + 1][2] < elapsed) {
                      idx++;
                    }

                    if (idx < path.length - 1) {
                      const p1 = path[idx];
                      const p2 = path[idx + 1];
                      const tDiff = p2[2] - p1[2];
                      const tRatio = tDiff > 0 ? (elapsed - p1[2]) / tDiff : 1;
                      x = p1[0] + (p2[0] - p1[0]) * tRatio;
                      y = p1[1] + (p2[1] - p1[1]) * tRatio;
                    } else {
                      x = path[path.length - 1][0];
                      y = path[path.length - 1][1];
                    }

                    const screenX = (x / 1000) * width;
                    const screenY = (y / 1000) * height;

                    // Draw a trail of the ghost's path
                    ctx.beginPath();
                    const startIdx = Math.max(0, idx - 15);
                    let first = true;
                    for (let i = startIdx; i <= idx; i++) {
                      const px = (path[i][0] / 1000) * width;
                      const py = (path[i][1] / 1000) * height;
                      if (first) {
                        ctx.moveTo(px, py);
                        first = false;
                      } else {
                        ctx.lineTo(px, py);
                      }
                    }
                    ctx.lineTo(screenX, screenY);
                    ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
                    ctx.lineWidth = 2.5;
                    ctx.stroke();

                    // Draw the faint secondary crosshair
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
                    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 1, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(0, 240, 255, 0.4)";
                    ctx.fill();
                  }
                }
              }
              ghostAnimFrameRef.current = requestAnimationFrame(runPlayback);
            };
            ghostAnimFrameRef.current = requestAnimationFrame(runPlayback);
          } else {
            setLoadedGhost(null);
            loadedGhostRef.current = null;
          }
        } catch (e) {
          console.error("Ghost playback initialization failed:", e);
        }
      } else {
        setLoadedGhost(null);
        loadedGhostRef.current = null;
      }
    } else if (phase === "finished" || phase === "menu") {
      setLoadedGhost(null);
      loadedGhostRef.current = null;
      // Clear ghost canvas
      const canvas = ghostCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (ghostAnimFrameRef.current !== null) {
        cancelAnimationFrame(ghostAnimFrameRef.current);
      }
    };
  }, [phase, modeId]);

  // Session Ticker
  useEffect(() => {
    if (phase !== "live") return;
    setTimeLeft(duration);

    const id = window.setInterval(() => {
      if (!isMountedRef.current) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          // End session callback
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);

  const endSession = useCallback(async () => {
    clearAllTimersAndLoops();
    muteAudioPool();
    _setPhaseWithRef("finished");

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }

    const config = getModeConfig(modeId);
    let finalScore = scoreRef.current;
    let extraStats: Record<string, any> = {
      "Timeout Misses": missedByTimeoutRef.current,
      "Targets Spawned": totalSpawnedRef.current,
    };

    if (modeId === "flick-benchmark") {
      const totalShots = hitsRef.current + missesRef.current;
      const rawAccuracy = totalShots > 0 ? hitsRef.current / totalShots : 0;
      const penaltyMultiplier = rawAccuracy < 0.85 ? Math.pow(rawAccuracy / 0.85, 2) : 1;
      finalScore = Math.round((hitsRef.current * 1000) * penaltyMultiplier);
      extraStats = {
        "Raw Accuracy": `${(rawAccuracy * 100).toFixed(1)}%`,
        "Penalty Applied": penaltyMultiplier < 1 ? `${((1 - penaltyMultiplier) * 100).toFixed(0)}%` : "None",
        "Timeouts": missedByTimeoutRef.current,
      };
    } else if (modeId === "consistency-check") {
      const times = reactionTimesRef.current;
      const timestamps = hitTimestampsRef.current;
      if (times.length >= 6) {
        // Group reaction times into 30-second blocks (30000ms each)
        const blockDurationMs = 30000;
        const numBlocks = 6;
        const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
        
        for (let i = 0; i < times.length; i++) {
          const t = timestamps[i] ?? 0;
          const blockIdx = Math.min(numBlocks - 1, Math.floor(t / blockDurationMs));
          if (blockIdx >= 0 && blockIdx < numBlocks) {
            blocks[blockIdx].push(times[i]);
          }
        }
        
        const blockMeans: number[] = [];
        for (let i = 0; i < numBlocks; i++) {
          const blockHits = blocks[i];
          if (blockHits.length > 0) {
            const mean = blockHits.reduce((sum, val) => sum + val, 0) / blockHits.length;
            blockMeans.push(mean);
          }
        }
        
        if (blockMeans.length >= 2) {
          const meanOfMeans = blockMeans.reduce((sum, val) => sum + val, 0) / blockMeans.length;
          const varianceOfMeans = blockMeans.reduce((sum, val) => sum + Math.pow(val - meanOfMeans, 2), 0) / blockMeans.length;
          const stdDevOfMeans = Math.sqrt(varianceOfMeans);
          const cv = meanOfMeans > 0 ? (stdDevOfMeans / meanOfMeans) : 0;
          const stability = Math.max(0, Math.min(100, Math.round(100 - cv * 300)));
          
          let label = "Severe Variance / Fatigue Failure";
          if (stability > 90) label = "Robotic Precision";
          else if (stability > 75) label = "Highly Stable";
          else if (stability > 50) label = "Moderate Fatigue Detected";

          extraStats = {
            "Stability Score": `${stability}%`,
            "Assessment": label,
            "Std Dev Track": `${Math.round(stdDevOfMeans)}ms`,
            "Neural Stability Score": stability,
          };
        } else {
          // Fallback if not enough blocks have data
          const mean = times.reduce((a, b) => a + b, 0) / times.length;
          const variance = times.reduce((a, t) => a + Math.pow(t - mean, 2), 0) / times.length;
          const stdDev = Math.sqrt(variance);
          const cv = stdDev / mean;
          const stability = Math.max(0, Math.round(100 - cv * 200));
          let label = "Severe Variance / Fatigue Failure";
          if (stability > 90) label = "Robotic Precision";
          else if (stability > 75) label = "Highly Stable";
          else if (stability > 50) label = "Moderate Fatigue Detected";

          extraStats = {
            "Stability Score": `${stability}%`,
            "Assessment": label,
            "Std Dev Track": `${Math.round(stdDev)}ms`,
            "Neural Stability Score": stability,
          };
        }
      } else {
        extraStats = {
          "Stability Score": "0%",
          "Assessment": "Insufficient Data",
          "Std Dev Track": "0ms",
          "Neural Stability Score": 0,
        };
      }
    }

    const resultData = buildGameResult({
      mode: config.name,
      difficulty: difficultyLabels[difficulty],
      score: finalScore,
      hits: hitsRef.current,
      misses: missesRef.current,
      duration: duration,
      reactionTimes: reactionTimesRef.current,
      // Merge any kinematic averages written by the game mode during the session.
      extraStats: { ...extraStats, ...kinematicsExtraStatsRef.current },
      taskId: overrideSettings?.taskId,
      missQuadrants: missQuadrantsRef.current,
    });
    // Clear the kinematics side-channel for the next session.
    kinematicsExtraStatsRef.current = {};

    if (modeId === "flick-benchmark") {
      resultData.isBenchmark = true;
    }

    // Determine if this is a new high score for the mode
    let isNewHighScore = false;
    try {
      const stats = StorageEngine.getUserStats();
      const currentHighScore = stats.modes[modeId]?.highScore || 0;
      if (finalScore > currentHighScore) {
        isNewHighScore = true;
      }
    } catch (e) {
      console.error("Failed to check high score for ghost:", e);
    }

    if (isNewHighScore) {
      try {
        const { compressGhost } = require("@/lib/utils/ghostCompression");
        const ghostRecord = {
          modeId,
          difficulty: resultData.difficulty,
          score: finalScore,
          targets: recordingTargetsRef.current,
          path: recordingPathRef.current,
          hits: recordingHitsRef.current,
        };
        const compressed = compressGhost(ghostRecord);
        resultData.ghostTelemetry = compressed;
        
        // Save locally as personal best ghost
        localStorage.setItem(`aimsync_ghost_${modeId}_${resultData.difficulty}`, compressed);
      } catch (err) {
        console.error("Failed to save high score ghost:", err);
      }
    }

    await updateStatsWithResult(resultData);
    setResult(resultData);

    if (onSessionComplete) {
      onSessionComplete(resultData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeId, difficulty, duration, overrideSettings?.taskId, onSessionComplete, clearAllTimersAndLoops, muteAudioPool]);

  const beginSession = useCallback(async () => {
    clearAllTimersAndLoops();
    // Init (or resume) the audio engine on this confirmed user interaction.
    audioEngine.init();
    audioEngine.resume();
    muteAudioPool();
    sessionIdxRef.current++;

    scoreRef.current = 0;
    hitsRef.current = 0;
    missesRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    reactionTimesRef.current = [];
    totalSpawnedRef.current = 0;
    missedByTimeoutRef.current = 0;
    missQuadrantsRef.current = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
    hitTimestampsRef.current = [];


    setScore(0);
    setHits(0);
    setMisses(0);
    setCombo(0);
    setMaxCombo(0);
    setReactionTimes([]);
    setTotalTargetsSpawned(0);
    setMissedByTimeout(0);
    setResult(null);

    if (containerRef.current && !document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
    }

    _setPhaseWithRef("countdown");
    const countdownVal = modeId === "consistency-check" ? 5 : 3;
    setCountdown(countdownVal);
  }, [modeId, clearAllTimersAndLoops, muteAudioPool]);

  // Auto-Start logic for Daily Contract and Playlists
  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const autoStart = searchParams.get("autoStart") === "true";
    if (autoStart && phase === "menu") {
      const timer = setTimeout(() => {
        beginSession();
      }, 400); // 400ms delay to allow ResizeObserver layout sizing to stabilize
      return () => clearTimeout(timer);
    }
  }, [phase, beginSession]);

  const resetToMenu = useCallback(() => {
    clearAllTimersAndLoops();
    muteAudioPool();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    sessionIdxRef.current++;
    _setPhaseWithRef("menu");
    setTimeLeft(duration);
    setCountdown(null);
    setResult(null);
  }, [duration, clearAllTimersAndLoops, muteAudioPool]);

  const triggerHit = useCallback((reactionTime: number) => {
    hitsRef.current++;
    comboRef.current++;
    if (comboRef.current > maxComboRef.current) {
      maxComboRef.current = comboRef.current;
    }
    reactionTimesRef.current.push(reactionTime);
    hitTimestampsRef.current.push(performance.now() - sessionStartTimeRef.current);

    setHits(hitsRef.current);
    setCombo(comboRef.current);
    setMaxCombo(maxComboRef.current);
    setReactionTimes([...reactionTimesRef.current]);

    // Synthesize adaptive hit tone – scheduled on AudioContext timeline,
    // completely outside the rAF canvas loop. Milestone sweeps for 10, 25, 50.
    if (comboRef.current === 10) {
      audioEngine.playCleanSound();
    } else if (comboRef.current === 25) {
      audioEngine.playLockedInSound();
    } else if (comboRef.current === 50) {
      audioEngine.playImpeccableSound();
    } else {
      audioEngine.playHitSound(comboRef.current);
    }

    setFeedback("hit");
    const id = window.setTimeout(() => setFeedback(null), 150);
    timeoutRefs.current.push(id);
  }, []);

  const triggerMiss = useCallback((penalty = 0, clickX?: number, clickY?: number, targetX?: number, targetY?: number) => {
    missesRef.current++;
    comboRef.current = 0;

    setMisses(missesRef.current);
    setCombo(0);

    if (clickX !== undefined && clickY !== undefined && targetX !== undefined && targetY !== undefined) {
      const dx = clickX - targetX;
      const dy = clickY - targetY;
      if (dx < 0 && dy < 0) missQuadrantsRef.current.topLeft++;
      else if (dx >= 0 && dy < 0) missQuadrantsRef.current.topRight++;
      else if (dx < 0 && dy >= 0) missQuadrantsRef.current.bottomLeft++;
      else if (dx >= 0 && dy >= 0) missQuadrantsRef.current.bottomRight++;
    }

    if (penalty > 0) {
      scoreRef.current = Math.max(0, scoreRef.current - penalty);
      setScore(scoreRef.current);
    }

    // Synthesize miss buzz – off the rAF loop.
    audioEngine.playMissSound();

    setFeedback("miss");
    const id = window.setTimeout(() => setFeedback(null), 150);
    timeoutRefs.current.push(id);
  }, []);

  const incrementScore = useCallback((amount: number) => {
    scoreRef.current += amount;
    setScore(scoreRef.current);
  }, []);

  const incrementSpawned = useCallback(() => {
    totalSpawnedRef.current++;
    setTotalTargetsSpawned(totalSpawnedRef.current);
  }, []);

  const incrementTimeoutMiss = useCallback((penalty = 0) => {
    missedByTimeoutRef.current++;
    missesRef.current++;
    comboRef.current = 0;

    setMissedByTimeout(missedByTimeoutRef.current);
    setMisses(missesRef.current);
    setCombo(0);

    if (penalty > 0) {
      scoreRef.current = Math.max(0, scoreRef.current - penalty);
      setScore(scoreRef.current);
    }

    // Target expired = broken rhythm, same buzz as an active miss.
    audioEngine.playMissSound();

    setFeedback("miss");
    const id = window.setTimeout(() => setFeedback(null), 150);
    timeoutRefs.current.push(id);
  }, []);

  return {
    phase,
    setPhase,
    timeLeft,
    countdown,
    score,
    hits,
    misses,
    combo,
    maxCombo,
    reactionTimes,
    totalTargetsSpawned,
    missedByTimeout,
    result,
    difficulty,
    setDifficulty,
    duration,
    setDuration,
    canvasRef,
    bgCanvasRef,
    uiCanvasRef,
    containerRef,
    dimensions,
    dimensionsRef,
    isMountedRef,
    sessionIdxRef,
    beginSession,
    endSession,
    resetToMenu,
    triggerHit,
    triggerMiss,
    incrementScore,
    incrementSpawned,
    incrementTimeoutMiss,
    addTimeout,
    addInterval,
    addAnimationFrame,
    clearAllTimersAndLoops,
    mousePosRef,
    kinematicsExtraStatsRef,
    loadedGhost,
    recordSpawnedTarget,
    recordHitEvent,
  };
}
