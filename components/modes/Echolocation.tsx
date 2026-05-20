"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime } from "@/lib/utils/gameMath";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";

const MODE_DURATION = 60;
const FOV = 800; // Focal length
const NEAR_PLANE = 0.1;
const MAX_LIGHT_DISTANCE = 60; // How far the light reaches
const MAX_STANDARD_DURATION = 60; // Cap for in-game modes

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface EcholocationProps {
    overrideSettings?: OverrideSettings;
    onFinish?: (res: GameResult) => void;
}

type Phase = "PRE_MENU" | "COUNTDOWN" | "ACTIVE" | "CALCULATING";

interface Point3D {
    x: number;
    y: number;
    z: number;
}

interface SphericalTarget extends BaseTarget {
    x: number;
    y: number;
    z: number;
    distance: number;
}

// --- 3D Math Engine ---
const rotate3D = (p: Point3D, cameraYaw: number, cameraPitch: number): Point3D => {
    const yawRad = (cameraYaw * Math.PI) / 180;
    const pitchRad = (cameraPitch * Math.PI) / 180;

    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    let x1 = p.x * cosY - p.z * sinY;
    let z1 = p.x * sinY + p.z * cosY;

    const cosX = Math.cos(pitchRad);
    const sinX = Math.sin(pitchRad);
    let y1 = p.y * cosX - z1 * sinX;
    let z2 = p.y * sinX + z1 * cosX;

    return { x: x1, y: y1, z: z2 };
};

const clipLine3D = (p1: Point3D, p2: Point3D): [Point3D, Point3D] | null => {
    if (p1.z >= NEAR_PLANE && p2.z >= NEAR_PLANE) return [p1, p2];
    if (p1.z < NEAR_PLANE && p2.z < NEAR_PLANE) return null;

    const t = (NEAR_PLANE - p1.z) / (p2.z - p1.z);
    const clippedP = {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        z: NEAR_PLANE
    };

    if (p1.z >= NEAR_PLANE) return [p1, clippedP];
    return [clippedP, p2];
};

const projectToScreen = (p: Point3D, width: number, height: number) => {
    const scale = FOV / p.z;
    return {
        screenX: (width / 2) + p.x * scale,
        screenY: (height / 2) - p.y * scale,
        scale,
        z: p.z
    };
};

