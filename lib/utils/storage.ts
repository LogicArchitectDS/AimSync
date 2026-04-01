// lib/utils/storage.ts
import { GameResult, UserStats, Routine } from "../types/schema";

const STORAGE_KEYS = {
    RESULTS: "aimsync_raw_results",
    STATS: "aimsync_user_stats",
    ROUTINES: "aimsync_routines",
};

// Safe wrapper for Next.js SSR
const isBrowser = typeof window !== "undefined";

/**
 * Core LocalStorage wrapper. 
 * Swap the internals of these functions later to use Supabase/Postgres.
 */
export const StorageEngine = {

    // --- RAW RESULTS ---
    saveGameResult: (result: GameResult): void => {
        if (!isBrowser) return;

        const existing = StorageEngine.getAllResults();
        existing.push(result);
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(existing));

        // Immediately trigger profile aggregation
        StorageEngine.updateUserStats(result);
    },

    getAllResults: (): GameResult[] => {
        if (!isBrowser) return [];
        const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
        return data ? JSON.parse(data) : [];
    },

    getResultsByMode: (modeId: string): GameResult[] => {
        return StorageEngine.getAllResults().filter(r => r.modeId === modeId);
    },

    // --- AGGREGATED STATS ---
    getUserStats: (): UserStats => {
        const defaultStats: UserStats = {
            userId: "local-user",
            totalGamesPlayed: 0,
            globalAccuracy: 0,
            timePlayedSeconds: 0,
            lastPlayedAt: null,
            modes: {},
        };

        if (!isBrowser) return defaultStats;
        const data = localStorage.getItem(STORAGE_KEYS.STATS);
        return data ? JSON.parse(data) : defaultStats;
    },

    updateUserStats: (newResult: GameResult): void => {
        if (!isBrowser) return;
        const stats = StorageEngine.getUserStats();

        // 1. Update Global Stats
        stats.totalGamesPlayed += 1;
        stats.timePlayedSeconds += newResult.durationSeconds;
        stats.lastPlayedAt = newResult.createdAt;

        // Rolling average for global accuracy
        stats.globalAccuracy = ((stats.globalAccuracy * (stats.totalGamesPlayed - 1)) + newResult.accuracy) / stats.totalGamesPlayed;

        // 2. Update Mode-Specific Stats
        if (!stats.modes[newResult.modeId]) {
            stats.modes[newResult.modeId] = {
                gamesPlayed: 0,
                highScore: 0,
                averageScore: 0,
                averageAccuracy: 0,
                bestReactionTime: 9999,
            };
        }

        const modeStats = stats.modes[newResult.modeId];
        modeStats.gamesPlayed += 1;
        modeStats.highScore = Math.max(modeStats.highScore, newResult.score);
        modeStats.averageScore = ((modeStats.averageScore * (modeStats.gamesPlayed - 1)) + newResult.score) / modeStats.gamesPlayed;
        modeStats.averageAccuracy = ((modeStats.averageAccuracy * (modeStats.gamesPlayed - 1)) + newResult.accuracy) / modeStats.gamesPlayed;

        if (newResult.bestReactionTime > 0) {
            modeStats.bestReactionTime = Math.min(modeStats.bestReactionTime, newResult.bestReactionTime);
        }

        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    },

    // --- ROUTINES ---
    saveRoutine: (routine: Routine): void => {
        if (!isBrowser) return;
        const routines = StorageEngine.getAllRoutines();

        const existingIndex = routines.findIndex(r => r.id === routine.id);
        if (existingIndex >= 0) {
            routines[existingIndex] = routine; // Update
        } else {
            routines.push(routine); // Insert
        }

        localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    },

    getAllRoutines: (): Routine[] => {
        if (!isBrowser) return [];
        const data = localStorage.getItem(STORAGE_KEYS.ROUTINES);
        return data ? JSON.parse(data) : [];
    }
};