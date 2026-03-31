"use client";

import { useState } from "react";
import StaticFlick from "@/components/modes/StaticFlick";
import SensitivityFinder from "@/components/modes/SensitivityFinder";
import TrackingMode from "@/components/modes/TrackingMode";
import TargetSwitch from "@/components/modes/TargetSwitch";

type Mode = "menu" | "static-flick" | "sensitivity-finder" | "tracking-mode" | "target-switch";

export default function GamePage() {
    const [currentMode, setCurrentMode] = useState<Mode>("menu");

    // --- RENDERING ROUTER ---

    if (currentMode === "static-flick") {
        return (
            <div className="relative w-full h-screen">
                <button onClick={() => setCurrentMode("menu")} className="absolute top-6 right-6 z-50 px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md">ABORT TO HUB</button>
                <StaticFlick />
            </div>
        );
    }

    if (currentMode === "tracking-mode") {
        return (
            <div className="relative w-full h-screen">
                <button onClick={() => setCurrentMode("menu")} className="absolute top-6 right-6 z-50 px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md">ABORT TO HUB</button>
                <TrackingMode />
            </div>
        );
    }

    if (currentMode === "target-switch") {
        return (
            <div className="relative w-full h-screen">
                <button onClick={() => setCurrentMode("menu")} className="absolute top-6 right-6 z-50 px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md">ABORT TO HUB</button>
                <TargetSwitch />
            </div>
        );
    }

    if (currentMode === "sensitivity-finder") {
        return (
            <div className="relative w-full h-screen overflow-y-auto">
                <button onClick={() => setCurrentMode("menu")} className="absolute top-6 right-6 z-50 px-4 py-2 bg-black/50 border border-white/10 rounded text-xs font-bold tracking-widest text-gray-400 hover:text-white hover:border-white/30 transition-all backdrop-blur-md">ABORT TO HUB</button>
                <SensitivityFinder />
            </div>
        );
    }

    // --- MISSION CONTROL HUB ---

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8 md:p-16 relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_800px_at_50%_50%,transparent,rgba(5,5,5,0.9))]"></div>

            <div className="relative z-10 w-full max-w-5xl space-y-12">

                <div className="text-center space-y-2">
                    <p className="text-cyan-500 text-sm font-bold tracking-[0.4em] uppercase">AimForge Terminal</p>
                    <h1 className="text-5xl md:text-6xl font-black tracking-widest uppercase drop-shadow-lg">Select Protocol</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Card 1: Static Flick */}
                    <button onClick={() => setCurrentMode("static-flick")} className="group relative flex flex-col text-left p-8 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden">
                        <span className="text-cyan-500 text-xs font-bold tracking-widest uppercase mb-2">Combat Protocol</span>
                        <h2 className="text-3xl font-black tracking-wide uppercase mb-4 text-white group-hover:text-cyan-500 transition-colors">Static Flick</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">Develop raw mechanical memory and precise stopping power on stationary targets.</p>
                    </button>

                    {/* Card 2: Moving Flick (Tracking) */}
                    <button onClick={() => setCurrentMode("tracking-mode")} className="group relative flex flex-col text-left p-8 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 hover:border-blue-500/50 transition-all duration-300 overflow-hidden">
                        <span className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-2">Dynamic Protocol</span>
                        <h2 className="text-3xl font-black tracking-wide uppercase mb-4 text-white group-hover:text-blue-500 transition-colors">Continuous Tracking</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">Engage erratic, fast-moving targets to develop dynamic crosshair prediction and pursuit accuracy.</p>
                    </button>

                    {/* Card 3: Target Switch */}
                    <button onClick={() => setCurrentMode("target-switch")} className="group relative flex flex-col text-left p-8 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 hover:border-emerald-500/50 transition-all duration-300 overflow-hidden">
                        <span className="text-emerald-500 text-xs font-bold tracking-widest uppercase mb-2">Cognitive Protocol</span>
                        <h2 className="text-3xl font-black tracking-wide uppercase mb-4 text-white group-hover:text-emerald-500 transition-colors">Target Switch</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">Rapidly identify and eliminate the correct target hidden among clustered decoys.</p>
                    </button>

                    {/* Card 4: Sensitivity Finder */}
                    <button onClick={() => setCurrentMode("sensitivity-finder")} className="group relative flex flex-col text-left p-8 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 hover:border-orange-500/50 transition-all duration-300 overflow-hidden">
                        <span className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-2">Diagnostic Tool</span>
                        <h2 className="text-3xl font-black tracking-wide uppercase mb-4 text-white group-hover:text-orange-500 transition-colors">Sens Matrix</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">Run mathematical analysis on your aiming mechanics to calculate optimal mouse sensitivity.</p>
                    </button>

                </div>
            </div>
        </div>
    );
}