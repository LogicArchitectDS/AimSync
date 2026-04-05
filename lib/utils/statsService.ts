import { db } from '../firebase';
import { getCurrentUserId } from '../auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import type { GameResult } from "../game/types";

// --- Inferred Types ---
export type LifetimeStats = {
    totalSessionsPlayed: number;
    totalHits: number;
    totalMisses: number;
    totalScore: number;
    totalPlaytime: number;
};

export type ModeStats = {
    mode: string;
    sessionsPlayed: number;
    bestScore: number;
    bestAccuracy: number;
    bestAverageReactionTime?: number;
    bestTargetsPerSecond?: number;
    totalHits: number;
    totalMisses: number;
    totalScore: number;
    totalPlaytime: number;
};

export type StoredStats = {
    modes: Record<string, ModeStats>;
    lifetime: LifetimeStats;
    recentSessions: GameResult[];
};
// -----------------------

const STATS_STORAGE_KEY = "aim_forge_stats";
const COLLECTION_NAME = "user_stats";
const MAX_RECENT_SESSIONS = 10;

const createEmptyLifetimeStats = (): LifetimeStats => ({
    totalSessionsPlayed: 0,
    totalHits: 0,
    totalMisses: 0,
    totalScore: 0,
    totalPlaytime: 0,
});

const createEmptyStoredStats = (): StoredStats => ({
    modes: {},
    lifetime: createEmptyLifetimeStats(),
    recentSessions: [],
});

// --- CORE ASYNC SERVICES ---

export const getStoredStats = async (): Promise<StoredStats> => {
    const userId = getCurrentUserId();

    // 1. GUEST FLOW: Fallback to LocalStorage
    if (!userId) {
        if (typeof window === "undefined") return createEmptyStoredStats();
        try {
            const raw = localStorage.getItem(STATS_STORAGE_KEY);
            if (!raw) return createEmptyStoredStats();
            const parsed = JSON.parse(raw) as StoredStats;
            return {
                modes: parsed.modes ?? {},
                lifetime: parsed.lifetime ?? createEmptyLifetimeStats(),
                recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : [],
            };
        } catch (error) {
            console.error("Failed to read stats from localStorage:", error);
            return createEmptyStoredStats();
        }
    }

    // 2. AUTHENTICATED FLOW: Fetch from Firestore
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as StoredStats;
            return {
                modes: data.modes ?? {},
                lifetime: data.lifetime ?? createEmptyLifetimeStats(),
                recentSessions: Array.isArray(data.recentSessions) ? data.recentSessions : [],
            };
        }
        return createEmptyStoredStats();
    } catch (error) {
        console.error("Failed to fetch stats from Firestore:", error);
        return createEmptyStoredStats();
    }
};

export const saveStoredStats = async (stats: StoredStats): Promise<void> => {
    const userId = getCurrentUserId();

    // 1. GUEST FLOW
    if (!userId) {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
        } catch (error) {
            console.error("Failed to save stats to localStorage:", error);
        }
        return;
    }

    // 2. AUTHENTICATED FLOW
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        await setDoc(docRef, stats, { merge: true });
    } catch (error) {
        console.error("Failed to save stats to Firestore:", error);
    }
};

export const clearStoredStats = async (): Promise<void> => {
    const userId = getCurrentUserId();

    if (!userId) {
        if (typeof window === "undefined") return;
        try {
            localStorage.removeItem(STATS_STORAGE_KEY);
        } catch (error) {
            console.error("Failed to clear stats from localStorage:", error);
        }
        return;
    }

    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Failed to clear stats from Firestore:", error);
    }
};

// --- LOGIC HELPER ---
const getUpdatedModeStats = (existing: ModeStats | undefined, result: GameResult): ModeStats => {
    const previous: ModeStats = existing ?? {
        mode: result.modeId,
        sessionsPlayed: 0,
        bestScore: 0,
        bestAccuracy: 0,
        bestAverageReactionTime: undefined,
        bestTargetsPerSecond: undefined,
        totalHits: 0,
        totalMisses: 0,
        totalScore: 0,
        totalPlaytime: 0,
    };

    const updatedAverageReactionTime =
        result.averageReactionTime === undefined
            ? previous.bestAverageReactionTime
            : previous.bestAverageReactionTime === undefined
                ? result.averageReactionTime
                : Math.min(previous.bestAverageReactionTime, result.averageReactionTime);

    const currentTargetsPerSecond = result.durationSeconds > 0 ? Number((result.hits / result.durationSeconds).toFixed(2)) : undefined;

    const updatedTargetsPerSecond =
        currentTargetsPerSecond === undefined
            ? previous.bestTargetsPerSecond
            : previous.bestTargetsPerSecond === undefined
                ? currentTargetsPerSecond
                : Math.max(previous.bestTargetsPerSecond, currentTargetsPerSecond);

    return {
        mode: result.modeId,
        sessionsPlayed: previous.sessionsPlayed + 1,
        bestScore: Math.max(previous.bestScore, result.score),
        bestAccuracy: Math.max(previous.bestAccuracy, result.accuracy),
        bestAverageReactionTime: updatedAverageReactionTime,
        bestTargetsPerSecond: updatedTargetsPerSecond,
        totalHits: previous.totalHits + result.hits,
        totalMisses: previous.totalMisses + result.misses,
        totalScore: previous.totalScore + result.score,
        totalPlaytime: previous.totalPlaytime + result.durationSeconds,
    };
};

export const updateStatsWithResult = async (result: GameResult): Promise<StoredStats> => {
    // Wait for the async fetch
    const current = await getStoredStats();

    const updatedModeStats = getUpdatedModeStats(current.modes[result.modeId], result);

    const updated: StoredStats = {
        modes: {
            ...current.modes,
            [result.modeId]: updatedModeStats,
        },
        lifetime: {
            totalSessionsPlayed: current.lifetime.totalSessionsPlayed + 1,
            totalHits: current.lifetime.totalHits + result.hits,
            totalMisses: current.lifetime.totalMisses + result.misses,
            totalScore: current.lifetime.totalScore + result.score,
            totalPlaytime: current.lifetime.totalPlaytime + result.durationSeconds,
        },
        recentSessions: [result, ...current.recentSessions].slice(0, MAX_RECENT_SESSIONS),
    };

    // Wait for the async save
    await saveStoredStats(updated);
    return updated;
};