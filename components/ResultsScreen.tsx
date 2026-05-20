"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameResult } from "@/lib/game/types";
import { StorageEngine } from "@/lib/utils/storage";
import { getModeConfig } from "@/lib/game/modeRegistry";
import { getLevelProgress } from "@/lib/utils/statsService";

// --- XP PAYOUT LOGIC ---
// Mathematically splits the session XP into Primary (70%) and Secondary (30%) Aim Factors
const calculateXpDistribution = (mode: string, totalXp: number) => {
    const primaryXp   = Math.floor(totalXp * 0.70);
    const secondaryXp = Math.floor(totalXp * 0.30);

    const distribution = {
        xpGainedFlicking:   0,
        xpGainedTracking:   0,
        xpGainedSpeed:      0,
        xpGainedPrecision:  0,
        xpGainedPerception: 0,
        xpGainedCognition:  0,
    };

    switch (mode) {
        case 'static-flick':
            distribution.xpGainedPrecision  = primaryXp;
            distribution.xpGainedFlicking   = secondaryXp;
            break;
        case 'tracking-mode':
            distribution.xpGainedTracking   = primaryXp;
            distribution.xpGainedPerception = secondaryXp;
            break;
        case 'reaction-test':
            distribution.xpGainedSpeed      = primaryXp;
            distribution.xpGainedPerception = secondaryXp;
            break;
        case 'target-switch':
            distribution.xpGainedCognition  = primaryXp;
            distribution.xpGainedFlicking   = secondaryXp;
            break;
        default:
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
    const status           = useGameStore(state => state.status);
    const storeScore       = useGameStore(state => state.score);
    const storeHighScore   = useGameStore(state => state.highScore);
    const storeShotsFired  = useGameStore(state => state.shotsFired);
    const storeTotalDuration = useGameStore(state => state.totalDuration);
    const storeSessionXp   = useGameStore(state => state.sessionXp);
    const storeMaxCombo    = useGameStore(state => state.maxCombo);
    const storeReset       = useGameStore(state => state.reset);
    const storeStartGame   = useGameStore(state => state.startGame);

    const router       = useRouter();
    const searchParams = useSearchParams();

    // The "Latch": Prevents duplicate saves during React Strict Mode double-renders
    const hasSaved = useRef(false);

    const [saveStatus, setSaveStatus]   = useState<"saving" | "saved" | "error">("saving");
    const [levelUpInfo, setLevelUpInfo] = useState<{ from: number; to: number } | null>(null);

    // XP progress bar state — animated in two phases (before → after save)
    const [progressBefore, setProgressBefore] = useState(0);
    const [progressAfter,  setProgressAfter]  = useState(0);
    const [barAnimated,    setBarAnimated]     = useState(false);

    const isLocalMode = !!result;

    // Derived values
    const currentMode    = isLocalMode ? (result?.modeId || 'unknown-protocol') : (searchParams.get('mode') || 'unknown-protocol');
    const displayScore   = isLocalMode ? (result?.score || 0) : storeScore;
    const durationSeconds = isLocalMode ? (result?.durationSeconds || 1) : storeTotalDuration;
    const shotsFired     = isLocalMode ? ((result?.hits || 0) + (result?.misses || 0)) : storeShotsFired;
    const accuracy       = isLocalMode ? (result?.accuracy || 0) : (shotsFired > 0 ? Math.round((storeScore / shotsFired) * 100) : 0);
    const avgKps         = (displayScore / (durationSeconds || 1)).toFixed(2);

    // Mock high score for 2D modes right now
    const highScore  = isLocalMode ? 0 : storeHighScore;
    const isNewBest  = displayScore >= highScore && displayScore > 0;

    const maxCombo   = isLocalMode ? (Number(result?.extraStats?.["Max Combo"]) || 0) : storeMaxCombo;
    const sessionXp  = isLocalMode ? Math.round(displayScore * 10) : storeSessionXp;

    // Registry lookup — drives combo column visibility
    const modeConfig    = getModeConfig(currentMode);
    const showComboCell = modeConfig.supportsCombo;

    // ── LEVEL-UP DETECTION for 2D local modes ────────────────────────────────
    useEffect(() => {
        if (!isLocalMode || !result) return;

        // Snapshot XP *before* the mode component already saved (stats were
        // saved before ResultsScreen mounted, so we work backwards via XP delta).
        const statsNow    = StorageEngine.getUserStats();
        const xpNow       = statsNow.xp || 0;
        const xpBefore    = Math.max(0, xpNow - sessionXp);
        const levelBefore = statsNow.level || 1;

        const before = getLevelProgress(xpBefore);
        const after  = getLevelProgress(xpNow);

        setProgressBefore(before.percentageComplete);

        // Detect level-up
        if (after.currentLevel > levelBefore) {
            setLevelUpInfo({ from: levelBefore, to: after.currentLevel });
        }

        setSaveStatus("saved");

        // Animate the bar: start at pre-save position, animate to post-save
        requestAnimationFrame(() => {
            setTimeout(() => {
                setProgressAfter(after.percentageComplete);
                setBarAnimated(true);
            }, 300); // short delay so the bar is visible before animating
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── EDGE TELEMETRY (3D legacy / direct store modes) ──────────────────────
    useEffect(() => {
        if (isLocalMode) return;

        if (status === 'finished' && !hasSaved.current) {
            hasSaved.current = true;
            setSaveStatus("saving");

            const saveTelemetry = async () => {
                try {
                    const xpPayout = calculateXpDistribution(currentMode, sessionXp);

                    const payload = {
                        userId:          'guest_user_123',
                        protocol:        currentMode,
                        score:           displayScore,
                        shotsFired:      shotsFired,
                        accuracy:        accuracy,
                        kps:             parseFloat(avgKps),
                        durationSeconds: durationSeconds,
                        ...xpPayout,
                    };

                    let response = await fetch('/api/save-session', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify(payload),
                    });

                    // Retry-with-Refresh Logic for Token Expiration Edge Case
                    if (response.status === 401) {
                        try {
                            const refreshRes = await fetch('/api/auth/session');
                            if (refreshRes.ok) {
                                response = await fetch('/api/save-session', {
                                    method:  'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body:    JSON.stringify(payload),
                                });
                            }
                        } catch (refreshErr) {
                            console.warn("Silent re-auth failed:", refreshErr);
                        }
                    }

                    if (response.status === 401) {
                        setSaveStatus("error");
                        if (confirm("Your session expired. Would you like to log in again to save your score?")) {
                            router.push("/auth/login?redirect=/dashboard");
                        }
                        return;
                    }

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
                await document.exitFullscreen().catch(() => {});
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

    // Grid column count: 4 when no combo cell, 5 when combo is shown
    const gridCols = showComboCell ? 'md:grid-cols-5' : 'md:grid-cols-4';

    // Current bar width — start at pre-save progress, animate to post-save
    const barWidth = barAnimated ? progressAfter : progressBefore;

    return (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-xl pointer-events-auto flex items-center justify-center p-6 transition-all duration-500 ease-out animate-in fade-in zoom-in-95">

            {/* ── SYNCING OVERLAY ────────────────────────────────────────────── */}
            {saveStatus === "saving" && (
                <div className="absolute inset-0 z-[300] flex flex-col items-center justify-center bg-black/60 backdrop-blur-lg rounded-3xl">
                    <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
                        {/* Spinner */}
                        <div className="w-10 h-10 border-4 border-[#3366FF]/30 border-t-[#3366FF] rounded-full animate-spin" />
                        <p className="text-white text-sm font-bold tracking-[0.3em] uppercase">
                            Syncing Telemetry to Edge...
                        </p>
                        <p className="text-gray-500 text-xs tracking-wider">
                            Uploading to Cloudflare D1
                        </p>
                    </div>
                </div>
            )}

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
                    {saveStatus === "saving" && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
                    {saveStatus === "saved"  && <div className="w-2 h-2 bg-[#1DB954] rounded-full shadow-[0_0_8px_#1DB954]" />}
                    {saveStatus === "error"  && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                    <span className="text-xs tracking-widest text-gray-400 uppercase">
                        {saveStatus === "saving" ? "Syncing Telemetry to Edge..."
                            : saveStatus === "saved" ? "Data Secured to D1"
                            : "Sync Failed"}
                    </span>
                </div>

                <div className="mb-8 text-center h-6">
                    {isNewBest ? (
                        <span className="text-yellow-400 text-sm font-black tracking-[0.3em] uppercase animate-pulse">⭐ New Personal Best! ⭐</span>
                    ) : (
                        <span className="text-gray-500 text-sm font-bold tracking-[0.2em] uppercase">Personal Best: {highScore || 0}</span>
                    )}
                </div>

                {/* THE METRIC GRID — combo cell hidden for modes that don't support it */}
                <div className={`grid grid-cols-2 ${gridCols} gap-4 w-full mb-8 relative z-10`}>
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

                    {showComboCell && (
                        <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                            <span className="text-gray-500 text-[10px] font-black tracking-wider mb-2 uppercase">Max Combo</span>
                            <span className="text-3xl font-black italic text-orange-400 tabular-nums drop-shadow-md">x{maxCombo}</span>
                        </div>
                    )}

                    <div className="flex flex-col items-center p-4 bg-white/5 rounded-2xl border border-[#3366FF]/30 shadow-[0_0_15px_rgba(51,102,255,0.1)] relative overflow-hidden">
                        <span className="text-[#3366FF] text-[10px] font-black tracking-wider mb-2 uppercase">Total XP</span>
                        <span className="text-3xl font-black text-[#3366FF] tabular-nums">+{sessionXp.toLocaleString()}</span>
                    </div>
                </div>

                {/* ── XP LEVEL PROGRESS BAR ────────────────────────────────────── */}
                {isLocalMode && (
                    <div className="w-full mb-8 relative z-10">
                        {(() => {
                            const stats       = StorageEngine.getUserStats();
                            const xpNow       = stats.xp || 0;
                            const progress    = getLevelProgress(xpNow);
                            return (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-xs font-black tracking-widest uppercase">
                                            Level {progress.currentLevel}
                                        </span>
                                        <span className="text-gray-600 text-xs font-bold tracking-wider">
                                            {Math.round(progress.xpIntoLevel).toLocaleString()} / {Math.round(progress.xpNeededForNext).toLocaleString()} XP
                                        </span>
                                        <span className="text-gray-400 text-xs font-black tracking-widest uppercase">
                                            Level {progress.nextLevel}
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-[#3366FF] to-cyan-400 shadow-[0_0_8px_rgba(51,102,255,0.6)]"
                                            style={{
                                                width: `${barWidth}%`,
                                                transition: 'width 0.6s ease-out',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* LEVEL-UP BANNER */}
                {levelUpInfo && (
                    <div className="w-full mb-8 relative z-10">
                        <div className="relative flex items-center justify-center gap-4 py-4 px-6 rounded-2xl border border-yellow-400/40 bg-yellow-400/5 overflow-hidden">
                            {/* Animated shimmer */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-[shimmer_2s_infinite] pointer-events-none" />
                            <span className="text-2xl">⚡</span>
                            <div className="text-center">
                                <p className="text-yellow-400 text-xs font-black tracking-[0.4em] uppercase">Level Up!</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-white/40 text-lg font-black line-through">{levelUpInfo.from}</span>
                                    <span className="text-yellow-400 text-sm">→</span>
                                    <span className="text-yellow-300 text-3xl font-black" style={{ textShadow: '0 0 20px rgba(250,204,21,0.8)' }}>{levelUpInfo.to}</span>
                                </div>
                            </div>
                            <span className="text-2xl">⚡</span>
                        </div>
                    </div>
                )}

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