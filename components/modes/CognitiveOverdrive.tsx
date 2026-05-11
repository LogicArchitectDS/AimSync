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

interface Distractor {
    id: string;
    baseX: number;
    baseY: number;
    radius: number;
    phase: number;
    speed: number;
    amplitude: number;
    axis: 'x' | 'y';
}

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface CognitiveOverdriveProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function CognitiveOverdrive({ overrideSettings, onFinish }: CognitiveOverdriveProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const animationRef = useRef<number | null>(null);
    const sessionIdxRef = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const lastHitTargetIdRef = useRef<string | null>(null);

    const dimensionsRef = useRef({ width: 1600, height: 900 });
    const [renderDimensions, setRenderDimensions] = useState({ width: 1600, height: 900 });

    const { isTrial } = useAuth();

    const [difficulty, setDifficulty] = useState<Difficulty>(overrideSettings?.difficulty ?? "medium");
    const [durationSeconds, setDurationSeconds] = useState<number>(overrideSettings?.duration ?? 30);
    
    // We use the state directly now, it will be initialized from overrideSettings if present.
    // If overrideSettings changes externally (unlikely), we might want a useEffect, 
    // but for this app's architecture, this is cleaner.

    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(30);
    const [countdown, setCountdown] = useState<number | null>(null);

    const [target, setTarget] = useState<BaseTarget | null>(null);
    const targetRef = useRef<BaseTarget | null>(null);
    
    const [distractors, setDistractors] = useState<Distractor[]>([]);
    const distractorsRef = useRef<Distractor[]>([]);

    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [combo, setCombo] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);

    const config = difficultyConfig[difficulty];

    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    // Keep refs in sync for animation loop
    useEffect(() => {
        targetRef.current = target;
    }, [target]);

    useEffect(() => {
        distractorsRef.current = distractors;
    }, [distractors]);

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
        const radius = getScaledRadius(config.targetRadius, difficulty, elapsedSec, durationSeconds);
        const nextTarget = createStaticTarget(dimensionsRef.current.width, dimensionsRef.current.height, radius);
        
        setTarget(nextTarget);
        
        // Spawn Distractors
        const numDistractors = Math.floor(Math.random() * 2) + 1; // 1 to 2 distractors
        const newDistractors: Distractor[] = [];
        for (let i = 0; i < numDistractors; i++) {
            newDistractors.push({
                id: Math.random().toString(),
                baseX: nextTarget.x,
                baseY: nextTarget.y,
                radius: radius * 1.1, // slightly larger
                phase: Math.random() * Math.PI * 2,
                speed: 3 + Math.random() * 4,
                amplitude: radius * (1.5 + Math.random() * 2),
                axis: Math.random() > 0.5 ? 'x' : 'y'
            });
        }
        setDistractors(newDistractors);

        setTotalTargetsSpawned((prev) => prev + 1);

        timeoutRef.current = window.setTimeout(() => {
            if (sessionIdxRef.current !== currentSession) return;
            
            setMisses((prev) => prev + 1);
            setMissedByTimeout((prev) => prev + 1);
            setCombo(0);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnTarget();
        }, config.targetLifetimeMs * 1.5); // Give slightly more time because of distractors
    };

    const resetState = () => {
        sessionIdxRef.current++;
        clearTargetTimeout();
        setGameStarted(false);
        setIsFinished(false);
        setTimeLeft(durationSeconds);
        setCountdown(null);
        setTarget(null);
        setDistractors([]);
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
        setDistractors([]);

        const resultData = buildGameResult({
            mode: "Cognitive Overdrive",
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
            spawnTarget();
            return;
        }
        const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
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
    }, [timeLeft, gameStarted, isFinished, countdown]);

    useEffect(() => {
        return () => clearTargetTimeout();
    }, []);

    // --- RENDER ENGINE ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const render = () => {
            ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
            const time = performance.now() / 1000;

            const currentTarget = targetRef.current;
            const currentDistractors = distractorsRef.current;

            // Draw Hostile Target (Bottom Layer)
            if (currentTarget) {
                const gradient = ctx.createRadialGradient(
                    currentTarget.x - currentTarget.radius * 0.3, currentTarget.y - currentTarget.radius * 0.3, currentTarget.radius * 0.1,
                    currentTarget.x, currentTarget.y, currentTarget.radius
                );
                gradient.addColorStop(0, "#FFAAAA");
                gradient.addColorStop(0.3, "#EF4444");
                gradient.addColorStop(1, "#660000");

                ctx.beginPath();
                ctx.arc(currentTarget.x, currentTarget.y, currentTarget.radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.shadowColor = "rgba(220,38,38,0.6)";
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
            }

            // Draw Civilian Distractors (Top Layer - blocking line of sight)
            currentDistractors.forEach(d => {
                const currentX = d.baseX + (d.axis === 'x' ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
                const currentY = d.baseY + (d.axis === 'y' ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);

                const pulse = Math.sin(time * 10) * 0.1 + 1.1; 

                ctx.beginPath();
                ctx.arc(currentX, currentY, d.radius * pulse, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(50, 150, 255, 0.5)";
                ctx.lineWidth = 2;
                ctx.stroke();

                const grad = ctx.createRadialGradient(
                    currentX - d.radius * 0.3, currentY - d.radius * 0.3, d.radius * 0.1,
                    currentX, currentY, d.radius
                );
                grad.addColorStop(0, "#66b2ff"); 
                grad.addColorStop(1, "#004c99"); 

                ctx.beginPath();
                ctx.arc(currentX, currentY, d.radius, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                // Draw "X" DO NOT SHOOT marker
                ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(currentX - d.radius * 0.4, currentY - d.radius * 0.4);
                ctx.lineTo(currentX + d.radius * 0.4, currentY + d.radius * 0.4);
                ctx.moveTo(currentX + d.radius * 0.4, currentY - d.radius * 0.4);
                ctx.lineTo(currentX - d.radius * 0.4, currentY + d.radius * 0.4);
                ctx.stroke();
            });

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [renderDimensions]);

    const isCountingDown = countdown !== null && countdown > 0;

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || isCountingDown) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);
        const time = performance.now() / 1000;

        // Check hits from top layer (distractors) to bottom layer (hostile)
        let hitDistractor: Distractor | null = null;
        for (const d of distractors) {
            const currentX = d.baseX + (d.axis === 'x' ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
            const currentY = d.baseY + (d.axis === 'y' ? Math.sin(time * d.speed + d.phase) * d.amplitude : 0);
            if (isPointInsideTarget(x, y, currentX, currentY, d.radius)) {
                hitDistractor = d;
                break;
            }
        }

        if (hitDistractor) {
            // Hit Civilian -> Penalty
            setScore((prev) => Math.max(0, prev - config.missPenalty * 2));
            setCombo(0); // SHATTER COMBO
            setDistractors(prev => prev.filter(d => d.id !== hitDistractor!.id)); // remove it
            return;
        }

        // Check Hostile Target
        if (target && isPointInsideTarget(x, y, target.x, target.y, target.radius)) {
            if (target.id === lastHitTargetIdRef.current) return;
            lastHitTargetIdRef.current = target.id;

            const reaction = performance.now() - target.spawnedAt;
            const nextCombo = combo + 1;
            setHits((prev) => prev + 1);
            setCombo(nextCombo);
            setScore((prev) => prev + config.scorePerHit + (nextCombo * 5)); 
            setReactionTimes((prev) => [...prev, reaction]);
            spawnHitmarker(event.clientX, event.clientY);
            spawnTarget();
            return;
        }

        // Miss entirely
        setMisses((prev) => prev + 1);
        setCombo(0);
        setScore((prev) => Math.max(0, prev - config.missPenalty));
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden">

            {isFinished && result && (
                <div className="absolute inset-0 z-[100]">
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[#3366FF] text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase text-white">Cognitive Overdrive</h2>
                                <p className="text-gray-400 mt-2">Target Discrimination: Shoot the red hostile targets. Avoid the blue civilian targets blocking your line of sight.</p>
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
                                        {!overrideSettings && (
                                            <option value={45}>45s (Extended)</option>
                                        )}
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

            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD
                            data={{
                                mode: "Cognitive Overdrive",
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
