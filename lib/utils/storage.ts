// lib/utils/storage.ts
import { GameResult, UserStats, Routine } from "../game/types";
import type { CustomPlaylist } from '../game/types';

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

    // Inside StorageEngine...

    getPlaylists: (): CustomPlaylist[] => {
        if (typeof window === 'undefined') return [];
        const stats = StorageEngine.getUserStats();
        return stats.playlists || [];
    },

    savePlaylist: (playlist: CustomPlaylist) => {
        if (typeof window === 'undefined') return;
        const stats = StorageEngine.getUserStats();

        // Initialize array if it doesn't exist
        if (!stats.playlists) stats.playlists = [];

        stats.playlists.push(playlist);
        localStorage.setItem('aimsync_stats', JSON.stringify(stats));
    },

    deletePlaylist: (playlistId: string) => {
        if (typeof window === 'undefined') return;
        const stats = StorageEngine.getUserStats();
        if (!stats.playlists) return;

        stats.playlists = stats.playlists.filter(p => p.id !== playlistId);
        localStorage.setItem('aimsync_stats', JSON.stringify(stats));
    },

    // --- RAW RESULTS ---
    saveGameResult: (result: GameResult): void => {
        if (!isBrowser) return;

        const existing = StorageEngine.getAllResults();
        existing.push(result);
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(existing));

        // Mark task as completed if present in URL
        const params = new URLSearchParams(window.location.search);
        const taskId = params.get('taskId');
        if (taskId) {
            StorageEngine.markTaskCompleted(taskId);
        }

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
            completedTasks: [],
            xp: 0,
            level: 1,
        };

        if (!isBrowser) return defaultStats;
        const data = localStorage.getItem(STORAGE_KEYS.STATS);
        if (data) {
            const parsed = JSON.parse(data);
            if (typeof parsed.xp === 'undefined') parsed.xp = 0;
            if (typeof parsed.level === 'undefined') parsed.level = 1;
            return parsed;
        }
        return defaultStats;
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
                timePlayedSeconds: 0,
                highScore: 0,
                averageScore: 0,
                averageAccuracy: 0,
                bestReactionTime: 9999,
            };
        }

        const modeStats = stats.modes[newResult.modeId];
        modeStats.gamesPlayed += 1;
        modeStats.timePlayedSeconds = (modeStats.timePlayedSeconds || 0) + newResult.durationSeconds;
        modeStats.highScore = Math.max(modeStats.highScore, newResult.score);
        modeStats.averageScore = ((modeStats.averageScore * (modeStats.gamesPlayed - 1)) + newResult.score) / modeStats.gamesPlayed;
        modeStats.averageAccuracy = ((modeStats.averageAccuracy * (modeStats.gamesPlayed - 1)) + newResult.accuracy) / modeStats.gamesPlayed;

        if (newResult.bestReactionTime > 0) {
            modeStats.bestReactionTime = Math.min(modeStats.bestReactionTime, newResult.bestReactionTime);
        }

        // 3. Update XP and Level
        const baseXP = Math.floor(newResult.score / 50) + Math.floor(newResult.durationSeconds / 2);
        stats.xp = (stats.xp || 0) + baseXP;
        stats.level = Math.floor(Math.sqrt(stats.xp / 100)) + 1;

        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    },

    markTaskCompleted: (taskId: string) => {
        if (!isBrowser) return;
        const stats = StorageEngine.getUserStats();
        if (!stats.completedTasks) stats.completedTasks = [];
        if (!stats.completedTasks.includes(taskId)) {
            stats.completedTasks.push(taskId);

            // Grant Task XP
            const isWeekly = taskId.includes("weekly");
            const taskXp = isWeekly ? 500 : 200;
            stats.xp = (stats.xp || 0) + taskXp;
            stats.level = Math.floor(Math.sqrt(stats.xp / 100)) + 1;

            localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
        }
    },

    getTotalGamesPlayed: (): number => {
        return StorageEngine.getUserStats().totalGamesPlayed;
    },

    getTotalPlaytimeSeconds: (): number => {
        return StorageEngine.getUserStats().timePlayedSeconds;
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