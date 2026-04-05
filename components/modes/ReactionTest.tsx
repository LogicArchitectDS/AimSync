"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import ResultsScreen from "../ResultsScreen";
import { buildGameResult } from "@/lib/utils/resultBuilder";
import { updateStatsWithResult } from "@/lib/utils/statsService";
import type { GameResult, Difficulty } from "@/lib/game/types";

export default function ReactionTest({
    overrideSettings,
    onFinish
}: {
    overrideSettings?: { duration?: number; difficulty?: Difficulty },
    onFinish?: (res: GameResult) => void
}) {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [gameStarted, setGameStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [result, setResult] = useState<GameResult | null>(null);

    // Test States
    const [gameState, setGameState] = useState<"waiting" | "ready" | "clicked" | "early" | "idle">("idle");
    const [attempts, setAttempts] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [startTime, setStartTime] = useState(0);

    const MAX_ATTEMPTS = 5;

    const clearTimers = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const startTrial = useCallback(() => {
        setGameState("waiting");
        // Random delay between 2 and 5 seconds to prevent anticipation
        const delay = Math.floor(Math.random() * 3000) + 2000;

        timeoutRef.current = setTimeout(() => {
            setGameState("ready");
            setStartTime(performance.now());
        }, delay);
    }, []);

    const resetState = useCallback(() => {
        clearTimers();
        setGameStarted(false);
        setIsFinished(false);
        setAttempts(0);
        setReactionTimes([]);
        setGameState("idle");
        setResult(null);
    }, [clearTimers]);

    const startGame = async () => {
        resetState();
        setGameStarted(true);

        if (containerRef.current && !document.fullscreenElement) {
            await containerRef.current.requestFullscreen().catch(() => { });
        }

        startTrial();
    };

    const endSession = useCallback((finalTimes: number[]) => {
        clearTimers();
        setGameStarted(false);

        const validTimes = finalTimes.filter((t) => t > 0);
        const misses = finalTimes.length - validTimes.length;
        const avg = validTimes.length > 0
            ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length
            : 0;

        const resultData = buildGameResult({
            mode: "reaction-test",
            difficulty: overrideSettings?.difficulty || "medium",
            score: validTimes.length > 0 ? Math.round(100000 / avg) : 0,
            hits: validTimes.length,
            misses,
            reactionTimes: validTimes,
            duration: 0,
        });

        // Sync to Firestore
        updateStatsWithResult(resultData);

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        setResult(resultData);
        setIsFinished(true);
    }, [clearTimers, overrideSettings]);

    const handleClick = () => {
        if (!gameStarted || isFinished) return;

        // FOUL: User clicked before the screen turned green
        if (gameState === "waiting") {
            clearTimers();
            setGameState("early");

            const newTimes = [...reactionTimes, -1]; // -1 marks a foul
            setReactionTimes(newTimes);
            const currentAttempts = newTimes.length;
            setAttempts(currentAttempts);

            if (currentAttempts >= MAX_ATTEMPTS) {
                setTimeout(() => endSession(newTimes), 1000);
            } else {
                setTimeout(startTrial, 1500);
            }
            return;
        }

        // SUCCESS: Valid reaction
        if (gameState === "ready") {
            const reactionTime = performance.now() - startTime;
            const newTimes = [...reactionTimes, reactionTime];
            setReactionTimes(newTimes);
            setGameState("clicked");
            const currentAttempts = newTimes.length;
            setAttempts(currentAttempts);

            if (currentAttempts >= MAX_ATTEMPTS) {
                endSession(newTimes);
            } else {
                setTimeout(startTrial, 1200);
            }
        }
    };

    useEffect(() => {
        return () => clearTimers();
    }, [clearTimers]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden select-none cursor-pointer"
            onMouseDown={handleClick}
        >
            {isFinished && result && (
                <div className="absolute inset-0 z-[100]" onMouseDown={(e) => e.stopPropagation()}>
                    <ResultsScreen result={result} onRestart={startGame} onBackToMenu={resetState} />
                </div>
            )}

            {!gameStarted && !isFinished && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="w-full max-w-2xl text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl shadow-2xl">
                        <p className="text-yellow-500 text-sm font-bold tracking-[0.4em] uppercase mb-2">Baseline Protocol</p>
                        <h2 className="text-5xl font-black tracking-widest uppercase mb-6">Reaction Test</h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            React to the visual stimulus. Wait for the green screen.
                            <br />Anticipation leads to automatic disqualification of the attempt.
                        </p>
                        <button onClick={startGame} className="w-full px-12 py-5 bg-yellow-500 text-black text-lg font-black tracking-[0.2em] rounded-xl hover:bg-white transition-all uppercase">
                            Initialize Sequence
                        </button>
                    </div>
                </div>
            )}

            {gameStarted && !isFinished && (
                <div className={`relative flex flex-col items-center justify-center w-full h-full z-20 transition-colors duration-75
                    ${gameState === "waiting" ? "bg-red-600" : ""}
                    ${gameState === "ready" ? "bg-emerald-500" : ""}
                    ${gameState === "early" ? "bg-red-800" : ""}
                    ${gameState === "clicked" ? "bg-blue-600" : ""}
                `}>
                    <div className="text-center pointer-events-none">
                        <h2 className="text-6xl font-black uppercase tracking-widest text-white drop-shadow-2xl">
                            {gameState === "waiting" && "Wait..."}
                            {gameState === "ready" && "CLICK!"}
                            {gameState === "early" && "Too Early!"}
                            {gameState === "clicked" && reactionTimes.length > 0 && `${Math.round(reactionTimes[reactionTimes.length - 1])} ms`}
                        </h2>
                        {gameState === "clicked" && (
                            <p className="mt-4 text-xl font-bold opacity-70 uppercase tracking-widest">
                                Attempt {attempts} / {MAX_ATTEMPTS}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}