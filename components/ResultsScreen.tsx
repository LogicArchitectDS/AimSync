"use client";

import type { GameResult } from "@/lib/game/types";

type ResultsScreenProps = {
    result: GameResult;
    onRestart: () => void;
    onBackToMenu: () => void;
};

const formatMs = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return "-";
    return `${Math.round(value)} ms`;
};

const formatNumber = (value?: number, digits = 2) => {
    if (value === undefined || Number.isNaN(value)) return "-";
    return value.toFixed(digits);
};

export default function ResultsScreen({
    result,
    onRestart,
    onBackToMenu,
}: ResultsScreenProps) {
    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 absolute inset-0 z-50 overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl border border-cyan-800/30 bg-background shadow-[0_0_50px_rgba(0,229,255,0.05)] p-8">

                {/* Header */}
                <div className="mb-10 text-center">
                    <p className="text-sm font-bold tracking-[0.3em] text-cyan">PROTOCOL COMPLETE</p>
                    <h1 className="mt-2 text-5xl font-black text-text-primary tracking-tight uppercase">
                        {result.mode}
                    </h1>
                    <p className="mt-2 text-text-muted text-lg tracking-wider">
                        DIFFICULTY: <span className="font-bold text-text-primary uppercase">{result.difficulty}</span>
                    </p>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard label="Score" value={result.score} highlight />
                    <StatCard label="Accuracy" value={`${formatNumber(result.accuracy)}%`} />
                    <StatCard label="Hits" value={result.hits} />
                    <StatCard label="Misses" value={result.misses} />
                    <StatCard label="Avg Reaction" value={formatMs(result.averageReactionTime)} />
                    <StatCard label="Targets / Sec" value={formatNumber(result.targetsPerSecond)} />
                    <StatCard label="Duration" value={`${result.duration}s`} />
                    <StatCard label="Spawned" value={result.totalTargetsSpawned ?? "-"} />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-6 mt-12">
                    <button
                        onClick={onRestart}
                        className="flex-1 rounded-xl bg-cyan text-background font-black tracking-widest py-4 px-6 hover:bg-cyan-700 transition-all hover:scale-[1.02]"
                    >
                        RECALIBRATE (Restart)
                    </button>
                    <button
                        onClick={onBackToMenu}
                        className="flex-1 rounded-xl border-2 border-text-muted/30 bg-transparent py-4 px-6 font-bold tracking-widest text-text-primary hover:border-text-primary transition-all"
                    >
                        RETURN TO MENU
                    </button>
                </div>

            </div>
        </div>
    );
}

// Internal Sub-component
function StatCard({
    label,
    value,
    highlight = false
}: {
    label: string;
    value: string | number;
    highlight?: boolean;
}) {
    return (
        <div className={`rounded-xl border p-4 flex flex-col items-center justify-center text-center transition-colors ${highlight ? 'border-cyan bg-cyan/10' : 'border-text-muted/20 bg-text-muted/5'
            }`}>
            <p className="text-xs font-bold tracking-widest uppercase text-text-muted mb-1">{label}</p>
            <p className={`text-2xl font-black ${highlight ? 'text-cyan' : 'text-text-primary'}`}>{value}</p>
        </div>
    );
}