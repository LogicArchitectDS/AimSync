"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { updateStatsWithResult } from "@/lib/utils/statsStorage";

import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";

export default function StaticFlick() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);

    // Dynamic Resolution Engine
    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const [difficulty, setDifficulty] = useState<Difficulty>("medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(30);
    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(30);

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);

    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[difficulty];

    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    const clearTargetTimeout = () => {
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const spawnTarget = () => {
        clearTargetTimeout();
        const nextTarget = createStaticTarget(dimensionsRef.current.width, dimensionsRef.current.height, config.targetRadius);
        setTarget(nextTarget);
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            setMisses((prev) => prev + 1);
            setMissedByTimeout((prev) => prev + 1);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnTarget();
        }, config.targetLifetimeMs);
    };

    const resetState = () => {
        clearTargetTimeout();
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(durationSeconds);
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
        window.setTimeout(() => spawnTarget(), 0);
    };

    const endSession = async () => {
        clearTargetTimeout();
        setGameStarted(false);
        setTarget(null);

        const resultData = buildGameResult({
            mode: "Static Flick",
            difficulty: difficultyLabels[difficulty],
            score,
            hits,
            misses,
            duration: durationSeconds,
            reactionTimes,
            totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Timeout Misses": missedByTimeout },
        });

        setResult(resultData);
        updateStatsWithResult(resultData);
        setIsFinished(true);

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => { });
        }
    };

    // --- DYNAMIC RESOLUTION OBSERVER ---
    useEffect(() => {
        if (!gameStarted) return;
        const updateSize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                const { clientWidth, clientHeight } = canvasRef.current.parentElement;
                dimensionsRef.current = { width: clientWidth, height: clientHeight };
                setRenderDimensions({ width: clientWidth, height: clientHeight });
            }
        };
        window.addEventListener("resize", updateSize);
        updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [gameStarted]);

    // --- TIMERS ---
    useEffect(() => {
        setTimeLeft(durationSeconds);
    }, [durationSeconds]);

    useEffect(() => {
        if (!gameStarted) return;
        const timer = window.setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished) {
            endSession();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameStarted, isFinished]);

    useEffect(() => {
        return () => clearTargetTimeout();
    }, []);

    // --- 3D ENGINE RENDERING ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 1. Clear canvas completely to let the CSS 3D floor show through
        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

        if (target) {
            // 2. 3D Sphere Shader for Static Targets
            const gradient = ctx.createRadialGradient(
                target.x - target.radius * 0.3, target.y - target.radius * 0.3, target.radius * 0.1,
                target.x, target.y, target.radius
            );

            // Aggressive Red for Combat Targets
            gradient.addColorStop(0, "#FFAAAA");
            gradient.addColorStop(0.3, "#EF4444");
            gradient.addColorStop(1, "#660000");

            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;

            // Dynamic drop shadow simulating light casting downwards onto the floor
            ctx.shadowColor = "rgba(0,0,0,0.6)";
            ctx.shadowBlur = 25;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 20;
            ctx.fill();

            // Reset shadows to prevent compounding
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
    }, [target, renderDimensions]);

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || !target) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            const reaction = performance.now() - target.spawnedAt;
            setHits((prev) => prev + 1);
            setScore((prev) => prev + config.scorePerHit);
            setReactionTimes((prev) => [...prev, reaction]);
            spawnTarget();
            return;
        }

        setMisses((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - config.missPenalty));
        spawnTarget();
    };

    if (isFinished && result) {
        return <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />;
    }

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

            {/* --- PRE-GAME MENU --- */}
            {!gameStarted && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase">AimForge Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Static Flick</h2>
                            </div>

                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
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
                                    <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                        <option value={15}>15s (Warmup)</option>
                                        <option value={30}>30s (Standard)</option>
                                        <option value={60}>60s (Endurance)</option>
                                    </select>
                                </label>
                            </div>

                            <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-[#3366FF] hover:text-white transition-all">
                                INITIALIZE SEQUENCE
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* --- ACTIVE GAME ENVIRONMENT --- */}
            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">

                    {/* THE SEAMLESS INFINITE 3D GRID ENVIRONMENT */}
                    <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]">
                        </div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none"></div>
                    </div>

                    <div className="relative z-10 flex-1 w-full overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            width={renderDimensions.width}
                            height={renderDimensions.height}
                            onClick={handleCanvasClick}
                            className="absolute inset-0 block cursor-crosshair"
                        />
                    </div>

                    <div className="relative z-20 shrink-0 w-full bg-[#050505] border-t border-white/10">
                        <SessionHUD
                            data={{
                                mode: "Static Flick",
                                difficulty: difficultyLabels[difficulty],
                                timeLeft,
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
                </div>
            )}
        </div>
    );
}