"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
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
import { updateStatsWithResult } from "@/lib/utils/statsService";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

const ENDURANCE_DURATION = 180; // 3 minutes, locked

type TrueTrackingTarget = MovingTarget & {
    health: number;
    isBeingTracked: boolean;
};

interface ConsistencyCheckProps {
    overrideSettings?: { difficulty: Difficulty; duration: number };
    onFinish?: (res: GameResult) => void;
}

export default function ConsistencyCheck({ overrideSettings, onFinish }: ConsistencyCheckProps = {}) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    // BUG FIX: Atomic target ID tracking
    const activeTargetId = useRef<string | null>(null);
    const targetRef = useRef<TrueTrackingTarget | null>(null);
    const mouseRef = useRef({ isFiring: false, x: 0, y: 0 });
    const dimensionsRef = useRef({ width: 1600, height: 900 });

    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const [isFinished, setIsFinished] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(ENDURANCE_DURATION);
    const [countdown, setCountdown] = useState<number | null>(null);

    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[overrideSettings?.difficulty ?? difficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);

    const clearEngine = useCallback(() => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        animationFrameRef.current = null;
        timeoutRef.current = null;
    }, []);

    const spawnTarget = useCallback(() => {
        clearEngine();

        const baseTarget = createTrackingTarget(
            overrideSettings?.difficulty ?? difficulty,
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            config.targetRadius
        );

        activeTargetId.current = baseTarget.id;

        targetRef.current = { ...baseTarget, health: 100, isBeingTracked: false };
        setTotalTargetsSpawned(p => p + 1);
        startTrackingLoop();

        timeoutRef.current = window.setTimeout(() => {
            if (activeTargetId.current === baseTarget.id) {
                setMisses(p => p + 1);
                setMissedByTimeout(p => p + 1);
                setScore(p => Math.max(0, p - config.missPenalty));
                spawnTarget();
            }
        }, config.targetLifetimeMs + 1000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [difficulty, config, overrideSettings, clearEngine]);

    const startTrackingLoop = () => {
        let lastTime = performance.now();

        const tick = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");

            if (canvas && ctx && targetRef.current) {
                // Update position via utility
                const nextPos = updateTrackingTargetPosition(
                    targetRef.current,
                    dimensionsRef.current.width,
                    dimensionsRef.current.height
                );

                const { isFiring, x, y } = mouseRef.current;
                const isHit = isFiring && isPointInsideTarget(x, y, nextPos.x, nextPos.y, nextPos.radius);

                let newHealth = targetRef.current.health;
                if (isHit) newHealth -= deltaTime * 0.25;

                // BUG FIX: Atomic check before spawning next target
                if (newHealth <= 0 && targetRef.current.id === activeTargetId.current) {
                    activeTargetId.current = null;
                    setHits(h => h + 1);
                    setScore(s => s + config.scorePerHit + 50);
                    // Record "reaction" as time to kill for consistency tracking
                    const ttk = performance.now() - targetRef.current.spawnedAt;
                    setReactionTimes(prev => [...prev, ttk]);
                    spawnTarget();
                    return;
                }

                targetRef.current = { ...nextPos, health: newHealth, isBeingTracked: isHit };

                ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
                renderTarget(ctx, targetRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    const renderTarget = (ctx: CanvasRenderingContext2D, t: TrueTrackingTarget) => {
        const gradient = ctx.createRadialGradient(
            t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
            t.x, t.y, t.radius
        );

        const color = t.isBeingTracked ? "#a78bfa" : "#8b5cf6";
        gradient.addColorStop(0, "#DDD6FE");
        gradient.addColorStop(0.3, color);
        gradient.addColorStop(1, "#3b0764");

        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.shadowColor = t.isBeingTracked ? "rgba(167,139,250,0.8)" : "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 25;
        ctx.fill();
    };

    const computeStability = (times: number[]) => {
        if (times.length < 5) return { score: 0, label: "Insufficient Data" };
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((a, t) => a + Math.pow(t - mean, 2), 0) / times.length;
        const cv = Math.sqrt(variance) / mean;
        const stability = Math.max(0, Math.round(100 - cv * 200));

        let label = "Moderate Fatigue Detected";
        if (stability > 90) label = "Robotic Precision";
        else if (stability > 75) label = "Highly Stable";
        return { score: stability, label };
    };

    const endSession = async () => {
        clearEngine();
        activeTargetId.current = null;
        setGameStarted(false);

        const { score: stabilityScore, label: stabilityLabel } = computeStability(reactionTimes);

        const resultData = buildGameResult({
            mode: "consistency-check",
            difficulty: difficultyLabels[difficulty],
            score,
            hits,
            misses,
            duration: ENDURANCE_DURATION,
            reactionTimes,
            totalTargetsSpawned,
            missedByTimeout,
            extraStats: {
                "Stability Score": `${stabilityScore}%`,
                "Assessment": stabilityLabel
            },
        });

        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) onFinish(resultData);
        else { setResult(resultData); setIsFinished(true); }
    };

    const startGame = async () => {
        clearEngine();
        activeTargetId.current = null;
        setGameStarted(true);
        setIsFinished(false);
        setTimeLeft(ENDURANCE_DURATION);
        setCountdown(5);
        targetRef.current = null;
        mouseRef.current = { isFiring: false, x: 0, y: 0 };
        setScore(0);
        setHits(0);
        setMisses(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);

        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }
    };

    useEffect(() => {
        if (countdown === 0) { setCountdown(null); spawnTarget(); }
        if (countdown !== null && countdown > 0) {
            const t = window.setTimeout(() => setCountdown(c => c! - 1), 1000);
            return () => window.clearTimeout(t);
        }
    }, [countdown, spawnTarget]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const t = window.setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(t);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished) endSession();
    }, [timeLeft, gameStarted, isFinished]);

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={() => setIsFinished(false)} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl space-y-8">
                        <div className="space-y-3">
                            <p className="text-[#8b5cf6] text-sm font-bold tracking-[0.35em] uppercase">Endurance Protocol</p>
                            <h2 className="text-5xl font-black tracking-widest uppercase">Consistency Check</h2>
                        </div>
                        <button onClick={startGame} className="w-full px-12 py-5 bg-[#8b5cf6] text-white text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#8b5cf6] transition-all">
                            START 3-MIN TEST
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="relative flex-1 w-full overflow-hidden bg-[#2f3b4c]">
                    <SessionHUD data={{ mode: "Consistency Check", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes) }} />
                    <canvas
                        ref={canvasRef}
                        width={renderDimensions.width}
                        height={renderDimensions.height}
                        onMouseDown={e => { mouseRef.current.isFiring = true; }}
                        onMouseUp={() => { mouseRef.current.isFiring = false; }}
                        onMouseMove={e => {
                            if (!canvasRef.current) return;
                            const coords = getScaledCanvasCoordinates(e, canvasRef.current, dimensionsRef.current.width, dimensionsRef.current.height);
                            mouseRef.current.x = coords.x;
                            mouseRef.current.y = coords.y;
                        }}
                        className="absolute inset-0 block cursor-crosshair"
                    />
                    {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[12rem] font-black text-[#8b5cf6] animate-ping">{countdown}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}