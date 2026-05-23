"use client";

import { useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

type LeaderboardEntry = {
    username: string;
    score: number;
    accuracy: number;
    max_combo: number;
    duration_seconds: number;
    created_at: string;
    has_ghost: number;
};

const EXERCISES = [
    { id: "static-flick", name: "Static Flick" },
    { id: "tracking-mode", name: "Continuous Tracking" },
    { id: "reaction-test", name: "Burst Reaction" },
    { id: "target-switch", name: "Target Switching" },
    { id: "micro-precision", name: "Micro Adjust" }
];

const DIFFICULTIES = [
    { id: "eco", name: "Eco (Easy)", gameDiff: "easy" },
    { id: "bonus", name: "Bonus (Medium)", gameDiff: "medium" },
    { id: "force-buy", name: "Force Buy (Hard)", gameDiff: "hard" },
    { id: "full-buy", name: "Full Buy (Extreme)", gameDiff: "extreme" }
];

export default function LeaderboardPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [selectedExercise, setSelectedExercise] = useState("static-flick");
    const [selectedDifficulty, setSelectedDifficulty] = useState("bonus");
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [ghostStatus, setGhostStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [loadingRival, setLoadingRival] = useState<string | null>(null);

    // Fetch standings
    useEffect(() => {
        let active = true;
        setLoading(true);
        fetch(`/api/leaderboard?exerciseId=${selectedExercise}&difficulty=${selectedDifficulty}`)
            .then(res => res.json())
            .then(data => {
                if (active) {
                    if (Array.isArray(data)) {
                        setEntries(data);
                    } else {
                        setEntries([]);
                    }
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error("Failed to fetch standings:", err);
                if (active) {
                    setEntries([]);
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [selectedExercise, selectedDifficulty]);

    // Handle rival ghost loading
    const handleRaceGhost = async (rivalUsername: string) => {
        setGhostStatus(null);
        setLoadingRival(rivalUsername);
        try {
            const res = await fetch(`/api/leaderboard?exerciseId=${selectedExercise}&difficulty=${selectedDifficulty}&rivalUsername=${rivalUsername}`);
            if (!res.ok) throw new Error("Ghost not found");
            const data = await res.json();
            if (data.ghostTelemetry) {
                localStorage.setItem("aimsync_active_ghost", data.ghostTelemetry);
                setGhostStatus({
                    type: "success",
                    message: `Ghost rival profile for '${rivalUsername}' loaded. Secondary target trail will display in game!`
                });
            } else {
                throw new Error("No telemetry content");
            }
        } catch (e) {
            setGhostStatus({
                type: "error",
                message: `Failed to retrieve telemetry profile for '${rivalUsername}'.`
            });
        } finally {
            setLoadingRival(null);
        }
    };

    const activeDiffObj = DIFFICULTIES.find(d => d.id === selectedDifficulty);
    const gameDifficultyKey = activeDiffObj?.gameDiff || "medium";

    const launchSession = () => {
        startTransition(() => {
            router.push(`/game?mode=${selectedExercise}&diff=${gameDifficultyKey}&autoStart=true`);
        });
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#08090d] text-white p-4 md:p-8 font-sans selection:bg-[#00f0ff] selection:text-[#08090d]">
            {/* Header */}
            <div className="max-w-6xl w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-6 mb-8 mt-4">
                <div className="text-center md:text-left space-y-2">
                    <p className="text-[#00f0ff] text-xs font-bold tracking-[0.4em] uppercase">Global Database</p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-widest uppercase">
                        LEADER<span className="text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">BOARD</span>
                    </h1>
                    <p className="text-gray-400 text-sm max-w-xl">
                        Analyze optimal mouse lines and race asynchronous shadows of players globally.
                    </p>
                </div>
                <button
                    onClick={() => router.push("/dashboard")}
                    className="px-6 py-3 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 rounded-xl font-bold tracking-wider transition-all text-sm shrink-0"
                >
                    RETURN TO COMMAND CENTER
                </button>
            </div>

            {/* Filters */}
            <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col space-y-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">DRILL TYPE</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2">
                        {EXERCISES.map(ex => (
                            <button
                                key={ex.id}
                                onClick={() => setSelectedExercise(ex.id)}
                                className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                    selectedExercise === ex.id
                                        ? "bg-[#00f0ff] text-[#08090d] border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                {ex.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col space-y-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">TIER DIFFICULTY</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {DIFFICULTIES.map(diff => (
                            <button
                                key={diff.id}
                                onClick={() => setSelectedDifficulty(diff.id)}
                                className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                                    selectedDifficulty === diff.id
                                        ? "bg-white text-[#08090d] border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                {diff.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Ghost Load Feedback */}
            {ghostStatus && (
                <div className={`max-w-6xl w-full mx-auto p-4 rounded-xl mb-6 border animate-in fade-in slide-in-from-top-4 duration-300 ${
                    ghostStatus.type === "success"
                        ? "bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <p className="text-sm font-semibold">{ghostStatus.message}</p>
                        {ghostStatus.type === "success" && (
                            <button
                                onClick={launchSession}
                                className="px-5 py-2 bg-[#00f0ff] text-[#08090d] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-white transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] shrink-0"
                            >
                                RUN CHALLENGE NOW
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Leaderboard Table */}
            <div className="max-w-6xl w-full mx-auto bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01] text-xs font-bold uppercase tracking-widest text-gray-500">
                                <th className="py-5 px-6">Rank</th>
                                <th className="py-5 px-6">Competitor</th>
                                <th className="py-5 px-6 text-right">High Score</th>
                                <th className="py-5 px-6 text-right">Accuracy</th>
                                <th className="py-5 px-6 text-right">Max Combo</th>
                                <th className="py-5 px-6 text-center">Ghost RivaL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-10 h-10 border-4 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Querying D1 Databank...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center text-gray-500">
                                        <div className="space-y-2">
                                            <p className="text-lg font-bold">No High Scores Registered Yet</p>
                                            <p className="text-xs max-w-sm mx-auto">Be the first to secure a standing on this protocol level difficulty!</p>
                                            <button
                                                onClick={launchSession}
                                                className="mt-4 px-6 py-3 bg-[#00f0ff] text-[#08090d] font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                                            >
                                                INITIALIZE FIRST TRIAL
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry, index) => {
                                    const isSelf = user?.username === entry.username || user?.email === entry.username;
                                    const rank = index + 1;
                                    let rankColor = "text-gray-400";
                                    let rankBg = "bg-white/5";

                                    if (rank === 1) {
                                        rankColor = "text-[#08090d] font-black";
                                        rankBg = "bg-yellow-400";
                                    } else if (rank === 2) {
                                        rankColor = "text-[#08090d] font-black";
                                        rankBg = "bg-slate-300";
                                    } else if (rank === 3) {
                                        rankColor = "text-[#08090d] font-black";
                                        rankBg = "bg-amber-600";
                                    }

                                    return (
                                        <tr key={entry.username} className={`hover:bg-white/[0.02] transition-colors ${isSelf ? "bg-[#00f0ff]/5" : ""}`}>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs ${rankBg} ${rankColor}`}>
                                                    {rank}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 font-bold tracking-wide">
                                                <div className="flex items-center gap-2">
                                                    <span>{entry.username}</span>
                                                    {isSelf && (
                                                        <span className="text-[10px] bg-[#00f0ff]/20 text-[#00f0ff] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                                            YOU
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right font-black text-[#00f0ff]">
                                                {entry.score.toLocaleString()}
                                            </td>
                                            <td className="py-4 px-6 text-right text-gray-300 font-semibold">
                                                {entry.accuracy.toFixed(1)}%
                                            </td>
                                            <td className="py-4 px-6 text-right text-gray-300 font-semibold">
                                                {entry.max_combo}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {entry.has_ghost ? (
                                                    <button
                                                        onClick={() => handleRaceGhost(entry.username)}
                                                        disabled={loadingRival !== null}
                                                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                                                            loadingRival === entry.username
                                                                ? "bg-[#00f0ff]/20 border-[#00f0ff]/30 text-[#00f0ff] animate-pulse"
                                                                : "bg-[#00f0ff]/10 hover:bg-[#00f0ff] border-[#00f0ff]/30 text-[#00f0ff] hover:text-[#08090d] hover:shadow-[0_0_15px_rgba(0,240,255,0.35)]"
                                                        }`}
                                                    >
                                                        {loadingRival === entry.username ? "CHARGING..." : "RACE GHOST"}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">NO TELEMETRY</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
