"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { proPlaylists, type ProPlaylist } from "@/lib/config/proPlaylists";

type GameFilterType = "ALL" | "Valorant" | "CS2";
type TierFilterType = "ALL" | "pro-team" | "specialist";

export default function ProMarketplace() {
    const router = useRouter();
    const [gameFilter, setGameFilter] = useState<GameFilterType>("ALL");
    const [tierFilter, setTierFilter] = useState<TierFilterType>("ALL");

    // Filtering logic (Hybrid gameFocus displays under both Valorant and CS2)
    const filteredPlaylists = proPlaylists.filter((playlist) => {
        const matchesGame =
            gameFilter === "ALL" ||
            playlist.gameFocus === gameFilter ||
            (playlist.gameFocus === "Hybrid" && (gameFilter === "Valorant" || gameFilter === "CS2"));

        const matchesTier = tierFilter === "ALL" || playlist.creatorType === tierFilter;

        return matchesGame && matchesTier;
    });

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
        if (mins > 0) return `${mins}m`;
        return `${secs}s`;
    };

    const getDifficultyBadgeColor = (difficulty: string) => {
        switch (difficulty) {
            case "Eco":
                return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
            case "Bonus":
                return "text-[#3366FF] border-[#3366FF]/20 bg-[#3366FF]/5";
            case "Force Buy":
                return "text-orange-400 border-orange-500/20 bg-orange-500/5";
            case "Full Buy":
                return "text-red-400 border-red-500/20 bg-red-500/5";
            default:
                return "text-gray-400 border-gray-500/20 bg-gray-500/5";
        }
    };

    const getGameFocusBadgeColor = (focus: "Valorant" | "CS2" | "Hybrid") => {
        switch (focus) {
            case "Valorant":
                return "text-red-400 border-red-500/30 bg-red-500/5";
            case "CS2":
                return "text-amber-500 border-amber-500/30 bg-amber-500/5";
            case "Hybrid":
                return "text-purple-400 border-purple-500/30 bg-purple-500/5";
            default:
                return "text-gray-400 border-gray-500/30 bg-gray-500/5";
        }
    };

    return (
        <div className="w-full space-y-6">
            {/* Dual-Axis Filter Controls */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-white/5 pb-6">
                <div className="flex flex-wrap gap-6">
                    {/* Game Focus Axis */}
                    <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase block">
                            Game Calibration
                        </span>
                        <div className="flex gap-1.5 bg-black/30 p-1 rounded-lg border border-white/5">
                            {(["ALL", "Valorant", "CS2"] as const).map((game) => (
                                <button
                                    key={game}
                                    onClick={() => setGameFilter(game)}
                                    className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${
                                        gameFilter === game
                                            ? "bg-[#3366FF] text-white shadow-[0_0_12px_rgba(51,102,255,0.4)]"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    {game}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Creator Tier Axis */}
                    <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase block">
                            Athletes & Specialists
                        </span>
                        <div className="flex gap-1.5 bg-black/30 p-1 rounded-lg border border-white/5">
                            {[
                                { key: "ALL", label: "All Creators" },
                                { key: "pro-team", label: "Pro Teams" },
                                { key: "specialist", label: "Streamers" },
                            ].map((tier) => (
                                <button
                                    key={tier.key}
                                    onClick={() => setTierFilter(tier.key as TierFilterType)}
                                    className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${
                                        tierFilter === tier.key
                                            ? "bg-[#3366FF] text-white shadow-[0_0_12px_rgba(51,102,255,0.4)]"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    {tier.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <span className="text-[10px] text-slate-500 font-black tracking-wider uppercase">
                    {filteredPlaylists.length} Regimens Compiled
                </span>
            </div>

            {/* Playlist Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlaylists.map((playlist) => {
                    const totalDuration = playlist.sequence.reduce(
                        (acc, item) => acc + item.duration,
                        0
                    );

                    return (
                        <div
                            key={playlist.id}
                            className={`group relative flex flex-col justify-between bg-black/40 rounded-2xl p-6 border backdrop-blur-md transition-all duration-300 ${playlist.accentColor}`}
                        >
                            {/* Inner grid overlay */}
                            <div className="absolute inset-0 pointer-events-none rounded-2xl opacity-[0.02] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:24px_24px] overflow-hidden" />

                            <div className="relative z-10 space-y-4">
                                {/* Creator / Badges */}
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider leading-none">
                                            {playlist.proName}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">
                                            {playlist.team}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span
                                            className={`px-2 py-0.5 text-[8px] font-black tracking-widest rounded border uppercase ${
                                                playlist.creatorType === "pro-team"
                                                    ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/5"
                                                    : "text-pink-400 border-pink-500/30 bg-pink-500/5"
                                            }`}
                                        >
                                            {playlist.creatorType === "pro-team" ? "PRO" : "SPEC"}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 text-[8px] font-black tracking-widest rounded border uppercase ${getGameFocusBadgeColor(
                                                playlist.gameFocus
                                            )}`}
                                        >
                                            {playlist.gameFocus}
                                        </span>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-slate-400 text-xs leading-relaxed min-h-[40px]">
                                    {playlist.description}
                                </p>

                                {/* Sequence Preview */}
                                <div className="space-y-1.5 border-t border-white/5 pt-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase">
                                            Sequence Drills
                                        </p>
                                        <span className="text-[9px] text-slate-400 font-bold tracking-wider">
                                            {playlist.sequence.length} Drills
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {playlist.sequence.map((drill, idx) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between items-center text-xs bg-[#121212]/60 border border-white/5 rounded-lg p-2 hover:border-white/10 transition-all"
                                            >
                                                <span className="text-white font-bold tracking-wide">
                                                    {drill.name}
                                                </span>
                                                <div className="flex gap-2 items-center">
                                                    <span
                                                        className={`px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider rounded border ${getDifficultyBadgeColor(
                                                            drill.difficulty
                                                        )}`}
                                                    >
                                                        {drill.difficulty}
                                                    </span>
                                                    <span className="text-slate-500 font-mono text-[10px]">
                                                        {drill.duration}s
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Launcher */}
                            <div className="relative z-10 mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                                <div className="text-left">
                                    <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase">
                                        Regimen length
                                    </p>
                                    <p className="text-sm font-mono text-white font-black">
                                        {formatDuration(totalDuration)}
                                    </p>
                                </div>

                                <button
                                    onClick={() => router.push(`/game?playlist=${playlist.id}`)}
                                    className="px-4 py-2.5 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#3366FF] hover:text-white transition-all shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:shadow-[0_0_15px_rgba(51,102,255,0.4)]"
                                >
                                    Initialize Sequence
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
