"use client";

import { useEffect, useState } from "react";
import { StorageEngine } from "@/lib/utils/storage";
import type { UserStats } from "@/lib/game/types";
import { protocolCards } from "../game/page"; // Assuming you export this from game/page.tsx for consistency, or we can hardcode the mode names

export default function Dashboard() {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Fetch stats on client mount to bypass Next.js SSR hydration errors
        const loadStats = () => {
            const data = StorageEngine.getUserStats();
            setStats(data);
            setIsLoading(false);
        };
        loadStats();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#121212] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#3366FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // --- HELPER FORMATTING ---
    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m ${seconds % 60}s`;
    };

    const formatModeName = (modeId: string) => {
        return modeId.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    };

    // --- EMPTY STATE ---
    if (!stats || stats.totalGamesPlayed === 0) {
        return (
            <div className="min-h-screen bg-[#121212] text-[#EAEAEA] p-8 md:p-16 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
                <div className="relative z-10 text-center space-y-6 max-w-xl border border-white/10 bg-black/40 backdrop-blur-md p-12 rounded-3xl shadow-2xl">
                    <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
                        <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black tracking-widest uppercase text-white">No Data Found</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Your performance matrix is currently empty. Initialize a training protocol from the Hub to begin recording your mechanical baseline.
                    </p>
                    <a href="/game" className="inline-block mt-4 px-8 py-3 bg-[#3366FF] text-white font-bold tracking-[0.2em] uppercase rounded-xl hover:bg-white hover:text-[#3366FF] transition-all">
                        Launch Terminal
                    </a>
                </div>
            </div>
        );
    }

    // --- ACTIVE DASHBOARD ---
    return (
        <div className="min-h-screen bg-[#121212] text-[#EAEAEA] p-8 md:p-16 relative overflow-x-hidden">
            {/* Background Grid */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_1000px_at_50%_0%,rgba(51,102,255,0.05),transparent)]"></div>

            <div className="relative z-10 w-full max-w-7xl mx-auto space-y-12">

                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6">
                    <div className="space-y-2">
                        <p className="text-[#3366FF] text-sm font-bold tracking-[0.4em] uppercase">Operator Profile</p>
                        <h1 className="text-5xl font-black tracking-widest uppercase text-white drop-shadow-lg">Metrics Dashboard</h1>
                    </div>
                    <div className="mt-4 md:mt-0 text-right">
                        <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">Last Sync</p>
                        <p className="text-sm text-gray-300">
                            {stats.lastPlayedAt ? new Date(stats.lastPlayedAt).toLocaleString() : "Unknown"}
                        </p>
                    </div>
                </div>

                {/* Global Metrics Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-black/80 to-black/40 border border-white/10 p-8 rounded-3xl backdrop-blur-md shadow-xl flex flex-col justify-center">
                        <span className="text-[#1DB954] text-xs font-bold tracking-widest uppercase mb-2">Total Deployments</span>
                        <span className="text-6xl font-black text-white">{stats.totalGamesPlayed}</span>
                    </div>

                    <div className="bg-gradient-to-br from-black/80 to-black/40 border border-white/10 p-8 rounded-3xl backdrop-blur-md shadow-xl flex flex-col justify-center">
                        <span className="text-[#3366FF] text-xs font-bold tracking-widest uppercase mb-2">Global Accuracy</span>
                        <div className="flex items-end space-x-2">
                            <span className="text-6xl font-black text-white">{stats.globalAccuracy.toFixed(1)}</span>
                            <span className="text-2xl font-bold text-gray-500 mb-2">%</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-black/80 to-black/40 border border-white/10 p-8 rounded-3xl backdrop-blur-md shadow-xl flex flex-col justify-center">
                        <span className="text-[#8A2BE2] text-xs font-bold tracking-widest uppercase mb-2">Time in Engine</span>
                        <span className="text-5xl font-black text-white">{formatTime(stats.timePlayedSeconds)}</span>
                    </div>
                </div>

                {/* Mode Breakdown Section */}
                <div className="pt-8">
                    <h2 className="text-2xl font-black tracking-widest uppercase text-white mb-8 border-l-4 border-[#3366FF] pl-4">Protocol Breakdown</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(stats.modes).map(([modeId, modeData]) => (
                            <div key={modeId} className="group flex flex-col p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-black/60 hover:border-white/30 transition-all duration-300">

                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold tracking-wide text-white group-hover:text-[#3366FF] transition-colors">
                                        {formatModeName(modeId)}
                                    </h3>
                                    <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-gray-400">
                                        {modeData.gamesPlayed} plays
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-xs text-gray-500 font-bold tracking-wider">HIGH SCORE</span>
                                        <span className="font-mono text-white font-bold">{Math.round(modeData.highScore)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-xs text-gray-500 font-bold tracking-wider">AVG SCORE</span>
                                        <span className="font-mono text-gray-300">{Math.round(modeData.averageScore)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-xs text-gray-500 font-bold tracking-wider">AVG ACCURACY</span>
                                        <span className="font-mono text-[#1DB954] font-bold">{modeData.averageAccuracy.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-xs text-gray-500 font-bold tracking-wider">BEST REACTION</span>
                                        <span className="font-mono text-cyan-400 font-bold">
                                            {modeData.bestReactionTime < 9999 ? `${Math.round(modeData.bestReactionTime)}ms` : 'N/A'}
                                        </span>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}