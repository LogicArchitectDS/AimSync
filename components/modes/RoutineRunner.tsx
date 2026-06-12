"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Routine, GameResult } from "@/lib/game/types";
import { proPlaylists } from "@/lib/config/proPlaylists";
import StaticFlick from "./StaticFlick";
import TrackingMode from "./TrackingMode";
import MicroAdjust from "./MicroAdjust";
import TargetSwitch from "./TargetSwitch";
import BurstReaction from "./BurstReaction";
import FlickBenchmark from "./FlickBenchmark";
import ReactionTest from "./ReactionTest";
import ConsistencyCheck from "./ConsistencyCheck";
import Echolocation from "./Echolocation";
import CognitiveOverdrive from "./CognitiveOverdrive";
import RecoilReactiveEvasion from "./RecoilReactiveEvasion";
import BlindFlick from "./BlindFlick";
import JigglePeek from "./JigglePeek";
import type { Difficulty } from "@/lib/utils/drillConfig";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModeMap: Record<string, React.ComponentType<any>> = {
    "static-flick": StaticFlick,
    "tracking-mode": TrackingMode,
    "micro-adjust": MicroAdjust,
    "target-switch": TargetSwitch,
    "burst-reaction": BurstReaction,
    "flick-benchmark": FlickBenchmark,
    "reaction-test": ReactionTest,
    "consistency-check": ConsistencyCheck,
    "echolocation": Echolocation,
    "cognitive-overdrive": CognitiveOverdrive,
    "recoil-evasion": RecoilReactiveEvasion,
    "blind-flick": BlindFlick,
    "jiggle-peek": JigglePeek,
};

interface OverrideSettings {
    duration: number;
    difficulty: Difficulty;
}

function resolveModeKey(modeId: string): string {
    const normalized = modeId.toLowerCase().replace(/_/g, "-");
    if (
        normalized === "continuous-tracking" ||
        normalized === "tracking-protocol" ||
        normalized === "continuous-track" ||
        normalized === "tracking-while-moving" ||
        normalized === "smoothness-track"
    ) {
        return "tracking-mode";
    }
    if (normalized === "micro-precision") {
        return "micro-adjust";
    }
    if (normalized === "vertical-flick" || normalized === "spatial-flick") {
        return "static-flick";
    }
    if (normalized === "flick-track-hybrid") {
        return "target-switch";
    }
    if (
        normalized === "recoil-reactive-evasion" ||
        normalized === "recoil_reactive_evasion" ||
        normalized === "recoil-reactive" ||
        normalized === "recoil-evasion"
    ) {
        return "recoil-evasion";
    }
    return normalized;
}

export default function RoutineRunner({ routine, onComplete }: { routine: Routine; onComplete: () => void }) {
    const searchParams = useSearchParams();
    const playlistParam = searchParams.get("playlist");

    const [activeRoutine, setActiveRoutine] = useState<Routine>(routine);
    const [stepIndex, setStepIndex] = useState(0);
    const [isIntermission, setIsIntermission] = useState(false);
    const [lastResult, setLastResult] = useState<GameResult | null>(null);

    // Ingest playlist from URL query parameters if present, overriding baseline routine
    useEffect(() => {
        if (playlistParam) {
            const proPlaylist = proPlaylists.find((p) => p.id === playlistParam);
            if (proPlaylist) {
                const difficultyMap: Record<string, string> = {
                    "Eco": "easy",
                    "Bonus": "medium",
                    "Force Buy": "hard",
                    "Full Buy": "extreme",
                };
                const compiled: Routine = {
                    id: proPlaylist.id,
                    name: `${proPlaylist.proName}'s Regimen`,
                    description: proPlaylist.description,
                    authorId: proPlaylist.creatorType,
                    createdAt: new Date().toISOString(),
                    drills: proPlaylist.sequence.map((task, idx) => ({
                        id: `${proPlaylist.id}-drill-${idx}-${Date.now()}`,
                        modeId: resolveModeKey(task.modeId),
                        difficulty: difficultyMap[task.difficulty] || "medium",
                        durationSeconds: task.duration,
                    })),
                };
                setActiveRoutine(compiled);
            }
        } else {
            setActiveRoutine(routine);
        }
    }, [playlistParam, routine]);

    const currentStep = activeRoutine.drills[stepIndex];
    const CurrentModeComponent = ModeMap[currentStep?.modeId];

    const handleDrillComplete = (result: GameResult) => {
        setLastResult(result);
        setIsIntermission(true);

        setTimeout(() => {
            if (stepIndex < activeRoutine.drills.length - 1) {
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
        const nextStep = activeRoutine.drills[stepIndex + 1];
        const isLast = stepIndex >= activeRoutine.drills.length - 1;

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
                        {isLast ? "Routine Complete" : `Next Up — Drill ${stepIndex + 2} / ${activeRoutine.drills.length}`}
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