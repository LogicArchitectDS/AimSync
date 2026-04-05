"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, type Difficulty } from "@/lib/utils/drillConfig";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    getScaledCanvasCoordinates,
    isPointInsideTarget,
} from "@/lib/utils/gameMath";
import { createStaticTarget } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

const BENCHMARK_DURATION = 60;
const ACCURACY_THRESHOLD = 0.85;

type Phase = "PRE_MENU" | "COUNTDOWN" | "ACTIVE" | "CALCULATING";

export default function FlickBenchmark({ onFinish }: { onFinish?: (res: GameResult) => void }) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);

    // BUG FIX: Atomic ID tracking
    const activeTargetId = useRef<string | null>(null);
    const dimensionsRef = useRef({ width: 1600, height: 900 });

    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });
    const [difficulty, setDifficulty] = useState<Difficulty>("hard");
    const [phase, setPhase] = useState<Phase>("PRE_MENU");
    const [countdown, setCountdown] = useState(3);
    const [timeLeft, setTimeLeft] = useState(BENCHMARK_DURATION);

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);
    const [isFinished, setIsFinished] = useState(false);

    const config = difficultyConfig[difficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);

    const clearTargetTimeout = () => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const spawnTarget = useCallback(() => {
        clearTargetTimeout();
        
        const next = createStaticTarget(dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);
        const newId = next.id;
        activeTargetId.current = newId;

        setTarget(next);
        setTotalTargetsSpawned(p => p + 1);

        timeoutRef.current = window.setTimeout(() => {
            if (activeTargetId.current === newId) {
                setMisses(p => p + 1);
                setMissedByTimeout(p => p + 1);
                spawnTarget();
            }
        }, config.targetLifetimeMs);
    }, [config]);

    const handleInitialize = async () => {
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }
        setPhase("COUNTDOWN");
    };

    const endSession = useCallback(async () => {
        clearTargetTimeout();
        activeTargetId.current = null;
        setTarget(null);
        setPhase("CALCULATING");

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });

        // Calculate benchmark-specific score with accuracy penalty
        const rawAccuracy = (hits + misses) > 0 ? hits / (hits + misses) : 0;
        const penaltyMultiplier = rawAccuracy < ACCURACY_THRESHOLD ? Math.pow(rawAccuracy / ACCURACY_THRESHOLD, 2) : 1;
        const benchmarkScore = Math.round((hits * 1000) * penaltyMultiplier);

        const resultData = buildGameResult({
            mode: "flick-benchmark",
            difficulty: difficultyLabels[difficulty],
            score: benchmarkScore,
            hits, misses,
            duration: BENCHMARK_DURATION,
            reactionTimes,
            totalTargetsSpawned,
            missedByTimeout,
            extraStats: {
                "Raw Accuracy": `${(rawAccuracy * 100).toFixed(1)}%`,
                "Penalty": penaltyMultiplier < 1 ? `${((1 - penaltyMultiplier) * 100).toFixed(0)}%` : "None"
            },
        });

        updateStatsWithResult({ ...resultData, isBenchmark: true });
        setResult(resultData);
        setIsFinished(true);
    }, [hits, misses, difficulty, reactionTimes, totalTargetsSpawned, missedByTimeout]);

    // Countdown Logic
    useEffect(() => {
        if (phase !== "COUNTDOWN") return;
        if (countdown === 0) {
            setPhase("ACTIVE");
            spawnTarget();
            return;
        }
        const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => window.clearTimeout(t);
    }, [phase, countdown, spawnTarget]);

    // Timer Logic
    useEffect(() => {
        if (phase !== "ACTIVE") return;
        const t = window.setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
        return () => window.clearInterval(t);
    }, [phase]);

    useEffect(() => {
        if (phase === "ACTIVE" && timeLeft === 0) endSession();
    }, [timeLeft, phase, endSession]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (phase !== "ACTIVE" || !target || activeTargetId.current !== target.id) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x, y } = getScaledCanvasCoordinates(e, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            activeTargetId.current = null; // Invalidate immediately
            setHits(p => p + 1);
            setReactionTimes(p => [...p, performance.now() - target.spawnedAt]);
            spawnTarget();
        } else {
            setMisses(p => p + 1);
        }
    };

    // Render logic (Canvas)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !target) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

        const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, target.radius);
        gradient.addColorStop(0, "#FFCCE8");
        gradient.addColorStop(1, "#ec4899");
        ctx.beginPath();
        ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.shadowColor = "#ec4899";
        ctx.shadowBlur = 15;
        ctx.fill();
    }, [target]);

    return (
        <div ref={containerRef} className="relative w-full h-screen bg-[#121212] overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={() => window.location.reload()} onBackToMenu={() => window.location.href = '/game'} />
                </div>
            )}

            {phase === "PRE_MENU" && (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center p-12 border border-white/10 bg-gray-900/50 rounded-3xl backdrop-blur-xl">
                        <p className="text-[#ec4899] text-sm font-bold tracking-widest uppercase mb-2">Protocol: Benchmark</p>
                        <h2 className="text-5xl font-black text-white mb-8">Flick Benchmark</h2>
                        <button onClick={handleInitialize} className="px-12 py-5 bg-[#ec4899] text-white font-black rounded-xl hover:scale-105 transition-all uppercase tracking-widest">
                            Initialize Sequence
                        </button>
                    </div>
                </div>
            )}

            {phase === "COUNTDOWN" && (
                <div className="flex items-center justify-center h-full">
                    <span className="text-[15rem] font-black text-white animate-pulse">{countdown}</span>
                </div>
            )}

            {phase === "ACTIVE" && (
                <div className="h-full flex flex-col">
                    <SessionHUD data={{ mode: "Benchmark", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes) }} />
                    <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onClick={handleCanvasClick} className="flex-1 cursor-crosshair bg-[#0d1117]" />
                </div>
            )}
        </div>
    );
}