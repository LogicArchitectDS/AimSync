'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

export default function GameHUD() {
    // Atomic selectors for better performance
    const status = useGameStore(state => state.status);
    const score = useGameStore(state => state.score);
    const timeRemaining = useGameStore(state => state.timeRemaining);
    const totalDuration = useGameStore(state => state.totalDuration);
    const tickTimer = useGameStore(state => state.tickTimer);

    // NEW: Grab the active combo
    const combo = useGameStore(state => state.combo);

    useEffect(() => {
        if (status !== 'playing') return;

        const interval = setInterval(() => {
            tickTimer();
        }, 100);

        return () => clearInterval(interval);
    }, [status, tickTimer]);

    if (status !== 'playing') {
        return null;
    }

    const elapsedTime = totalDuration - timeRemaining;
    const kps = elapsedTime > 0 ? (score / elapsedTime).toFixed(2) : '0.00';

    const formattedTime = `00:${timeRemaining.toString().padStart(2, '0')}`;
    const timeColorClass = timeRemaining <= 5 ? 'text-red-500 animate-pulse' : 'text-white';

    return (
        <>
            {/* Standard Telemetry HUD */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/10 flex items-center gap-8 shadow-xl pointer-events-none">
                <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">Time</span>
                    <span className={`text-2xl font-black font-mono tabular-nums ${timeColorClass}`}>{formattedTime}</span>
                </div>

                <div className="w-px h-8 bg-white/10"></div>

                <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">Score</span>
                    <span className="text-2xl font-black font-mono tabular-nums text-cyan-400">{score}</span>
                </div>

                <div className="w-px h-8 bg-white/10"></div>

                <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">KPS</span>
                    <span className="text-2xl font-black font-mono tabular-nums text-green-400">{kps}</span>
                </div>
            </div>

            {/* --- CALIBRATED ARKHAM COMBO COUNTER (3, 10, 20, 30) --- */}
            {combo >= 3 && (
                <div className="absolute top-32 left-1/2 -translate-x-1/2 flex items-center justify-center animate-in fade-in zoom-in duration-200 pointer-events-none z-10">
                    <span className="text-white/80 font-black italic text-4xl mr-2 drop-shadow-lg">x</span>
                    <span className={`font-black italic transition-all ${combo >= 30 ? 'text-7xl text-red-500 animate-pulse scale-110 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]' :
                        combo >= 20 ? 'text-6xl text-orange-400 scale-105 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]' :
                            combo >= 10 ? 'text-5xl text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' :
                                'text-4xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                        }`}>
                        {combo}
                    </span>
                </div>
            )}
        </>
    );
}