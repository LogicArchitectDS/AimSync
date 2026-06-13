"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StorageEngine } from "@/lib/utils/storage";
import type { CustomPlaylist, PlaylistTask } from "@/lib/game/types";
import ProMarketplace from "@/components/dashboard/ProMarketplace";

export default function PlaylistsPage() {
    const router = useRouter();
    const [playlists, setPlaylists] = useState<CustomPlaylist[]>([]);
    
    // --- PLAYLIST CREATOR STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
    const [draftTasks, setDraftTasks] = useState<PlaylistTask[]>([]);

    const [selectedMode, setSelectedMode] = useState("static-flick");
    const [selectedDiff, setSelectedDiff] = useState("Eco");
    const [selectedTime, setSelectedTime] = useState(60);

    const baseModes = [
        { mode: 'static-flick', name: 'Static Flick', desc: 'Classic 3-target gridset.', category: 'Flicking' },
        { mode: 'tracking-mode', name: 'Continuous Tracking', desc: 'Continuous 3D target tracking.', category: 'Tracking' },
        { mode: 'target-switch', name: 'Target Switch', desc: 'Rapidly identify and eliminate hostiles among decoys.', category: 'Cognition' },
        { mode: 'burst-reaction', name: 'Burst Reaction', desc: 'Engage rapid target clusters to build combo multipliers.', category: 'Reflex' },
        { mode: 'micro-adjust', name: 'Micro Adjust', desc: 'Micro-target pixel precision training.', category: 'Precision' },
        { mode: 'reaction-test', name: 'Reaction Test', desc: 'Pure neurological stimulus response testing.', category: 'Reflex' },
        { mode: 'flick-benchmark', name: 'Flick Benchmark', desc: 'Standardized testing protocol to rank flicking accuracy.', category: 'Evaluation' },
        { mode: 'consistency-check', name: 'Consistency Check', desc: 'Test variance in performance over prolonged engagements.', category: 'Evaluation' },
        { mode: 'echolocation', name: 'Echolocation', desc: 'Rely on spatial audio to snap to targets behind you.', category: 'Perception' },
        { mode: 'cognitive-overdrive', name: 'Cognitive Overdrive', desc: 'Target discrimination: shoot hostiles and avoid distractors.', category: 'Cognition' },
        { mode: 'recoil-evasion', name: 'Recoil Evasion', desc: 'Counteract weapon recoil while tracking an evasive target.', category: 'Tracking' },
        { mode: 'blind-flick', name: 'Blind Flick', desc: 'Acquire targets in a dark void using spatial audio pans.', category: 'Perception' },
        { mode: 'jiggle-peek', name: 'Jiggle Peek', desc: 'Practice reaction discipline against peeking targets.', category: 'Combat' }
    ];

    useEffect(() => {
        setPlaylists(StorageEngine.getPlaylists());
    }, []);

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

    const handleDeletePlaylist = (id: string) => {
        StorageEngine.deletePlaylist(id);
        setPlaylists(playlists.filter(p => p.id !== id));
    };

    return (
        <div className="flex flex-col gap-8 w-full relative">
            
            {/* Header section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black uppercase tracking-wider text-white">Training Playlists</h1>
                <p className="text-slate-400 text-sm">Deploy custom routines or professional player warming regimens to calibrate your aim.</p>
            </div>

            {/* --- PLAYLIST CREATOR MODAL --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 w-full max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] text-left relative overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Create Regimen</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-red-500 font-bold transition-colors">✕</button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6">
                            <input 
                                type="text" 
                                placeholder="Playlist Name (e.g., Valorant Warmup)" 
                                value={newPlaylistName} 
                                onChange={(e) => setNewPlaylistName(e.target.value)} 
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-bold" 
                            />
                            <input 
                                type="text" 
                                placeholder="Short Description..." 
                                value={newPlaylistDesc} 
                                onChange={(e) => setNewPlaylistDesc(e.target.value)} 
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-slate-300 text-sm focus:outline-none focus:border-blue-500" 
                            />
                        </div>

                        {/* Task Selector */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Add Exercise</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="flex flex-col gap-1.5 md:col-span-2">
                                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Exercise Mode</span>
                                    <select 
                                        className="bg-black/50 text-white text-xs p-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-blue-500 font-bold transition-all h-[38px] cursor-pointer" 
                                        value={selectedMode} 
                                        onChange={(e) => setSelectedMode(e.target.value)}
                                    >
                                        {baseModes.filter(m => m.mode !== 'sensitivity-finder').map(m => (
                                            <option key={m.mode} value={m.mode}>{m.name}</option>
                                        ))}
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
                            <button 
                                onClick={handleAddTaskToDraft} 
                                className="mt-4 w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-widest rounded-lg border border-blue-500/20 transition-all"
                            >
                                + Add to Queue
                            </button>
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

                        <button 
                            onClick={handleSavePlaylist} 
                            disabled={!newPlaylistName || draftTasks.length === 0} 
                            className="w-full py-3 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-lg transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                        >
                            Save Regimen
                        </button>
                    </div>
                </div>
            )}

            {/* --- CUSTOM PLAYLISTS SECTION --- */}
            <div className="bg-surface/40 border border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
                    <div>
                        <h2 className="text-white font-black text-xl uppercase tracking-widest">Custom Regimens</h2>
                        <p className="text-slate-400 text-sm">Your personal warmup playlists</p>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)} 
                        className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    >
                        + Create Playlist
                    </button>
                </div>

                {playlists.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-black/20 relative z-10">
                        <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-2">No custom playlists found</p>
                        <p className="text-slate-600 text-[11px] mb-4">Configure a custom warmup sequence targeting flicking, tracking, or speed to align with your routine.</p>
                        <button 
                            onClick={() => setIsModalOpen(true)} 
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all"
                        >
                            Configure Playlist
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                        {playlists.map((playlist) => {
                            const totalDuration = playlist.tasks.reduce((acc, t) => acc + t.timeLimit, 0);
                            return (
                                <div key={playlist.id} className="group relative flex flex-col justify-between bg-black/40 rounded-xl p-6 border border-white/5 hover:border-blue-500/30 transition-all duration-300">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-black text-white uppercase tracking-wider group-hover:text-blue-400 transition-colors truncate">{playlist.name}</h3>
                                                <p className="text-slate-500 text-[11px] mt-1 leading-relaxed line-clamp-2">{playlist.description}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeletePlaylist(playlist.id)}
                                                className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all shrink-0"
                                                title="Delete Playlist"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="space-y-1.5 border-t border-white/5 pt-4">
                                            <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase">Sequence Drills</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                {playlist.tasks.map((t, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs bg-[#121212]/60 border border-white/5 rounded-lg p-2">
                                                        <span className="text-white font-bold tracking-wide truncate mr-2">
                                                            {baseModes.find(bm => bm.mode === t.mode)?.name || t.mode}
                                                        </span>
                                                        <div className="flex gap-2 items-center shrink-0">
                                                            <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider rounded border text-blue-400 border-blue-500/20 bg-blue-500/5">
                                                                {t.difficulty}
                                                            </span>
                                                            <span className="text-slate-500 font-mono text-[10px]">
                                                                {t.timeLimit}s
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[9px] text-slate-500 font-black tracking-widest uppercase">Length</p>
                                            <p className="text-sm font-mono text-white font-black">{totalDuration}s</p>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/game?playlist=${playlist.id}`)}
                                            className="px-4 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-[0_0_10px_rgba(255,255,255,0.05)]"
                                        >
                                            Deploy Playlist
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* --- PRO REGIMENS SECTION --- */}
            <div className="bg-surface/40 border border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="mb-6 relative z-10">
                    <h2 className="text-white font-black text-xl uppercase tracking-widest">Pro Player Regimens</h2>
                    <p className="text-slate-400 text-sm">Professional player warmup schedules and drills</p>
                </div>
                <div className="relative z-10">
                    <ProMarketplace />
                </div>
            </div>

        </div>
    );
}