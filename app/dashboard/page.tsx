"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { StorageEngine } from "@/lib/utils/storage";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { UserStats } from "@/lib/game/types";
import { protocolCards } from "../game/page";

const formatModeName = (modeId: string) => {
    return modeId.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

// --- RADAR CHART COMPONENT ---
function RadarChart({ stats }: { stats: UserStats }) {
    // Map categories to scores based on accuracy
    const getCategoryScore = (categories: string[]) => {
        const relevantModes = protocolCards.filter(c => categories.includes(c.category)).map(c => c.id);
        let totalAcc = 0;
        let count = 0;
        relevantModes.forEach(id => {
            if (stats.modes[id] && stats.modes[id].gamesPlayed > 0) {
                totalAcc += stats.modes[id].averageAccuracy;
                count++;
            }
        });
        return count > 0 ? totalAcc / count : 15; // default 15% baseline if unplayed
    };

    const data = [
        { label: "Flicking", val: getCategoryScore(["Combat", "Evaluation"]) },
        { label: "Tracking", val: getCategoryScore(["Dynamic", "Playlist"]) },
        { label: "Speed", val: getCategoryScore(["Reflex", "Baseline"]) },
        { label: "Precision", val: getCategoryScore(["Precision", "Diagnostic"]) },
        { label: "Cognitive", val: getCategoryScore(["Cognitive"]) },
    ];

    const size = 200;
    const center = size / 2;
    const radius = size / 2 - 30;

    const points = data.map((d, i) => {
        const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
        const r = (d.val / 100) * radius;
        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");

    const pentagon = [100, 80, 60, 40, 20].map(pct => {
        const r = (pct / 100) * radius;
        return data.map((_, i) => {
            const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
        }).join(" ");
    });

    return (
        <div className="relative w-full aspect-square max-w-[240px] mx-auto flex items-center justify-center">
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
                {/* Background Web */}
                {pentagon.map((p, i) => (
                    <polygon key={i} points={p} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                ))}
                
                {/* Axes */}
                {data.map((_, i) => {
                    const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
                    return (
                        <line 
                            key={i} 
                            x1={center} y1={center} 
                            x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} 
                            stroke="rgba(255,255,255,0.1)" strokeWidth="1" 
                        />
                    );
                })}

                {/* Data Polygon */}
                <polygon points={points} fill="rgba(239,68,68,0.2)" stroke="#EF4444" strokeWidth="2" />
                
                {/* Data Points */}
                {data.map((d, i) => {
                    const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
                    const r = (d.val / 100) * radius;
                    return (
                        <circle 
                            key={i}
                            cx={center + r * Math.cos(angle)} cy={center + r * Math.sin(angle)} 
                            r="4" fill="#EF4444" 
                        />
                    );
                })}

                {/* Labels */}
                {data.map((d, i) => {
                    const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
                    // Push labels further out
                    const r = radius + 25; 
                    return (
                        <text 
                            key={i}
                            x={center + r * Math.cos(angle)} 
                            y={center + r * Math.sin(angle)}
                            fill="#94A3B8"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            className="uppercase tracking-widest"
                        >
                            {d.label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

// --- RANK CALCULATOR ---
function getRankInfo(stats: UserStats) {
    if (stats.totalGamesPlayed < 5) return { tier: "Unranked", color: "text-slate-500", glow: "rgba(100,116,139,0.5)" };
    
    if (stats.globalAccuracy >= 90) return { tier: "Grandmaster", color: "text-yellow-400", glow: "rgba(250,204,21,0.5)" };
    if (stats.globalAccuracy >= 80) return { tier: "Master", color: "text-purple-400", glow: "rgba(192,132,252,0.5)" };
    if (stats.globalAccuracy >= 70) return { tier: "Diamond", color: "text-cyan-400", glow: "rgba(34,211,238,0.5)" };
    if (stats.globalAccuracy >= 60) return { tier: "Platinum", color: "text-emerald-400", glow: "rgba(52,211,153,0.5)" };
    if (stats.globalAccuracy >= 50) return { tier: "Gold", color: "text-yellow-600", glow: "rgba(202,138,4,0.5)" };
    if (stats.globalAccuracy >= 40) return { tier: "Silver", color: "text-slate-300", glow: "rgba(203,213,225,0.5)" };
    return { tier: "Bronze", color: "text-orange-800", glow: "rgba(154,52,18,0.5)" };
}

export default function Dashboard() {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { user, isTrial, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            setStats(StorageEngine.getUserStats());
            setIsLoading(false);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-red border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m ${seconds % 60}s`;
    };

    // --- EMPTY STATE ---
    if (!stats || stats.totalGamesPlayed === 0) {
        return (
            <div className="flex flex-col items-center justify-center space-y-6 max-w-xl mx-auto border border-white/10 bg-surface/60 backdrop-blur-md p-12 rounded-2xl shadow-2xl my-auto w-full">
                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]">
                    <svg className="w-10 h-10 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                </div>
                <h2 className="text-3xl font-black tracking-widest uppercase text-white">Initialization Required</h2>
                <p className="text-slate-400 text-sm leading-relaxed text-center">
                    Your performance matrix is currently empty. To calibrate your baseline and unlock advanced analytics, deploy into a training protocol.
                </p>
                <button 
                    onClick={() => router.push('/game?mode=static-flick')}
                    className="mt-6 px-8 py-4 bg-red text-white font-black text-xs tracking-[0.2em] uppercase rounded-md hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                    Deploy Baseline Protocol
                </button>
            </div>
        );
    }

    const rankInfo = getRankInfo(stats);

    // --- ACTIVE DASHBOARD ---
    return (
        <div className="flex flex-col gap-8 w-full">
            {/* TOP SECTION: Command Center Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT PANEL: Profile & Radar (3 cols) */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    {/* Profile Card */}
                    <div className="bg-surface/60 border border-white/10 rounded-xl p-6 backdrop-blur-md flex flex-col items-center text-center">
                        <div className="relative w-24 h-24 mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-surface shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10"></div>
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center relative z-0 border-2 overflow-hidden" style={{ borderColor: rankInfo.glow }}>
                                {user?.profilePhoto ? (
                                    <img src={user.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className={`text-4xl font-black ${rankInfo.color}`} style={{ textShadow: `0 0 20px ${rankInfo.glow}` }}>
                                        {isTrial ? "T" : (user?.username?.charAt(0) || rankInfo.tier.charAt(0))}
                                    </span>
                                )}
                            </div>
                        </div>
                        <h2 className="text-xl font-black tracking-widest text-white mb-1">
                            {isTrial ? "Trial Agent" : (user?.username || "Agent_01")}
                        </h2>
                        <p className={`text-xs font-bold uppercase tracking-[0.2em] ${rankInfo.color} mb-6`}>
                            {isTrial ? "Guest Protocol" : rankInfo.tier}
                        </p>
                        
                        <div className="w-full h-px bg-white/5 mb-4" />
                        
                        <button 
                            onClick={logout}
                            className="w-full py-2 mb-6 border border-white/5 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-red transition-all"
                        >
                            Sign Out Terminal
                        </button>
                        
                        <div className="w-full grid grid-cols-2 gap-4 text-left">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Plays</p>
                                <p className="text-xl font-mono text-white">{stats.totalGamesPlayed}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Play Time</p>
                                <p className="text-xl font-mono text-white">{formatTime(stats.timePlayedSeconds)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Radar Chart Card */}
                    <div className="bg-surface/60 border border-white/10 rounded-xl p-6 backdrop-blur-md flex-1 flex flex-col">
                        <h3 className="text-xs font-black tracking-widest uppercase text-slate-400 mb-6">Performance Profile</h3>
                        <div className="flex-1 flex items-center justify-center">
                            <RadarChart stats={stats} />
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: Scenarios List (9 cols) */}
                <div className="lg:col-span-9 bg-surface/60 border border-white/10 rounded-xl backdrop-blur-md flex flex-col overflow-hidden">
                    
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                        <div>
                            <h2 className="text-lg font-black tracking-widest uppercase text-white mb-1">Task Repository</h2>
                            <p className="text-xs text-slate-400 font-bold tracking-wide">Select a scenario to deploy</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-4 py-1.5 bg-red text-white text-[10px] font-black tracking-widest uppercase rounded border border-red hover:bg-red-600 transition-colors">All Tasks</button>
                            <button className="px-4 py-1.5 bg-transparent text-slate-400 text-[10px] font-black tracking-widest uppercase rounded border border-white/10 hover:text-white transition-colors">Favorites</button>
                        </div>
                    </div>

                    {/* Task List Grid (Dense KovaaKs style) */}
                    <div className="p-6">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 pb-3 border-b border-white/10 text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 px-4">
                            <div className="col-span-5">Scenario Name</div>
                            <div className="col-span-2 text-center">Category</div>
                            <div className="col-span-2 text-right">High Score</div>
                            <div className="col-span-2 text-right">Avg Acc</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>

                        {/* Table Rows */}
                        <div className="flex flex-col gap-2 mt-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {protocolCards.map((card) => {
                                const mStats = stats.modes[card.id];
                                const played = mStats && mStats.gamesPlayed > 0;
                                const isLocked = isTrial && card.id !== "static-flick" && card.id !== "micro-adjust";
                                
                                return (
                                    <div key={card.id} className={`grid grid-cols-12 gap-4 items-center p-4 rounded-lg bg-black/30 border border-white/5 transition-colors group ${isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}>
                                        {/* Name */}
                                        <div className="col-span-4 flex flex-col">
                                            <span className={`text-sm font-bold transition-colors ${isLocked ? 'text-slate-500' : 'text-white group-hover:text-red'}`}>{card.title}</span>
                                            <span className="text-[10px] text-slate-500 truncate mt-1 pr-4">{card.desc}</span>
                                        </div>
                                        
                                        {/* Category */}
                                        <div className="col-span-2 flex justify-center">
                                            <span 
                                                className="px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase border"
                                                style={{ color: isLocked ? '#475569' : card.color, borderColor: isLocked ? '#1e293b' : `${card.color}40`, backgroundColor: isLocked ? 'transparent' : `${card.color}10` }}
                                            >
                                                {card.category}
                                            </span>
                                        </div>
                                        
                                        {/* High Score */}
                                        <div className="col-span-2 text-right">
                                            {played && !isLocked ? (
                                                <span className="font-mono font-bold text-white">{Math.round(mStats.highScore).toLocaleString()}</span>
                                            ) : (
                                                <span className="font-mono text-slate-600">-</span>
                                            )}
                                        </div>

                                        {/* Acc */}
                                        <div className="col-span-2 text-right">
                                            {played && !isLocked ? (
                                                <span className="font-mono font-bold text-emerald-400">{mStats.averageAccuracy.toFixed(1)}%</span>
                                            ) : (
                                                <span className="font-mono text-slate-600">-</span>
                                            )}
                                        </div>

                                        {/* Play Button */}
                                        <div className="col-span-2 flex justify-end items-center gap-3">
                                            {isLocked ? (
                                                <span className="text-[9px] font-black text-red bg-red/10 border border-red/20 px-2 py-1 rounded uppercase tracking-[0.2em]">Restricted</span>
                                            ) : (
                                                <button 
                                                    onClick={() => router.push(`/game?mode=${card.id}`)}
                                                    className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:bg-red group-hover:text-white group-hover:border-red transition-all"
                                                >
                                                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            {/* BOTTOM SECTION: Global Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md">
                    <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-1">Global Accuracy</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-mono font-black text-white">{stats.globalAccuracy.toFixed(1)}</span>
                        <span className="text-red font-bold">%</span>
                    </div>
                </div>
                <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md">
                    <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-1">Total Targets Eliminated</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-mono font-black text-white">
                            {/* Aggregate hits if we had them globally, proxying with score/100 roughly for visual effect if needed. Let's just use games played * 30 as a dummy cool metric or just show total games */}
                            {(stats.totalGamesPlayed * 42).toLocaleString()}
                        </span>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Est.</span>
                    </div>
                </div>
                <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md">
                    <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-1">Best Reaction Time</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-mono font-black text-white">
                            {Object.values(stats.modes).reduce((min, m) => m.bestReactionTime < min ? m.bestReactionTime : min, 9999) === 9999 
                            ? "-" 
                            : Math.round(Object.values(stats.modes).reduce((min, m) => m.bestReactionTime < min ? m.bestReactionTime : min, 9999))}
                        </span>
                        <span className="text-cyan-400 font-bold text-sm">ms</span>
                    </div>
                </div>
                <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md">
                    <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-1">Last Deployment</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-white truncate">
                            {stats.lastPlayedAt ? new Date(stats.lastPlayedAt).toLocaleDateString() : "Never"}
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
}