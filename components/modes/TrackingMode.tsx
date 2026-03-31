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

type TrueTrackingTarget = MovingTarget & { health: number; isBeingTracked: boolean };

export default function TrackingMode() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const targetRef = useRef<TrueTrackingTarget | null>(null);
    const mouseRef = useRef({ isFiring: false, x: 0, y: 0 });

    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const [difficulty, setDifficulty] = useState<Difficulty>("medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(30);
    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(30);

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
                const nextTarget = updateTrackingTargetPosition(targetRef.current, dimensionsRef.current.width, dimensionsRef.current.height);

                const { isFiring, x, y } = mouseRef.current;
                const isHit = isFiring && isPointInsideTarget(x, y, nextTarget.x, nextTarget.y, nextTarget.radius);

                let newHealth = targetRef.current.health;
                if (isHit) {
                    newHealth -= (deltaTime * 0.25);
                }

                if (newHealth <= 0) {
                    targetRef.current = null;
                    setHits(h => h + 1);
                    setScore(s => s + config.scorePerHit + 50);
                    spawnTarget();
                    return;
                }

                targetRef.current = {
                    ...nextTarget,
                    health: newHealth,
                    isBeingTracked: isHit
                } as TrueTrackingTarget;

                // 1. CLEAR CANVAS (Keep Transparent)
                ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

                const t = targetRef.current;

                // 2. 3D SPHERE SHADER
                const gradient = ctx.createRadialGradient(
                    t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1,
                    t.x, t.y, t.radius
                );

                if (t.isBeingTracked) {
                    gradient.addColorStop(0, "#FFFFFF");
                    gradient.addColorStop(0.3, "#00E5FF");
                    gradient.addColorStop(1, "#005566");
                } else {
                    gradient.addColorStop(0, "#FFAAAA");
                    gradient.addColorStop(0.3, "#EF4444");
                    gradient.addColorStop(1, "#660000");
                }

                ctx.beginPath();
                ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;

                // Dynamic drop shadow simulating light casting downwards
                ctx.shadowColor = "rgba(0,0,0,0.6)";
                ctx.shadowBlur = 25;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 20;
                ctx.fill();

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
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
            difficulty,
            dimensionsRef.current.width,
            dimensionsRef.current.height,
            config.targetRadius
        );

        targetRef.current = {
            ...baseTarget,
            health: 100,
            isBeingTracked: false
        };

        setTotalTargetsSpawned((prev) => prev + 1);
        startTrackingLoop();

        timeoutRef.current = window.setTimeout(() => {
            setMisses((prev) => prev + 1);
            setMissedByTimeout((prev) => prev + 1);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnTarget();
        }, config.targetLifetimeMs + 1000);
    };

    const resetState = () => {
        clearAnimation();
        clearTargetTimeout();
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(durationSeconds);
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
        window.setTimeout(() => spawnTarget(), 0);
    };

    const endSession = async () => {
        clearAnimation();
        clearTargetTimeout();
        setGameStarted(false);
        targetRef.current = null;

        const resultData = buildGameResult({
            mode: "Tracking Protocol",
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

    useEffect(() => setTimeLeft(durationSeconds), [durationSeconds]);

    useEffect(() => {
        if (!gameStarted) return;
        const timer = window.setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished) endSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameStarted, isFinished]);

    useEffect(() => {
        return () => {
            clearAnimation();
            clearTargetTimeout();
        };
    }, []);

    const updateMousePosition = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvasRef.current, dimensionsRef.current.width, dimensionsRef.current.height);
        mouseRef.current.x = x;
        mouseRef.current.y = y;
    };

    if (isFinished && result) {
        return <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />;
    }

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-slate-900 text-white overflow-hidden">

            {/* --- PRE-GAME MENU --- */}
            {!gameStarted && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-black/60 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-cyan text-sm font-bold tracking-[0.3em] uppercase">AimForge Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">Continuous Tracking</h2>
                            </div>

                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-cyan outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-cyan outline-none transition-all cursor-pointer">
                                        <option value={15}>15s (Warmup)</option>
                                        <option value={30}>30s (Standard)</option>
                                        <option value={60}>60s (Endurance)</option>
                                    </select>
                                </label>
                            </div>

                            <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-black text-lg font-black tracking-[0.2em] rounded-xl hover:bg-cyan hover:text-background transition-all">
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
                        {/* Single Continuous 3D Plane */}
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]">
                        </div>

                        {/* Heavy Vignette to hide edges and create depth without a hard horizon line */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none"></div>
                    </div>

                    <div className="relative z-10 flex-1 w-full overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            width={renderDimensions.width}
                            height={renderDimensions.height}
                            onMouseDown={(e) => { mouseRef.current.isFiring = true; updateMousePosition(e); }}
                            onMouseUp={() => { mouseRef.current.isFiring = false; }}
                            onMouseMove={updateMousePosition}
                            onMouseLeave={() => { mouseRef.current.isFiring = false; }}
                            className="absolute inset-0 block cursor-crosshair"
                        />
                    </div>

                    <div className="relative z-20 shrink-0 w-full bg-[#050505] border-t border-white/10">
                        <SessionHUD
                            data={{
                                mode: "Tracking Protocol",
                                difficulty: difficultyLabels[difficulty],
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
                </div>
            )}
        </div>
    );
}