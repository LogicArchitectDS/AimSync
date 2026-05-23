"use client";

import { useEffect, useState, useRef } from "react";

interface StreakAnnouncerProps {
  combo: number;
}

interface Announcement {
  text: string;
  subtext: string;
  tier: "clean" | "locked" | "impeccable";
  id: number;
}

export default function StreakAnnouncer({ combo }: StreakAnnouncerProps) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const lastTriggeredComboRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset checks if combo breaks
    if (combo < 10) {
      lastTriggeredComboRef.current = 0;
      return;
    }

    let nextAnnouncement: Omit<Announcement, "id"> | null = null;

    if (combo >= 50 && lastTriggeredComboRef.current < 50) {
      nextAnnouncement = {
        text: "IMPECCABLE",
        subtext: "50 COMBO PROTOCOL ENABLED",
        tier: "impeccable",
      };
      lastTriggeredComboRef.current = 50;
    } else if (combo >= 25 && combo < 50 && lastTriggeredComboRef.current < 25) {
      nextAnnouncement = {
        text: "LOCKED IN",
        subtext: "25 COMBO SYSTEM SYNCED",
        tier: "locked",
      };
      lastTriggeredComboRef.current = 25;
    } else if (combo >= 10 && combo < 25 && lastTriggeredComboRef.current < 10) {
      nextAnnouncement = {
        text: "CLEAN",
        subtext: "10 COMBO INITIATED",
        tier: "clean",
      };
      lastTriggeredComboRef.current = 10;
    }

    if (nextAnnouncement) {
      if (timerRef.current) clearTimeout(timerRef.current);
      
      setAnnouncement({
        ...nextAnnouncement,
        id: Date.now(),
      });

      timerRef.current = setTimeout(() => {
        setAnnouncement(null);
      }, 1500);
    }
  }, [combo]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!announcement) return null;

  const { text, subtext, tier, id } = announcement;

  // Tier-based styles
  let textClass = "";
  let glowColor = "";
  let animationClass = "";

  if (tier === "clean") {
    textClass = "text-cyan-400 font-black italic tracking-[0.25em] text-5xl md:text-7xl";
    glowColor = "rgba(6, 182, 212, 0.85)";
    animationClass = "animate-cleanStreak";
  } else if (tier === "locked") {
    textClass = "text-amber-400 font-black italic tracking-[0.3em] text-6xl md:text-8xl";
    glowColor = "rgba(245, 158, 11, 0.9)";
    animationClass = "animate-lockedStreak";
  } else if (tier === "impeccable") {
    textClass = "text-red-500 font-black italic tracking-[0.4em] text-7xl md:text-9xl";
    glowColor = "rgba(239, 68, 68, 0.95)";
    animationClass = "animate-impeccableStreak";
  }

  return (
    <div
      key={id}
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[60] select-none"
    >
      {/* Styles Injection */}
      <style>{`
        @keyframes cleanIn {
          0% { transform: translateY(-50px) scale(0.9); opacity: 0; filter: blur(10px); }
          15% { transform: translateY(0) scale(1.05); opacity: 1; filter: blur(0); }
          25% { transform: translateY(0) scale(1); }
          85% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
          100% { transform: translateY(20px) scale(0.95); opacity: 0; filter: blur(15px); }
        }
        @keyframes lockedIn {
          0% { transform: scale(0.5) skewX(-15deg); opacity: 0; filter: brightness(2); }
          12% { transform: scale(1.2) skewX(-15deg); opacity: 1; filter: brightness(1); }
          18% { transform: scale(0.95) skewX(-15deg); }
          22% { transform: scale(1) skewX(-15deg); }
          30%, 50%, 70% { transform: scale(1) skewX(-15deg) translate(1px, -1px); }
          40%, 60% { transform: scale(1) skewX(-15deg) translate(-1px, 1px); }
          80% { opacity: 1; transform: scale(1) skewX(-15deg); }
          100% { opacity: 0; transform: scale(1.4) skewX(-15deg); filter: blur(20px); }
        }
        @keyframes impeccableIn {
          0% { transform: scale(1.6) skewX(-20deg); opacity: 0; filter: contrast(2) brightness(3) blur(20px); }
          8% { transform: scale(0.9) skewX(-20deg); opacity: 1; filter: contrast(1) brightness(1) blur(0); }
          12% { transform: scale(1.1) skewX(-20deg); }
          16% { transform: scale(1) skewX(-20deg); }
          /* Glitch effect segments */
          20%, 40%, 60%, 80% { transform: scale(1) skewX(-20deg) translate(-2px, 1px); clip-path: inset(10% 0 30% 0); }
          22%, 42%, 62%, 82% { transform: scale(1.02) skewX(-18deg) translate(2px, -1px); clip-path: inset(40% 0 10% 0); }
          24%, 44%, 64%, 84% { transform: scale(1) skewX(-20deg); clip-path: none; }
          90% { opacity: 1; filter: blur(0); }
          100% { opacity: 0; transform: scale(0.8) skewX(-20deg) translateY(40px); filter: blur(30px); }
        }

        .animate-cleanStreak {
          animation: cleanIn 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        .animate-lockedStreak {
          animation: lockedIn 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-impeccableStreak {
          animation: impeccableIn 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
      `}</style>

      <div className={`flex flex-col items-center justify-center text-center ${animationClass}`}>
        <div
          className={`${textClass} font-black select-none drop-shadow-[0_0_35px_var(--glow-color)]`}
          style={{ "--glow-color": glowColor } as any}
        >
          {text}
        </div>
        <div className="text-[10px] md:text-xs font-black tracking-[0.4em] uppercase text-white/50 mt-2 bg-black/40 px-4 py-1.5 rounded border border-white/5 backdrop-blur-sm shadow-lg">
          {subtext}
        </div>
      </div>
    </div>
  );
}
