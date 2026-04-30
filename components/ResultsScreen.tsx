"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameResult } from "@/lib/game/types";

// --- XP PAYOUT LOGIC ---
// Mathematically splits the session XP into Primary (70%) and Secondary (30%) Aim Factors
const calculateXpDistribution = (mode: string, totalXp: number) => {
    const primaryXp = Math.floor(totalXp * 0.70);
    const secondaryXp = Math.floor(totalXp * 0.30);

    let distribution = {
        xpGainedFlicking: 0,
        xpGainedTracking: 0,
        xpGainedSpeed: 0,
        xpGainedPrecision: 0,
        xpGainedPerception: 0,
        xpGainedCognition: 0,
    };

    switch (mode) {
        case 'static-flick':
            distribution.xpGainedPrecision = primaryXp;
            distribution.xpGainedFlicking = secondaryXp;
            break;
        case 'tracking-mode':
            distribution.xpGainedTracking = primaryXp;
            distribution.xpGainedPerception = secondaryXp;
            break;
        case 'reaction-test':
            distribution.xpGainedSpeed = primaryXp;
            distribution.xpGainedPerception = secondaryXp;
            break;
        case 'target-switch':
            distribution.xpGainedCognition = primaryXp;
            distribution.xpGainedFlicking = secondaryXp;
            break;
        default:
            // Fallback: Give 100% to precision if protocol is unknown
            distribution.xpGainedPrecision = totalXp;
    }
    return distribution;
};

interface ResultsScreenProps {
    result?: GameResult | null;
    onRestart?: () => void;
    onBackToMenu?: () => void;
}

export default function ResultsScreen({ result, onRestart, onBackToMenu }: ResultsScreenProps = {}) {
    // Atomic selectors for performance (legacy 3D engine support)
    const status = useGameStore(state => state.status);
    const storeScore = useGameStore(state => state.score);
    const storeHighScore = useGameStore(state => state.highScore);
    const storeShotsFired = useGameStore(state => state.shotsFired);
    const storeTotalDuration = useGameStore(state => state.totalDuration);
    const storeSessionXp = useGameStore(state => state.sessionXp); // NEW: Arkham XP
    const storeMaxCombo = useGameStore(state => state.maxCombo);   // NEW: Max Combo
    const storeReset = useGameStore(state => state.reset);
    const storeStartGame = useGameStore(state => state.startGame);

    const router = useRouter();
    const searchParams = useSearchParams();

    // The "Latch": Prevents duplicate saves during React Strict Mode double-renders
    const hasSaved = useRef(false);
    const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saving");

    const isLocalMode = !!result;

    // Derived values
    const currentMode = isLocalMode ? (result?.modeId || 'unknown-protocol') : (searchParams.get('mode') || 'unknown-protocol');
    const displayScore = isLocalMode ? (result?.score || 0) : storeScore;
    const durationSeconds = isLocalMode ? (result?.durationSeconds || 1) : storeTotalDuration;
    const shotsFired = isLocalMode ? ((result?.hits || 0) + (result?.misses || 0)) : storeShotsFired;
    const accuracy = isLocalMode ? (result?.accuracy || 0) : (shotsFired > 0 ? Math.round((storeScore / shotsFired) * 100) : 0);
    const avgKps = (displayScore / (durationSeconds || 1)).toFixed(2);
    
    // Mock high score for 2D modes right now
    const highScore = isLocalMode ? 0 : storeHighScore;
    const isNewBest = displayScore >= highScore && displayScore > 0;
    
    const maxCombo = isLocalMode ? (Number(result?.extraStats?.["Max Combo"]) || 0) : storeMaxCombo;
    const sessionXp = isLocalMode ? Math.round(displayScore * 10) : storeSessionXp;

    useEffect(() => {
        // For local 2D modes, we skip the API post for now as they use their own statsStorage
        if (isLocalMode) {
            setSaveStatus("saved");
            return;
        }

        if (status === 'finished' && !hasSaved.current) {
            hasSaved.current = true;
            setSaveStatus("saving");

            const saveTelemetry = async () => {
                try {
                    // STEP 4: Calculate the precise XP split for the 6 Factors
                    const xpPayout = calculateXpDistribution(currentMode, sessionXp);

                    const response = await fetch('/api/save-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: 'guest_user_123', // Hardcoded until Auth.js is implemented
                            protocol: currentMode,
                            score: displayScore,
                            shotsFired: shotsFired,
                            accuracy: accuracy,
                            kps: parseFloat(avgKps),
                            ...xpPayout // Injects the 6 precise XP variables directly into the payload!
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
    }, [isLocalMode, status, currentMode, displayScore, shotsFired, accuracy, avgKps, sessionXp]);

    // Only render the UI when the sequence is over
    if (!isLocalMode && status !== 'finished') return null;

    const handleReturnToHub = async () => {
        if (onBackToMenu) {
            onBackToMenu();
        } else {
            storeReset();
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => { });
            }
            router.push('/dashboard');
        }
    };

    const handlePlayAgain = () => {
        if (onRestart) {
            onRestart();
        } else {
            hasSaved.current = false;
            storeStartGame(durationSeconds);
        }
    };

    return (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-xl pointer-events-auto flex items-center justify-center p-6 transition-all duration-500 ease-out animate-in fade-in zoom-in-95">
            <div className="w-full max-w-4xl bg-[#121212] border border-white/10 rounded-3xl p-10 shadow-2xl flex flex-col items-center text-white relative overflow-hidden">

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

                {/* THE 5-METRIC GRID (Now includes Max Combo and Total XP) */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full mb-12 relative z-10">
                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Score</span>
                        <span className="text-3xl font-black text-white tabular-nums">{displayScore}</span>
                    </div>

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Accuracy</span>
                        <span className="text-3xl font-black text-[#1DB954] tabular-nums">{accuracy}%</span>
                    </div>

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Avg KPS</span>
                        <span className="text-3xl font-black text-cyan-400 tabular-nums">{avgKps}</span>
                    </div>

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Max Combo</span>
                        <span className="text-3xl font-black italic text-orange-400 tabular-nums drop-shadow-md">x{maxCombo}</span>
                    </div>

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-[#3366FF]/30 shadow-[0_0_15px_rgba(51,102,255,0.1)]">
                        <span className="text-[#3366FF] text-[10px] font-black tracking-wider mb-2 uppercase">Total XP</span>
                        <span className="text-3xl font-black text-[#3366FF] tabular-nums">+{sessionXp.toLocaleString()}</span>
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