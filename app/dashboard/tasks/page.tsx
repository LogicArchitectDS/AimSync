"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { StorageEngine } from "@/lib/utils/storage";
import type { UserStats } from "@/lib/game/types";
import type { Difficulty } from "@/lib/utils/drillConfig";
import { protocolCards } from "@/app/game/page";

// ── Seeded daily/weekly task lists ─────────────────────────────────────────
// Tasks rotate on a real-world date seed so everyone gets the same list today.
// Daily: 4 tasks, weekly: 3 tasks, sampled from the protocol pool.
function seededShuffle<T>(arr: T[], seed: number): T[] {
    const a = [...arr];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getDaySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getWeekSeed() {
    const d = new Date();
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.floor((d.getTime() - startOfYear.getTime()) / 604800000);
    return d.getFullYear() * 1000 + week;
}

const DAILY_DEFAULT_DIFFS: Difficulty[] = ["medium", "hard", "medium", "easy"];
const WEEKLY_DEFAULT_DIFFS: Difficulty[] = ["hard", "extreme", "hard"];

// ── Difficulty helpers ──────────────────────────────────────────────────────
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "extreme"];

const DIFF_LABELS: Record<Difficulty, string> = {
    easy:    "Eco",
    medium:  "Bonus",
    hard:    "Force Buy",
    extreme: "Full Buy",
};

const DIFF_COLORS: Record<Difficulty, string> = {
    easy:    "#1DB954",
    medium:  "#eab308",
    hard:    "#f97316",
    extreme: "#ef4444",
};

// ── URL diff param mapping ──────────────────────────────────────────────────
const DIFF_PARAM: Record<Difficulty, string> = {
    easy:    "eco",
    medium:  "bonus",
    hard:    "force-buy",
    extreme: "full-buy",
};

// ── Task card component ─────────────────────────────────────────────────────
function TaskCard({
    mode, name, desc, category, color, highScore, avgAcc, defaultDiff,
}: {
    mode: string; name: string; desc: string; category: string;
    color: string; highScore: number; avgAcc: number; defaultDiff: Difficulty;
}) {
    const router = useRouter();
    const [diff, setDiff] = useState<Difficulty>(defaultDiff);

    const play = () =>
        router.push(`/game?mode=${mode}&diff=${DIFF_PARAM[diff]}`);

    return (
        <div className="grid grid-cols-12 gap-3 py-4 px-4 items-center bg-[#121212]/30 border border-white/5 rounded-xl hover:border-white/20 hover:bg-white/[0.02] transition-colors group">

            {/* Name + desc */}
            <div className="col-span-4 flex flex-col min-w-0">
                <span className="text-white font-bold text-sm tracking-wide truncate group-hover:text-[#3366FF] transition-colors">
                    {name}
                </span>
                <span className="text-slate-500 text-[11px] truncate pr-2 mt-0.5">{desc}</span>
            </div>

            {/* Category badge */}
            <div className="col-span-2 flex justify-center">
                <span
                    className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border rounded-md whitespace-nowrap"
                    style={{ color, borderColor: `${color}40`, backgroundColor: `${color}1a` }}
                >
                    {category}
                </span>
            </div>

            {/* Difficulty chooser */}
            <div className="col-span-2 flex justify-center">
                <select
                    value={diff}
                    onChange={e => setDiff(e.target.value as Difficulty)}
                    onClick={e => e.stopPropagation()}
                    className="bg-black/60 border border-white/15 text-[11px] font-bold text-white rounded-md px-2 py-1.5 cursor-pointer focus:outline-none focus:border-[#3366FF] transition-colors appearance-none text-center w-full"
                    style={{ color: DIFF_COLORS[diff] }}
                >
                    {DIFFICULTIES.map(d => (
                        <option key={d} value={d} style={{ color: DIFF_COLORS[d] }}>
                            {DIFF_LABELS[d]}
                        </option>
                    ))}
                </select>
            </div>

            {/* High Score */}
            <div className="col-span-2 text-right">
                <span className="text-white font-mono text-sm font-bold">
                    {highScore > 0 ? Math.round(highScore).toLocaleString() : "--"}
                </span>
            </div>

            {/* Avg Accuracy */}
            <div className="col-span-1 text-right">
                <span className="text-emerald-400 font-mono text-sm font-bold">
                    {avgAcc > 0 ? `${avgAcc.toFixed(1)}%` : "--"}
                </span>
            </div>

            {/* Play button */}
            <div className="col-span-1 flex justify-end">
                <button
                    onClick={play}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-[#3366FF]/10 border border-[#3366FF]/30 text-[#3366FF] hover:bg-[#3366FF] hover:text-white hover:border-[#3366FF] transition-all whitespace-nowrap"
                >
                    Play ▶
                </button>
            </div>
        </div>
    );
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ label, sublabel, accent }: { label: string; sublabel: string; accent: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accent }} />
            <div>
                <h3 className="text-white font-black text-sm tracking-[0.2em] uppercase">{label}</h3>
                <p className="text-slate-500 text-[11px] tracking-wider">{sublabel}</p>
            </div>
            <div className="flex-1 h-px bg-white/5 ml-2" />
        </div>
    );
}

