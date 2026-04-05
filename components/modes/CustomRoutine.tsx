"use client";

import { useState } from "react";
import RoutineRunner from "@/components/modes/RoutineRunner";
import type { Routine, RoutineStep, GameResult } from "@/lib/game/types";
import type { Difficulty } from "@/lib/utils/drillConfig";

interface CustomRoutineProps {
    onFinish?: (res?: GameResult) => void;
}

const AVAILABLE_MODULES: { modeId: string; name: string }[] = [
    { modeId: "static-flick", name: "Static Flick" },
    { modeId: "tracking-mode", name: "Continuous Tracking" },
    { modeId: "target-switch", name: "Target Switch" },
    { modeId: "micro-adjust", name: "Micro Adjust" },
    { modeId: "burst-reaction", name: "Burst Reaction" },
];

const DIFFICULTY_OPTIONS: { key: Difficulty; label: string }[] = [
    { key: "easy", label: "ECO" },
    { key: "medium", label: "BONUS" },
    { key: "hard", label: "FORCE BUY" },
    { key: "extreme", label: "FULL BUY" },
];

export default function CustomRoutine({ onFinish }: CustomRoutineProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [playlist, setPlaylist] = useState<RoutineStep[]>([]);

    // Builder state
    const [selectedModule, setSelectedModule] = useState(AVAILABLE_MODULES[0]);
    const [duration, setDuration] = useState<number>(60);
    const [difficulty, setDifficulty] = useState<Difficulty>("medium");

    const addDrill = () => {
        if (playlist.length >= 8) return;
        const step: RoutineStep = {
            id: `drill-${Date.now()}`,
            modeId: selectedModule.modeId,
            durationSeconds: duration,
            difficulty: difficulty,
        };
        setPlaylist(prev => [...prev, step]);
    };

    const removeDrill = (id: string) =>
        setPlaylist(prev => prev.filter(s => s.id !== id));

    // ── RUNNING STATE ────────────────────────────────────────
    if (isRunning && playlist.length > 0) {
        const routine: Routine = {
            id: "user-custom-routine",
            name: "Custom Deployment",
            description: "User-compiled drill sequence",
            authorId: "local-agent",
            createdAt: new Date().toISOString(),
            drills: playlist,
        };

        return (
            <div className="absolute inset-0 z-10 bg-[#121212]">
                <RoutineRunner
                    routine={routine}
                    onComplete={() => {
                        setIsRunning(false);
                        if (onFinish) onFinish();
                    }}
                />
            </div>
        );
    }

    // ── COMPILER UI ──────────────────────────────────────────
    return (
        <div className="w-full h-screen bg-[#121212] flex items-center justify-center p-8 text-[#EAEAEA] relative overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('/grid.svg')] bg-center bg-[size:40px_40px]" />

            <div className="relative z-10 max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 h-[600px]">

                {/* ── LEFT: Configuration Matrix ── */}
                <div className="flex flex-col space-y-6 bg-gray-900/50 p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
                    <div>
                        <p className="text-emerald-500 text-sm font-bold tracking-[0.4em] uppercase mb-1">Playlist Protocol</p>
                        <h1 className="text-3xl font-black tracking-widest uppercase text-white">Forge Sequence</h1>
                        <p className="text-gray-500 text-xs mt-2 font-medium">Construct up to 8 drills for a continuous training block.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Select Module</label>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_MODULES.map(mod => (
                                <button
                                    key={mod.modeId}
                                    onClick={() => setSelectedModule(mod)}
                                    className={`p-3 text-xs font-bold tracking-widest rounded-xl border transition-all uppercase ${selectedModule.modeId === mod.modeId
                                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                                        : "bg-transparent border-white/5 text-gray-500 hover:border-white/20 hover:text-white"
                                        }`}
                                >
                                    {mod.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Duration</label>
                            <select
                                value={duration}
                                onChange={e => setDuration(Number(e.target.value))}
                                className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                            >
                                <option value={15}>15s</option>
                                <option value={30}>30s</option>
                                <option value={60}>60s</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Difficulty</label>
                            <select
                                value={difficulty}
                                onChange={e => setDifficulty(e.target.value as Difficulty)}
                                className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                            >
                                {DIFFICULTY_OPTIONS.map(opt => (
                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={addDrill}
                        disabled={playlist.length >= 8}
                        className="w-full py-4 border border-dashed border-emerald-500/40 text-emerald-500 font-black text-xs tracking-[0.25em] uppercase rounded-xl hover:bg-emerald-500/5 transition-all disabled:opacity-20"
                    >
                        + Append to Sequence
                    </button>
                </div>

                {/* ── RIGHT: Playlist Payload ── */}
                <div className="bg-gray-950/80 rounded-3xl p-6 border border-white/5 flex flex-col shadow-2xl">
                    <h3 className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase mb-6 flex justify-between">
                        Active Payload
                        <span>{playlist.length} / 8</span>
                    </h3>

                    <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                        {playlist.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-2">
                                <span className="text-[10px] font-black tracking-widest uppercase">Sequence Empty</span>
                            </div>
                        ) : (
                            playlist.map((step, i) => {
                                const mod = AVAILABLE_MODULES.find(m => m.modeId === step.modeId);
                                return (
                                    <div key={step.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-xl group hover:border-emerald-500/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <span className="text-emerald-500 font-black text-sm">{i + 1}</span>
                                            <div>
                                                <p className="text-white font-bold text-xs tracking-wider uppercase">{mod?.name ?? step.modeId}</p>
                                                <p className="text-[9px] text-gray-500 uppercase tracking-[0.15em] mt-0.5">
                                                    {step.durationSeconds}s · {step.difficulty}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeDrill(step.id)}
                                            className="text-gray-600 hover:text-red-500 transition-colors px-2"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/5">
                        <button
                            onClick={() => setIsRunning(true)}
                            disabled={playlist.length === 0}
                            className="w-full py-4 bg-emerald-500 text-gray-950 font-black tracking-[0.3em] uppercase rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-20 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                        >
                            Initialize Routine
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}