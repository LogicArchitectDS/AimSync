"use client";

import { useRef, useState, useEffect } from "react";
import ResultsScreen from "../ResultsScreen";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import type { GameResult, Difficulty } from "@/lib/game/types";

interface RoutineOverride {
    duration?: number;
    difficulty?: Difficulty;
}

export default function ReactionTest({
    overrideSettings,
    onFinish
}: {
    overrideSettings?: RoutineOverride,
    onFinish?: (res: GameResult) => void
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [result, setResult] = useState<GameResult | null>(null);

    // Test States
    const [gameState, setGameState] = useState<"waiting" | "ready" | "clicked" | "early">("waiting");
    const [attempts, setAttempts] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [startTime, setStartTime] = useState(0);

    // Settings
    const MAX_ATTEMPTS = 5;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startGame = async () => {
        resetState();
        setGameStarted(true);

        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }

        startTrial();
    };

    const resetState = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setGameStarted(false);
        setIsFinished(false);
        setAttempts(0);
        setReactionTimes([]);
        setGameState("waiting");
    };

    const startTrial = () => {
        setGameState("waiting");
        // Random delay between 2 and 5 seconds
        const delay = Math.floor(Math.random() * 3000) + 2000;

        timeoutRef.current = setTimeout(() => {
            setGameState("ready");
            setStartTime(performance.now());
        }, delay);
    };

    const handleClick = () => {
        if (!gameStarted || isFinished) return;

        if (gameState === "waiting") {
            // User clicked too early — counts as a missed attempt
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setGameState("early");

            // Record -1 as a sentinel for a missed/early attempt
            const newTimes = [...reactionTimes, -1];
            setReactionTimes(newTimes);
            setAttempts(newTimes.length);

            if (newTimes.length >= MAX_ATTEMPTS) {
                // All 5 attempts used up (all misses)
                setTimeout(() => endSession(newTimes), 1500);
            } else {
                setTimeout(startTrial, 1500);
            }
            return;
        }

        if (gameState === "ready") {
            const reactionTime = performance.now() - startTime;
            const newTimes = [...reactionTimes, reactionTime];
            setReactionTimes(newTimes);
            setGameState("clicked");

            if (newTimes.length >= MAX_ATTEMPTS) {
                endSession(newTimes);
            } else {
                setAttempts(newTimes.length);
                setTimeout(startTrial, 1000);
            }
        }
    };

    const endSession = (finalTimes: number[]) => {
        // -1 entries are missed/early attempts; filter them out for avg calculation
        const validTimes = finalTimes.filter((t) => t > 0);
        const misses = finalTimes.length - validTimes.length;
        const avg = validTimes.length > 0
            ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length
            : 9999;

        const resultData = buildGameResult({
            mode: "reaction-test",
            difficulty: overrideSettings?.difficulty || "bonus",
            score: validTimes.length > 0 ? Math.round(100000 / avg) : 0,
            hits: validTimes.length,
            misses,
            reactionTimes: validTimes, // Only pass valid times for stats
            duration: 0, // Not a time-based mode
        });

        // Exit fullscreen immediately so the results screen is visible.
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        // Always show the results screen first.
        // onFinish (routing back to hub) is deferred until the user
        // explicitly clicks "Back to Menu" inside the ResultsScreen.
        setResult(resultData);
        setIsFinished(true);
    };

    const handleBackToMenu = () => {
        if (onFinish && result) {
            onFinish(result);
        } else {
            resetState();
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // --- UI RENDERING ---
    return (
        <div ref={containerRef} className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden select-none" onMouseDown={handleClick}>

            {/* 1. RESULTS */}
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]" onMouseDown={(e) => e.stopPropagation()}>
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={handleBackToMenu} />
                </div>
            )}

            {/* 2. MENU */}
            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                    <div className="relative z-10 w-full max-w-2xl text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl">
                        <p className="text-[#eab308] text-sm font-bold tracking-[0.4em] uppercase mb-2">Baseline Protocol</p>
                        <h1 className="text-5xl font-black tracking-widest uppercase text-white mb-6 drop-shadow-md">Reaction Test</h1>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            When the screen turns green, click as fast as humanly possible.
                            <br />Do not anticipate. Wait for the visual stimulus.
                        </p>

                        {overrideSettings ? (
                            <div className="text-center px-6 py-3 bg-[#eab308]/10 border border-[#eab308]/30 rounded-xl mb-8">
                                <span className="text-[#eab308] text-[10px] font-bold tracking-widest uppercase block mb-1">ROUTINE LOCKED</span>
                                <span className="text-white font-black tracking-wider uppercase">5 ATTEMPTS</span>
                            </div>
                        ) : (
                            <div className="text-center px-6 py-3 bg-white/5 border border-white/10 rounded-xl mb-8 inline-block">
                                <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase block mb-1">STANDARD CALIBRATION</span>
                                <span className="text-white font-black tracking-wider uppercase">5 ATTEMPTS</span>
                            </div>
                        )}

                        <button onClick={startGame} className="w-full px-12 py-5 bg-[#eab308] text-[#121212] text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white hover:text-[#eab308] transition-all">
                            INITIALIZE SEQUENCE
                        </button>
                    </div>
                </div>
            )}

            {/* 3. GAMEPLAY (The Reaction Canvas) */}
            {gameStarted && !isFinished && (
                <div className={`relative flex flex-col items-center justify-center w-full h-full z-20 transition-colors duration-75
                    ${gameState === "waiting" ? "bg-[#cf222e]" : ""}
                    ${gameState === "ready" ? "bg-[#1DB954]" : ""}
                    ${gameState === "early" ? "bg-[#cf222e]" : ""}
                    ${gameState === "clicked" ? "bg-[#3366FF]" : ""}
                `}>

                    {/* Visual Cues */}
                    <div className="text-center pointer-events-none">
                        {gameState === "waiting" && <h2 className="text-6xl font-black uppercase tracking-widest text-white drop-shadow-lg">Wait for Green</h2>}
                        {gameState === "ready" && <h2 className="text-6xl font-black uppercase tracking-widest text-white drop-shadow-lg">CLICK!</h2>}
                        {gameState === "early" && <h2 className="text-6xl font-black uppercase tracking-widest text-white drop-shadow-lg">Too Early!</h2>}
                        {gameState === "clicked" && reactionTimes.length > 0 && (
                            <div className="space-y-2">
                                <h2 className="text-6xl font-black uppercase tracking-widest text-white drop-shadow-lg">
                                    {Math.round(reactionTimes[reactionTimes.length - 1])} ms
                                </h2>
                                <p className="text-xl font-bold text-white/70 uppercase tracking-widest">
                                    Attempt {attempts} / {MAX_ATTEMPTS}
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            )}

        </div>
    );
}