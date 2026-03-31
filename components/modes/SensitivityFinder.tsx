"use client";

import React, { useMemo, useState } from "react";
import type { CalibrationResult, CalibrationTrial } from "@/lib/game/calibration";
import { analyzeCalibrationTrials, buildSensitivityCandidates } from "@/lib/utils/calibrationAnalysis";

export default function SensitivityFinder() {
    const [baseSensitivity, setBaseSensitivity] = useState(0.35);
    const [trials, setTrials] = useState<CalibrationTrial[]>(() =>
        buildSensitivityCandidates(0.35)
    );

    const result: CalibrationResult = useMemo(
        () => analyzeCalibrationTrials(trials),
        [trials]
    );

    const updateTrial = (
        sensitivity: number,
        key: keyof Omit<CalibrationTrial, "sensitivity">,
        value: number
    ) => {
        setTrials((prev) =>
            prev.map((trial) =>
                trial.sensitivity === sensitivity
                    ? { ...trial, [key]: Math.max(0, Math.min(100, value)) }
                    : trial
            )
        );
    };

    const regenerate = () => {
        setTrials(buildSensitivityCandidates(baseSensitivity));
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 relative overflow-hidden">

            {/* Tactical Minimalist Background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_800px_at_50%_0%,transparent,rgba(5,5,5,1))]"></div>

            <div className="relative z-10 mx-auto max-w-7xl space-y-8">

                {/* Header Header */}
                <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-[0_0_50px_rgba(0,229,255,0.03)]">
                    <p className="text-cyan text-sm font-bold tracking-[0.3em] uppercase mb-2">Diagnostic Tool</p>
                    <h1 className="text-4xl font-black tracking-widest uppercase">Sensitivity Finder</h1>
                    <p className="mt-2 text-sm text-text-muted tracking-wide max-w-2xl">
                        Input your baseline sensitivity to generate test candidates. Run drills with each candidate, input your subjective scores (0-100), and let the engine calculate your mathematically optimal sensitivity.
                    </p>

                    <div className="mt-8 flex flex-wrap items-end gap-6">
                        <div className="flex-1 max-w-xs">
                            <label className="mb-2 block text-xs font-bold text-text-muted tracking-wider uppercase">Baseline Sensitivity</label>
                            <input
                                type="number"
                                step="0.01"
                                value={baseSensitivity}
                                onChange={(e) => setBaseSensitivity(Number(e.target.value))}
                                className="w-full rounded-xl border border-white/10 bg-black/60 px-6 py-4 outline-none focus:border-cyan focus:ring-1 focus:ring-cyan font-mono text-lg transition-all"
                            />
                        </div>

                        <button
                            onClick={regenerate}
                            className="rounded-xl bg-white px-8 py-4 font-black tracking-widest text-black hover:bg-cyan hover:text-background transition-all"
                        >
                            GENERATE MATRIX
                        </button>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">

                    {/* Main Trials Panel */}
                    <section className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-[0_0_50px_rgba(0,229,255,0.03)]">
                        <h2 className="text-xl font-black tracking-widest uppercase border-b border-white/10 pb-4 mb-6 text-cyan">Calibration Matrix</h2>

                        <div className="space-y-6">
                            {trials.map((trial) => (
                                <div
                                    key={trial.sensitivity}
                                    className="rounded-2xl border border-white/5 bg-white/5 p-6 hover:border-cyan/30 transition-colors"
                                >
                                    <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                                        <h3 className="text-lg font-black tracking-wider uppercase">
                                            Variant <span className="text-cyan ml-2 font-mono">{trial.sensitivity.toFixed(3)}</span>
                                        </h3>
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
                                        <MetricInput
                                            label="Accuracy"
                                            value={trial.accuracy}
                                            onChange={(value) => updateTrial(trial.sensitivity, "accuracy", value)}
                                        />
                                        <MetricInput
                                            label="Comfort"
                                            value={trial.comfort}
                                            onChange={(value) => updateTrial(trial.sensitivity, "comfort", value)}
                                        />
                                        <MetricInput
                                            label="Speed"
                                            value={trial.speed}
                                            onChange={(value) => updateTrial(trial.sensitivity, "speed", value)}
                                        />
                                        <MetricInput
                                            label="Overflick"
                                            value={trial.overflickRate}
                                            onChange={(value) => updateTrial(trial.sensitivity, "overflickRate", value)}
                                        />
                                        <MetricInput
                                            label="Underflick"
                                            value={trial.underflickRate}
                                            onChange={(value) => updateTrial(trial.sensitivity, "underflickRate", value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Side Results Panel */}
                    <aside className="space-y-8">
                        <div className="rounded-3xl border border-cyan/30 bg-cyan/5 backdrop-blur-xl p-8 shadow-[0_0_50px_rgba(0,229,255,0.1)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.2L18.8 19H5.2L12 6.2z" /></svg>
                            </div>
                            <h2 className="text-xl font-black tracking-widest uppercase text-cyan">Optimal Output</h2>
                            <p className="mt-4 text-6xl font-black font-mono tracking-tight text-white drop-shadow-md">
                                {result.recommendedSensitivity.toFixed(3)}
                            </p>
                            <p className="mt-4 text-sm text-text-muted">
                                Calculated via composite weighting of control, comfort, speed, and flick variance.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-[0_0_50px_rgba(0,229,255,0.03)]">
                            <h2 className="text-xl font-black tracking-widest uppercase border-b border-white/10 pb-4 mb-6">Data Rankings</h2>

                            <div className="space-y-3">
                                {result.rankedTrials.map((trial, index) => (
                                    <div
                                        key={trial.sensitivity}
                                        className={`flex justify-between items-center rounded-xl border p-4 transition-all ${index === 0 ? 'border-cyan bg-cyan/10 text-cyan' : 'border-white/5 bg-white/5 text-text-muted'
                                            }`}
                                    >
                                        <p className="font-bold tracking-wider">
                                            #{index + 1} <span className="ml-4 font-mono text-white">{trial.sensitivity.toFixed(3)}</span>
                                        </p>
                                        <p className="text-sm font-mono font-bold">
                                            {trial.compositeScore.toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function MetricInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="flex flex-col">
            <label className="mb-2 block text-[10px] font-bold tracking-widest uppercase text-text-muted">{label}</label>
            <input
                type="number"
                min={0}
                max={100}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-center font-mono outline-none focus:border-cyan focus:ring-1 focus:ring-cyan transition-colors"
            />
        </div>
    );
}