"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { GameResult, MovingTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
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
import { useGameEngine } from "@/hooks/useGameEngine";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

type TrueTrackingTarget = MovingTarget & { health: number; isBeingTracked: boolean };

interface OverrideSettings { difficulty: Difficulty; duration: number; taskId?: string; }
interface TrackingModeProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function TrackingMode({ overrideSettings, onFinish }: TrackingModeProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const targetRef = useRef<TrueTrackingTarget | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes] = useState<number[]>([]);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    // ─── Score refs to read current values inside rAF closures ───
    const scoreRef = useRef(0);
    const hitsRef = useRef(0);
    const missesRef = useRef(0);
    const missedByTimeoutRef = useRef(0);

    const endSessionCallback = useCallback(async () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        targetRef.current = null;

        const resultData = buildGameResult({
            mode: "Tracking Protocol",
            difficulty: difficultyLabels[effectiveDifficulty],
            score: scoreRef.current,
            hits: hitsRef.current,
            misses: missesRef.current,
            duration: engine.duration,
            reactionTimes,
            extraStats: { "Timeout Misses": missedByTimeoutRef.current },
            taskId: overrideSettings?.taskId,
        });

        await updateStatsWithResult(resultData);

        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

        if (onFinish) {
            onFinish(resultData);
        } else {
            setResult(resultData);
            engine.endSession();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveDifficulty, reactionTimes, onFinish, overrideSettings?.taskId]);

    const engine = useGameEngine({
        defaultDuration: overrideSettings?.duration ?? 30,
        onTimerEnd: endSessionCallback,
        canvasRef,
    });

    const clearAnimation = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };

    const startTrackingLoop = useCallback(() => {
        clearAnimation();
        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            if (!engine.isMountedRef.current) return;
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");

            if (canvas && ctx && targetRef.current) {
                const w = engine.dimensions.width;
                const h = engine.dimensions.height;
                const nextTarget = updateTrackingTargetPosition(targetRef.current, w, h);
                const { x, y } = mouseRef.current;
                const isHit = isPointInsideTarget(x, y, nextTarget.x, nextTarget.y, nextTarget.radius);
                let newHealth = targetRef.current.health;
                if (isHit) newHealth -= (deltaTime * 0.25);

                if (newHealth <= 0) {
                    targetRef.current = null;
                    hitsRef.current += 1;
                    scoreRef.current += config.scorePerHit + 50;
                    setHits(hitsRef.current);
                    setScore(scoreRef.current);
                    spawnTarget();
                    return;
                }

                targetRef.current = { ...nextTarget, health: newHealth, isBeingTracked: isHit } as TrueTrackingTarget;

                // Resize canvas to match parent if needed
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                ctx.clearRect(0, 0, w, h);

                const t = targetRef.current;

                // Outer glow ring
                const glowRadius = t.radius * 1.6;
                const glow = ctx.createRadialGradient(t.x, t.y, t.radius * 0.5, t.x, t.y, glowRadius);
                if (isHit) {
                    glow.addColorStop(0, "rgba(0, 229, 255, 0.35)");
                    glow.addColorStop(1, "rgba(0, 229, 255, 0)");
                } else {
                    glow.addColorStop(0, "rgba(239, 68, 68, 0.30)");
                    glow.addColorStop(1, "rgba(239, 68, 68, 0)");
                }
                ctx.beginPath();
                ctx.arc(t.x, t.y, glowRadius, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();

                // Core sphere gradient
                const gradient = ctx.createRadialGradient(
                    t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
                    t.x, t.y, t.radius
                );
                if (isHit) {
                    gradient.addColorStop(0, "#CBD5E1");
                    gradient.addColorStop(0.3, "#00E5FF");
                    gradient.addColorStop(1, "#004455");
                } else {
                    gradient.addColorStop(0, "#FFCCCC");
                    gradient.addColorStop(0.3, "#EF4444");
                    gradient.addColorStop(1, "#550000");
                }
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.shadowColor = isHit ? "rgba(0, 229, 255, 0.8)" : "rgba(239, 68, 68, 0.6)";
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Health bar
                const barW = t.radius * 2;
                const barH = 5;
                const barX = t.x - t.radius;
                const barY = t.y + t.radius + 8;
                ctx.fillStyle = "rgba(255,255,255,0.1)";
                ctx.roundRect?.(barX, barY, barW, barH, 2);
                ctx.fill();
                ctx.fillStyle = isHit ? "#00E5FF" : "#EF4444";
                ctx.roundRect?.(barX, barY, barW * (newHealth / 100), barH, 2);
                ctx.fill();
            }

            animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, engine.dimensions, engine.isMountedRef]);

    const spawnTarget = useCallback(() => {
        clearAnimation();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = 0; // simplified
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);

        const baseTarget = createTrackingTarget(
            effectiveDifficulty,
            engine.dimensions.width,
            engine.dimensions.height,
            radius
        );
        targetRef.current = { ...baseTarget, health: 100, isBeingTracked: false };
        startTrackingLoop();

        window.setTimeout(() => {
            if (!engine.isMountedRef.current || engine.sessionIdxRef.current !== currentSession) return;
            missesRef.current += 1;
            missedByTimeoutRef.current += 1;
            scoreRef.current = Math.max(0, scoreRef.current - config.missPenalty);
            setMisses(missesRef.current);
            setMissedByTimeout(missedByTimeoutRef.current);
            setScore(scoreRef.current);
            spawnTarget();
        }, config.targetLifetimeMs + 1000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, effectiveDifficulty, engine.dimensions, engine.duration, engine.isMountedRef, engine.sessionIdxRef, startTrackingLoop]);

    const handleStartGame = async () => {
        // Reset all score refs
        scoreRef.current = 0;
        hitsRef.current = 0;
        missesRef.current = 0;
        missedByTimeoutRef.current = 0;
        setScore(0); setHits(0); setMisses(0); setMissedByTimeout(0); setResult(null);
        targetRef.current = null;

        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => {});
        }
        engine.beginSession(overrideSettings?.duration);
    };

    // When engine phase transitions to "live", spawn first target
    const prevPhaseRef = useRef(engine.phase);
    if (engine.phase === "live" && prevPhaseRef.current !== "live") {
        prevPhaseRef.current = "live";
        spawnTarget();
    } else if (engine.phase !== "live") {
        prevPhaseRef.current = engine.phase;
    }

    const updateMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvasRef.current, engine.dimensions.width, engine.dimensions.height);
        mouseRef.current.x = x;
        mouseRef.current.y = y;
    };

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && result !== null;

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">

            {/* RESULTS SCREEN */}
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={handleStartGame} onBackToMenu={engine.resetToMenu} />
                </div>
            )}

            {/* PRE-GAME MENU */}
            {engine.phase === "menu" && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">Continuous Tracking</h2>
                                <p className="text-slate-400 text-sm">Hold your cursor over the target. Drain its health bar to score.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                {!overrideSettings && (
                                    <>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                {Object.entries(difficultyLabels).map(([key, label]) => (
                                                    <option key={key} value={key}>{label.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                            <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                <option value={15}>15s (Warmup)</option>
                                                <option value={30}>30s (Standard)</option>
                                                <option value={45}>45s (Extended)</option>
                                                <option value={60}>60s (Endurance)</option>
                                            </select>
                                        </label>
                                    </>
                                )}
                            </div>
                            <button onClick={handleStartGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all shadow-[0_0_30px_rgba(51,102,255,0.2)]">
                                INITIALIZE SEQUENCE
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ACTIVE GAME */}
            {(isLive || isCountingDown) && (
                <div className="relative flex flex-col w-full h-full z-20">
                    {/* TOP HUD */}
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Tracking Protocol",
                                difficulty: difficultyLabels[effectiveDifficulty],
                                timeLeft: engine.timeLeft,
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

                    {/* ARENA */}
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#1a2030] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#1e293b] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_85%)] pointer-events-none" />
                        </div>
                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={canvasRef}
                                width={engine.dimensions.width}
                                height={engine.dimensions.height}
                                onMouseMove={updateMousePosition}
                                onMouseDown={updateMousePosition}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                        </div>

                        {/* COUNTDOWN OVERLAY */}
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/40">
                                <div className="flex flex-col items-center gap-4">
                                    <span key={engine.countdown} className="text-[12rem] font-black text-[#3366FF] leading-none select-none"
                                        style={{ textShadow: "0 0 80px rgba(51,102,255,0.8), 0 0 20px rgba(51,102,255,1)" }}>
                                        {engine.countdown}
                                    </span>
                                    <p className="text-white/50 text-sm font-bold tracking-[0.3em] uppercase">Get Ready</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}