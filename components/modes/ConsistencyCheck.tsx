"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult, MovingTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createTrackingTarget, updateTrackingTargetPosition } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

// ─────────────────────────────────────────────────────────────
//  ConsistencyCheck — Endurance tracking variant.
//  Same canvas engine as TrackingMode, locked to 180s.
//  Post-session: calculates a Stability Score via Coefficient of Variation.
// ─────────────────────────────────────────────────────────────

const ENDURANCE_DURATION = 180; // 3 minutes, locked

type TrueTrackingTarget = MovingTarget & { health: number; isBeingTracked: boolean };

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface ConsistencyCheckProps { overrideSettings?: OverrideSettings; onFinish?: (res: GameResult) => void; }

export default function ConsistencyCheck({ overrideSettings, onFinish }: ConsistencyCheckProps = {}) {
    const containerRef       = useRef<HTMLDivElement | null>(null);
    const canvasRef          = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef  = useRef<number | null>(null);
    const timeoutRef         = useRef<number | null>(null);
    const targetRef          = useRef<TrueTrackingTarget | null>(null);
    const mouseRef           = useRef({ isFiring: false, x: 0, y: 0 });
    const dimensionsRef      = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty         = overrideSettings?.difficulty ?? difficulty;
    const effectiveDuration           = overrideSettings?.duration   ?? ENDURANCE_DURATION;

    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished,  setIsFinished]  = useState(false);
    const [timeLeft,    setTimeLeft]    = useState(effectiveDuration);
    const [countdown,   setCountdown]   = useState<number | null>(null);

    const [score,               setScore]               = useState(0);
    const [hits,                setHits]                = useState(0);
    const [misses,              setMisses]              = useState(0);
    const [reactionTimes,       setReactionTimes]       = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout,     setMissedByTimeout]     = useState(0);
    const [result,              setResult]              = useState<GameResult | null>(null);

    const config = difficultyConfig[effectiveDifficulty];

    const accuracy            = useMemo(() => calculateAccuracy(hits, misses),             [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime    = useMemo(() => calculateBestReactionTime(reactionTimes),    [reactionTimes]);

    // ─────────────────────────────────────────────────────────
    //  Engine helpers
    // ─────────────────────────────────────────────────────────
    const clearAnimation = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };

    const clearTargetTimeout = () => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const startTrackingLoop = () => {
        clearAnimation();
        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");

            if (canvas && ctx && targetRef.current) {
                const nextTarget = updateTrackingTargetPosition(
                    targetRef.current,
                    dimensionsRef.current.width,
                    dimensionsRef.current.height
                );

                const { isFiring, x, y } = mouseRef.current;
                const isHit = isFiring && isPointInsideTarget(x, y, nextTarget.x, nextTarget.y, nextTarget.radius);

                let newHealth = targetRef.current.health;
                if (isHit) newHealth -= deltaTime * 0.25;

                if (newHealth <= 0) {
                    targetRef.current = null;
                    setHits(h => h + 1);
                    setScore(s => s + config.scorePerHit + 50);
                    spawnTarget();
                    return;
                }

                targetRef.current = { ...nextTarget, health: newHealth, isBeingTracked: isHit } as TrueTrackingTarget;

                ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
                const t = targetRef.current;

                // Purple-tinted target for ConsistencyCheck identity
                const gradient = ctx.createRadialGradient(
                    t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
                    t.x, t.y, t.radius
                );
                if (t.isBeingTracked) {
                    gradient.addColorStop(0, "#FFFFFF");
                    gradient.addColorStop(0.3, "#a78bfa");
                    gradient.addColorStop(1, "#3b0764");
                } else {
                    gradient.addColorStop(0, "#DDD6FE");
                    gradient.addColorStop(0.3, "#8b5cf6");
                    gradient.addColorStop(1, "#3b0764");
                }

                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.shadowColor = t.isBeingTracked ? "rgba(167,139,250,0.8)" : "rgba(0,0,0,0.6)";
                ctx.shadowBlur  = 25;
                ctx.shadowOffsetY = 20;
                ctx.fill();
                ctx.shadowColor   = "transparent";
                ctx.shadowBlur    = 0;
                ctx.shadowOffsetY = 0;
            }

            animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);
    };

    const spawnTarget = () => {
        clearTargetTimeout();
        clearAnimation();

        const baseTarget = createTrackingTarget(
            effectiveDifficulty,
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            config.targetRadius
        );

        targetRef.current = { ...baseTarget, health: 100, isBeingTracked: false };
        setTotalTargetsSpawned(p => p + 1);
        startTrackingLoop();

        timeoutRef.current = window.setTimeout(() => {
            setMisses(p => p + 1);
            setMissedByTimeout(p => p + 1);
            setScore(p => Math.max(0, p - config.missPenalty));
            spawnTarget();
        }, config.targetLifetimeMs + 1000);
    };

    const resetState = () => {
        clearAnimation();
        clearTargetTimeout();
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(effectiveDuration);
        setCountdown(null);
        targetRef.current = null;
        mouseRef.current = { isFiring: false, x: 0, y: 0 };
        setScore(0);
        setHits(0);
        setMisses(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => {});
        }
        setCountdown(5); // 5-second prep countdown
    };

    // ─────────────────────────────────────────────────────────
    //  Stability Score (Coefficient of Variation)
    // ─────────────────────────────────────────────────────────
    const computeStability = (times: number[]): { score: number; label: string } => {
        if (times.length < 10) return { score: 0, label: "Insufficient Data" };

        const mean       = times.reduce((a, b) => a + b, 0) / times.length;
        const variance   = times.reduce((a, t) => a + Math.pow(t - mean, 2), 0) / times.length;
        const stdDev     = Math.sqrt(variance);
        const cv         = stdDev / mean;
        const stability  = Math.max(0, Math.round(100 - cv * 200));

        let label = "Severe Variance / Fatigue Failure";
        if (stability > 90)      label = "Robotic Precision";
        else if (stability > 75) label = "Highly Stable";
        else if (stability > 50) label = "Moderate Fatigue Detected";

        return { score: stability, label };
    };

    const endSession = async () => {
        clearAnimation();
        clearTargetTimeout();
        setGameStarted(false);
        targetRef.current = null;

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }

        // Use functional setState to read fresh values and avoid stale closures
        setReactionTimes(rt => {
            const { score: stabilityScore, label: stabilityLabel } = computeStability(rt);

            setHits(h => {
                setMisses(m => {
                    setScore(s => {
                        setTotalTargetsSpawned(sp => {
                            setMissedByTimeout(mt => {
                                const resultData = buildGameResult({
                                    mode: "consistency-check",
                                    difficulty: difficultyLabels[effectiveDifficulty],
                                    score: s,
                                    hits: h,
                                    misses: m,
                                    duration: effectiveDuration,
                                    reactionTimes: rt,
                                    totalTargetsSpawned: sp,
                                    missedByTimeout: mt,
                                    extraStats: {
                                        "Stability Score": `${stabilityScore}%`,
                                        "Assessment":      stabilityLabel,
                                        "Std Dev Track":   `${Math.round(rt.length > 0 ? Math.sqrt(rt.reduce((a, t) => a + Math.pow(t - rt.reduce((x, y) => x + y, 0) / rt.length, 2), 0) / rt.length) : 0)}ms`,
                                    },
                                });

                                updateStatsWithResult(resultData);

                                if (onFinish) {
                                    onFinish(resultData);
                                } else {
                                    setResult(resultData);
                                    setIsFinished(true);
                                }
                                return mt;
                            });
                            return sp;
                        });
                        return s;
                    });
                    return m;
                });
                return h;
            });
            return rt;
        });
    };

    // ─────────────────────────────────────────────────────────
    //  Effects
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            window.setTimeout(() => spawnTarget(), 0);
            return;
        }
        const t = window.setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown]);

    useEffect(() => {
        if (!gameStarted) return;
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
    }, [gameStarted]);

    useEffect(() => { setTimeLeft(effectiveDuration); }, [effectiveDuration]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const t = window.setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(t);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished && countdown === null) endSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameStarted, isFinished, countdown]);

    useEffect(() => () => { clearAnimation(); clearTargetTimeout(); }, []);

    const updateMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvasRef.current, dimensionsRef.current.width, dimensionsRef.current.height);
        mouseRef.current.x = x;
        mouseRef.current.y = y;
    };

    const isCountingDown = countdown !== null && countdown > 0;

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

            {/* ── RESULTS SCREEN ── */}
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {/* ── PRE-GAME MENU ── */}
            {!gameStarted && !isFinished && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-3">
                                <p className="text-[#8b5cf6] text-sm font-bold tracking-[0.35em] uppercase">Evaluation Protocol</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Consistency Check</h2>
                                <p className="text-gray-500 text-sm leading-relaxed pt-1">
                                    A grueling <span className="text-white font-bold">3-minute</span> sustained engagement test.<br />
                                    Maintain peak performance throughout. The system will calculate<br />
                                    your <span className="text-[#8b5cf6] font-bold">Neural Stability Score</span> from your reaction time variance.
                                </p>
                            </div>

                            {/* Difficulty selector */}
                            {!overrideSettings && (
                                <div className="flex flex-col text-left">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select
                                        value={difficulty}
                                        onChange={e => setDifficulty(e.target.value as Difficulty)}
                                        className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#8b5cf6] outline-none transition-all cursor-pointer"
                                    >
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Locked info strip */}
                            <div className="flex gap-3 justify-center">
                                {[
                                    { label: "FORMAT",          value: "Tracking" },
                                    { label: "DURATION",        value: "3 MIN · LOCKED" },
                                    { label: "ANALYSIS",        value: "Stability CV" },
                                ].map(item => (
                                    <div key={item.label} className="flex flex-col items-center px-4 py-2 border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 rounded-xl flex-1">
                                        <span className="text-[#8b5cf6] text-[9px] font-black tracking-widest uppercase mb-1">{item.label}</span>
                                        <span className="text-white font-black text-xs tracking-wider uppercase">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={startGame}
                                className="w-full px-12 py-5 bg-[#8b5cf6] text-white text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#8b5cf6] transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]"
                            >
                                INITIATE ENDURANCE SEQUENCE
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── ACTIVE GAME ── */}
            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">

                    {/* HUD */}
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Consistency Check",
                                difficulty: difficultyLabels[effectiveDifficulty],
                                timeLeft,
                                score,
                                hits,
                                misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [{ label: "Timeouts", value: missedByTimeout }],
                            }}
                        />
                    </div>

                    {/* Endurance protocol banner */}
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-full pointer-events-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] shadow-[0_0_6px_#8b5cf6] animate-pulse" />
                        <span className="text-[#8b5cf6] text-[9px] font-black tracking-[0.35em] uppercase">Endurance Protocol · Stability Being Measured</span>
                    </div>

                    {/* 3D Arena */}
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none" />
                        </div>

                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={canvasRef}
                                width={renderDimensions.width}
                                height={renderDimensions.height}
                                onMouseDown={e => { if (isCountingDown) return; mouseRef.current.isFiring = true; updateMousePosition(e); }}
                                onMouseUp={() => { mouseRef.current.isFiring = false; }}
                                onMouseMove={updateMousePosition}
                                onMouseLeave={() => { mouseRef.current.isFiring = false; }}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                        </div>

                        {/* Countdown overlay */}
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span
                                    key={countdown}
                                    className="text-[12rem] font-black text-[#8b5cf6] animate-ping leading-none select-none drop-shadow-[0_0_60px_#8b5cf6]"
                                >
                                    {countdown}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}