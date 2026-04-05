"use client";

import { useState, useCallback } from "react";
import type { Routine, GameResult } from "@/lib/game/types";
import type { Difficulty } from "@/lib/utils/drillConfig";

// Mode Imports - Ensure these match your file structure
import StaticFlick from "./StaticFlick";
import TrackingMode from "./TrackingMode";
import MicroAdjust from "./MicroAdjust";
import TargetSwitch from "./TargetSwitch";
import BurstReaction from "./BurstReaction";
import ReactionTest from "./ReactionTest";

// Map string IDs from the CustomRoutine compiler to actual React Components
const ModeMap: Record<string, React.ComponentType<any>> = {
    "static-flick": StaticFlick,
    "tracking-mode": TrackingMode,
    "micro-adjust": MicroAdjust,
    "target-switch": TargetSwitch,
    "burst-reaction": BurstReaction,
    "reaction-test": ReactionTest
};

interface RoutineRunnerProps {
    routine: Routine;
    onComplete: () => void;
}

export default function RoutineRunner({ routine, onComplete }: RoutineRunnerProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [isIntermission, setIsIntermission] = useState(false);
    const [lastResult, setLastResult] = useState<GameResult | null>(null);

    const currentStep = routine.drills[stepIndex];
    const CurrentModeComponent = ModeMap[currentStep?.modeId];

    const handleDrillComplete = (result: GameResult) => {
        setLastResult(result);
        setIsIntermission(true);

        // 5-second breather/summary before the next drill initializes
        setTimeout(() => {
            if (stepIndex < routine.drills.length - 1) {
                setStepIndex((prev) => prev + 1);
                setIsIntermission(false);
            } else {
                onComplete();
            }
        }, 5000);
    };

    if (isIntermission) {
        const nextStep = routine.drills[stepIndex + 1];
        const isLast = stepIndex >= routine.drills.length - 1;

        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#121212] space-y-8 relative overflow-hidden">
                {/* Background Grid Accent */}
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('/grid.svg')] bg-center opacity-20" />

                <div className="z-10 text-center space-y-2">
                    <p className="text-emerald-500 font-black tracking-[.4em] uppercase text-xs">Module Complete</p>
                    <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Tactical Reset</h2>
                </div>

                {lastResult && (
                    <div className="z-10 flex gap-12 text-center bg-white/[0.03] border border-white/10 p-8 rounded-3xl backdrop-blur-md">
                        <div>
                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Score</p>
                            <p className="text-3xl font-black text-white">{lastResult.score.toLocaleString()}</p>
                        </div>
                        <div className="w-px bg-white/10 h-12 my-auto" />
                        <div>
                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Accuracy</p>
                            <p className="text-3xl font-black text-emerald-500">{lastResult.accuracy.toFixed(1)}%</p>
                        </div>
                        <div className="w-px bg-white/10 h-12 my-auto" />
                        <div>
                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Avg MS</p>
                            <p className="text-3xl font-black text-white">
                                {lastResult.averageReactionTime > 0 ? `${Math.round(lastResult.averageReactionTime)}ms` : "---"}
                            </p>
                        </div>
                    </div>
                )}

                <div className="z-10 p-6 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl text-center min-w-[320px]">
                    <p className="text-gray-500 mb-2 uppercase text-[10px] font-black tracking-widest">
                        {isLast ? "Deployment Finished" : `Next Phase — ${stepIndex + 2} / ${routine.drills.length}`}
                    </p>
                    <p className="text-xl font-black text-white uppercase tracking-wider">
                        {isLast ? "🏁 Sequence Terminated" : nextStep.modeId.replace(/-/g, " ")}
                    </p>
                </div>

                {/* Transition Progress Bar */}
                <div className="z-10 w-64 bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
                    <div
                        className="h-full bg-emerald-500 shadow-[0_0_10px_#10B981]"
                        style={{ animation: "cooldown 5s linear forwards" }}
                    />
                </div>

                <style>{`
                    @keyframes cooldown { 
                        from { width: 100%; } 
                        to { width: 0%; } 
                    }
                `}</style>
            </div>
        );
    }

    if (!CurrentModeComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white space-y-4">
                <p className="text-red-500 font-black tracking-widest uppercase">Error: Unknown Module {currentStep?.modeId}</p>
                <button onClick={onComplete} className="px-8 py-3 bg-white text-black font-black rounded-lg uppercase">Return to Hub</button>
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            {/* BUG FIX: The 'key' prop is essential here. 
                When stepIndex changes, the key changes, forcing React 
                to destroy the old component instance and its internal 
                timers/refs before starting the next one.
            */}
            <CurrentModeComponent
                key={`${currentStep.id}-${stepIndex}`}
                overrideSettings={{
                    duration: currentStep.durationSeconds,
                    difficulty: currentStep.difficulty as Difficulty
                }}
                onFinish={handleDrillComplete}
            />
        </div>
    );
}