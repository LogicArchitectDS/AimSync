import React from 'react';

interface ComboMeterProps {
    combo: number;
}

export default function ComboMeter({ combo }: ComboMeterProps) {
    if (combo < 3) return null;

    // Calculate percentage fill (cap at 30 for max meter)
    const fillPct = Math.min((combo / 30) * 100, 100);

    // Determine color tier (Dark, Batman/Arkham vibe)
    let colorClass = 'text-zinc-300 drop-shadow-[0_0_10px_rgba(212,212,216,0.6)]';
    let fillClass = 'bg-zinc-300 shadow-[0_0_15px_#d4d4d8]';
    let sizeClass = 'text-5xl';
    
    if (combo >= 30) {
        // Freeflow Max: Blood Red / Crimson with pulse
        colorClass = 'text-red-700 animate-pulse drop-shadow-[0_0_25px_rgba(185,28,28,0.9)]';
        fillClass = 'bg-red-700 shadow-[0_0_20px_#b91c1c] animate-pulse';
        sizeClass = 'text-8xl scale-125';
    } else if (combo >= 20) {
        // Danger/Arkham Knight: Crimson
        colorClass = 'text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]';
        fillClass = 'bg-red-600 shadow-[0_0_15px_#dc2626]';
        sizeClass = 'text-7xl scale-110';
    } else if (combo >= 15) {
        // Fire/Intense: Deep Orange
        colorClass = 'text-orange-600 drop-shadow-[0_0_15px_rgba(234,88,12,0.8)]';
        fillClass = 'bg-orange-600 shadow-[0_0_15px_#ea580c]';
        sizeClass = 'text-6xl scale-105';
    } else if (combo >= 10) {
        // Bat-Signal: Amber/Gold
        colorClass = 'text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]';
        fillClass = 'bg-amber-500 shadow-[0_0_15px_#f59e0b]';
        sizeClass = 'text-6xl';
    } else if (combo >= 5) {
        // Gotham Night: Deep Blue
        colorClass = 'text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]';
        fillClass = 'bg-blue-500 shadow-[0_0_15px_#3b82f6]';
        sizeClass = 'text-5xl';
    }

    return (
        <div className="absolute bottom-20 left-20 flex flex-col animate-in fade-in zoom-in duration-200 pointer-events-none z-50">
            {/* The Number Section */}
            <div className="flex items-end justify-start mb-2">
                <span className="text-white/50 font-black italic text-4xl mr-1 pb-1 drop-shadow-lg">x</span>
                <span className={`font-black italic transition-all duration-300 origin-bottom-left ${colorClass} ${sizeClass}`}>
                    {combo}
                </span>
            </div>
            
            {/* The Exclusivity Gauge (Empty Box that fills up) */}
            <div className="w-64 h-4 bg-black/60 border-2 border-white/10 overflow-hidden rounded-sm skew-x-[-15deg] shadow-[0_4px_10px_rgba(0,0,0,0.5)] relative backdrop-blur-sm">
                <div 
                    className={`h-full transition-all duration-500 ease-out ${fillClass}`} 
                    style={{ width: `${fillPct}%` }} 
                />
            </div>
            <span className="text-white/30 text-[10px] font-black tracking-[0.3em] uppercase mt-1 ml-2 italic">Combo Rating</span>
        </div>
    );
}
