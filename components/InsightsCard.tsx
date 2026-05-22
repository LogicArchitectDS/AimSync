"use client";

/**
 * components/InsightsCard.tsx
 *
 * Context-aware mechanical coaching card for the AimSync dashboard.
 *
 * Reads Urgency Index (UI) and Over-Flick Coefficient (OFC) from the most
 * recent flicking sessions stored in localStorage (via statsStorage) and
 * surfaces actionable coaching recommendations when values exceed the
 * clinically significant thresholds defined in the engineering spec.
 *
 * Thresholds:
 *   OFC  > 1.20  → Over-shooting warning
 *   UI   > 2.50  → Micro-adjustment hesitancy warning
 */

import { useMemo } from "react";
import { getStoredStats } from "@/lib/utils/statsStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsightConfig {
  id: string;
  icon: string;
  level: "warning" | "caution" | "good";
  title: string;
  body: string;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  accentColor: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractKinematicsFromSessions(): {
  avgUI: number | null;
  avgOFC: number | null;
  sampleCount: number;
} {
  const stored = getStoredStats();
  const flickSessions = stored.recentSessions.filter(
    (s) =>
      (s.modeId === "static-flick" || s.modeId === "flick-benchmark") &&
      s.extraStats &&
      typeof (s.extraStats as any)["Urgency Index"] === "number"
  );

  if (flickSessions.length === 0) {
    return { avgUI: null, avgOFC: null, sampleCount: 0 };
  }

  let uiSum = 0;
  let ofcSum = 0;
  let uiCount = 0;
  let ofcCount = 0;

  for (const session of flickSessions) {
    const stats = session.extraStats as Record<string, number>;
    if (typeof stats["Urgency Index"] === "number") {
      uiSum += stats["Urgency Index"];
      uiCount++;
    }
    if (typeof stats["Over-Flick Coefficient"] === "number") {
      ofcSum += stats["Over-Flick Coefficient"];
      ofcCount++;
    }
  }

  return {
    avgUI:  uiCount  > 0 ? uiSum  / uiCount  : null,
    avgOFC: ofcCount > 0 ? ofcSum / ofcCount  : null,
    sampleCount: flickSessions.length,
  };
}

function buildInsights(
  avgUI: number | null,
  avgOFC: number | null
): InsightConfig[] {
  const insights: InsightConfig[] = [];

  // ── Condition A: Over-Flicking ────────────────────────────────────────────
  if (avgOFC !== null && avgOFC > 1.20) {
    insights.push({
      id: "ofc-high",
      icon: "⚠️",
      level: "warning",
      title: "Over-Shooting Detected",
      body: "You are consistently over-shooting your flicks and forcing corrections. Lower your sensitivity or focus on deceleration control.",
      borderColor: "border-amber-500/50",
      bgColor: "bg-amber-500/5",
      iconColor: "text-amber-400",
      accentColor: "text-amber-300",
    });
  }

  // ── Condition B: Urgency Index High ──────────────────────────────────────
  if (avgUI !== null && avgUI > 2.5) {
    insights.push({
      id: "ui-high",
      icon: "⚡",
      level: "caution",
      title: "Micro-Adjustment Hesitancy",
      body: "Your initial reaction speed is fast, but your micro-adjustments are hesitant. Practice smooth, constant-velocity target selection.",
      borderColor: "border-cyan-500/50",
      bgColor: "bg-cyan-500/5",
      iconColor: "text-cyan-400",
      accentColor: "text-cyan-300",
    });
  }

  // ── All Clear ─────────────────────────────────────────────────────────────
  if (insights.length === 0 && avgOFC !== null) {
    insights.push({
      id: "all-clear",
      icon: "✓",
      level: "good",
      title: "Mechanics Nominal",
      body: `OFC ${avgOFC.toFixed(2)} · UI ${avgUI?.toFixed(2) ?? "—"} — No significant mechanical issues detected in your recent flick sessions.`,
      borderColor: "border-emerald-500/40",
      bgColor: "bg-emerald-500/5",
      iconColor: "text-emerald-400",
      accentColor: "text-emerald-300",
    });
  }

  return insights;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InsightsCardProps {
  /** Optional CSS class overrides */
  className?: string;
}

export default function InsightsCard({ className = "" }: InsightsCardProps) {
  const { avgUI, avgOFC, sampleCount } = useMemo(
    () => extractKinematicsFromSessions(),
    // Re-compute when the component mounts; stale stats are fine between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const insights = useMemo(
    () => buildInsights(avgUI, avgOFC),
    [avgUI, avgOFC]
  );

  // ── No data state ─────────────────────────────────────────────────────────
  if (sampleCount === 0) {
    return (
      <div
        className={`bg-surface/60 border border-white/10 rounded-xl p-6 backdrop-blur-md ${className}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg">🎯</span>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Mechanical Insights
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Complete at least one{" "}
          <span className="text-white font-semibold">Static Flick</span> or{" "}
          <span className="text-white font-semibold">Flick Benchmark</span>{" "}
          session to unlock kinematic diagnostics.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface/60 border border-white/10 rounded-xl p-6 backdrop-blur-md space-y-3 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧬</span>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Mechanical Insights
          </h3>
        </div>
        <span className="text-[10px] text-slate-600 uppercase tracking-widest">
          {sampleCount} session{sampleCount !== 1 ? "s" : ""} analysed
        </span>
      </div>

      {/* Raw metrics row */}
      <div className="flex gap-4 pb-3 border-b border-white/5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">
            Avg Urgency Index
          </span>
          <span className="text-sm font-mono font-bold text-white">
            {avgUI !== null ? avgUI.toFixed(2) : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">
            Avg Over-Flick
          </span>
          <span className="text-sm font-mono font-bold text-white">
            {avgOFC !== null ? avgOFC.toFixed(2) : "—"}x
          </span>
        </div>
      </div>

      {/* Insight cards */}
      {insights.map((insight) => (
        <div
          key={insight.id}
          className={`rounded-lg border p-4 ${insight.borderColor} ${insight.bgColor} transition-all`}
          style={{
            animation: "fadeInUp 0.3s ease both",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="text-base mt-0.5 flex-shrink-0"
              aria-hidden="true"
            >
              {insight.icon}
            </span>
            <div className="space-y-1">
              <p
                className={`text-xs font-black uppercase tracking-widest ${insight.accentColor}`}
              >
                Mechanical Insight: {insight.title}
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {insight.body}
              </p>
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
