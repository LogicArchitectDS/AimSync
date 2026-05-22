"use client";

import { useRef, useState, useEffect } from "react";
import ResultsScreen from "../ResultsScreen";
import type { GameResult } from "@/lib/game/types";
import { type Difficulty } from "@/lib/utils/drillConfig";
import { useBaseGameEngine } from "@/lib/hooks/useBaseGameEngine";

interface RoutineOverride {
    duration?: number;
    difficulty?: Difficulty;
}

export default function ReactionTest({
    overrideSettings,
    onFinish,
}: {
    overrideSettings?: RoutineOverride;
    onFinish?: (res: GameResult) => void;
}) {
    const [reduceFlash, setReduceFlash] = useState(false);
    const [gameState, setGameState] = useState<"waiting" | "ready" | "clicked" | "early">("waiting");
    const [attempts, setAttempts] = useState(0);
    const [reactionTimes, setReactionTimes] = useState<number[]>([]);
    const [startTime, setStartTime] = useState(0);

    const MAX_ATTEMPTS = 5;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const engine = useBaseGameEngine({
        modeId: "reaction-test",
        overrideSettings: {
            difficulty: overrideSettings?.difficulty ?? "medium",
            duration: 0, // reaction-test has no countdown timer
        },
        onSessionComplete: onFinish,
    });

    const startGame = async () => {
        resetState();
        engine.beginSession();
        startTrial();
    };

    const resetState = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setAttempts(0);
        setReactionTimes([]);
        setGameState("waiting");
        engine.resetToMenu();
    };

    const startTrial = () => {
        setGameState("waiting");
        const delay = Math.floor(Math.random() * 3000) + 2000;

        timeoutRef.current = setTimeout(() => {
            setGameState("ready");
            setStartTime(performance.now());
        }, delay);
    };

    const handleClick = () => {
        if (engine.phase !== "live") return;

        if (gameState === "waiting") {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setGameState("early");

            const newTimes = [...reactionTimes, -1];
            setReactionTimes(newTimes);
            setAttempts(newTimes.length);
            engine.triggerMiss(0); // Reaction test uses 0 miss penalty

            if (newTimes.length >= MAX_ATTEMPTS) {
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
            engine.triggerHit(reactionTime);

            if (newTimes.length >= MAX_ATTEMPTS) {
                endSession(newTimes);
            } else {
                setAttempts(newTimes.length);
                setTimeout(startTrial, 1000);
            }
        }
    };

    const endSession = (finalTimes: number[]) => {
        const validTimes = finalTimes.filter((t) => t > 0);
        const avg = validTimes.length > 0
            ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length
            : 9999;

        const calculatedScore = validTimes.length > 0 ? Math.round(100000 / avg) : 0;
        engine.incrementScore(calculatedScore - engine.score); // set exact score
        engine.endSession();
    };

    const handleBackToMenu = () => {
        if (onFinish && engine.result) {
            onFinish(engine.result);
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

    const isFinished = engine.phase === "finished" && engine.result !== null;

    return (
        <div className="relative w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden select-none" onMouseDown={handleClick}>

            {/* RESULTS */}
            {isFinished && engine.result && (
                <div className="absolute inset-0 z-[100]" onMouseDown={(e) => e.stopPropagation()}>
                    <ResultsScreen result={engine.result} onRestart={startGame} onBackToMenu={handleBackToMenu} />
                </div>
            )}

            {/* MENU */}
            {engine.phase === "menu" && (
                <div className="relative z-10 w-full h-full flex items-center justify-center p-4 bg-black/50" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
                    <div className="relative z-10 w-full max-w-2xl text-center p-12 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-xl">
                        <p className="text-[#eab308] text-sm font-bold tracking-[0.4em] uppercase mb-2">Baseline Protocol</p>
                        <h1 className="text-5xl font-black tracking-widest uppercase text-white mb-6 drop-shadow-md">Reaction Test</h1>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            When the screen turns green, click as fast as humanly possible.
                            <br />Do not anticipate. Wait for the visual stimulus.
                            <br /><br />
                            <span className="text-red-400 text-xs font-bold uppercase tracking-wider block">⚠️ Photosensitivity Warning</span>
                            <span className="text-xs text-red-400/80">This mode features sudden, full-screen color changes.</span>
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

                        <div className="flex justify-center items-center space-x-2 mt-6 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                id="reduceFlash"
                                checked={reduceFlash}
                                onChange={(e) => setReduceFlash(e.target.checked)}
                                className="rounded border-white/20 bg-black/50 text-[#eab308] focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                            />
                            <label htmlFor="reduceFlash" className="cursor-pointer font-medium select-none text-xs tracking-wider uppercase text-gray-400 hover:text-white transition-colors">
                                Reduce Flash Intensity (Eye Strain Protection)
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* GAMEPLAY */}
            {engine.phase === "live" && (
                <div className={`relative flex flex-col items-center justify-center w-full h-full z-20 transition-colors duration-75
                    ${gameState === "waiting" ? "bg-[#450a0a]" : ""}
                    ${gameState === "ready" ? "bg-[#14532d]" : ""}
                    ${gameState === "early" ? "bg-[#450a0a]" : ""}
                    ${gameState === "clicked" ? "bg-[#1e3a8a]" : ""}
                `}
                style={{
                    filter: reduceFlash && gameState === "ready" ? "brightness(0.85)" : "none",
                    transition: "filter 0.3s ease",
                }}>

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