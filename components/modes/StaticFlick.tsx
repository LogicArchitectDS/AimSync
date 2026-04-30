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
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import { useAuth } from "@/lib/contexts/AuthContext";
import ComboMeter from "@/components/ComboMeter";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface StaticFlickProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function StaticFlick({ overrideSettings, onFinish }: StaticFlickProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef        = useRef<number | null>(null);
    const sessionIdxRef     = useRef(0);
    const sessionStartRef   = useRef<number>(0);
    const lastHitTargetIdRef = useRef<string | null>(null);

    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const { isTrial } = useAuth();

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
    const [combo, setCombo] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[effectiveDifficulty];

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
        // The session index acts as a global kill-switch for all callbacks
        const currentSession = sessionIdxRef.current;
        const myId = Date.now() + Math.random(); // Unique ID for this specific target lifecycle
        
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, effectiveDuration);
        const nextTarget = createStaticTarget(dimensionsRef.current.width, dimensionsRef.current.height, radius);
        
        setTarget(nextTarget);
        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            // Guard: If session changed or another target took over, abort
            if (sessionIdxRef.current !== currentSession) return;
            
            setMisses((prev) => prev + 1);
            setMissedByTimeout((prev) => prev + 1);
            setCombo(0);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnTarget();
        }, config.targetLifetimeMs);
    };

    const resetState = () => {
        sessionIdxRef.current++; // Invalidate all pending timeouts immediately
        clearTargetTimeout();
        setGameStarted(false);
        // ... rest of resetState ...
        setIsFinished(false);
        setTimeLeft(durationSeconds);
        setCountdown(null);
        setTarget(null);
        setScore(0);
        setHits(0);
        setMisses(0);
        setCombo(0);
        setReactionTimes([]);
        setTotalTargetsSpawned(0);
        setMissedByTimeout(0);
        setResult(null);
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        sessionStartRef.current = performance.now();
        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }
        setCountdown(3);
    };

    const endSession = async () => {
        clearTargetTimeout();
        setGameStarted(false);
        setTarget(null);

        const resultData = buildGameResult({
            mode: "Static Flick",
            difficulty: difficultyLabels[effectiveDifficulty],
            score,
            hits,
            misses,
            duration: effectiveDuration,
            reactionTimes,
            totalTargetsSpawned,
            missedByTimeout,
            extraStats: { "Timeout Misses": missedByTimeout },
        });

        updateStatsWithResult(resultData);

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => { });
        }

        if (onFinish) {
            onFinish(resultData);
        } else {
            setResult(resultData);
            setIsFinished(true);
        }
    };

    // --- COUNTDOWN EFFECT ---
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            // Ensure we only spawn if we haven't already started a session
            spawnTarget();
            return;
        }
        const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown]);

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

    useEffect(() => { setTimeLeft(durationSeconds); }, [durationSeconds]);

    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);

    useEffect(() => {
        if (gameStarted && timeLeft === 0 && !isFinished && countdown === null) endSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameStarted, isFinished, countdown]);

    useEffect(() => {
        return () => clearTargetTimeout();
    }, []);

    // --- 3D ENGINE RENDERING ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

        if (target) {
            const gradient = ctx.createRadialGradient(
                target.x - target.radius * 0.3, target.y - target.radius * 0.3, target.radius * 0.1,
                target.x, target.y, target.radius
            );
            gradient.addColorStop(0, "#FFAAAA");
            gradient.addColorStop(0.3, "#EF4444");
            gradient.addColorStop(1, "#660000");

            ctx.beginPath();
            ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
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
    }, [target, renderDimensions]);

    const isCountingDown = countdown !== null && countdown > 0;

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || !target || isCountingDown) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);

        if (isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            if (target.id === lastHitTargetIdRef.current) return;
            lastHitTargetIdRef.current = target.id;

            const reaction = performance.now() - target.spawnedAt;
            const nextCombo = combo + 1;
            setHits((prev) => prev + 1);
            setCombo(nextCombo);
            setScore((prev) => prev + config.scorePerHit + (nextCombo * 5)); // Reward combo
            setReactionTimes((prev) => [...prev, reaction]);
            spawnHitmarker(event.clientX, event.clientY);
            spawnTarget();
            return;
        }

        setMisses((prev) => prev + 1);
        setCombo(0);
        setScore((prev) => Math.max(0, prev - config.missPenalty));
        spawnTarget();
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

            {/* --- RESULTS SCREEN --- */}
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {/* --- PRE-GAME MENU --- */}
            {!gameStarted && !isFinished && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Static Flick</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([key, label]) => {
                                            const isLocked = isTrial && key !== "eco" && key !== "bonus";
                                            return (
                                                <option key={key} value={key} disabled={isLocked}>
                                                    {label.toUpperCase()}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                                <label className="flex flex-col text-left flex-1">
                                    <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-[#3366FF] outline-none transition-all cursor-pointer">
                                        {!overrideSettings && (
                                            <option value={15} disabled={isTrial}>15s (Warmup)</option>
                                        )}
                                        <option value={30}>30s (Standard)</option>
                                        <option value={60} disabled={isTrial}>60s (Endurance)</option>
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

                    {/* TOP HUD */}
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
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

                    {/* 3D ARENA */}
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none"></div>
                        </div>

                        <div className="relative z-10 w-full h-full">
                            <canvas
                                ref={canvasRef}
                                width={renderDimensions.width}
                                height={renderDimensions.height}
                                onClick={handleCanvasClick}
                                className="absolute inset-0 block cursor-crosshair"
                            />
                            
                            <ComboMeter combo={combo} />
                        </div>

                        {/* COUNTDOWN OVERLAY */}
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span key={countdown} className="text-[12rem] font-black text-[#3366FF] animate-ping leading-none select-none drop-shadow-[0_0_60px_#3366FF]">
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