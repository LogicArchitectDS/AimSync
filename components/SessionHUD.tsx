"use client";

import React from "react";
import type { HUDData } from "@/lib/game/hud";

type SessionHUDProps = {
    data: HUDData;
};

const formatMs = (value?: number) => {
    if (value === undefined) return "-";
    return `${Math.round(value)} ms`;
};

export default function SessionHUD({ data }: SessionHUDProps) {
    return (
        <div className="w-full flex flex-row items-center justify-between px-6 py-4 bg-background border-t border-gray-800 text-text-primary z-10">

            {/* Left: Mode & Difficulty */}
            <div className="flex flex-col">
                <h3 className="font-black tracking-widest uppercase text-sm">
                    {data.mode}
                </h3>
                <span className="text-cyan text-xs font-bold uppercase tracking-wider">
                    {data.difficulty}
                </span>
            </div>

            {/* Center: Primary Stats (Horizontal) */}
            <div className="flex flex-row gap-8 text-sm">
                <div className="flex flex-col items-center">
                    <span className="text-text-muted text-xs font-bold tracking-widest">SCORE</span>
                    <span className="font-black text-cyan text-lg">{data.score}</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-text-muted text-xs font-bold tracking-widest">ACCURACY</span>
                    <span className="font-black text-lg">{data.accuracy}%</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-text-muted text-xs font-bold tracking-widest">HITS / MISSES</span>
                    <span className="font-black text-lg">{data.hits} / {data.misses}</span>
                </div>

                {data.averageReactionTime !== undefined && (
                    <div className="flex flex-col items-center border-l border-gray-800 pl-8">
                        <span className="text-text-muted text-xs font-bold tracking-widest">AVG REACTION</span>
                        <span className="font-black text-lg">{formatMs(data.averageReactionTime)}</span>
                    </div>
                )}
            </div>

            {/* Right: Time Remaining */}
            <div className="flex flex-col items-end">
                <span className="text-text-muted text-xs font-bold tracking-widest">TIME</span>
                <span className="font-black text-orange text-2xl leading-none">{data.timeLeft}s</span>
            </div>

        </div>
    );
}