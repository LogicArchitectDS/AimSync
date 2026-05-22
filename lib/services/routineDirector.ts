// lib/services/routineDirector.ts

import { StorageEngine } from "@/lib/utils/storage";
import type { GameResult } from "@/lib/game/types";

export interface DailyContractDrill {
  modeId: string;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  durationSeconds: number;
}

export interface DailyContractState {
  status: "idle" | "running" | "completed";
  currentStepIndex: number;
  drills: DailyContractDrill[];
  completedResults: GameResult[];
  lastUpdated: string;
}

const STORAGE_KEY = "aimsync_daily_contract";

// Get current date string (YYYY-MM-DD)
function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export const RoutineDirector = {
  // Get current contract state from localStorage
  getContractState(): DailyContractState {
    if (typeof window === "undefined") {
      return {
        status: "idle",
        currentStepIndex: 0,
        drills: [],
        completedResults: [],
        lastUpdated: "",
      };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const state: DailyContractState = JSON.parse(raw);
        // Reset if it's a new day and status is completed or idle
        const stateDate = state.lastUpdated.substring(0, 10);
        const todayStr = getTodayString();
        if (stateDate !== todayStr && state.status === "completed") {
          return {
            status: "idle",
            currentStepIndex: 0,
            drills: [],
            completedResults: [],
            lastUpdated: new Date().toISOString(),
          };
        }
        return state;
      } catch (e) {
        console.error("Failed to parse daily contract state", e);
      }
    }

    return {
      status: "idle",
      currentStepIndex: 0,
      drills: [],
      completedResults: [],
      lastUpdated: new Date().toISOString(),
    };
  },

  // Save contract state to localStorage
  saveContractState(state: DailyContractState) {
    if (typeof window === "undefined") return;
    state.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  // Clear / Abort contract
  abortContract() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },

  getLocalAccuracyFallback(): number {
    const localStats = StorageEngine.getUserStats();
    let totalAcc = 0;
    let count = 0;
    Object.values(localStats.modes || {}).forEach((m: any) => {
      if (m.averageAccuracy > 0) {
        totalAcc += m.averageAccuracy;
        count++;
      }
    });

    if (count > 0) {
      return totalAcc / count;
    }

    return 85.0; // Default baseline if no data exists
  },

  // Compute accuracy trend from database history or localStorage fallback
  async getHistoricalAccuracyTrend(userId: string): Promise<number> {
    if (!userId || userId === 'undefined' || userId === 'local' || userId === 'null') {
      return this.getLocalAccuracyFallback();
    }
    try {
      const res = await fetch(`/api/scores?userId=${userId}&history=true`);
      if (res.ok) {
        const history = await res.json();
        if (Array.isArray(history) && history.length > 0) {
          const sum = history.reduce((acc: number, curr: any) => acc + (curr.accuracy || 0), 0);
          return sum / history.length;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch score history from D1, falling back to local storage", e);
    }

    return this.getLocalAccuracyFallback();
  },

  // Initialize a new contract
  async startContract(userId: string): Promise<DailyContractState> {
    const accuracyTrend = await this.getHistoricalAccuracyTrend(userId);

    // 1. Phase 1: Warmup (5 minutes)
    // Low-velocity tracking: 5 steps of 60 seconds
    const phase1: DailyContractDrill[] = [
      { modeId: "tracking-mode", difficulty: "easy", durationSeconds: 60 },
      { modeId: "tracking-mode", difficulty: "easy", durationSeconds: 60 },
      { modeId: "tracking-mode", difficulty: "medium", durationSeconds: 60 },
      { modeId: "tracking-mode", difficulty: "medium", durationSeconds: 60 },
      { modeId: "tracking-mode", difficulty: "medium", durationSeconds: 60 },
    ];

    // 2. Phase 2: Precision Assessment (5 minutes)
    // 5 steps of 60 seconds based on accuracy trend
    let phase2Mode: string = "static-flick";
    let phase2Diffs: ("easy" | "medium" | "hard" | "extreme")[] = ["easy", "medium", "medium", "hard", "hard"];

    if (accuracyTrend < 85.0) {
      // Prioritize strict precision
      phase2Mode = "micro-adjust";
      phase2Diffs = ["easy", "medium", "medium", "hard", "hard"];
    } else if (accuracyTrend >= 90.0) {
      // Aggrerssively surface velocity
      phase2Mode = "flick-benchmark";
      phase2Diffs = ["medium", "medium", "hard", "hard", "extreme"];
    } else {
      // Balanced flicking
      phase2Mode = "static-flick";
      phase2Diffs = ["easy", "medium", "medium", "hard", "hard"];
    }

    const phase2: DailyContractDrill[] = phase2Diffs.map((diff) => ({
      modeId: phase2Mode,
      difficulty: diff,
      durationSeconds: 60,
    }));

    // 3. Phase 3: Pressure (5 minutes)
    // Complex combinations: 5 steps of 60 seconds
    const phase3: DailyContractDrill[] = [
      { modeId: "cognitive-overdrive", difficulty: "medium", durationSeconds: 60 },
      { modeId: "recoil-evasion", difficulty: "medium", durationSeconds: 60 },
      { modeId: "cognitive-overdrive", difficulty: "hard", durationSeconds: 60 },
      { modeId: "recoil-evasion", difficulty: "hard", durationSeconds: 60 },
      { modeId: "cognitive-overdrive", difficulty: "extreme", durationSeconds: 60 },
    ];

    const newState: DailyContractState = {
      status: "running",
      currentStepIndex: 0,
      drills: [...phase1, ...phase2, ...phase3],
      completedResults: [],
      lastUpdated: new Date().toISOString(),
    };

    this.saveContractState(newState);
    return newState;
  },

  // Record drill completion and advance step
  completeDrill(result: GameResult): DailyContractState {
    const state = this.getContractState();
    if (state.status !== "running") return state;

    state.completedResults.push(result);
    state.currentStepIndex += 1;

    if (state.currentStepIndex >= state.drills.length) {
      state.status = "completed";
    }

    this.saveContractState(state);
    return state;
  },

  isContractActive(): boolean {
    const state = this.getContractState();
    return state.status === "running";
  },

  isContractCompletedToday(): boolean {
    const state = this.getContractState();
    if (state.status !== "completed") return false;
    const stateDate = state.lastUpdated.substring(0, 10);
    const todayStr = getTodayString();
    return stateDate === todayStr;
  },
};
