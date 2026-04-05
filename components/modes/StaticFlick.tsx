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

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface StaticFlickProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function StaticFlick({ overrideSettings, onFinish }: StaticFlickProps = {}) {
    const { user } = useAuth(); // Ensure telemetry is tied to current agent
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);

    // BUG FIX: Atomic ID tracking prevents race conditions in target spawning
    const activeTargetId = useRef<string | null>(null);
    const dimensionsRef = useRef({ width: 1600, height: 900 });

    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });
    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(overrideSettings?.duration ?? 30);

    const effectiveDifficulty = overrideSettings?.difficulty ?? difficulty;
    const effectiveDuration = overrideSettings?.duration ?? durationSeconds;

    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [countdown, setCountdown] = useState<number | null>(null);

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);

    const clearTargetTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const spawnTarget = useCallback(() => {
        clearTargetTimeout();

        // BUG FIX: Generate unique ID and lock the ref to prevent double-spawns
        const newId = crypto.randomUUID();
        activeTargetId.current = newId;

        const nextTarget = createStaticTarget(dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);
        setTarget({ ...nextTarget, id: newId });
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            // Only process timeout if this is still the active target
            if (activeTargetId.current === newId) {
                setMisses((prev) => prev + 1);
                setMissedByTimeout((prev) => prev + 1);
                setScore((prev) => Math.max(0, prev - config.missPenalty));
                spawnTarget();
            }
        }, config.targetLifetimeMs);
    }, [config, clearTargetTimeout]);

    const resetState = () => {
        clearTargetTimeout();
        activeTargetId.current = null;
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(effectiveDuration);
        setCountdown(null);
        setTarget(null);
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
            await containerRef.current.requestFullscreen().catch(() => { });
        }
        setCountdown(3);
    };

    const endSession = useCallback(async () => {
        clearTargetTimeout();
        activeTargetId.current = null;
        setGameStarted(false);
        setTarget(null);

        const resultData = buildGameResult({
            mode: "Static Flick",
            difficulty: difficultyLabels[effectiveDifficulty],
            score, hits, misses,
            duration: effectiveDuration,
            reactionTimes, totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Timeout Misses": missedByTimeout },
        });

        // SECURE PERSISTENCE: Data pushed to Firestore under user UID
        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) onFinish(resultData);
        else { setResult(resultData); setIsFinished(true); }
    }, [hits, misses, score, effectiveDifficulty, effectiveDuration, reactionTimes, totalTargetsSpawned, missedByTimeout, onFinish, clearTargetTimeout]);

    useEffect(() => {
        if (countdown === 0) { setCountdown(null); spawnTarget(); }
        else if (countdown !== null) {
            const timer = window.setTimeout(() => setCountdown(c => c! - 1), 1000);
            return () => window.clearTimeout(timer);
        }
    }, [countdown, spawnTarget]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished) endSession();
    }, [timeLeft, gameStarted, isFinished, endSession]);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || !target || (countdown !== null && countdown > 0)) return;

        // BUG FIX: Ignore click if target ID doesn't match active ref
        if (target.id !== activeTargetId.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            activeTargetId.current = null; // Lock spawning immediately
            setHits((prev) => prev + 1);
            setScore((prev) => prev + config.scorePerHit);
            setReactionTimes((prev) => [...prev, performance.now() - target.spawnedAt]);
            spawnTarget();
        } else {
            setMisses((prev) => prev + 1);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
        }
    };

    // Canvas Render Engine
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
        if (target) {
            const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, target.radius);
            gradient.addColorStop(0, "#FFAAAA");
            gradient.addColorStop(0.3, "#EF4444");
            gradient.addColorStop(1, "#660000");
            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
            ctx.shadowBlur = 20;
            ctx.fill();
        }
    }, [target, renderDimensions]);

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase mb-2">AimSync Protocol</p>
                        <h2 className="text-5xl font-black tracking-widest uppercase">Static Flick</h2>
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all uppercase">
                            Initialize Sequence
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="relative flex-1 w-full overflow-hidden bg-[#2f3b4c]">
                    <SessionHUD data={{ mode: "Static Flick", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy: calculateAccuracy(hits, misses), averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes) }} />
                    <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onClick={handleCanvasClick} className="absolute inset-0 block cursor-crosshair" />
                    {countdown !== null && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[12rem] font-black text-[#3366FF] animate-ping">{countdown}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}