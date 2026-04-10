"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createStaticTarget } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

// ─────────────────────────────────────────────────────────────
//  BENCHMARK CONSTANTS — Duration & accuracy threshold never change.
// ─────────────────────────────────────────────────────────────
const BENCHMARK_DURATION  = 60;     // Locked 60s always
const ACCURACY_THRESHOLD  = 0.85;   // 85% accuracy floor

interface FlickBenchmarkProps {
    onFinish?: (res: GameResult) => void;
}

// PRE_MENU → COUNTDOWN → ACTIVE → CALCULATING → (ResultsScreen)
type Phase = "PRE_MENU" | "COUNTDOWN" | "ACTIVE" | "CALCULATING";

export default function FlickBenchmark({ onFinish }: FlickBenchmarkProps) {
    const containerRef  = useRef<HTMLDivElement | null>(null);
    const canvasRef     = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef    = useRef<number | null>(null);
    const sessionIdxRef     = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    // Difficulty selected on pre-menu — user can pick, duration is still locked
    const [difficulty, setDifficulty] = useState<Difficulty>("hard");
    const benchmarkConfig = difficultyConfig[difficulty];

    // Phase machine
    const [phase,     setPhase]     = useState<Phase>("PRE_MENU");
    const [countdown, setCountdown] = useState(3);

    // Live game state
    const [timeLeft, setTimeLeft] = useState(BENCHMARK_DURATION);
    const [target,   setTarget]   = useState<BaseTarget | null>(null);
    const [score,    setScore]    = useState(0);
    const [hits,     setHits]     = useState(0);
    const [misses,   setMisses]   = useState(0);
    const [reactionTimes,       setReactionTimes]       = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout,     setMissedByTimeout]     = useState(0);

    // Results phase
    const [result,        setResult]        = useState<GameResult | null>(null);
    const [isFinished,    setIsFinished]    = useState(false);
    const [penaltyApplied, setPenaltyApplied] = useState(false);

    const accuracy            = useMemo(() => calculateAccuracy(hits, misses),             [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime    = useMemo(() => calculateBestReactionTime(reactionTimes),    [reactionTimes]);

    // ─────────────────────────────────────────────────────────
    //  PRE_MENU → Initialize button → COUNTDOWN
    // ─────────────────────────────────────────────────────────
    const handleInitialize = async () => {
        sessionIdxRef.current++; // Kill switch for any lingering loops
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => {});
        }
        setPhase("COUNTDOWN");
        setCountdown(3);
    };

    // ─────────────────────────────────────────────────────────
    //  COUNTDOWN: 3 → 2 → 1 → ACTIVE
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "COUNTDOWN") return;
        if (countdown === 0) {
            sessionStartRef.current = performance.now();
            setPhase("ACTIVE");
            spawnTarget();
            return;
        }
        const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, countdown]);

    // ─────────────────────────────────────────────────────────
    //  ACTIVE: game timer
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "ACTIVE") return;
        const t = window.setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(t);
    }, [phase]);

    useEffect(() => {
        if (phase === "ACTIVE" && timeLeft === 0) endSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, phase]);

    // ─────────────────────────────────────────────────────────
    //  Canvas resize observer
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "ACTIVE") return;
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
    }, [phase]);

    // ─────────────────────────────────────────────────────────
    //  Canvas render — target drawn as red sphere (same as StaticFlick)
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

        if (target) {
            // Outer glow ring
            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(236, 72, 153, 0.12)";
            ctx.fill();

            // Pink sphere gradient
            const gradient = ctx.createRadialGradient(
                target.x - target.radius * 0.3, target.y - target.radius * 0.3, target.radius * 0.05,
                target.x, target.y, target.radius
            );
            gradient.addColorStop(0, "#FFCCE8");
            gradient.addColorStop(0.35, "#ec4899");
            gradient.addColorStop(1, "#7c0040");

            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.shadowColor = "rgba(236, 72, 153, 0.7)";
            ctx.shadowBlur  = 22;
            ctx.shadowOffsetY = 8;
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur  = 0;
            ctx.shadowOffsetY = 0;
        }
    }, [target, renderDimensions]);

    // ─────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────
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
        const radius = getScaledRadius(benchmarkConfig.targetRadius, difficulty, elapsedSec, BENCHMARK_DURATION);
        const next = createStaticTarget(
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            radius
        );
        setTarget(next);
        setTotalTargetsSpawned(p => p + 1);

        timeoutRef.current = window.setTimeout(() => {
            if (sessionIdxRef.current !== currentSession) return;
            setMisses(p => p + 1);
            setMissedByTimeout(p => p + 1);
            setScore(p => Math.max(0, p - benchmarkConfig.missPenalty));
            spawnTarget();
        }, benchmarkConfig.targetLifetimeMs);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (phase !== "ACTIVE" || !target) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(e, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            const reaction = performance.now() - target.spawnedAt;
            setHits(p => p + 1);
            setScore(p => p + benchmarkConfig.scorePerHit);
            setReactionTimes(p => [...p, reaction]);
            spawnTarget();
        } else {
            setMisses(p => p + 1);
            setScore(p => Math.max(0, p - benchmarkConfig.missPenalty));
        }
    };

    // ─────────────────────────────────────────────────────────
    //  PHASE 3: Telemetry calculation
    // ─────────────────────────────────────────────────────────
    const endSession = async () => {
        clearTargetTimeout();
        setTarget(null);
        setPhase("CALCULATING");

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
        }

        window.setTimeout(() => {
            setHits(h => {
                setMisses(m => {
                    setScore(s => {
                        setReactionTimes(rt => {
                            setTotalTargetsSpawned(sp => {
                                setMissedByTimeout(mt => {
                                    runCalculation(h, m, s, rt, sp, mt);
                                    return mt;
                                });
                                return sp;
                            });
                            return rt;
                        });
                        return s;
                    });
                    return m;
                });
                return h;
            });
        }, 800);
    };

    const runCalculation = (
        finalHits: number,
        finalMisses: number,
        finalScore: number,
        finalReactionTimes: number[],
        finalSpawned: number,
        finalTimeouts: number,
    ) => {
        const totalShots  = finalHits + finalMisses;
        const rawAccuracy = totalShots > 0 ? finalHits / totalShots : 0;

        const penaltyMultiplier = rawAccuracy < ACCURACY_THRESHOLD
            ? Math.pow(rawAccuracy / ACCURACY_THRESHOLD, 2)
            : 1;
        const appliedPenalty = penaltyMultiplier < 1;
        const benchmarkScore = Math.round((finalHits * 1000) * penaltyMultiplier);

        const resultData = buildGameResult({
            mode: "flick-benchmark",
            difficulty: difficultyLabels[difficulty],
            score: benchmarkScore,
            hits: finalHits,
            misses: finalMisses,
            duration: BENCHMARK_DURATION,
            reactionTimes: finalReactionTimes,
            totalTargetsSpawned: finalSpawned,
            missedByTimeout: finalTimeouts,
            extraStats: {
                "Raw Accuracy": `${(rawAccuracy * 100).toFixed(1)}%`,
                "Penalty Applied": appliedPenalty ? `${((1 - penaltyMultiplier) * 100).toFixed(0)}%` : "None",
                "Timeouts": finalTimeouts,
            },
        });

        const benchmarkResult: GameResult = { ...resultData, isBenchmark: true };

        updateStatsWithResult(benchmarkResult);
        setPenaltyApplied(appliedPenalty);
        setResult(benchmarkResult);
        setIsFinished(true);
    };

    const handleRestart = () => {
        sessionIdxRef.current++; // Invalidate stale timeouts
        clearTargetTimeout();
        setPhase("PRE_MENU");
        setCountdown(3);
        setTimeLeft(BENCHMARK_DURATION);
        setTarget(null);
        setScore(0);
        setHits(0);
        setMisses(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);
        setIsFinished(false);
        setPenaltyApplied(false);
    };

    const handleBackToMenu = () => {
        clearTargetTimeout();
        if (onFinish && result) {
            onFinish(result);
        } else {
            handleRestart();
        }
    };

    useEffect(() => () => clearTargetTimeout(), []);

    // Difficulty option display config
    const difficultyOptions: { key: Difficulty; label: string; desc: string }[] = [
        { key: "easy",    label: "ECO",       desc: "Large targets · 1400ms lifetime" },
        { key: "medium",  label: "BONUS",     desc: "Medium targets · 1100ms lifetime" },
        { key: "hard",    label: "FORCE BUY", desc: "Small targets · 850ms lifetime" },
        { key: "extreme", label: "FULL BUY",  desc: "Micro targets · 650ms lifetime" },
    ];

    // ─────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

            {/* ── RESULTS SCREEN ── */}
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={handleRestart} onBackToMenu={handleBackToMenu} />
                </div>
            )}

            {/* ════════════════════════════════════════════════
                PHASE 0: PRE-GAME MENU
            ════════════════════════════════════════════════ */}
            {phase === "PRE_MENU" && !isFinished && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">

                            {/* Header */}
                            <div className="space-y-2">
                                <p className="text-[#ec4899] text-sm font-bold tracking-[0.35em] uppercase">Evaluation Protocol</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Flick Benchmark</h2>
                                <p className="text-gray-500 text-sm leading-relaxed pt-1">
                                    An official, unmodified run. Duration is locked to <span className="text-white font-bold">60 seconds</span>.<br />
                                    Choose your difficulty below, then initialize the sequence.
                                </p>
                            </div>

                            {/* Difficulty Selector */}
                            <div className="space-y-3">
                                <span className="text-gray-400 text-xs font-bold tracking-wider uppercase block text-left">Select Difficulty</span>
                                <div className="grid grid-cols-2 gap-3">
                                    {difficultyOptions.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setDifficulty(opt.key)}
                                            className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${
                                                difficulty === opt.key
                                                    ? "border-[#ec4899] bg-[#ec4899]/10 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                                                    : "border-white/10 bg-black/40 hover:border-white/30 hover:bg-black/60"
                                            }`}
                                        >
                                            <span className={`text-xs font-black tracking-widest uppercase mb-1 ${difficulty === opt.key ? "text-[#ec4899]" : "text-gray-400"}`}>
                                                {opt.label}
                                            </span>
                                            <span className="text-white font-bold text-sm">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Locked config strip */}
                            <div className="flex gap-3 justify-center">
                                {[
                                    { label: "MODE",     value: "Static Flick" },
                                    { label: "DURATION", value: "60s · LOCKED" },
                                    { label: "ACCURACY FLOOR", value: "85%" },
                                ].map(item => (
                                    <div key={item.label} className="flex flex-col items-center px-4 py-2 border border-[#ec4899]/20 bg-[#ec4899]/5 rounded-xl flex-1">
                                        <span className="text-[#ec4899] text-[9px] font-black tracking-widest uppercase mb-1">{item.label}</span>
                                        <span className="text-white font-black text-xs tracking-wider uppercase">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Initialize button */}
                            <button
                                onClick={handleInitialize}
                                className="w-full mt-2 px-12 py-5 bg-[#ec4899] text-white text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#ec4899] transition-all shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)]"
                            >
                                INITIALIZE BENCHMARK
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════════
                PHASE 1: COUNTDOWN
            ════════════════════════════════════════════════ */}
            {phase === "COUNTDOWN" && !isFinished && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#121212]">
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

                    <div className="relative z-10 text-center space-y-6">
                        <p className="text-[#ec4899] text-xs font-black tracking-[0.5em] uppercase">
                            Benchmark Protocol · Locked Config
                        </p>
                        <div className="flex flex-col items-center space-y-1">
                            <span className="text-gray-500 text-xs tracking-widest uppercase">Commencing In</span>
                            <span
                                key={countdown}
                                className="text-[10rem] font-black leading-none text-white drop-shadow-[0_0_60px_#ec4899] animate-ping"
                                style={{ animationDuration: "0.8s", animationIterationCount: 1, animationFillMode: "both" }}
                            >
                                {countdown}
                            </span>
                        </div>

                        <div className="flex gap-4 mt-4">
                            {[
                                { label: "MODE",        value: "Static Flick" },
                                { label: "DURATION",    value: "60s" },
                                { label: "DIFFICULTY",  value: difficultyLabels[difficulty].toUpperCase() },
                                { label: "ENVIRONMENT", value: "Dark" },
                            ].map(item => (
                                <div key={item.label} className="flex flex-col items-center px-5 py-3 border border-[#ec4899]/20 bg-[#ec4899]/5 rounded-xl">
                                    <span className="text-[#ec4899] text-[9px] font-black tracking-widest uppercase mb-1">{item.label}</span>
                                    <span className="text-white font-black text-sm tracking-wider uppercase">{item.value}</span>
                                    <span className="text-[#ec4899] text-[8px] font-bold tracking-wider uppercase mt-1">LOCKED</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-gray-600 text-xs tracking-widest uppercase pt-2">
                            Center your mouse · Plant your wrist · Focus
                        </p>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════
                PHASE 2: ACTIVE GAME
            ════════════════════════════════════════════════ */}
            {phase === "ACTIVE" && !isFinished && (
                <div className="relative flex flex-col w-full h-full z-20">

                    {/* HUD */}
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Flick Benchmark",
                                difficulty: difficultyLabels[difficulty],
                                timeLeft,
                                score,
                                hits,
                                misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [
                                    { label: "Spawned",  value: totalTargetsSpawned },
                                    { label: "Timeouts", value: missedByTimeout },
                                ],
                            }}
                        />
                    </div>

                    {/* Official Benchmark banner */}
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1 bg-[#ec4899]/10 border border-[#ec4899]/30 rounded-full pointer-events-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ec4899] shadow-[0_0_6px_#ec4899] animate-pulse" />
                        <span className="text-[#ec4899] text-[9px] font-black tracking-[0.35em] uppercase">Official Benchmark · All Settings Locked</span>
                    </div>

                    {/* 3D Arena — same dark-slate look as StaticFlick */}
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
                                onClick={handleCanvasClick}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════
                PHASE 3: CALCULATING
            ════════════════════════════════════════════════ */}
            {phase === "CALCULATING" && !isFinished && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#121212]/95 backdrop-blur-sm">
                    <div className="text-center space-y-8">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 rounded-full border-4 border-[#ec4899]/20" />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ec4899] animate-spin" />
                            <div className="absolute inset-3 rounded-full bg-[#ec4899]/10 flex items-center justify-center">
                                <span className="text-[#ec4899] text-xl font-black">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-[#ec4899] text-3xl font-black tracking-widest uppercase">
                                Processing Telemetry
                            </h2>
                            <p className="text-gray-500 text-xs tracking-[0.3em] uppercase">
                                Applying accuracy modifiers...
                            </p>
                        </div>

                        <div className="flex gap-3 justify-center">
                            {["Calculating Score", "Checking Accuracy Floor", "Stamping Certificate"].map((step, i) => (
                                <div
                                    key={step}
                                    className="flex items-center gap-2 px-3 py-1.5 border border-white/5 bg-white/[0.02] rounded-lg"
                                    style={{ opacity: 0.4 + i * 0.2 }}
                                >
                                    <div
                                        className="w-1.5 h-1.5 rounded-full bg-[#ec4899] animate-pulse"
                                        style={{ animationDelay: `${i * 0.3}s` }}
                                    />
                                    <span className="text-gray-400 text-[9px] tracking-widest uppercase">{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}