"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResultsScreen() {
    // Atomic selectors for performance
    const status = useGameStore(state => state.status);
    const score = useGameStore(state => state.score);
    const highScore = useGameStore(state => state.highScore);
    const shotsFired = useGameStore(state => state.shotsFired);
    const totalDuration = useGameStore(state => state.totalDuration);
    const reset = useGameStore(state => state.reset);
    const startGame = useGameStore(state => state.startGame);

    const router = useRouter();
    const searchParams = useSearchParams();

    // The "Latch": Prevents duplicate saves during React Strict Mode double-renders
    const hasSaved = useRef(false);
    const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saving");

    // Math Calculations
    const accuracy = shotsFired > 0 ? Math.round((score / shotsFired) * 100) : 0;
    const avgKps = (score / totalDuration).toFixed(2);
    const isNewBest = score >= highScore && score > 0;
    const currentMode = searchParams.get('mode') || 'unknown-protocol';

    // --- CLOUDFLARE D1 TELEMETRY SYNC ---
    useEffect(() => {
        // Only trigger the save when the game actually finishes, and only do it once
        if (status === 'finished' && !hasSaved.current) {
            hasSaved.current = true;
            setSaveStatus("saving");

            const saveTelemetry = async () => {
                try {
                    const response = await fetch('/api/save-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: 'guest_user_123', // Hardcoded until Auth.js is implemented
                            protocol: currentMode,
                            score: score,
                            shotsFired: shotsFired,
                            accuracy: accuracy,
                            kps: parseFloat(avgKps)
                        })
                    });

                    if (!response.ok) throw new Error("Failed to reach Edge API");
                    setSaveStatus("saved");
                } catch (error) {
                    console.error("[AimSync] Failed to sync telemetry:", error);
                    setSaveStatus("error");
                }
            };

            saveTelemetry();
        }
    }, [status, currentMode, score, shotsFired, accuracy, avgKps]);

    // Only render the UI when the sequence is over
    if (status !== 'finished') return null;

    const handleReturnToHub = async () => {
        reset(); // Clear the engine state
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => { });
        }
        router.push('/dashboard');
    };

    const handlePlayAgain = () => {
        // Reset the latch so the next game can be saved
        hasSaved.current = false;
        startGame(totalDuration);
    };

    return (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-xl pointer-events-auto flex items-center justify-center p-6 transition-all duration-500 ease-out animate-in fade-in zoom-in-95">
            <div className="w-full max-w-3xl bg-[#121212] border border-white/10 rounded-3xl p-10 shadow-2xl flex flex-col items-center text-white relative overflow-hidden">

                {/* Decorative Background */}
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.2L18.8 19H5.2L12 6.2z" /></svg>
                </div>

                <p className="text-[#3366FF] text-sm font-bold tracking-[0.4em] uppercase mb-2">Protocol Complete</p>
                <h1 className="text-5xl font-black tracking-widest uppercase text-white drop-shadow-md">
                    {currentMode.replace(/-/g, " ")}
                </h1>

                {/* Save Status Indicator */}
                <div className="mt-4 mb-6 flex items-center justify-center space-x-2">
                    {saveStatus === "saving" && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>}
                    {saveStatus === "saved" && <div className="w-2 h-2 bg-[#1DB954] rounded-full shadow-[0_0_8px_#1DB954]"></div>}
                    {saveStatus === "error" && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                    <span className="text-xs tracking-widest text-gray-400 uppercase">
                        {saveStatus === "saving" ? "Syncing Telemetry to Cloud..." : saveStatus === "saved" ? "Data Secured to D1" : "Sync Failed"}
                    </span>
                </div>

                <div className="mb-8 text-center h-6">
                    {isNewBest ? (
                        <span className="text-yellow-400 text-sm font-black tracking-[0.3em] uppercase animate-pulse">⭐ New Personal Best! ⭐</span>
                    ) : (
                        <span className="text-gray-500 text-sm font-bold tracking-[0.2em] uppercase">Personal Best: {highScore || 0}</span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12 relative z-10">
                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-[#3366FF]/30 transition-colors shadow-inner">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Final Score</span>
                        <span className="text-5xl font-black text-white tabular-nums">{score}</span>
                    </div>

                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-[#1DB954]/30 transition-colors shadow-inner">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Accuracy</span>
                        <span className="text-5xl font-black text-[#1DB954] tabular-nums">{accuracy}%</span>
                    </div>

                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-cyan-400/30 transition-colors shadow-inner">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2 uppercase">Avg KPS</span>
                        <span className="text-5xl font-black text-cyan-400 tabular-nums">{avgKps}</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center relative z-10">
                    <button
                        onClick={handlePlayAgain}
                        className="px-10 py-5 bg-[#EAEAEA] text-[#121212] font-black tracking-[0.2em] uppercase rounded-xl hover:bg-[#3366FF] hover:text-white transition-all duration-300 w-full sm:w-auto"
                    >
                        Run Again
                    </button>
                    <button
                        onClick={handleReturnToHub}
                        className="px-10 py-5 bg-transparent border border-white/20 text-white font-bold tracking-[0.2em] uppercase rounded-xl hover:bg-white/10 hover:border-white/50 transition-all duration-300 w-full sm:w-auto"
                    >
                        Abort to Hub
                    </button>
                </div>
            </div>
        </div>
    );
}