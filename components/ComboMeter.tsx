import React from 'react';

interface ComboMeterProps {
    combo: number;
}

export default function ComboMeter({ combo }: ComboMeterProps) {
    if (combo < 3) return null;

    return (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 flex items-center justify-center animate-in fade-in zoom-in duration-200 pointer-events-none z-50">
            <span className="text-white/80 font-black italic text-4xl mr-2 drop-shadow-lg">x</span>
            <span className={`font-black italic transition-all ${combo >= 30 ? 'text-7xl text-red-500 animate-pulse scale-110 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]' :
                combo >= 20 ? 'text-6xl text-orange-400 scale-105 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]' :
                    combo >= 10 ? 'text-5xl text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' :
                        'text-4xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                }`}>
                {combo}
            </span>
        </div>
    );
}
