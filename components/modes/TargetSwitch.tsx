"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult, SwitchTarget } from "@/lib/game/types";
import { difficultyConfig, difficultyLabels, getScaledRadius, type Difficulty } from "@/lib/utils/drillConfig";
import { calculateAccuracy, calculateAverageReactionTime, calculateBestReactionTime, getScaledCanvasCoordinates, isPointInsideTarget } from "@/lib/utils/gameMath";
import { createTargetSwitchWave } from "@/lib/utils/targetSpawning";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsStorage";
import SessionHUD from "@/components/SessionHUD";
import ResultsScreen from "@/components/ResultsScreen";
import { spawnHitmarker } from "@/lib/utils/hitmarker";
import ComboMeter from "@/components/ComboMeter";

interface OverrideSettings { difficulty: Difficulty; duration: number; }
interface TargetSwitchProps { overrideSettings?: OverrideSettings; onFinish?: (result: GameResult) => void; }

export default function TargetSwitch({ overrideSettings, onFinish }: TargetSwitchProps = {}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const timeoutRef    = useRef<number | null>(null);
    const sessionIdxRef     = useRef(0);
    const sessionStartRef = useRef<number>(0);
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
    const [targets, setTargets] = useState<SwitchTarget[]>([]);
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

    const clearWaveTimeout = () => { if (timeoutRef.current !== null) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; } };

    const spawnWave = () => {
        clearWaveTimeout();
        const currentSession = sessionIdxRef.current;
        const elapsedSec = (performance.now() - sessionStartRef.current) / 1000;
        const radius = getScaledRadius(config.targetRadius, effectiveDifficulty, elapsedSec, effectiveDuration);
        const wave = createTargetSwitchWave(difficulty, dimensionsRef.current.width, dimensionsRef.current.height, radius);
        setTargets(wave);
        setTotalTargetsSpawned((prev) => prev + wave.length);
        timeoutRef.current = window.setTimeout(() => {
            if (sessionIdxRef.current !== currentSession) return;
            setMisses((prev) => prev + 1);
            setMissedByTimeout((prev) => prev + 1);
            setCombo(0);
            setScore((prev) => Math.max(0, prev - config.missPenalty));
            spawnWave();
        }, config.targetLifetimeMs);
    };

    const resetState = () => {
        sessionIdxRef.current++;
        clearWaveTimeout();
        setGameStarted(false); setIsFinished(false);        setTimeLeft(effectiveDuration); setCountdown(null);
        setTargets([]); setScore(0); setHits(0); setMisses(0); setCombo(0); setReactionTimes([]);
        setTotalTargetsSpawned(0); setMissedByTimeout(0); setResult(null);
    };

    const startGame = async () => {
        resetState();
        setGameStarted(true);
        if (containerRef.current && !document.fullscreenElement) await containerRef.current.requestFullscreen().catch(() => { });
        setCountdown(3);
    };

    const endSession = async () => {
        clearWaveTimeout();
        setGameStarted(false);
        setTargets([]);
        const resultData = buildGameResult({ mode: "Target Switch", difficulty: difficultyLabels[effectiveDifficulty], score, hits, misses, duration: effectiveDuration, reactionTimes, totalTargetsSpawned, missedByTimeout, extraStats: { "Wave Targets Spawned": totalTargetsSpawned } });
        updateStatsWithResult(resultData);

        if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });

        if (onFinish) { onFinish(resultData); } else { setResult(resultData); setIsFinished(true); }
    };

    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) { 
            setCountdown(null); 
            sessionStartRef.current = performance.now();
            spawnWave(); 
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
        const timer = window.setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [gameStarted, countdown]);
    useEffect(() => { if (gameStarted && timeLeft === 0 && !isFinished && countdown === null) endSession(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameStarted, isFinished, countdown]);
    useEffect(() => { return () => clearWaveTimeout(); }, []);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
        for (const target of targets) {
            const gradient = ctx.createRadialGradient(target.x - target.radius * 0.3, target.y - target.radius * 0.3, target.radius * 0.1, target.x, target.y, target.radius);
            if (target.isCorrect) { gradient.addColorStop(0, "#FFFFFF"); gradient.addColorStop(0.3, "#10B981"); gradient.addColorStop(1, "#064E3B"); }
            else { gradient.addColorStop(0, "#FFAAAA"); gradient.addColorStop(0.3, "#EF4444"); gradient.addColorStop(1, "#660000"); }
            ctx.beginPath(); ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2); ctx.fillStyle = gradient;
            ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 25; ctx.shadowOffsetY = 20; ctx.fill();
            ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        }
    }, [targets, renderDimensions]);

    const isCountingDown = countdown !== null && countdown > 0;

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!gameStarted || isCountingDown) return;
        const canvas = canvasRef.current; if (!canvas) return;
        const { x, y } = getScaledCanvasCoordinates(event, canvas, dimensionsRef.current.width, dimensionsRef.current.height);
        let clicked = null;
        for (const t of targets) { if (isPointInsideTarget(x, y, t.x, t.y, t.radius)) { clicked = t; break; } }
        if (!clicked) { setMisses((p) => p + 1); setCombo(0); setScore((p) => Math.max(0, p - config.missPenalty)); return; }
        if (clicked.isCorrect) { const reaction = performance.now() - clicked.spawnedAt; const nextCombo = combo + 1; setHits((p) => p + 1); setCombo(nextCombo); setScore((p) => p + config.scorePerHit + (nextCombo * 5)); setReactionTimes((p) => [...p, reaction]); spawnHitmarker(event.clientX, event.clientY); spawnWave(); return; }
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
                                <p className="text-emerald-500 text-sm font-bold tracking-[0.3em] uppercase">AimSync Training</p>
                                <h2 className="text-5xl font-black tracking-widest uppercase">Target Switch</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6 justify-center pt-4">
                                <label className="flex flex-col text-left flex-1"><span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DIFFICULTY</span>
                                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white outline-none cursor-pointer">
                                        {Object.entries(difficultyLabels).map(([k, l]) => <option key={k} value={k}>{l.toUpperCase()}</option>)}
                                    </select></label>
                                <label className="flex flex-col text-left flex-1"><span className="text-gray-400 text-xs font-bold tracking-wider mb-2">DURATION</span>
                                    <select value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-black/80 border border-white/20 p-4 rounded-xl text-white outline-none cursor-pointer">
                                        {!overrideSettings && <option value={15}>15s (Warmup)</option>}<option value={30}>30s (Standard)</option><option value={60}>60s (Endurance)</option>
                                    </select></label>
                            </div>
                            <button onClick={startGame} className="w-full mt-8 px-12 py-5 bg-white text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-emerald-500 hover:text-white transition-all">INITIALIZE SEQUENCE</button>
                        </div>
                    </div>
                </>
            )}
            {gameStarted && (
                <div className="relative flex flex-col w-full h-full z-20">
                    <div className="relative z-30 shrink-0 w-full bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm">
                        <SessionHUD data={{ mode: "Target Switch", difficulty: difficultyLabels[difficulty], timeLeft, score, hits, misses, accuracy, averageReactionTime, bestReactionTime, extraLines: [{ label: "Timeouts", value: missedByTimeout }] }} />
                    </div>
                    <div className="relative flex-1 w-full overflow-hidden">
                        <div className="absolute inset-0 z-0 overflow-hidden bg-[#2f3b4c] perspective-[800px]">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[#334155] bg-[linear-gradient(to_right,#00000033_2px,transparent_2px),linear-gradient(to_bottom,#00000033_2px,transparent_2px)] bg-[size:4rem_4rem] origin-center [transform:rotateX(60deg)]"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none"></div>
                        </div>
                        <div className="relative z-10 w-full h-full">
                            <canvas ref={canvasRef} width={renderDimensions.width} height={renderDimensions.height} onClick={handleCanvasClick} className="absolute inset-0 block cursor-crosshair" />
                            <ComboMeter combo={combo} />
                        </div>
                        {isCountingDown && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <span key={countdown} className="text-[12rem] font-black text-emerald-400 animate-ping leading-none select-none drop-shadow-[0_0_60px_#10B981]">{countdown}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}