const drawDepthLine = (ctx: CanvasRenderingContext2D, w1: Point3D, w2: Point3D, yaw: number, pitch: number, width: number, height: number, baseColor: [number, number, number], maxDist = MAX_LIGHT_DISTANCE, lineWidth = 2, intensity = 1.0) => {
    const r1 = rotate3D(w1, yaw, pitch);
    const r2 = rotate3D(w2, yaw, pitch);

    const clipped = clipLine3D(r1, r2);
    if (!clipped) return;

    const [c1, c2] = clipped;
    const p1 = projectToScreen(c1, width, height);
    const p2 = projectToScreen(c2, width, height);

    const getAlpha = (z: number) => Math.max(0, 1 - (z / maxDist));
    const alpha1 = getAlpha(c1.z);
    const alpha2 = getAlpha(c2.z);

    if (alpha1 <= 0 && alpha2 <= 0) return;

    const r1Color = Math.min(255, Math.floor(baseColor[0] * intensity));
    const g1Color = Math.min(255, Math.floor(baseColor[1] * intensity));
    const b1Color = Math.min(255, Math.floor(baseColor[2] * intensity));

    const grad = ctx.createLinearGradient(p1.screenX, p1.screenY, p2.screenX, p2.screenY);
    grad.addColorStop(0, `rgba(${r1Color}, ${g1Color}, ${b1Color}, ${alpha1})`);
    grad.addColorStop(1, `rgba(${r1Color}, ${g1Color}, ${b1Color}, ${alpha2})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(p1.screenX, p1.screenY);
    ctx.lineTo(p2.screenX, p2.screenY);
    ctx.stroke();
};

// --- Target Definitions ---

// --- Wireframe Radial Sonar Grid ---
const gridLines: [Point3D, Point3D][] = [];
const NUM_RINGS = 10;
const RADIUS_STEP = 12;
const FLOOR_Y = -30;
const CEIL_Y = 30;
const NUM_SPOKES = 16;

for (let r = 1; r <= NUM_RINGS; r++) {
    const radius = r * RADIUS_STEP;
    const segments = 32;
    for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        const x1 = Math.cos(a1) * radius;
        const z1 = Math.sin(a1) * radius;
        const x2 = Math.cos(a2) * radius;
        const z2 = Math.sin(a2) * radius;

        gridLines.push([{x: x1, y: FLOOR_Y, z: z1}, {x: x2, y: FLOOR_Y, z: z2}]);
        gridLines.push([{x: x1, y: CEIL_Y, z: z1}, {x: x2, y: CEIL_Y, z: z2}]);
    }
}

for (let i = 0; i < NUM_SPOKES; i++) {
    const angle = (i / NUM_SPOKES) * Math.PI * 2;
    const maxRadius = NUM_RINGS * RADIUS_STEP;
    const x = Math.cos(angle) * maxRadius;
    const z = Math.sin(angle) * maxRadius;

    gridLines.push([{x: 0, y: FLOOR_Y, z: 0}, {x: x, y: FLOOR_Y, z: z}]);
    gridLines.push([{x: 0, y: CEIL_Y, z: 0}, {x: x, y: CEIL_Y, z: z}]);
}

export default function Echolocation({ overrideSettings, onFinish }: EcholocationProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const sessionIdxRef = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(overrideSettings?.duration ?? 30);
    const effectiveDuration = overrideSettings?.duration ?? durationSeconds;
    const [sensitivity, setSensitivity] = useState<number>(1.0);
    const config = difficultyConfig[difficulty];
    const { isTrial } = { isTrial: false }; // Placeholder for auth if needed, but drillConfig handles locking


    const [phase, setPhase] = useState<Phase>("PRE_MENU");
    const [countdown, setCountdown] = useState(3);

    const [timeLeft, setTimeLeft] = useState(effectiveDuration);
    const [target, setTarget] = useState<SphericalTarget | null>(null);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);

    const [result, setResult] = useState<GameResult | null>(null);
    const [isFinished, setIsFinished] = useState(false);

    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    // Camera state
    const cameraYawRef = useRef(0);
    const cameraPitchRef = useRef(0);
    const targetRotationRef = useRef(0);

    // Audio Context state
    const audioCtxRef = useRef<AudioContext | null>(null);

    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume();
        }
    };

    const playSpatialSound = (targetX: number, targetY: number, targetZ: number, distance: number) => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const panner = ctx.createPanner();
        const filter = ctx.createBiquadFilter();

        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;

        // Dull the sound based on difficulty
        const diffConfig = {
            easy: { filterFreq: 20000, volume: 1.0 },
            medium: { filterFreq: 6000, volume: 0.85 },
            hard: { filterFreq: 2000, volume: 0.7 },
            extreme: { filterFreq: 800, volume: 0.5 }
        };
        const audioSettings = diffConfig[difficulty] || diffConfig.medium;

        filter.type = 'lowpass';
        filter.frequency.value = audioSettings.filterFreq;

        // Rotate the target coordinates *around the origin* to get relative position to camera
        const rot = rotate3D({x: targetX, y: targetY, z: targetZ}, cameraYawRef.current, cameraPitchRef.current);

        panner.positionX.value = rot.x;
        panner.positionY.value = rot.y;
        panner.positionZ.value = rot.z; // WebAudio maps perfectly to our negative Z

        if (distance > 15) {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(1.5 * audioSettings.volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        } else {
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(1.0 * audioSettings.volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        }

        osc.connect(filter);
        filter.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    };

    const handleInitialize = async () => {
        initAudio();
        sessionIdxRef.current++;
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => {});
        }
        setPhase("COUNTDOWN");
        setCountdown(3);
    };

    useEffect(() => {
        if (phase !== "COUNTDOWN") return;
        if (countdown === 0) {
            sessionStartRef.current = performance.now();
            setPhase("ACTIVE");
            spawnTarget();
            
            if (canvasRef.current) {
                canvasRef.current.requestPointerLock();
            }
            return;
        }
        const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => window.clearTimeout(t);
    }, [phase, countdown]);

    useEffect(() => {
        if (phase !== "ACTIVE") return;
        const t = window.setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(t);
    }, [phase]);

    useEffect(() => {
        if (phase === "ACTIVE" && timeLeft === 0) {
            endSession();
        }
    }, [timeLeft, phase]);

    // Pointer Lock & Mouse Movement Handler
    useEffect(() => {
        if (phase !== "ACTIVE") return;

        const handleMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement === canvasRef.current) {
                const sensitivityMultiplier = 0.05 * sensitivity;
                cameraYawRef.current = (cameraYawRef.current + e.movementX * sensitivityMultiplier) % 360;
                
                cameraPitchRef.current -= e.movementY * sensitivityMultiplier;
                cameraPitchRef.current = Math.max(-89, Math.min(89, cameraPitchRef.current));
            }
        };

        const handlePointerLockChange = () => {};

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('pointerlockchange', handlePointerLockChange);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
        };
    }, [phase, sensitivity, timeLeft]);

    // Render loop
    useEffect(() => {
        if (phase !== "ACTIVE") return;

        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, renderDimensions.width, renderDimensions.height);

            const centerX = renderDimensions.width / 2;
            const centerY = renderDimensions.height / 2;
            const yaw = cameraYawRef.current;
            const pitch = cameraPitchRef.current;

            // Render Sonar Grid with Sweep Effect
            const time = performance.now() / 1000;
            const sweepAngle = (time * 1.5) % (Math.PI * 2);

            gridLines.forEach(([w1, w2]) => {
                const midX = (w1.x + w2.x) / 2;
                const midZ = (w1.z + w2.z) / 2;
                const angle = Math.atan2(midZ, midX);
                let angleDiff = sweepAngle - angle;
                
                while (angleDiff < 0) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI * 2) angleDiff -= Math.PI * 2;

                let intensity = 1.0;
                if (angleDiff < 0.6) {
                    intensity = 1.0 + (0.6 - angleDiff) * 3; 
                } else if (angleDiff > Math.PI * 2 - 0.1) {
                    intensity = 1.5;
                } else {
                    intensity = 0.2; 
                }

                drawDepthLine(ctx, w1, w2, yaw, pitch, renderDimensions.width, renderDimensions.height, [6, 182, 212], MAX_LIGHT_DISTANCE, 1, intensity);
            });

            // Draw 3D Target
            if (target) {
                const rotTarget = rotate3D(target, yaw, pitch);
                if (rotTarget.z >= NEAR_PLANE) {
                    const proj = projectToScreen(rotTarget, renderDimensions.width, renderDimensions.height);
                    const renderRadius = target.radius * 20 * proj.scale / FOV;

                    if (
                        proj.screenX + renderRadius > 0 &&
                        proj.screenX - renderRadius < renderDimensions.width &&
                        proj.screenY + renderRadius > 0 &&
                        proj.screenY - renderRadius < renderDimensions.height
                    ) {
                        // 1. Pulsating Outer Ring (Sonar effect)
                        const time = performance.now() / 1000;
                        const pulse = Math.sin(time * 6) * 0.15 + 1.15; // Pulses between 1.0 and 1.3
                        
                        ctx.beginPath();
                        ctx.arc(proj.screenX, proj.screenY, renderRadius * pulse, 0, Math.PI * 2);
                        ctx.strokeStyle = "rgba(255, 50, 50, 0.3)";
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        // 2. Main 3D Sphere Body
                        const grad = ctx.createRadialGradient(
                            proj.screenX - renderRadius * 0.3,
                            proj.screenY - renderRadius * 0.3,
                            renderRadius * 0.1,
                            proj.screenX,
                            proj.screenY,
                            renderRadius
                        );
                        grad.addColorStop(0, "#ff6666"); // Bright highlight
                        grad.addColorStop(1, "#990000"); // Deep red shadow

                        ctx.beginPath();
                        ctx.arc(proj.screenX, proj.screenY, renderRadius, 0, Math.PI * 2);
                        ctx.fillStyle = grad;
                        ctx.fill();

                        // 3. Sharp Inner Core (Tactical focus point)
                        ctx.beginPath();
                        ctx.arc(proj.screenX, proj.screenY, renderRadius * 0.25, 0, Math.PI * 2);
                        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                        ctx.shadowBlur = 10;
                        ctx.fill();
                        ctx.shadowColor = "transparent";
                        ctx.shadowBlur = 0;
                    }
                }
            }

            // Draw Static Crosshair
            ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - 8, centerY);
            ctx.lineTo(centerX + 8, centerY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - 8);
            ctx.lineTo(centerX, centerY + 8);
            ctx.stroke();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [target, renderDimensions, phase]);

    const clearTargetTimeout = () => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const spawnTarget = () => {
        clearTargetTimeout();
        const currentSession = sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const baseRadius = getScaledRadius(config.targetRadius, difficulty, elapsedSec, effectiveDuration);

        // Target should spawn OUTSIDE front FOV (so relative yaw > FOV/2)
        const yawOffset = (60 + Math.random() * 120) * (Math.random() > 0.5 ? 1 : -1);
        const newYaw = (cameraYawRef.current + yawOffset + 360) % 360;
        const newPitch = -30 + Math.random() * 60;
        
        // 15% chance to spawn close (3 to 10 units), otherwise spawn far (20 to 60 units)
        const isCloseSpawn = Math.random() < 0.15;
        const newDistance = isCloseSpawn ? 3 + Math.random() * 7 : 20 + Math.random() * 40;

        const yawRad = (newYaw * Math.PI) / 180;
        const pitchRad = (newPitch * Math.PI) / 180;
        
        const x = newDistance * Math.sin(yawRad) * Math.cos(pitchRad);
        const y = newDistance * Math.sin(pitchRad);
        const z = -newDistance * Math.cos(yawRad) * Math.cos(pitchRad);

        const newTarget: SphericalTarget = {
            id: Math.random().toString(),
            x, y, z,
            radius: baseRadius,
            spawnedAt: performance.now(),
            distance: newDistance
        };

        setTarget(newTarget);
        playSpatialSound(x, y, z, newDistance);

        timeoutRef.current = window.setTimeout(() => {
            if (sessionIdxRef.current !== currentSession) return;
            setMisses(p => p + 1);
            setScore(p => Math.max(0, p - config.missPenalty));
            spawnTarget();
        }, config.targetLifetimeMs * 1.5);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (phase !== "ACTIVE") return;
        
        if (document.pointerLockElement !== canvasRef.current) {
            canvasRef.current?.requestPointerLock();
        }

        if (!target) return;

        const rotTarget = rotate3D(target, cameraYawRef.current, cameraPitchRef.current);
        if (rotTarget.z >= NEAR_PLANE) {
            const proj = projectToScreen(rotTarget, renderDimensions.width, renderDimensions.height);
            
            const centerX = renderDimensions.width / 2;
            const centerY = renderDimensions.height / 2;

            const dx = proj.screenX - centerX;
            const dy = proj.screenY - centerY;
            const distToCenter = Math.sqrt(dx * dx + dy * dy);

            const renderRadius = target.radius * 20 * proj.scale / FOV;

            if (distToCenter <= renderRadius) {
                // Hit!
                const reaction = performance.now() - target.spawnedAt;
                setHits(p => p + 1);
                setScore(p => p + config.scorePerHit);
                setReactionTimes(p => [...p, reaction]);
                spawnHitmarker(renderDimensions.width / 2, renderDimensions.height / 2);
                spawnTarget();
                return;
            }
        }
        
        // Miss
        setMisses(p => p + 1);
        setScore(p => Math.max(0, p - config.missPenalty));
    };

    const endSession = async () => {
        clearTargetTimeout();
        setTarget(null);
        setPhase("CALCULATING");

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }

        window.setTimeout(async () => {
            const resultData = buildGameResult({
                mode: "echolocation",
                difficulty: difficultyLabels[difficulty],
                score,
                hits,
                misses,
                duration: effectiveDuration,
                reactionTimes,
            });
            await updateStatsWithResult(resultData);
            setResult(resultData);
            setIsFinished(true);
        }, 800);
    };

    const handleRestart = () => {
        sessionIdxRef.current++;
        clearTargetTimeout();
        setPhase("PRE_MENU");
        setCountdown(3);
        setTimeLeft(effectiveDuration);
        setTarget(null);
        setScore(0);
        setHits(0);
        setMisses(0);
        setReactionTimes([]);
        setResult(null);
        setIsFinished(false);
        cameraYawRef.current = 0;
        cameraPitchRef.current = 0;
    };

    useEffect(() => {
        const updateSize = () => {
            if (canvasRef.current?.parentElement) {
                const { clientWidth, clientHeight } = canvasRef.current.parentElement;
                dimensionsRef.current = { width: clientWidth, height: clientHeight };
                setRenderDimensions({ width: clientWidth, height: clientHeight });
            }
        };
        window.addEventListener("resize", updateSize);
        updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    useEffect(() => () => clearTargetTimeout(), []);

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={handleRestart} onBackToMenu={() => onFinish && onFinish(result)} />
                </div>
            )}

            {phase === "PRE_MENU" && !isFinished && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black tracking-widest uppercase text-white">Echolocation</h2>
                            <p className="text-gray-500 text-sm">Rely on spatial audio to snap to 3D targets in a pitch-black void.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-left">
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Difficulty</label>
                                    <select 
                                        value={difficulty} 
                                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#06b6d4] outline-none transition-all cursor-pointer"
                                    >
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Duration</label>
                                    <select
                                        value={durationSeconds}
                                        onChange={(e) => setDurationSeconds(Number(e.target.value))}
                                        className="bg-black/80 border border-white/20 p-3 rounded-lg text-white focus:border-[#06b6d4] outline-none transition-all cursor-pointer"
                                    >
                                        {!overrideSettings && <option value={15}>15s (Warmup)</option>}
                                        <option value={30}>30s (Standard)</option>
                                        {!overrideSettings && <option value={45}>45s (Extended)</option>}
                                        <option value={60}>60s (Endurance)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-gray-400 text-xs font-bold tracking-wider uppercase mb-2">Sensitivity</label>
                                    <div className="flex items-center space-x-2 bg-black/80 border border-white/20 p-3 rounded-lg">
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            value={sensitivity} 
                                            onChange={(e) => setSensitivity(parseFloat(e.target.value) || 1.0)}
                                            className="bg-transparent w-full outline-none text-white font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleInitialize}
                                className="w-full px-12 py-5 bg-[#06b6d4] text-black text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                            >
                                START PROTOCOL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {phase === "COUNTDOWN" && !isFinished && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#121212]">
                    <span className="text-[10rem] font-black text-white animate-ping">{countdown}</span>
                </div>
            )}

            {phase === "ACTIVE" && !isFinished && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10">
                        <SessionHUD
                            data={{
                                mode: "Echolocation",
                                difficulty: difficultyLabels[difficulty],
                                timeLeft,
                                score,
                                hits,
                                misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                            }}
                        />
                    </div>

                    <div className="relative flex-1 w-full overflow-hidden bg-[#000000]">
                        <canvas
                            ref={canvasRef}
                            width={renderDimensions.width}
                            height={renderDimensions.height}
                            onClick={handleCanvasClick}
                            className="absolute inset-0 block cursor-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
