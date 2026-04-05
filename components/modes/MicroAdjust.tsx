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
import { createMicroAdjustTarget } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface MicroAdjustProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function MicroAdjust({ overrideSettings, onFinish }: MicroAdjustProps = {}) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    // BUG FIX: Atomic ID tracking for high-precision clicks
    const activeTargetId = useRef<string | null>(null);
    const targetRef = useRef<BaseTarget | null>(null);
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

    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[effectiveDifficulty];
    const microRadius = Math.max(10, Math.round(config.targetRadius * 0.65));

    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);

    const clearEngineTimers = useCallback(() => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    }, []);

    const spawnTarget = useCallback(() => {
        clearEngineTimers();

        const currentX = targetRef.current?.x;
        const currentY = targetRef.current?.y;

        const nextTarget = createMicroAdjustTarget(
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            microRadius,
            currentX,
            currentY
        );

        const newId = nextTarget.id;
        activeTargetId.current = newId;

        targetRef.current = nextTarget;
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            if (activeTargetId.current === newId) {
                setMisses((prev) => prev + 1);
                setMissedByTimeout((prev) => prev + 1);
                setScore((prev) => Math.max(0, prev - config.missPenalty));
                spawnTarget();
            }
        }, config.targetLifetimeMs);
    }, [config, microRadius, clearEngineTimers]);

    const resetState = () => {
        clearEngineTimers();
        activeTargetId.current = null;
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(effectiveDuration);
        setCountdown(null);
        targetRef.current = null;
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
        startRenderLoop();
        setCountdown(3);
    };

    const endSession = async () => {
        clearEngineTimers();
        activeTargetId.current = null;
        setGameStarted(false);
        targetRef.current = null;

        const resultData = buildGameResult({
            mode: "Micro Adjust",
            difficulty: difficultyLabels[effectiveDifficulty],
            score, hits, misses,
            duration: effectiveDuration,
            reactionTimes, totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Micro Radius": microRadius, "Timeout Misses": missedByTimeout },
        });

        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) onFinish(resultData);
        else { setResult(resultData); setIsFinished(true); }
    };

    const startRenderLoop = () => {
        const tick = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
                const t = targetRef.current;
                if (t) {
                    const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.radius);
                    gradient.addColorStop(0, "#FFFFFF");
                    gradient.addColorStop(0.3, "#A855F7");
                    gradient.addColorStop(1, "#4C1D95");
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                    ctx.fillStyle = gradient;
                    ctx.shadowColor = "rgba(168, 85, 247, 0.4)";
                    ctx.shadowBlur = 20;
                    ctx.fill();
                }
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        if (countdown === 0) { setCountdown(null); spawnTarget(); }
        else if (countdown !== null) {
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

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || !targetRef.current || (countdown !== null && countdown > 0)) return;

        if (targetRef.current.id !== activeTargetId.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, targetRef.current.x, targetRef.current.y, targetRef.current.radius)) {
            activeTargetId.current = null;
            setHits((prev) => prev + 1);
            setReactionTimes((prev) => [...prev, performance.now() - targetRef.current!.spawnedAt]);
            setScore((prev) => prev + config.scorePerHit);
            spawnTarget();
        } else {
            setMisses((prev) => prev + 1);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <div className="space-y-2">
                            <p className="text-[#A855F7] text-sm font-bold tracking-[0.3em] uppercase">AimSync Protocol</p>
                            <h2 className="text-5xl font-black tracking-widest uppercase">Micro Adjust</h2>
                        </div>
                        <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#A855F7] hover:text-white transition-all uppercase">
                            Initialize Sequence
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "Micro Adjust", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime: calculateAverageReactionTime(reactionTimes), bestReactionTime: calculateBestReactionTime(reactionTimes) }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden bg-[#2f3b4c]">
                        <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onMouseDown={handleCanvasMouseDown} className="absolute inset-0 block cursor-crosshair" />
                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-[12rem] font-black text-[#A855F7] animate-ping">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}