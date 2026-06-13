import { Suspense } from 'react';
import Link from 'next/link';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// --- SKELETON LOADER FOR INSTANT STATIC NAVIGATIONS ---
function LeaderboardTableSkeleton() {
    return (
        <div className="max-w-6xl w-full bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-pulse">
            <table className="w-full text-left border-collapse table-fixed">
                <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-slate-500">
                        <th className="py-4 px-6 w-20">Rank</th>
                        <th className="py-4 px-6 w-48 text-left">Competitor</th>
                        <th className="py-4 px-6 w-24 text-center">Level</th>
                        <th className="py-4 px-6 w-32 text-right">Avg Acc</th>
                        <th className="py-4 px-6 w-32 text-right">Max Combo</th>
                        <th className="py-4 px-6 w-32 text-right">Sessions</th>
                        <th className="py-4 px-6 w-32 text-right">Consistency</th>
                        <th className="py-4 px-6 w-36 text-right">Score</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 15 }).map((_, i) => (
                        <tr key={i} className="border-b border-white/5 h-[61px]">
                            <td className="py-3.5 px-6"><div className="w-8 h-8 bg-white/5 rounded-lg" /></td>
                            <td className="py-3.5 px-6"><div className="w-32 h-4 bg-white/5 rounded" /></td>
                            <td className="py-3.5 px-6"><div className="w-10 h-4 bg-white/5 rounded mx-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-16 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-16 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-12 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-20 h-4 bg-white/5 rounded ml-auto" /></td>
                            <td className="py-3.5 px-6"><div className="w-24 h-4 bg-white/5 rounded ml-auto" /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- ERROR FALLBACK DISPLAY ---
function ErrorTableMessage({ message }: { message: string }) {
    return (
        <div className="max-w-6xl w-full bg-white/[0.01] border border-red-500/20 rounded-3xl p-12 text-center text-slate-400 shadow-2xl">
            <p className="text-lg font-bold text-red-500/80 mb-2">Telemetry System Offline</p>
            <p className="text-sm font-mono">{message}</p>
        </div>
    );
}

// --- DYNAMIC DATA LOADER ---
async function LeaderboardData() {
    let db: any;
    try {
        if ((process.env as any).DB) {
            db = (process.env as any).DB;
        } else {
            db = getRequestContext().env.DB;
        }
    } catch {
        db = null;
    }

    if (!db) {
        return <ErrorTableMessage message="D1 Database binding missing in edge context." />;
    }

    try {
        // SQL query calculating aggregate scores (Total XP combined with accuracy scaling)
        // consistency_days counts unique active training calendar dates
        const result = await db.prepare(`
            SELECT 
                up.user_id,
                MAX(st.username) as username,
                up.current_level,
                up.total_xp,
                COUNT(st.id) as total_sessions,
                ROUND(AVG(st.accuracy), 1) as avg_accuracy,
                MAX(st.max_combo) as peak_combo,
                COUNT(DISTINCT date(st.created_at)) as consistency_days,
                ROUND(up.total_xp * (AVG(st.accuracy) / 100.0) * (1.0 + (COUNT(st.id) / 100.0)), 0) as ranking_score
            FROM user_progression up
            JOIN scores_telemetry st ON up.user_id = st.user_id
            WHERE st.integrity_flag = 'HIGH_INTEGRITY'
            GROUP BY up.user_id, up.current_level, up.total_xp
            ORDER BY ranking_score DESC
            LIMIT 50
        `).all();

        const entries = result.results || [];

        if (entries.length === 0) {
            return <ErrorTableMessage message="No high scores registered on Aegis nodes yet." />;
        }

        return (
            <div className="max-w-6xl w-full bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-slate-500">
                                <th className="py-4 px-6 w-20">Rank</th>
                                <th className="py-4 px-6 w-48 text-left">Competitor</th>
                                <th className="py-4 px-6 w-24 text-center">Level</th>
                                <th className="py-4 px-6 w-32 text-right">Avg Acc</th>
                                <th className="py-4 px-6 w-32 text-right">Max Combo</th>
                                <th className="py-4 px-6 w-32 text-right">Sessions</th>
                                <th className="py-4 px-6 w-32 text-right">Consistency</th>
                                <th className="py-4 px-6 w-36 text-right">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm font-mono">
                            {entries.map((entry: any, index: number) => {
                                const rank = index + 1;
                                let rankColor = "text-slate-400";
                                let rankBg = "bg-white/5";

                                if (rank === 1) {
                                    rankColor = "text-[#08090d] font-black";
                                    rankBg = "bg-yellow-400";
                                } else if (rank === 2) {
                                    rankColor = "text-[#08090d] font-black";
                                    rankBg = "bg-slate-300";
                                } else if (rank === 3) {
                                    rankColor = "text-[#08090d] font-black";
                                    rankBg = "bg-amber-600";
                                }

                                return (
                                    <tr key={entry.user_id} className="hover:bg-white/[0.01] transition-colors border-b border-white/5">
                                        <td className="py-3.5 px-6">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${rankBg} ${rankColor}`}>
                                                {rank}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-6 font-bold tracking-wide truncate text-left text-slate-200">
                                            {entry.username || 'Anonymous Player'}
                                        </td>
                                        <td className="py-3.5 px-6 text-center text-slate-300">
                                            {entry.current_level}
                                        </td>
                                        <td className="py-3.5 px-6 text-right text-emerald-400 font-semibold">
                                            {entry.avg_accuracy}%
                                        </td>
                                        <td className="py-3.5 px-6 text-right text-slate-300">
                                            {entry.peak_combo}
                                        </td>
                                        <td className="py-3.5 px-6 text-right text-slate-400">
                                            {entry.total_sessions}
                                        </td>
                                        <td className="py-3.5 px-6 text-right text-cyan-400 font-semibold">
                                            {entry.consistency_days}d / 7d
                                        </td>
                                        <td className="py-3.5 px-6 text-right font-black text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                                            {Number(entry.ranking_score).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    } catch (e) {
        console.error("Leaderboard database query error:", e);
        return <ErrorTableMessage message="An error occurred while executing D1 aggregation queries." />;
    }
}

export default async function LeaderboardPage() {
    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#08090d] text-white p-4 md:p-8 font-sans selection:bg-[#00f0ff] selection:text-[#08090d] items-center">
            {/* Header */}
            <div className="max-w-6xl w-full flex flex-col md:flex-row items-center justify-between gap-6 mb-8 mt-4">
                <div className="text-center md:text-left space-y-2">
                    <p className="text-[#00f0ff] text-xs font-bold tracking-[0.4em] uppercase">Global Database</p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-widest uppercase">
                        LEADER<span className="text-[#00f0ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">BOARD</span>
                    </h1>
                    <p className="text-gray-400 text-sm max-w-xl font-medium">
                        Analyze optimal mouse lines and rank standings of players globally.
                    </p>
                </div>
                <Link
                    href="/dashboard"
                    className="px-6 py-3 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 rounded-xl font-bold tracking-wider transition-all text-sm shrink-0"
                >
                    RETURN TO COMMAND CENTER
                </Link>
            </div>

            {/* Standings Table wrapped in Suspense for streaming shell rendering */}
            <Suspense fallback={<LeaderboardTableSkeleton />}>
                <LeaderboardData />
            </Suspense>
        </div>
    );
}