// ── Column header row ───────────────────────────────────────────────────────
function ColHeaders() {
    return (
        <div className="grid grid-cols-12 gap-3 pb-3 border-b border-white/10 text-[9px] font-black tracking-[0.2em] uppercase text-slate-600 px-4 mb-2">
            <div className="col-span-4">Protocol</div>
            <div className="col-span-2 text-center">Category</div>
            <div className="col-span-2 text-center">Difficulty</div>
            <div className="col-span-2 text-right">High Score</div>
            <div className="col-span-1 text-right">Avg Acc</div>
            <div className="col-span-1" />
        </div>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function TasksPage() {
    const [stats, setStats] = useState<UserStats | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setStats(StorageEngine.getUserStats()), 0);
        return () => clearTimeout(t);
    }, []);

    // Seeded shuffle so tasks rotate daily / weekly
    const dailyCards = useMemo(() => {
        const shuffled = seededShuffle(protocolCards, getDaySeed());
        return shuffled.slice(0, 4).map((card, i) => ({
            mode:        card.id,
            name:        card.title,
            desc:        card.desc,
            category:    card.category,
            color:       card.color,
            defaultDiff: DAILY_DEFAULT_DIFFS[i],
            highScore:   stats?.modes?.[card.id]?.highScore ?? 0,
            avgAcc:      stats?.modes?.[card.id]?.averageAccuracy ?? 0,
        }));
    }, [stats]);

    const weeklyCards = useMemo(() => {
        const shuffled = seededShuffle(protocolCards, getWeekSeed());
        // Pick 3 that aren't in today's dailies to avoid overlap
        const dailyIds = new Set(dailyCards.map(c => c.mode));
        const candidates = shuffled.filter(c => !dailyIds.has(c.id));
        return candidates.slice(0, 3).map((card, i) => ({
            mode:        card.id,
            name:        card.title,
            desc:        card.desc,
            category:    card.category,
            color:       card.color,
            defaultDiff: WEEKLY_DEFAULT_DIFFS[i],
            highScore:   stats?.modes?.[card.id]?.highScore ?? 0,
            avgAcc:      stats?.modes?.[card.id]?.averageAccuracy ?? 0,
        }));
    }, [stats, dailyCards]);

    return (
        <div className="w-full mt-6 space-y-10">

            {/* ── DAILY TASKS ── */}
            <div className="bg-surface/60 border border-white/10 p-8 rounded-2xl backdrop-blur-md">
                <SectionHeader
                    label="Daily Operations"
                    sublabel="Resets at midnight · Complete all 4 for bonus XP"
                    accent="#3366FF"
                />
                <ColHeaders />
                <div className="flex flex-col gap-2">
                    {dailyCards.map(card => (
                        <TaskCard key={card.mode} {...card} />
                    ))}
                </div>
            </div>

            {/* ── WEEKLY TASKS ── */}
            <div className="bg-surface/60 border border-white/10 p-8 rounded-2xl backdrop-blur-md">
                <SectionHeader
                    label="Weekly Contracts"
                    sublabel="Resets every Monday · Higher XP multiplier"
                    accent="#8b5cf6"
                />
                <ColHeaders />
                <div className="flex flex-col gap-2">
                    {weeklyCards.map(card => (
                        <TaskCard key={card.mode} {...card} />
                    ))}
                </div>
            </div>

        </div>
    );
}