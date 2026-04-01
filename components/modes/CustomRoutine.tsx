"use client";

import { useState } from "react";
import RoutineRunner from "@/components/modes/RoutineRunner";
import type { Routine, RoutineStep } from "@/lib/game/types";
import type { Difficulty } from "@/lib/utils/drillConfig";
import type { GameResult } from "@/lib/game/types";

interface CustomRoutineProps {
    onFinish?: (res?: GameResult) => void;
}

const AVAILABLE_MODULES: { modeId: string; name: string }[] = [
    { modeId: "static-flick",   name: "Static Flick" },
    { modeId: "tracking-mode",  name: "Continuous Tracking" },
    { modeId: "target-switch",  name: "Target Switch" },
    { modeId: "micro-adjust",   name: "Micro Adjust" },
    { modeId: "burst-reaction", name: "Burst Reaction" },
];

const DIFFICULTY_OPTIONS: { key: Difficulty; label: string }[] = [
    { key: "easy",    label: "Eco"       },
    { key: "medium",  label: "Bonus"     },
    { key: "hard",    label: "Force Buy" },
    { key: "extreme", label: "Full Buy"  },
];

export default function CustomRoutine({ onFinish }: CustomRoutineProps) {
    const [isRunning,     setIsRunning]     = useState(false);
    const [playlist,      setPlaylist]      = useState<RoutineStep[]>([]);

    // Builder state
    const [selectedModule, setSelectedModule] = useState(AVAILABLE_MODULES[0]);
    const [duration,       setDuration]       = useState<number>(60);
    const [difficulty,     setDifficulty]     = useState<Difficulty>("medium");

    const addDrill = () => {
        if (playlist.length >= 8) return;
        const step: RoutineStep = {
            id:              `drill-${Date.now()}`,
            modeId:          selectedModule.modeId,
            durationSeconds: duration,
            difficulty:      difficulty,
        };
        setPlaylist(prev => [...prev, step]);
    };

    const removeDrill = (id: string) =>
        setPlaylist(prev => prev.filter(s => s.id !== id));

    // ── RUNNING STATE ────────────────────────────────────────
    if (isRunning && playlist.length > 0) {
        const routine: Routine = {
            id:          "user-custom-routine",
            name:        "Custom Deployment",
            description: "User-compiled drill sequence",
            authorId:    "local-user",
            createdAt:   new Date().toISOString(),
            drills:      playlist,
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
        <div className="w-full h-full min-h-screen bg-[#121212] flex items-center justify-center p-8 text-[#EAEAEA] relative overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />

            <div className="relative z-10 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* ── LEFT: Configuration Matrix ── */}
                <div className="space-y-6 bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
                    <div>
                        <p className="text-[#3366FF] text-sm font-bold tracking-[0.4em] uppercase mb-1">Playlist Protocol</p>
                        <h1 className="text-3xl font-black tracking-widest uppercase text-white">Forge Sequence</h1>
                        <p className="text-gray-500 text-xs mt-2">Build up to 8 drills. They execute in order.</p>
                    </div>

                    {/* Module selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">Select Module</label>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_MODULES.map(mod => (
                                <button
                                    key={mod.modeId}
                                    onClick={() => setSelectedModule(mod)}
                                    className={`p-3 text-sm font-bold tracking-wide rounded-xl border transition-all ${
                                        selectedModule.modeId === mod.modeId
                                            ? "bg-[#3366FF]/20 border-[#3366FF] text-[#3366FF]"
                                            : "bg-transparent border-white/10 text-gray-500 hover:border-white/30 hover:text-white"
                                    }`}
                                >
                                    {mod.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration + Difficulty */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">Duration</label>
                            <select
                                value={duration}
                                onChange={e => setDuration(Number(e.target.value))}
                                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white font-bold outline-none focus:border-[#3366FF] transition-all"
                            >
                                <option value={15}>15s</option>
                                <option value={30}>30s</option>
                                <option value={60}>60s</option>
                                <option value={120}>120s</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">Difficulty</label>
                            <select
                                value={difficulty}
                                onChange={e => setDifficulty(e.target.value as Difficulty)}
                                className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white font-bold outline-none focus:border-[#3366FF] transition-all"
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
                        className="w-full py-4 border border-dashed border-[#3366FF] text-[#3366FF] font-bold tracking-widest uppercase rounded-xl hover:bg-[#3366FF]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        + Append to Sequence
                    </button>
                </div>

                {/* ── RIGHT: Playlist Payload ── */}
                <div className="bg-[#0d0d0d] rounded-3xl p-6 border border-white/5 flex flex-col shadow-2xl">
                    <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-4 border-b border-white/10 pb-3">
                        Active Payload
                        <span className="ml-2 text-white">{playlist.length}</span>
                        <span className="text-gray-600"> / 8</span>
                    </h3>

                    <div className="flex-1 space-y-2 overflow-y-auto min-h-[240px]">
                        {playlist.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-600 text-sm font-bold tracking-widest uppercase pt-16">
                                Sequence Empty
                            </div>
                        ) : (
                            playlist.map((step, i) => {
                                const mod = AVAILABLE_MODULES.find(m => m.modeId === step.modeId);
                                return (
                                    <div key={step.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl group hover:border-white/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[#3366FF] font-black text-lg w-5 text-center">{i + 1}</span>
                                            <div>
                                                <p className="text-white font-bold text-sm tracking-wide">{mod?.name ?? step.modeId}</p>
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">
                                                    {step.durationSeconds}s · {step.difficulty}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeDrill(step.id)}
                                            className="text-red-500/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-lg font-bold"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
                        {playlist.length > 0 && (
                            <p className="text-center text-gray-600 text-xs tracking-widest uppercase">
                                Total duration: {playlist.reduce((t, s) => t + s.durationSeconds, 0)}s
                            </p>
                        )}
                        <button
                            onClick={() => setIsRunning(true)}
                            disabled={playlist.length === 0}
                            className="w-full py-4 bg-[#1DB954] text-black font-black tracking-[0.2em] uppercase rounded-xl hover:bg-[#1ed760] transition-all disabled:opacity-30 disabled:bg-gray-700 disabled:text-gray-500 shadow-[0_0_15px_rgba(29,185,84,0.3)] hover:shadow-[0_0_25px_rgba(29,185,84,0.5)]"
                        >
                            Initialize Routine
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}