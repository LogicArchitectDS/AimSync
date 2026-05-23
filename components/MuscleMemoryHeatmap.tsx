"use client";

import { useEffect, useRef, useMemo } from "react";
import type { UserStats } from "@/lib/game/types";

interface MuscleMemoryHeatmapProps {
    safeStats: UserStats;
}

export default function MuscleMemoryHeatmap({ safeStats }: MuscleMemoryHeatmapProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const missQuadrants = safeStats.missQuadrants || { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
    const totalMisses = Object.values(missQuadrants).reduce((a, b) => a + b, 0);

    const pcts = useMemo(() => {
        if (totalMisses === 0) {
            return { topLeft: 25, topRight: 25, bottomLeft: 25, bottomRight: 25 };
        }
        return {
            topLeft: (missQuadrants.topLeft / totalMisses) * 100,
            topRight: (missQuadrants.topRight / totalMisses) * 100,
            bottomLeft: (missQuadrants.bottomLeft / totalMisses) * 100,
            bottomRight: (missQuadrants.bottomRight / totalMisses) * 100,
        };
    }, [missQuadrants, totalMisses]);

    // Compute mechanical bias assessment
    const biasInfo = useMemo(() => {
        if (totalMisses < 5) {
            return {
                title: "INSUFFICIENT DATA",
                desc: "Complete more training sessions. The AI engine requires at least 5 registered missed shots to diagnose your muscle memory tendencies.",
                color: "text-slate-400 bg-slate-500/5 border-slate-500/20",
                barColor: "bg-slate-500"
            };
        }

        const maxKey = Object.entries(pcts).reduce((a, b) => (b[1] > a[1] ? b : a))[0];

        switch (maxKey) {
            case "topLeft":
                return {
                    title: "LEFTWARD / UPWARD BIAS (Target Overshoot)",
                    desc: "You consistently miss above and to the left of the target. This indicates mouse-release timing delay or wrist-flick overshoot. Work on your deceleration phase, or try lowering your horizontal mouse sensitivity slightly.",
                    color: "text-red-400 bg-red-950/20 border-red-500/20",
                    barColor: "bg-red-500"
                };
            case "topRight":
                return {
                    title: "RIGHTWARD / UPWARD BIAS (Target Overshoot)",
                    desc: "You consistently miss above and to the right of the target. This represents excess momentum on outward wrist extensions. Grinding the 'Needlepoint' precision mode will help train decelerative motor control.",
                    color: "text-orange-400 bg-orange-950/20 border-orange-500/20",
                    barColor: "bg-orange-500"
                };
            case "bottomLeft":
                return {
                    title: "LEFTWARD / DOWNWARD BIAS (Drag Under-flick)",
                    desc: "You consistently miss below and to the left of the target. This is typical of wrist-anchoring issues, where your mouse drags against the desk pad, restricting vertical extension. Try raising your wrist or using a low-friction sleeve.",
                    color: "text-amber-400 bg-amber-950/20 border-amber-500/20",
                    barColor: "bg-amber-500"
                };
            case "bottomRight":
                return {
                    title: "RIGHTWARD / DOWNWARD BIAS (Drag Under-flick)",
                    desc: "You consistently miss below and to the right of the target. This points to under-flicking, common during speed-flicking benchmarks. Focus on full arm-to-wrist coordination rather than solely relying on finger movements.",
                    color: "text-yellow-400 bg-yellow-950/20 border-yellow-500/20",
                    barColor: "bg-yellow-500"
                };
            default:
                return {
                    title: "BALANCED PRECISION PROFILE",
                    desc: "Your historical hit-miss distribution is evenly balanced, showing no structural muscle memory asymmetry. Excellent mechanical neutral stance.",
                    color: "text-cyan-400 bg-cyan-950/20 border-cyan-500/20",
                    barColor: "bg-cyan-500"
                };
        }
    }, [pcts, totalMisses]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        ctx.clearRect(0, 0, width, height);

        // Draw Cyberpunk styling grid lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
        ctx.lineWidth = 1;
        const step = 20;
        for (let i = step; i < width; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        // Draw quadrant heat zones
        const draws = [
            { key: "topLeft", x: 0, y: 0, w: cx, h: cy, color: "239, 68, 68" },
            { key: "topRight", x: cx, y: 0, w: cx, h: cy, color: "249, 115, 22" },
            { key: "bottomLeft", x: 0, y: cy, w: cx, h: cy, color: "245, 158, 11" },
            { key: "bottomRight", x: cx, y: cy, w: cx, h: cy, color: "234, 179, 8" }
        ];

        draws.forEach((d) => {
            const pct = pcts[d.key as keyof typeof pcts] || 0;
            if (pct > 0 && totalMisses >= 5) {
                const qcx = d.x + d.w / 2;
                const qcy = d.y + d.h / 2;
                const grad = ctx.createRadialGradient(qcx, qcy, 5, qcx, qcy, Math.min(d.w, d.h) * 0.95);
                const opacity = 0.12 + (pct / 100) * 0.58;
                grad.addColorStop(0, `rgba(${d.color}, ${opacity})`);
                grad.addColorStop(0.5, `rgba(${d.color}, ${opacity * 0.35})`);
                grad.addColorStop(1, `rgba(${d.color}, 0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(d.x, d.y, d.w, d.h);
            }
        });

        // Draw central crosshair lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(cx, 10);
        ctx.lineTo(cx, height - 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(10, cy);
        ctx.lineTo(width - 10, cy);
        ctx.stroke();

        ctx.setLineDash([]);

        // Target Zone central ring
        ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 35, 0, Math.PI * 2);
        ctx.stroke();

        // Outer reference bounds ring
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 80, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair reticle dot
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        // Render percentage values inside quadrants
        ctx.font = "bold 13px Courier New, monospace";
        ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textVal = (key: string) => {
            if (totalMisses < 5) return "--";
            return `${pcts[key as keyof typeof pcts].toFixed(1)}%`;
        };

        ctx.fillText(textVal("topLeft"), cx / 2, cy / 2);
        ctx.fillText(textVal("topRight"), cx + cx / 2, cy / 2);
        ctx.fillText(textVal("bottomLeft"), cx / 2, cy + cy / 2);
        ctx.fillText(textVal("bottomRight"), cx + cx / 2, cy + cy / 2);

    }, [pcts, totalMisses]);

    return (
        <div className="bg-surface/60 border border-white/10 p-6 md:p-8 rounded-xl backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
            {/* Glowing neon background nodes */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#00f0ff]/5 rounded-full blur-[80px] pointer-events-none" />

            {/* Left Column: Visual Canvas Heatmap */}
            <div className="relative shrink-0 flex flex-col items-center">
                <div className="text-[10px] font-black text-slate-500 tracking-[0.25em] uppercase mb-3">Miss Click Vectors</div>
                <div className="relative border border-white/10 bg-black/60 rounded-xl overflow-hidden p-2 shadow-inner">
                    <canvas
                        ref={canvasRef}
                        width={260}
                        height={260}
                        className="block rounded-lg"
                    />
                    {/* Centered crosshair labeling indicators */}
                    <div className="absolute top-4 left-4 text-[9px] font-mono text-slate-600">TL</div>
                    <div className="absolute top-4 right-4 text-[9px] font-mono text-slate-600">TR</div>
                    <div className="absolute bottom-4 left-4 text-[9px] font-mono text-slate-600">BL</div>
                    <div className="absolute bottom-4 right-4 text-[9px] font-mono text-slate-600">BR</div>
                </div>
                <div className="text-[9px] text-slate-600 mt-2 font-mono">Center represents target coordinate (0,0)</div>
            </div>

            {/* Right Column: Analytics Metrics */}
            <div className="flex-1 space-y-6">
                <div>
                    <span className="px-2.5 py-0.5 text-[9px] font-black tracking-widest text-[#00f0ff] bg-[#00f0ff]/10 rounded border border-[#00f0ff]/20 uppercase">BIOMETRIC PROFILER</span>
                    <h2 className="text-white font-black text-xl uppercase tracking-wider mt-1.5">Muscle Memory Heatmap</h2>
                    <p className="text-slate-400 text-xs mt-1">Real-time coordinate error logging relative to target center centroids.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/35 border border-white/5 p-3.5 rounded-lg flex flex-col justify-between">
                        <span className="text-[9px] font-black tracking-wider uppercase text-red-400">Top-Left</span>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="text-xl font-mono font-black text-white">{totalMisses >= 5 ? `${pcts.topLeft.toFixed(1)}%` : '--'}</span>
                            {totalMisses >= 5 && <span className="text-[10px] text-slate-500 font-mono">({missQuadrants.topLeft} misses)</span>}
                        </div>
                    </div>

                    <div className="bg-black/35 border border-white/5 p-3.5 rounded-lg flex flex-col justify-between">
                        <span className="text-[9px] font-black tracking-wider uppercase text-orange-400">Top-Right</span>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="text-xl font-mono font-black text-white">{totalMisses >= 5 ? `${pcts.topRight.toFixed(1)}%` : '--'}</span>
                            {totalMisses >= 5 && <span className="text-[10px] text-slate-500 font-mono">({missQuadrants.topRight} misses)</span>}
                        </div>
                    </div>

                    <div className="bg-black/35 border border-white/5 p-3.5 rounded-lg flex flex-col justify-between">
                        <span className="text-[9px] font-black tracking-wider uppercase text-amber-400">Bottom-Left</span>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="text-xl font-mono font-black text-white">{totalMisses >= 5 ? `${pcts.bottomLeft.toFixed(1)}%` : '--'}</span>
                            {totalMisses >= 5 && <span className="text-[10px] text-slate-500 font-mono">({missQuadrants.bottomLeft} misses)</span>}
                        </div>
                    </div>

                    <div className="bg-black/35 border border-white/5 p-3.5 rounded-lg flex flex-col justify-between">
                        <span className="text-[9px] font-black tracking-wider uppercase text-yellow-400">Bottom-Right</span>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="text-xl font-mono font-black text-white">{totalMisses >= 5 ? `${pcts.bottomRight.toFixed(1)}%` : '--'}</span>
                            {totalMisses >= 5 && <span className="text-[10px] text-slate-500 font-mono">({missQuadrants.bottomRight} misses)</span>}
                        </div>
                    </div>
                </div>

                <div className={`p-4 rounded-lg border text-xs leading-relaxed ${biasInfo.color}`}>
                    <div className="font-black uppercase tracking-wider mb-1.5">AI Diagnostic: {biasInfo.title}</div>
                    <div>{biasInfo.desc}</div>
                </div>
            </div>
        </div>
    );
}
