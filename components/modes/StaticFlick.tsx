"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useGameEngine } from "@/hooks/useGameEngine";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { useAuth } from "@/lib/contexts/AuthContext";
import ComboMeter from "@/components/ComboMeter";

interface OverrideSettings { difficulty: Difficulty; duration: number; taskId?: string; }
interface StaticFlickProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function StaticFlick({ overrideSettings, onFinish }: StaticFlickProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const sessionStartRef = useRef<number>(0);
    const lastHitTargetIdRef = useRef<string | null>(null);
    const activeTargetId = useRef<string | null>(null);

    const { isTrial } = useAuth();

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [combo, setCombo] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    // Score refs so closures always read fresh values
    const scoreRef = useRef(0);
    const hitsRef = useRef(0);
    const missesRef = useRef(0);
    const comboRef = useRef(0);
    const reactionTimesRef = useRef<number[]>([]);
    const totalSpawnedRef = useRef(0);
    const missedByTimeoutRef = useRef(0);

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    const clearTargetTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const endSessionCallback = useCallback(async () => {
        clearTargetTimeout();
        setTarget(null);

        const resultData = buildGameResult({
            mode: "Static Flick",
            difficulty: difficultyLabels[effectiveDifficulty],
            score: scoreRef.current,
            hits: hitsRef.current,
            misses: missesRef.current,
            duration: engine.duration,
            reactionTimes: reactionTimesRef.current,
            extraStats: { "Timeout Misses": missedByTimeoutRef.current, "Targets Spawned": totalSpawnedRef.current },
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
    }, [effectiveDifficulty, clearTargetTimeout, onFinish, overrideSettings?.taskId]);

    const engine = useGameEngine({
        defaultDuration: overrideSettings?.duration ?? 30,
        onTimerEnd: endSessionCallback,
        canvasRef,
    });

    const spawnTarget = useCallback(() => {
        clearTargetTimeout();
        const currentSession = engine.sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, engine.duration);
        const nextTarget = createStaticTarget(engine.dimensions.width, engine.dimensions.height, radius);
        nextTarget.spawnedAt = performance.now();
        activeTargetId.current = nextTarget.id;

        setTarget(nextTarget);
        totalSpawnedRef.current += 1;
        setTotalTargetsSpawned(totalSpawnedRef.current);

        timeoutRef.current = window.setTimeout(() => {
            if (engine.sessionIdxRef.current !== currentSession) return;
            missesRef.current += 1;
            missedByTimeoutRef.current += 1;
            comboRef.current = 0;
            scoreRef.current = Math.max(0, scoreRef.current - config.missPenalty);
            setMisses(missesRef.current);
            setMissedByTimeout(missedByTimeoutRef.current);
            setCombo(0);
            setScore(scoreRef.current);
            spawnTarget();
        }, config.targetLifetimeMs);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearTargetTimeout, config, effectiveDifficulty, engine.dimensions, engine.duration, engine.sessionIdxRef]);

    // Canvas render effect — fires whenever target or dimensions change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = engine.dimensions.width;
        const h = engine.dimensions.height;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        ctx.clearRect(0, 0, w, h);

        if (target) {
            const t = target;
            const glowRadius = t.radius * 1.7;

            // Outer ambient glow
            const glow = ctx.createRadialGradient(t.x, t.y, t.radius * 0.5, t.x, t.y, glowRadius);
            glow.addColorStop(0, "rgba(239, 68, 68, 0.35)");
            glow.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.beginPath();
            ctx.arc(t.x, t.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // Inner ring outline
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Core sphere gradient
            const gradient = ctx.createRadialGradient(
                t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
                t.x, t.y, t.radius
            );
            gradient.addColorStop(0, "#FFCCCC");
            gradient.addColorStop(0.35, "#EF4444");
            gradient.addColorStop(1, "#550000");
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.shadowColor = "rgba(239, 68, 68, 0.7)";
            ctx.shadowBlur = 20;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Specular highlight (top-left gleam)
            const spec = ctx.createRadialGradient(
                t.x - t.radius * 0.35, t.y - t.radius * 0.35, 0,
                t.x - t.radius * 0.35, t.y - t.radius * 0.35, t.radius * 0.5
            );
            spec.addColorStop(0, "rgba(255,255,255,0.5)");
            spec.addColorStop(1, "rgba(255,255,255,0)");
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = spec;
            ctx.fill();
        }
    }, [target, engine.dimensions]);

    const handleStartGame = async () => {
        // Reset all refs and state
        scoreRef.current = 0; hitsRef.current = 0; missesRef.current = 0;
        comboRef.current = 0; reactionTimesRef.current = []; totalSpawnedRef.current = 0;
        missedByTimeoutRef.current = 0;
        setScore(0); setHits(0); setMisses(0); setCombo(0);
        setReactionTimes([]); setTotalTargetsSpawned(0); setMissedByTimeout(0);
        setTarget(null); setResult(null);
        lastHitTargetIdRef.current = null;
        sessionStartRef.current = performance.now();

        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => {});
        }
        engine.beginSession(overrideSettings?.duration);
    };

    // Spawn first target when engine transitions to "live"
    const prevPhaseRef = useRef(engine.phase);
    if (engine.phase === "live" && prevPhaseRef.current !== "live") {
        prevPhaseRef.current = "live";
        spawnTarget();
    } else if (engine.phase !== "live") {
        prevPhaseRef.current = engine.phase;
    }

    // Cleanup on unmount
    useEffect(() => () => clearTargetTimeout(), [clearTargetTimeout]);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (engine.phase !== "live" || !target || engine.countdown !== null) return;
        if (target.id !== activeTargetId.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, engine.dimensions.width, engine.dimensions.height);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            if (target.id === lastHitTargetIdRef.current) return;
            lastHitTargetIdRef.current = target.id;

            const reaction = performance.now() - target.spawnedAt;
            comboRef.current += 1;
            hitsRef.current += 1;
            scoreRef.current += config.scorePerHit + (comboRef.current * 5);
            reactionTimesRef.current.push(reaction);

            setHits(hitsRef.current);
            setCombo(comboRef.current);
            setScore(scoreRef.current);
            setReactionTimes([...reactionTimesRef.current]);
            spawnHitmarker(event.clientX, event.clientY);
            spawnTarget();
            return;
        }

        missesRef.current += 1;
        comboRef.current = 0;
        scoreRef.current = Math.max(0, scoreRef.current - config.missPenalty);
        setMisses(missesRef.current);
        setCombo(0);
        setScore(scoreRef.current);
        spawnTarget();
    };

    const isCountingDown = engine.countdown !== null && engine.countdown > 0;
    const isLive = engine.phase === "live";
    const isFinished = engine.phase === "finished" && result !== null;

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

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
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Static Flick</h2>
                                <p className="text-slate-400 text-sm">Click targets as fast as possible. Chain hits to build your combo.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                {!overrideSettings && (
                                    <>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                {Object.entries(difficultyLabels).map(([key, label]) => (
                                                    <option key={key} value={key} disabled={isTrial && key !== "eco" && key !== "bonus"}>
                                                        {label.toUpperCase()}{isTrial && key !== "eco" && key !== "bonus" ? " 🔒" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="flex flex-col text-left flex-1">
                                            <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                            <select value={engine.duration} onChange={(e) => engine.setDuration(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                                <option value={15} disabled={isTrial}>15s (Warmup){isTrial ? " 🔒" : ""}</option>
                                                <option value={30}>30s (Standard)</option>
                                                <option value={45}>45s (Extended)</option>
                                                <option value={60} disabled={isTrial}>60s (Endurance){isTrial ? " 🔒" : ""}</option>
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
                                mode: "Static Flick",
                                difficulty: difficultyLabels[effectiveDifficulty],
                                timeLeft: engine.timeLeft,
                                score,
                                hits,
                                misses,
                                accuracy,
                                averageReactionTime,
                                bestReactionTime,
                                extraLines: [
                                    { label: "Spawned", value: totalTargetsSpawned },
                                    { label: "Timeouts", value: missedByTimeout },
                                ],
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
                                onClick={handleCanvasClick}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                            <ComboMeter combo={combo} />
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