"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";



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

export type Mode =
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

const ModeRegistry: Record<Exclude<Mode, "menu">, React.ElementType<any>> = {
    "static-flick": StaticFlick,
    "tracking-mode": TrackingMode,
    "target-switch": TargetSwitch,
    "burst-reaction": BurstReaction,
    "micro-adjust": MicroAdjust,
    "sensitivity-finder": SensitivityFinder,
    "consistency-check": ConsistencyCheck,
    "custom-routine": CustomRoutine,
    "flick-benchmark": FlickBenchmark,
    "reaction-test": ReactionTest,
};



export const protocolCards: { id: Exclude<Mode, "menu">; category: string; title: string; desc: string; color: string }[] = [
    // ... (keep your exact protocolCards array here)
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

function GameEngine() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const modeParam = searchParams.get("mode") as Exclude<Mode, "menu"> | null;
    const currentMode = modeParam && ModeRegistry[modeParam] ? modeParam : null;

    if (!currentMode) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white space-y-4">
                <h2 className="text-2xl font-black tracking-widest uppercase">Invalid Protocol</h2>
                <button
                    onClick={() => router.push("/dashboard")}
                    className="px-6 py-2 bg-[#3366FF] hover:bg-white hover:text-[#3366FF] transition-all rounded-lg font-bold tracking-widest uppercase text-sm"
                >
                    Return to Hub
                </button>
            </div>
        );
    }

    const ActiveComponent = ModeRegistry[currentMode];



    const handleModeFinish = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch((err) => {
                console.warn("Could not exit fullscreen naturally:", err);
            });
        }
        router.push("/dashboard");
    };

    return (
        <div className="relative w-full h-screen bg-[#121212] overflow-hidden">



            {/* Existing Abort Button */}
            <button
                onClick={handleModeFinish}
                className="absolute bottom-6 right-6 z-[100] px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md"
            >
                ABORT TO HUB
            </button>

            {/* The Active Mode Component */}
            {React.createElement(ActiveComponent as any, { onFinish: handleModeFinish })}
        </div>
    );
}

export default function GamePage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-[#121212] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#3366FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <GameEngine />
        </React.Suspense>
    );
}