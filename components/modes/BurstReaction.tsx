"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BaseTarget, GameResult } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime, getScaledCanvasCoordinates, isPointInsideTarget } from "@/lib/utils/gameMath";
import { createBurstTarget, getBurstSize } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import ComboMeter from "@/components/ComboMeter";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface BurstReactionProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function BurstReaction({ overrideSettings, onFinish }: BurstReactionProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const sessionIdxRef = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const targetsRef = useRef<BaseTarget[]>([]);
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
    const [combo, setCombo] = useState(0);
    const [score, setScore] = useState(0);
    const [hits, setHits] = useState(0);
    const [misses, setMisses] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [totalTargetsSpawned, setTotalTargetsSpawned] = useState(0);
    const [missedByTimeout, setMissedByTimeout] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);
    const config = difficultyConfig[effectiveDifficulty];
    const accuracy = useMemo(() => calculateAccuracy(hits, misses), [hits, misses]);
    const averageReactionTime = useMemo(() => calculateAverageReactionTime(reactionTimes), [reactionTimes]);
    const bestReactionTime = useMemo(() => calculateBestReactionTime(reactionTimes), [reactionTimes]);

    const clearEngineTimers = () => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };

    const startRenderLoop = () => {
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        const tick = () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
                ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
                for (const t of targetsRef.current) {
                    const gradient = ctx.createRadialGradient(t.x - t.radius * 0.3, t.y - t.radius * 0.3, t.radius * 0.1, t.x, t.y, t.radius);
                    gradient.addColorStop(0, "#FFFFFF"); gradient.addColorStop(0.3, "#F97316"); gradient.addColorStop(1, "#7C2D12");
                    ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.fillStyle = gradient;
                    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 25; ctx.shadowOffsetY = 20; ctx.fill();
                    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                }
            }
            animationFrameRef.current = requestAnimationFrame(tick);
        };
        animationFrameRef.current = requestAnimationFrame(tick);
    };

    const spawnCluster = () => {
        if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
        const currentSession = sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, effectiveDuration);
        
        const clusterSize = getBurstSize(difficulty) || 3;
        const newCluster: BaseTarget[] = [];
        for (let i = 0; i < clusterSize; i++) {
            let next = createBurstTarget(dimensionsRef.current.width, dimensionsRef.current.height, radius);
            let attempts = 0;
            while (newCluster.some((t) => Math.hypot(t.x - next.x, t.y - next.y) < radius * 2.5) && attempts < 15) {
                next = createBurstTarget(dimensionsRef.current.width, dimensionsRef.current.height, radius);
                attempts++;
            }
            newCluster.push(next);
        }
        targetsRef.current = newCluster;
        setTotalTargetsSpawned((prev) => prev + clusterSize);
        const clusterLifetime = Math.max(800, config.targetLifetimeMs * 1.5);
        
        timeoutRef.current = window.setTimeout(() => {
            if (sessionIdxRef.current !== currentSession) return;
            const remaining = targetsRef.current.length;
            if (remaining > 0) { 
                setMisses((p) => p + remaining); 
                setMissedByTimeout((p) => p + remaining); 
                setCombo(0); 
                setScore((p) => Math.max(0, p - config.missPenalty * remaining)); 
            }
            targetsRef.current = [];
            
            window.setTimeout(() => {
                if (sessionIdxRef.current !== currentSession) return;
                spawnCluster();
            }, 320);
        }, clusterLifetime);
    };

    const resetState = () => {
        sessionIdxRef.current++;
        clearEngineTimers();
        setGameStarted(false); setIsFinished(false); setTimeLeft(effectiveDuration); setCountdown(null);
        targetsRef.current = []; setCombo(0); setScore(0); setHits(0); setMisses(0);
        setReactionTimes([]); setTotalTargetsSpawned(0); setMissedByTimeout(0); setResult(null);
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        if (containerRef.current && !document.fullscreenElement) await containerRef.current.requestFullscreen().catch(() => { });
        startRenderLoop();
        setCountdown(3);
    };

    const endSession = async () => {
        clearEngineTimers();
        setGameStarted(false);
        targetsRef.current = [];
        const resultData = buildGameResult({ mode: "Burst Reaction", difficulty: difficultyLabels[effectiveDifficulty], score, hits, misses, duration: effectiveDuration, reactionTimes, totalTargetsSpawned, missedByTimeout, extraStats: { "Max Combo": combo, "Timeout Misses": missedByTimeout } });
        updateStatsWithResult(resultData);
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
        if (onFinish) { onFinish(resultData); } else { setResult(resultData); setIsFinished(true); }
    };

    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) { 
            setCountdown(null); 
            sessionStartRef.current = performance.now();
            spawnCluster(); 
            return; 
        }
        const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown]);

    useEffect(() => {
        if (!gameStarted) return;
        const updateSize = () => { if (canvasRef.current?.parentElement) { const { clientWidth, clientHeight } = canvasRef.current.parentElement; dimensionsRef.current = { width: clientWidth, height: clientHeight }; setRenderDimensions({ width: clientWidth, height: clientHeight }); } };
        window.addEventListener("resize", updateSize); updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, [gameStarted]);

    useEffect(() => { setTimeLeft(durationSeconds); }, [durationSeconds]);
    useEffect(() => {
        if (!gameStarted || countdown !== null) return;
        const timer = window.setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);
    useEffect(() => { if (gameStarted && timeLeft === 0 && !isFinished && countdown === null) endSession(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameStarted, isFinished, countdown]);
    useEffect(() => { return () => clearEngineTimers(); }, []);

    const isCountingDown = countdown !== null && countdown > 0;

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || targetsRef.current.length === 0 || isCountingDown) return;
        const canvas = canvasRef.current; if (!canvas) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);
        let hitIndex = -1;
        for (let i = 0; i < targetsRef.current.length; i++) { if (isPointInsideTarget(x, y, targetsRef.current[i].x, targetsRef.current[i].y, targetsRef.current[i].radius)) { hitIndex = i; break; } }
        if (hitIndex !== -1) {
            const hitTarget = targetsRef.current[hitIndex];
            const reaction = performance.now() - hitTarget.spawnedAt;
            const nextCombo = combo + 1;
            targetsRef.current.splice(hitIndex, 1);
            setHits((p) => p + 1); setCombo(nextCombo); setReactionTimes((p) => [...p, reaction]); setScore((p) => p + config.scorePerHit + nextCombo * 5); spawnHitmarker(event.clientX, event.clientY);
            if (targetsRef.current.length === 0) { if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current); window.setTimeout(() => spawnCluster(), 250); }
            return;
        }
        setMisses((p) => p + 1); setCombo(0); setScore((p) => Math.max(0, p - config.missPenalty));
    };

    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden">
            {isFinished && result && (<div className="absolute inset-0 z-[100]"><ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} /></div>)}
            {!gameStarted && !isFinished && (
                <>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50">
                        <div className="w-full max-w-2xl space-y-8 text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-orange-500 text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">True Burst</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1"><span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-orange-500 outline-none transition-all cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([k, l]) => <option key={k} value={k}>{l.toUpperCase()}</option>)}
                                    </select></label>
                                <label className="flex flex-col text-left flex-1"><span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white focus:border-orange-500 outline-none transition-all cursor-pointer">
                                        {!overrideSettings && <option value={15}>15s (Warmup)</option>}<option value={30}>30s (Standard)</option><option value={60}>60s (Endurance)</option>
                                    </select></label>
                            </div>
                            <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-orange-500 hover:text-white transition-all">INITIALIZE SEQUENCE</button>
                        </div>
                    </div>
                </>
            )}
            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "True Burst", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime, bestReactionTime, extraLines: [{ label: "Multiplier", value: `${combo}x` }] }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none"></div>
                        </div>
                        <div className="relative z-10 w-full h-full">
                            <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onMouseDown={handleCanvasMouseDown} className="absolute inset-0 block cursor-crosshair" />
                            <ComboMeter combo={combo} />
                        </div>
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span key={countdown} className="text-[12rem] font-black text-orange-400 animate-ping leading-none select-none drop-shadow-[0_0_60px_#F97316]">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}