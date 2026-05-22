"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { StorageEngine } from "@/lib/utils/storage";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { UserStats, CustomPlaylist, PlaylistTask } from "@/lib/game/types";
import dynamic from 'next/dynamic';
import { RoutineDirector } from "@/lib/services/routineDirector";

const RadarProfiler = dynamic(() => import('@/components/RadarProfiler'), {
    ssr: false,
    loading: () => <div className="w-full max-w-md h-[400px] animate-pulse bg-[#121212]/80 backdrop-blur-md rounded-3xl border border-white/5" />
});

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

export default function DashboardPage() {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [playlists, setPlaylists] = useState<CustomPlaylist[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [dailyContract, setDailyContract] = useState<any>(null);
    const [isContractActive, setIsContractActive] = useState(false);

    // --- MODAL STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
    const [draftTasks, setDraftTasks] = useState<PlaylistTask[]>([]);

    // Temporary states for the dropdowns inside the modal
    const [selectedMode, setSelectedMode] = useState("static-flick");
    const [selectedDiff, setSelectedDiff] = useState("Eco");
    const [selectedTime, setSelectedTime] = useState(60);

    const { user, isTrial, logout } = useAuth();
    const router = useRouter();

    const radarData = stats?.xpFactors || { flickingXp: 0, trackingXp: 0, speedXp: 0, precisionXp: 0, perceptionXp: 0, cognitionXp: 0 };

    const handleInitiateDailyContract = async () => {
        const started = await RoutineDirector.startContract(user?.id || "local");
        setDailyContract(started);
        setIsContractActive(true);
        const firstDrill = started.drills[0];
        router.push(`/game?mode=${firstDrill.modeId}&diff=${firstDrill.difficulty}&time=${firstDrill.durationSeconds}&autoStart=true`);
    };

    const handleContinueDailyContract = () => {
        if (dailyContract) {
            const nextDrill = dailyContract.drills[dailyContract.currentStepIndex];
            router.push(`/game?mode=${nextDrill.modeId}&diff=${nextDrill.difficulty}&time=${nextDrill.durationSeconds}&autoStart=true`);
        }
    };

    const handleAbandonDailyContract = () => {
        setShowAbandonConfirm(true);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setStats(StorageEngine.getUserStats());
            setPlaylists(StorageEngine.getPlaylists());
            setDailyContract(RoutineDirector.getContractState());
            setIsContractActive(RoutineDirector.isContractActive());
            setIsLoading(false);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m ${seconds % 60}s`;
    };

    // --- PLAYLIST LOGIC ---
    const handleAddTaskToDraft = () => {
        setDraftTasks([...draftTasks, { mode: selectedMode, difficulty: selectedDiff, timeLimit: selectedTime }]);
    };

    const handleSavePlaylist = () => {
        if (!newPlaylistName || draftTasks.length === 0) return;

        const newPlaylist: CustomPlaylist = {
            id: `playlist-${Date.now()}`,
            name: newPlaylistName,
            description: newPlaylistDesc || "Custom Training Regimen",
            tasks: draftTasks,
            createdAt: Date.now()
        };

        StorageEngine.savePlaylist(newPlaylist);
        setPlaylists([...playlists, newPlaylist]);

        // Reset and close
        setNewPlaylistName("");
        setNewPlaylistDesc("");
        setDraftTasks([]);
        setIsModalOpen(false);
    };

    // --- DYNAMIC TASK GENERATORS (Dailies) ---
    const activeTasks = useMemo(() => {
        const date = new Date();
        const dailySeed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
        const weekSeed = Math.floor(dailySeed / 7);

        const difficulties = ['Eco', 'Bonus', 'Force Buy'];
        const timeLimits = [30, 60, 90, 120];

        const getModifier = (array: string[] | number[], offset: number) => array[(dailySeed + offset) % array.length];

        const coreBases = [
            { mode: 'static-flick', name: 'Baseline: Flick', focus: 'raw speed' },
            { mode: 'continuous-track', name: 'Baseline: Track', focus: 'reactivity' },
            { mode: 'micro-precision', name: 'Baseline: Micro', focus: 'fine-motor control' }
        ];

        const compulsoryTasks = coreBases.map((base, index) => {
            const diff = getModifier(difficulties, index * 13) as string;
            const time = getModifier(timeLimits, index * 7) as number;

            return {
                id: `task-core-${index}-${dailySeed}`,
                mode: base.mode,
                name: base.name,
                desc: `Calibrate your ${base.focus} for ${time}s on a ${diff}.`,
                difficulty: diff,
                timeLimit: time,
                xpReward: time * 10 + (difficulties.indexOf(diff) * 200)
            };
        });

        const randomPoolBases = [
            { mode: 'static-flick', name: 'Flick Endurance', focus: 'flick stamina' },
            { mode: 'continuous-track', name: 'Tracking Overdrive', focus: 'smooth tracking' },
            { mode: 'micro-precision', name: 'Needlepoint', focus: 'micro-adjustments' },
            { mode: 'cognition-react', name: 'Cognitive Test', focus: 'decision making' }
        ];

        const r1Index = dailySeed % randomPoolBases.length;
        let r2Index = (dailySeed + 3) % randomPoolBases.length;
        if (r1Index === r2Index) r2Index = (r2Index + 1) % randomPoolBases.length;

        const randomSelection = [randomPoolBases[r1Index], randomPoolBases[r2Index]];

        const dailyRandomTasks = randomSelection.map((base, index) => {
            const diff = getModifier(difficulties, index * 19 + 50) as string;
            const time = getModifier(timeLimits, index * 11 + 50) as number;

            return {
                id: `task-rnd-${index}-${dailySeed}`,
                mode: base.mode,
                name: base.name,
                desc: `Train your ${base.focus} for ${time}s on a ${diff}.`,
                difficulty: diff,
                timeLimit: time,
                xpReward: time * 10 + (difficulties.indexOf(diff) * 200)
            };
        });

        const weeklyPool = [
            { mode: 'static-flick', name: 'Operation: Lightning', desc: 'Survive the Full Buy trial for 2 full minutes.', difficulty: 'Full Buy', timeLimit: 120, xpReward: 5000 },
        ];
        const w1Index = weekSeed % weeklyPool.length;

        return {
            daily: [...compulsoryTasks, ...dailyRandomTasks],
            weekly: [
                { id: `task-w1-${weekSeed}`, ...weeklyPool[w1Index] }
            ]
        };
    }, []);

    // --- THE MATRIX GENERATOR (Sandbox) ---
    const baseModes = [
        { mode: 'static-flick', name: 'Static Flick', desc: 'Classic 3-target gridset.', category: 'Flicking', badgeColor: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
        { mode: 'continuous-track', name: 'Orbital Tracking', desc: 'Erratic 3D drone tracking.', category: 'Tracking', badgeColor: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
        { mode: 'micro-precision', name: 'Needlepoint', desc: 'Micro-target precision training.', category: 'Precision', badgeColor: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' },
        { mode: 'cognition-react', name: 'Cognition Test', desc: 'Rapid target identification.', category: 'Cognition', badgeColor: 'text-purple-400 border-purple-400/30 bg-purple-400/10' }
    ];

    const trainingProtocols = useMemo(() => {
        const allDifficulties = ['Eco', 'Bonus', 'Force Buy', 'Full Buy'];
        return baseModes.flatMap(base =>
            allDifficulties.map(diff => ({
                ...base,
                uid: `${base.mode}-${diff.toLowerCase().replace(' ', '-')}`,
                difficulty: diff,
                highScore: stats?.modes?.[base.mode]?.highScore || 0,
                avgAcc: stats?.modes?.[base.mode]?.averageAccuracy || 0,
                gamesPlayed: stats?.modes?.[base.mode]?.gamesPlayed || 0,
                timePlayedSeconds: stats?.modes?.[base.mode]?.timePlayedSeconds || 0,
            }))
        );
    }, [stats]);

    // XP Factor bar helper (normalise to 0–100 relative to the highest factor)
    const xpFactorBars = (() => {
        const f = radarData;
        const max = Math.max(f.flickingXp, f.trackingXp, f.speedXp, f.precisionXp, f.perceptionXp, f.cognitionXp, 1);
        return [
            { label: 'Flicking',   value: f.flickingXp,   color: 'bg-blue-500',    pct: (f.flickingXp   / max) * 100 },
            { label: 'Tracking',   value: f.trackingXp,   color: 'bg-orange-400',  pct: (f.trackingXp   / max) * 100 },
            { label: 'Speed',      value: f.speedXp,      color: 'bg-yellow-400',  pct: (f.speedXp      / max) * 100 },
            { label: 'Precision',  value: f.precisionXp,  color: 'bg-emerald-400', pct: (f.precisionXp  / max) * 100 },
            { label: 'Perception', value: f.perceptionXp, color: 'bg-cyan-400',    pct: (f.perceptionXp / max) * 100 },
            { label: 'Cognition',  value: f.cognitionXp,  color: 'bg-purple-400',  pct: (f.cognitionXp  / max) * 100 },
        ];
    })();

    if (isLoading) return <div className="flex-1 flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    // Safe defaults so new users see zeros instead of a gate screen
    const safeStats = stats ?? {
        totalGamesPlayed: 0, timePlayedSeconds: 0, globalAccuracy: 0,
        modes: {}, level: 1, xp: 0, lastPlayedAt: null,
    } as any;

    const rankInfo = getRankInfo(safeStats);

    const currentLevel  = safeStats.level || 1;
    const currentXp     = safeStats.xp    || 0;
    const prevLevelXp   = Math.pow(currentLevel - 1, 2) * 500;
    const nextLevelXp   = Math.pow(currentLevel,     2) * 500;
    const xpProgress    = currentXp - prevLevelXp;
    const xpRequired    = nextLevelXp - prevLevelXp;
    const xpPercentage  = Math.min(100, Math.max(0, (xpProgress / Math.max(xpRequired, 1)) * 100));

    return (
        <div className="flex flex-col gap-8 w-full relative">

            {/* --- ABANDON CONTRACT CONFIRMATION MODAL --- */}
            {showAbandonConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
                    <div className="bg-[#121212] border border-red-500/20 rounded-2xl p-8 w-full max-w-md shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden">
                        {/* Red accent line on top */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-500 via-rose-500 to-transparent" />
                        
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20">
                                <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">Abandon Contract</h3>
                        </div>
                        
                        <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                            Are you sure you want to terminate the active Daily Contract? This will wipe your progression and status for today.
                        </p>
                        
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowAbandonConfirm(false)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10 transition-all"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={() => {
                                    RoutineDirector.abortContract();
                                    setDailyContract(null);
                                    setIsContractActive(false);
                                    setShowAbandonConfirm(false);
                                }}
                                className="px-5 py-2.5 bg-red-950/60 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/30 hover:border-red-500 transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                            >
                                Terminate Contract
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PLAYLIST CREATOR MODAL --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 w-full max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Create Regimen</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-red-500 font-bold">X</button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6">
                            <input type="text" placeholder="Playlist Name (e.g., Valorant Warmup)" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-bold" />
                            <input type="text" placeholder="Short Description..." value={newPlaylistDesc} onChange={(e) => setNewPlaylistDesc(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-slate-300 text-sm focus:outline-none focus:border-blue-500" />
                        </div>

                        {/* Task Selector */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Add Exercise</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="flex flex-col gap-1.5 md:col-span-2">
                                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Exercise Mode</span>
                                    <select className="bg-black/50 text-white text-xs p-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-blue-500 font-bold transition-all h-[38px] cursor-pointer" value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
                                        {baseModes.map(m => <option key={m.mode} value={m.mode}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Difficulty</span>
                                    <div className="grid grid-cols-4 gap-0.5 bg-black/40 p-1 border border-white/10 rounded-lg h-[38px]">
                                        {['Eco', 'Bonus', 'Force Buy', 'Full Buy'].map((diffOption) => {
                                            const isActive = selectedDiff === diffOption;
                                            return (
                                                <button
                                                    key={diffOption}
                                                    type="button"
                                                    onClick={() => setSelectedDiff(diffOption)}
                                                    className={`rounded text-[9px] font-black uppercase tracking-wider transition-all truncate px-0.5 ${
                                                        isActive
                                                            ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                                >
                                                    {diffOption === 'Force Buy' ? 'Force' : diffOption === 'Full Buy' ? 'Full' : diffOption}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Time Limit</span>
                                    <div className="grid grid-cols-3 gap-0.5 bg-black/40 p-1 border border-white/10 rounded-lg h-[38px]">
                                        {[30, 60, 120].map((tOption) => {
                                            const isActive = selectedTime === tOption;
                                            return (
                                                <button
                                                    key={tOption}
                                                    type="button"
                                                    onClick={() => setSelectedTime(tOption)}
                                                    className={`rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                                                        isActive
                                                            ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                                >
                                                    {tOption}s
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleAddTaskToDraft} className="mt-4 w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-widest rounded-lg border border-blue-500/20 transition-all">+ Add to Queue</button>
                        </div>

                        {/* Draft Queue Preview */}
                        <div className="mb-6 max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {draftTasks.length === 0 ? (
                                <p className="text-center text-slate-600 text-xs italic">Queue is empty.</p>
                            ) : (
                                draftTasks.map((t, i) => (
                                    <div key={i} className="flex justify-between items-center bg-black/40 border border-white/5 p-2 rounded mb-2">
                                        <span className="text-white text-xs font-bold">{baseModes.find(m => m.mode === t.mode)?.name}</span>
                                        <div className="flex gap-2">
                                            <span className="text-[9px] text-orange-400 border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 rounded">{t.difficulty}</span>
                                            <span className="text-[9px] text-slate-400 border border-white/10 bg-white/5 px-2 py-0.5 rounded">{t.timeLimit}s</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button onClick={handleSavePlaylist} disabled={!newPlaylistName || draftTasks.length === 0} className="w-full py-3 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-lg transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                            Save Regimen
                        </button>
                    </div>
                </div>
            )}


            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT PANEL */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-surface/60 border border-white/10 rounded-xl p-6 backdrop-blur-md flex flex-col items-center text-center">
                        <div className="relative w-24 h-24 mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-surface shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10"></div>
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center relative z-0 border-2 overflow-hidden" style={{ borderColor: rankInfo.glow }}>
                                {user?.profilePhoto ? (
                                    <img src={user.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className={`text-4xl font-black ${rankInfo.color}`} style={{ textShadow: `0 0 20px ${rankInfo.glow}` }}>{isTrial ? "T" : (user?.username?.charAt(0) || rankInfo.tier.charAt(0))}</span>
                                )}
                            </div>
                        </div>
                        <h2 className="text-xl font-black tracking-widest text-white mb-1">{isTrial ? "Trial Agent" : (user?.username || "Agent_01")}</h2>
                        <p className={`text-xs font-bold uppercase tracking-[0.2em] ${rankInfo.color} mb-6`}>{isTrial ? "Guest Protocol" : rankInfo.tier}</p>

                        {/* --- XP BAR --- */}
                        <div className="w-full bg-black/50 border border-white/10 rounded-lg p-4 mb-6 relative overflow-hidden">
                            <div className="flex justify-between items-end mb-2 relative z-10">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Level</span>
                                    <span className="text-2xl font-black text-white">{currentLevel}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest">{currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden relative z-10">
                                <div
                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-1000"
                                    style={{ width: `${xpPercentage}%` }}
                                />
                            </div>
                        </div>

                        <div className="w-full h-px bg-white/5 mb-4" />
                        {/* XP Factor Breakdown */}
                        <div className="w-full mb-4 space-y-2">
                            {xpFactorBars.map(bar => (
                                <div key={bar.label}>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{bar.label}</span>
                                        <span className="text-[9px] font-mono text-slate-400">{bar.value.toLocaleString()} XP</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${bar.color} rounded-full transition-all duration-1000`} style={{ width: `${bar.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="w-full h-px bg-white/5 mb-4" />
                        <button onClick={logout} className="w-full py-2 mb-4 border border-white/5 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-red-500 transition-all">Sign Out Terminal</button>
                        <div className="w-full grid grid-cols-2 gap-4 text-left">
                            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Plays</p><p className="text-xl font-mono text-white">{safeStats.totalGamesPlayed}</p></div>
                            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Play Time</p><p className="text-xl font-mono text-white">{formatTime(safeStats.timePlayedSeconds || 0)}</p></div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center"><RadarProfiler stats={radarData} /></div>
                </div>

                {/* RIGHT PANEL */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* DAILY CONTRACT PROTOCOL */}
                    <div className="bg-[#0b0f19]/80 border border-blue-500/25 p-6 rounded-xl backdrop-blur-md relative overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                        {/* Glowing accent border */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-transparent" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4 relative z-10">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black tracking-widest text-[#00E5FF] bg-[#00E5FF]/10 rounded border border-[#00E5FF]/30 uppercase">DIRECTOR INTELLIGENCE</span>
                                    {isContractActive && <span className="h-1.5 w-1.5 bg-[#00E5FF] rounded-full animate-ping" />}
                                </div>
                                <h2 className="text-white font-black text-xl uppercase tracking-wider mt-1">Daily Training Contract</h2>
                                <p className="text-slate-400 text-xs mt-0.5">Custom performance-calibrated neurological routine</p>
                            </div>
                            
                            {!isContractActive ? (
                                <button
                                    onClick={handleInitiateDailyContract}
                                    className="px-6 py-3 bg-gradient-to-r from-[#3366FF] to-cyan-500 hover:brightness-110 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(51,102,255,0.4)]"
                                >
                                    Initiate Contract
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAbandonDailyContract}
                                        className="px-4 py-3 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                    >
                                        Abandon
                                    </button>
                                    <button
                                        onClick={handleContinueDailyContract}
                                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                                    >
                                        Continue Contract
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Contract status & steps */}
                        {isContractActive && dailyContract ? (
                            <div className="mt-4 relative z-10 border-t border-white/5 pt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        Sequence Progression
                                    </span>
                                    <span className="text-xs font-mono text-[#00E5FF] font-black">
                                        {dailyContract.currentStepIndex} / {dailyContract.drills.length} Completed
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {dailyContract.drills.map((drill: any, idx: number) => {
                                        const isActive = idx === dailyContract.currentStepIndex;
                                        const isCompleted = idx < dailyContract.currentStepIndex;
                                        const { getModeConfig } = require("@/lib/config/modeRegistry");
                                        const drillName = getModeConfig(drill.modeId)?.name || drill.modeId;
                                        return (
                                            <div
                                                key={idx}
                                                className={`p-2 rounded border text-center transition-all ${
                                                    isCompleted
                                                        ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-400"
                                                        : isActive
                                                        ? "bg-cyan-500/10 border-cyan-500/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                                                        : "bg-white/5 border-white/5 text-slate-500"
                                                }`}
                                            >
                                                <div className="text-[9px] font-black uppercase tracking-widest truncate">{drillName}</div>
                                                <div className="text-[8px] font-mono mt-1 opacity-80">
                                                    {isCompleted ? "✓ DONE" : isActive ? "▶ ACTIVE" : "⚿ LOCKED"}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2 text-slate-500 text-xs leading-relaxed border-t border-white/5 pt-3">
                                The director analyzes your performance telemetry history across all cognitive metrics to generate a balanced 5-exercise regimen every day. Initiating locks the console until all 5 routines are completed.
                            </div>
                        )}
                    </div>

                    {/* BOX 1: ACTIVE OPERATIONS */}
                    <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md relative overflow-hidden">
                        {/* Background glow effect for the panel */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
                            <div><h2 className="text-white font-black text-lg uppercase tracking-widest">Active Operations</h2><p className="text-slate-400 text-sm">Time-sensitive training contracts</p></div>
                        </div>
                        <div className="mb-8 relative z-10">
                            <div className="flex items-center gap-3 mb-2 px-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                                <h3 className="text-white font-black tracking-[0.2em] uppercase text-xs">Daily Contracts</h3>
                                <span className="text-slate-500 text-[10px] font-mono ml-auto">
                                    {activeTasks.daily.filter(t => safeStats?.completedTasks?.includes(t.id)).length} / {activeTasks.daily.length} Completed
                                </span>
                            </div>
                            <div className="w-full bg-white/5 h-1 mb-4 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-1000 ease-out" style={{ width: `${(activeTasks.daily.filter(t => safeStats?.completedTasks?.includes(t.id)).length / activeTasks.daily.length) * 100}%` }} />
                            </div>
                            <div className="flex flex-col gap-2">
                                {activeTasks.daily.map((task) => {
                                    const isCompleted = safeStats?.completedTasks?.includes(task.id);
                                    return (
                                        <div key={task.id} className={`group relative bg-[#121212]/50 border ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 hover:border-blue-500/50'} rounded-lg p-4 transition-colors overflow-hidden`}>
                                            <div className={`absolute inset-0 bg-gradient-to-r ${isCompleted ? 'from-emerald-500/0 via-emerald-500/0 to-emerald-500/5' : 'from-blue-500/0 via-blue-500/0 to-blue-500/5 group-hover:to-blue-500/20'} transition-all pointer-events-none`} />
                                            <div className="flex justify-between items-center relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className={`mt-1 w-5 h-5 rounded flex shrink-0 items-center justify-center border transition-all ${isCompleted ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-white/5 border-white/10 text-transparent group-hover:border-blue-500/50'}`}>
                                                        {isCompleted && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-bold text-sm tracking-wide transition-colors ${isCompleted ? 'text-emerald-400' : 'text-white group-hover:text-blue-400'}`}>{task.name}</h4>
                                                        <p className="text-slate-500 text-[11px] mt-1">{task.desc}</p>
                                                        <div className="flex gap-3 mt-3">
                                                            <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">⏱ {task.timeLimit}s</span>
                                                            <span className="text-[9px] font-mono text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded border border-orange-400/20">⚡ {task.difficulty}</span>
                                                            {!isCompleted && <span className="text-[9px] font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded border border-purple-400/20">✨ +{task.xpReward} XP</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    disabled={isContractActive}
                                                    onClick={() => router.push(`/game?mode=${task.mode}&time=${task.timeLimit}&diff=${task.difficulty}&taskId=${task.id}`)} 
                                                    className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded border transition-all ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 opacity-100' : isContractActive ? 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed opacity-50' : 'bg-white/5 hover:bg-blue-600 text-white border-white/10 hover:border-blue-500 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0'}`}
                                                >
                                                    {isCompleted ? "Replay" : isContractActive ? "Locked" : "Deploy"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2 px-2">
                                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                                <h3 className="text-white font-black tracking-[0.2em] uppercase text-xs">Weekly Operation</h3>
                                <span className="text-slate-500 text-[10px] font-mono ml-auto">
                                    {activeTasks.weekly.filter(t => safeStats?.completedTasks?.includes(t.id)).length} / {activeTasks.weekly.length} Completed
                                </span>
                            </div>
                            <div className="w-full bg-white/5 h-1 mb-4 rounded-full overflow-hidden">
                                <div className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-1000 ease-out" style={{ width: `${(activeTasks.weekly.filter(t => safeStats?.completedTasks?.includes(t.id)).length / activeTasks.weekly.length) * 100}%` }} />
                            </div>
                            <div className="flex flex-col gap-2">
                                {activeTasks.weekly.map((task) => {
                                    const isCompleted = safeStats?.completedTasks?.includes(task.id);
                                    return (
                                        <div key={task.id} className={`group relative bg-[#121212]/50 border ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/20 hover:border-red-500/50'} rounded-lg p-5 transition-colors overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.05)]`}>
                                            <div className={`absolute inset-0 bg-gradient-to-r ${isCompleted ? 'from-emerald-500/0 via-emerald-500/0 to-emerald-500/5' : 'from-red-500/0 via-red-500/0 to-red-500/5 group-hover:to-red-500/20'} transition-all pointer-events-none`} />
                                            <div className="flex justify-between items-center relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className={`mt-1 w-6 h-6 rounded flex shrink-0 items-center justify-center border transition-all ${isCompleted ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-red-500/10 border-red-500/30 text-transparent group-hover:border-red-500/50'}`}>
                                                        {isCompleted && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-bold text-base tracking-wide transition-colors ${isCompleted ? 'text-emerald-400' : 'text-white group-hover:text-red-400'}`}>{task.name}</h4>
                                                        <p className="text-slate-400 text-xs mt-1">{task.desc}</p>
                                                        <div className="flex gap-3 mt-4">
                                                            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">⏱ {task.timeLimit}s</span>
                                                            <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">💀 {task.difficulty}</span>
                                                            {!isCompleted && <span className="text-[10px] font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded border border-purple-400/20">✨ +{task.xpReward} XP</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    disabled={isContractActive}
                                                    onClick={() => router.push(`/game?mode=${task.mode}&time=${task.timeLimit}&diff=${task.difficulty}&taskId=${task.id}`)} 
                                                    className={`px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded border transition-all ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 opacity-100' : isContractActive ? 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed opacity-50 shadow-none' : 'bg-red-600/20 hover:bg-red-600 text-white border-red-500/30 hover:border-red-500 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 shadow-[0_0_15px_rgba(239,68,68,0.2)]'}`}
                                                >
                                                    {isCompleted ? "Replay" : isContractActive ? "Locked" : "Deploy"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* BOX 1.5: CUSTOM REGIMENS (PLAYLISTS) */}
                    <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                            <div>
                                <h2 className="text-white font-black text-lg uppercase tracking-widest">Custom Regimens</h2>
                                <p className="text-slate-400 text-sm">Your personal warmup routines</p>
                            </div>
                            <button 
                                disabled={isContractActive}
                                onClick={() => setIsModalOpen(true)} 
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-colors ${isContractActive ? 'bg-white/5 text-slate-600 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}
                            >
                                + Create Routine
                            </button>
                        </div>

                        {playlists.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg bg-black/20">
                                <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-2">No active routines found</p>
                                <p className="text-slate-600 text-[10px]">Create a custom playlist to structure your daily warmup.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {playlists.map((playlist) => (
                                    <div key={playlist.id} className="group flex justify-between items-center bg-[#121212]/50 border border-white/5 rounded-lg p-4 hover:border-blue-500/30 transition-all">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-bold text-sm tracking-wide group-hover:text-blue-400 transition-colors">{playlist.name}</h4>
                                            <p className="text-slate-500 text-[11px] mt-1">{playlist.description}</p>
                                            <div className="mt-2 flex gap-2 flex-wrap">
                                                {playlist.tasks.slice(0, 4).map((t, i) => (
                                                    <span key={i} className="text-[8px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">{t.mode.replace('-', ' ')}</span>
                                                ))}
                                                {playlist.tasks.length > 4 && <span className="text-[8px] font-mono text-slate-600">+{playlist.tasks.length - 4} more</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center ml-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <button
                                                onClick={() => {
                                                    const updated = playlists.filter(p => p.id !== playlist.id);
                                                    setPlaylists(updated);
                                                    const s = { ...StorageEngine.getUserStats(), playlists: updated };
                                                    StorageEngine.saveUserStats(s as any);
                                                }}
                                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded border border-white/5 transition-all"
                                                title="Delete Routine"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                            <button
                                                disabled={isContractActive}
                                                onClick={() => router.push(`/game?playlist=${playlist.id}`)}
                                                className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded border transition-all ${isContractActive ? 'bg-white/5 text-slate-600 border-white/5 cursor-not-allowed' : 'bg-white/5 hover:bg-blue-600 text-white border-white/10 hover:border-blue-500'}`}
                                            >
                                                {isContractActive ? "Locked" : "Deploy"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* BOX 2: TASK REPOSITORY (Sandbox) */}
                    <div className="bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                            <div><h2 className="text-white font-black text-lg uppercase tracking-widest">Task Repository</h2><p className="text-slate-400 text-sm">Open training sandbox (No time limits)</p></div>
                        </div>
                        <div className="grid grid-cols-12 gap-4 pb-3 border-b border-white/10 text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 px-4">
                            <div className="col-span-3">Scenario Name</div><div className="col-span-2 text-center">Category</div><div className="col-span-1 text-center">Diff</div><div className="col-span-2 text-center">Plays / Time</div><div className="col-span-2 text-right">High Score</div><div className="col-span-2 text-right">Avg Acc</div>
                        </div>
                        <div className="flex flex-col mt-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {trainingProtocols.map((protocol) => (
                                <div 
                                    key={protocol.uid} 
                                    className={`grid grid-cols-12 gap-4 py-4 px-4 items-center border-b border-white/5 transition-colors group ${isContractActive ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.02] cursor-pointer'}`} 
                                    onClick={isContractActive ? () => alert("Daily Contract Active! Please complete or abandon your current contract to access the sandbox.") : () => router.push(`/game?mode=${protocol.mode}&time=0&diff=${protocol.difficulty}`)}
                                >
                                    <div className="col-span-3 flex flex-col"><span className="text-white font-bold text-sm tracking-wide group-hover:text-[#3366FF] transition-colors truncate">{protocol.name}</span><span className="text-slate-500 text-[10px] truncate pr-2">{protocol.desc}</span></div>
                                    <div className="col-span-2 flex justify-center"><span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest border rounded-sm ${protocol.badgeColor}`}>{protocol.category}</span></div>
                                    <div className="col-span-1 flex justify-center"><span className="px-2 py-1 text-[9px] font-mono text-slate-300 bg-white/5 border border-white/10 rounded truncate">{protocol.difficulty}</span></div>
                                    <div className="col-span-2 flex flex-col items-center"><span className="text-white font-mono text-xs">{protocol.gamesPlayed}</span><span className="text-slate-500 text-[10px]">{formatTime(protocol.timePlayedSeconds)}</span></div>
                                    <div className="col-span-2 text-right"><span className="text-white font-mono text-sm font-bold">{protocol.highScore > 0 ? Math.round(protocol.highScore).toLocaleString() : '--'}</span></div>
                                    <div className="col-span-2 text-right"><span className="text-emerald-400 font-mono text-sm font-bold">{protocol.avgAcc > 0 ? `${protocol.avgAcc.toFixed(1)}%` : '--'}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* STAT GRID */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="group bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all">
                            <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-2">Global Accuracy</span>
                            <div className="flex items-baseline gap-1 mb-2">
                                <span className="text-3xl font-mono font-black text-white">{safeStats?.globalAccuracy?.toFixed(1) ?? '0.0'}</span>
                                <span className="text-red-500 font-bold">%</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-1000" style={{ width: `${safeStats?.globalAccuracy || 0}%` }} />
                            </div>
                        </div>
                        <div className="group bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all">
                            <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-2">Total Time</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-mono font-black text-white">{formatTime(safeStats?.timePlayedSeconds || 0)}</span>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-2">{safeStats?.totalGamesPlayed || 0} sessions</p>
                        </div>
                        <div className="group bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-all">
                            <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-2">Best Reaction</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-mono font-black text-white">{safeStats && Object.keys(safeStats.modes).length > 0 ? Math.round(Object.values(safeStats.modes as any).reduce((min: number, m: any) => m.bestReactionTime < min ? m.bestReactionTime : min, 9999) as number) : "--"}</span>
                                <span className="text-cyan-400 font-bold text-sm">ms</span>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-2">Personal best</p>
                        </div>
                        <div className="group bg-surface/60 border border-white/10 p-6 rounded-xl backdrop-blur-md hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.08)] transition-all">
                            <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase block mb-2">Rank Tier</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-xl font-black ${rankInfo.color}`} style={{ textShadow: `0 0 15px ${rankInfo.glow}` }}>{rankInfo.tier}</span>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-2">{safeStats?.lastPlayedAt ? new Date(safeStats.lastPlayedAt).toLocaleDateString() : 'Never played'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}