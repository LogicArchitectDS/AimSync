'use client';

import { useState, useEffect } from 'react';
import {
    Radar, RadarChart, PolarGrid,
    PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts';

interface RadarProfilerProps {
    stats?: {
        flickingXp: number;
        trackingXp: number;
        speedXp: number;
        precisionXp: number;
        perceptionXp: number;
        cognitionXp: number;
    }
}

export default function RadarProfiler({ stats }: RadarProfilerProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setIsMounted(true);

        const fetchTelemetry = async () => {
            try {
                const res = await fetch('/api/get-stats');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setChartData(data);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch radar telemetry:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTelemetry();
    }, []);

    // SSR Guard
    if (!isMounted) {
        return (
            <div className="w-full max-w-md bg-[#121212]/80 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-2xl flex flex-col items-center justify-center min-h-[362px] relative">
                <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-[#121212]/80 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-2xl flex flex-col items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full scale-150" />

            <h2 className="text-white/80 font-black tracking-[0.3em] uppercase text-sm mb-4 relative z-10">
                AimSync Diagnostic
            </h2>

            <div className="w-full min-h-[300px] relative z-10 flex items-center justify-center">
                {loading ? (
                    <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin" />
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(59,130,246,0.5)', borderRadius: '12px' }}
                                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                formatter={(value: any) => [`Level ${value}`, 'Current Rank']}
                            />
                            <Radar
                                name="Player Stats"
                                dataKey="level"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fill="#3b82f6"
                                fillOpacity={0.4}
                                animationDuration={1500}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
