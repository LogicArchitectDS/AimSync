"use client";

import { useState } from "react";
import React from "react";
// --- ACTIVE PROTOCOLS ---
import StaticFlick from "@/components/modes/StaticFlick";
import SensitivityFinder from "@/components/modes/SensitivityFinder";
import TrackingMode from "@/components/modes/TrackingMode";
import TargetSwitch from "@/components/modes/TargetSwitch";
import BurstReaction from "@/components/modes/BurstReaction";
import MicroAdjust from "@/components/modes/MicroAdjust";
import RoutineRunner from "@/components/modes/RoutineRunner";
import ReactionTest from "@/components/modes/ReactionTest";
import FlickBenchmark from "@/components/modes/FlickBenchmark";
import ConsistencyCheck from "@/components/modes/ConsistencyCheck";
import CustomRoutine from "@/components/modes/CustomRoutine";
import { DEFAULT_ROUTINES } from "@/lib/utils/routineEngine";

type Mode =
    | "menu"
    | "static-flick"
    | "tracking-mode"
    | "target-switch"
    | "burst-reaction"
    | "micro-adjust"
    | "sensitivity-finder"
    | "consistency-check"
    | "custom-routine"
    | "flick-benchmark"
    | "reaction-test";

// --- TEMPORARY PLACEHOLDER FOR UNBUILT MODES ---
const ConstructionPlaceholder = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-16 h-16 border-4 border-[#3366FF] border-t-transparent rounded-full animate-spin"></div>
        <h2 className="text-2xl font-black tracking-widest uppercase text-white">Booting {title}...</h2>
        <p className="text-gray-400 text-sm">Module physically missing from local directory. Awaiting construction.</p>
    </div>
);

// --- COMPONENT DICTIONARY ---
// This completely eliminates the need for massive if/else blocks.
const ModeRegistry: Record<Exclude<Mode, "menu">, React.ElementType> = {
    "static-flick": StaticFlick,
    "tracking-mode": TrackingMode,
    "target-switch": TargetSwitch,
    "burst-reaction": BurstReaction,
    "micro-adjust": MicroAdjust,
    "sensitivity-finder": SensitivityFinder,
    // Map pending modes to the placeholder until the files are created
    "consistency-check": ConsistencyCheck,
    "custom-routine": CustomRoutine,
    "flick-benchmark": FlickBenchmark,
    "reaction-test": ReactionTest,
};

// --- PROTOCOL MENU DATA ---
// Separating data from UI keeps the render loop clean
const protocolCards: { id: Exclude<Mode, "menu">; category: string; title: string; desc: string; color: string }[] = [
    { id: "static-flick", category: "Combat", title: "Static Flick", desc: "Develop raw mechanical memory and stopping power.", color: "#3366FF" },
    { id: "tracking-mode", category: "Dynamic", title: "Continuous Tracking", desc: "Engage erratic targets to develop crosshair prediction.", color: "#06b6d4" },
    { id: "target-switch", category: "Cognitive", title: "Target Switch", desc: "Rapidly identify and eliminate the correct target hidden among decoys.", color: "#1DB954" },
    { id: "burst-reaction", category: "Reflex", title: "Burst Reaction", desc: "Engage rapid target clusters to build combo multipliers.", color: "#f97316" },
    { id: "micro-adjust", category: "Precision", title: "Micro Adjust", desc: "Master tiny, pixel-perfect mouse corrections.", color: "#f43f5e" },
    { id: "reaction-test", category: "Baseline", title: "Reaction Test", desc: "Pure neurological stimulus response testing.", color: "#eab308" },
    { id: "flick-benchmark", category: "Evaluation", title: "Flick Benchmark", desc: "Standardized testing protocol to rank flicking accuracy.", color: "#ec4899" },
    { id: "consistency-check", category: "Evaluation", title: "Consistency Check", desc: "Test variance in performance over prolonged engagements.", color: "#8b5cf6" },
    { id: "custom-routine", category: "Playlist", title: "Custom Routine", desc: "Execute user-defined training playlists.", color: "#64748b" },
    { id: "sensitivity-finder", category: "Diagnostic", title: "Sens Matrix", desc: "Mathematical analysis to calculate optimal mouse sensitivity.", color: "#8A2BE2" },
];

export default function GamePage() {
    const [currentMode, setCurrentMode] = useState<Mode>("menu");

    if (currentMode !== "menu") {
        const ActiveComponent = ModeRegistry[currentMode];

        // Create a dedicated exit handler
        const handleModeFinish = () => {
            // 1. Exit native browser fullscreen if it is active
            if (document.fullscreenElement) {
                document.exitFullscreen().catch((err) => {
                    console.warn("Could not exit fullscreen naturally:", err);
                });
            }
            // 2. Route the React state back to the hub
            setCurrentMode("menu");
        };

        return (
            <div className="relative w-full h-screen bg-[#121212]">
                <button
                    onClick={handleModeFinish}
                    className="absolute top-6 right-6 z-[100] px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md"
                >
                    ABORT TO HUB
                </button>

                {/* Plug in the communication wire so the child can trigger the exit */}
                <ActiveComponent onFinish={handleModeFinish} />
            </div>
        );
    }

    // --- MISSION CONTROL HUB ---
    return (
        <div className="min-h-screen bg-[#121212] text-[#EAEAEA] p-8 md:p-16 relative overflow-hidden flex flex-col items-center justify-center">
            {/* Background Grids */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_800px_at_50%_50%,transparent,rgba(18,18,18,0.95))]"></div>

            <div className="relative z-10 w-full max-w-7xl space-y-12">
                <div className="text-center space-y-2">
                    <p className="text-[#3366FF] text-sm font-bold tracking-[0.4em] uppercase">AimForge Terminal</p>
                    <h1 className="text-5xl md:text-6xl font-black tracking-widest uppercase text-white drop-shadow-lg">Select Protocol</h1>
                </div>

                {/* Dynamic Grid Rendering */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {protocolCards.map((card) => {
                        const cardStyle: React.CSSProperties = { "--hover-border": card.color } as React.CSSProperties;
                        return (
                            <button
                                key={card.id}
                                onClick={() => setCurrentMode(card.id)}
                                className="group relative flex flex-col text-left p-6 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 transition-all duration-300 overflow-hidden"
                                style={cardStyle}
                            >
                                {/* Dynamic Hover Border Effect using inline custom properties */}
                                <div className="absolute inset-0 border border-transparent group-hover:border-[var(--hover-border)] opacity-50 rounded-3xl transition-colors duration-300 pointer-events-none"></div>

                                <span
                                    className="text-xs font-bold tracking-widest uppercase mb-2"
                                    style={{ color: card.color }}
                                >
                                    {card.category} Protocol
                                </span>
                                <h2 className="text-2xl font-black tracking-wide uppercase mb-3 text-white transition-colors" style={{ textShadow: `0 0 10px ${card.color}00` }}>
                                    {card.title}
                                </h2>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    {card.desc}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}