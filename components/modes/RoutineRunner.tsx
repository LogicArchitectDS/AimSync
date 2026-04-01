"use client";

import { useState } from "react";
import type { Routine, GameResult } from "@/lib/game/types";
import StaticFlick from "./StaticFlick";
import TrackingMode from "./TrackingMode";
import MicroAdjust from "./MicroAdjust";
import TargetSwitch from "./TargetSwitch";
import BurstReaction from "./BurstReaction";
import type { Difficulty } from "@/lib/utils/drillConfig";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModeMap: Record<string, React.ComponentType<any>> = {
    "static-flick": StaticFlick,
    "tracking-mode": TrackingMode,
    "micro-adjust": MicroAdjust,
    "target-switch": TargetSwitch,
    "burst-reaction": BurstReaction,
};

interface OverrideSettings {
    duration: number;
    difficulty: Difficulty;
}

export default function RoutineRunner({ routine, onComplete }: { routine: Routine; onComplete: () => void }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [isIntermission, setIsIntermission] = useState(false);
    const [lastResult, setLastResult] = useState<GameResult | null>(null);

    const currentStep = routine.drills[stepIndex];
    const CurrentModeComponent = ModeMap[currentStep?.modeId];

    const handleDrillComplete = (result: GameResult) => {
        setLastResult(result);
        setIsIntermission(true);

        setTimeout(() => {
            if (stepIndex < routine.drills.length - 1) {
                setStepIndex((prev) => prev + 1);
                setIsIntermission(false);
            } else {
                onComplete();
            }
        }, 5000);
    };

    const overrideSettings: OverrideSettings = {
        duration: currentStep?.durationSeconds ?? 30,
        difficulty: (currentStep?.difficulty as Difficulty) ?? "medium",
    };

    if (isIntermission) {
        const nextStep = routine.drills[stepIndex + 1];
        const isLast = stepIndex >= routine.drills.length - 1;

        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#121212] space-y-6">
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                <p className="text-[#3366FF] font-bold tracking-[.3em] uppercase text-sm">Drill Complete</p>
                <h2 className="text-4xl font-black text-white uppercase">Nice Work</h2>

                {lastResult && (
                    <div className="flex gap-8 text-center">
                        <div><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Score</p><p className="text-2xl font-black text-white">{lastResult.score}</p></div>
                        <div><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Accuracy</p><p className="text-2xl font-black text-[#3366FF]">{lastResult.accuracy.toFixed(1)}%</p></div>
                        <div><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Avg Reaction</p><p className="text-2xl font-black text-white">{lastResult.averageReactionTime > 0 ? `${Math.round(lastResult.averageReactionTime)}ms` : "N/A"}</p></div>
                    </div>
                )}

                <div className="p-8 border border-white/10 bg-black/40 rounded-2xl text-center min-w-[280px]">
                    <p className="text-gray-400 mb-2 uppercase text-xs font-bold">
                        {isLast ? "Routine Complete" : `Next Up — Drill ${stepIndex + 2} / ${routine.drills.length}`}
                    </p>
                    <p className="text-2xl font-bold text-white uppercase">
                        {isLast ? "🏁 All Done!" : nextStep.modeId.replace(/-/g, " ")}
                    </p>
                </div>

                {/* Progress bar */}
                <div className="w-64 bg-white/10 rounded-full h-1 overflow-hidden">
                    <div className="h-full bg-[#3366FF] rounded-full" style={{ animation: "shrink 5s linear forwards" }}></div>
                </div>

                <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
            </div>
        );
    }

    if (!CurrentModeComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white space-y-4">
                <p className="text-red-400 font-bold">Unknown mode: {currentStep?.modeId}</p>
                <button onClick={onComplete} className="px-6 py-3 bg-white text-[#121212] rounded-xl font-bold">Back to Hub</button>
            </div>
        );
    }

    return (
        <CurrentModeComponent
            key={currentStep.id}
            overrideSettings={overrideSettings}
            onFinish={handleDrillComplete}
        />
    );
}