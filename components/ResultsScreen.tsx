"use client";

import { useEffect, useRef, useState } from "react";
import { StorageEngine } from "@/lib/utils/storage";
import type { GameResult } from "@/lib/game/types";

interface ResultsScreenProps {
    result: GameResult;
    onRestart: () => void;
    onBackToMenu: () => void;
}

export default function ResultsScreen({ result, onRestart, onBackToMenu }: ResultsScreenProps) {
    // The "Latch": Prevents duplicate saves during React Strict Mode double-renders
    const hasSaved = useRef(false);
    const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saving");

    useEffect(() => {
        // Only save if we haven't saved this specific result ID yet
        if (!hasSaved.current && result && result.id) {
            try {
                StorageEngine.saveGameResult(result);
                hasSaved.current = true;
                setSaveStatus("saved");
            } catch (error) {
                console.error("Failed to save session data:", error);
                setSaveStatus("error");
            }
        }
    }, [result]);

    // Format reaction times for display
    const avgReaction = result.averageReactionTime > 0 ? `${Math.round(result.averageReactionTime)}ms` : "N/A";
    const bestReaction = result.bestReactionTime > 0 && result.bestReactionTime < 9999 ? `${Math.round(result.bestReactionTime)}ms` : "N/A";

    return (
        <div className="relative w-full h-screen flex flex-col bg-[#121212] text-[#EAEAEA] overflow-hidden items-center justify-center p-6">

            {/* Background Grid */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>

            <div className="relative z-10 w-full max-w-3xl border border-white/10 bg-black/60 backdrop-blur-xl rounded-3xl p-10 shadow-2xl flex flex-col items-center">

                {/* Header Phase */}
                <div className="text-center mb-10">
                    <p className="text-[#3366FF] text-sm font-bold tracking-[0.4em] uppercase mb-2">Protocol Complete</p>
                    <h1 className="text-5xl font-black tracking-widest uppercase text-white drop-shadow-md">
                        {result.modeId.replace(/-/g, " ")}
                    </h1>

                    {/* Benchmark Certification Badge */}
                    {result.isBenchmark && (
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-[#ec4899]/10 border border-[#ec4899]/30 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ec4899] shadow-[0_0_6px_#ec4899]" />
                            <span className="text-[#ec4899] text-[10px] font-black tracking-[0.35em] uppercase">Certified Benchmark Run</span>
                        </div>
                    )}

                    {/* Save Status Indicator */}
                    <div className="mt-4 flex items-center justify-center space-x-2">
                        {saveStatus === "saving" && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>}
                        {saveStatus === "saved"  && <div className="w-2 h-2 bg-[#1DB954] rounded-full shadow-[0_0_8px_#1DB954]"></div>}
                        {saveStatus === "error"  && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                        <span className="text-xs tracking-widest text-gray-400 uppercase">
                            {saveStatus === "saving" ? "Syncing Data..." : saveStatus === "saved" ? "Data Secured" : "Sync Failed"}
                        </span>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full mb-12">
                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-[#3366FF]/30 transition-colors">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">SCORE</span>
                        <span className="text-4xl font-black text-white">{result.score}</span>
                    </div>

                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-[#1DB954]/30 transition-colors">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">ACCURACY</span>
                        <span className="text-4xl font-black text-[#1DB954]">{result.accuracy.toFixed(1)}%</span>
                    </div>

                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-[#8A2BE2]/30 transition-colors">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">AVG REACTION</span>
                        <span className="text-3xl font-black text-white">{avgReaction}</span>
                    </div>

                    <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-cyan-400/30 transition-colors">
                        <span className="text-gray-400 text-xs font-bold tracking-wider mb-2">HITS / MISSES</span>
                        <span className="text-3xl font-black text-white">{result.hits} <span className="text-gray-600">/</span> {result.misses}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <button
                        onClick={onRestart}
                        className="px-8 py-4 bg-[#EAEAEA] text-[#121212] font-black tracking-[0.2em] uppercase rounded-xl hover:bg-[#3366FF] hover:text-white transition-all duration-300"
                    >
                        Run Again
                    </button>
                    <button
                        onClick={onBackToMenu}
                        className="px-8 py-4 bg-transparent border border-white/20 text-white font-bold tracking-[0.2em] uppercase rounded-xl hover:bg-white/10 hover:border-white/50 transition-all duration-300"
                    >
                        Abort to Hub
                    </button>
                </div>

            </div>
        </div>
    );
}