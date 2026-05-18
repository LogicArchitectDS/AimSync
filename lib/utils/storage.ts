import type { GameResult, UserStats, CustomPlaylist } from "../game/types";

const STORAGE_KEYS = {
    STATS: "aimsync_stats",
    SESSION: "aimsync_session",
};

export const StorageEngine = {

    // --- 1. CORE STATE RETRIEVAL ---
    getUserStats: (): UserStats => {
        if (typeof window === 'undefined') {
            return { totalGamesPlayed: 0, timePlayedSeconds: 0, globalAccuracy: 0, modes: {}, playlists: [] } as any;
        }

        const raw = localStorage.getItem(STORAGE_KEYS.STATS);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                console.error("Failed to parse local stats", e);
            }
        }

        // Default blank slate
        return {
            totalGamesPlayed: 0,
            timePlayedSeconds: 0,
            globalAccuracy: 0,
            modes: {},
            playlists: []
        } as any;
    },

    // --- 2. HYBRID SAVE (Local + Cloud) ---
    saveUserStats: (stats: UserStats) => {
        if (typeof window === 'undefined') return;

        // A. Instant Local Save (UI updates instantly without waiting for network)
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));

        // B. Background Cloud Sync (Fire and forget)
        const sessionRaw = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (sessionRaw) {
            try {
                const session = JSON.parse(sessionRaw);
                // Only sync if it's a real user (not a trial guest)
                if (session.user?.id && !session.isTrial) {
                    fetch('/api/scores', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: session.user.id, stats })
                    }).catch(err => console.error("Cloud sync failed:", err));
                }
            } catch (e) {
                console.error("Session parse error during sync", e);
            }
        }
    },

    // --- 3. GAME COMPLETION HANDLER ---
    saveGameResult: (result: GameResult) => {
        const stats = StorageEngine.getUserStats();

        // Update global counters
        stats.totalGamesPlayed = (stats.totalGamesPlayed || 0) + 1;
        stats.timePlayedSeconds = (stats.timePlayedSeconds || 0) + result.durationSeconds;

        // Initialize mode if it doesn't exist
        if (!stats.modes) stats.modes = {};
        if (!stats.modes[result.modeId]) {
            stats.modes[result.modeId] = {
                gamesPlayed: 0,
                timePlayedSeconds: 0,
                highScore: 0,
                averageScore: 0,
                averageAccuracy: 0,
                bestReactionTime: 9999
            };
        }

        const modeStats = stats.modes[result.modeId];

        // Update High Score
        if (result.score > modeStats.highScore) {
            modeStats.highScore = result.score;
        }

        // Update Reaction Time
        if (result.averageReactionTime && result.averageReactionTime < modeStats.bestReactionTime) {
            modeStats.bestReactionTime = result.averageReactionTime;
        }

        // Calculate Rolling Average Accuracy
        const totalPreviousAccuracy = modeStats.averageAccuracy * modeStats.gamesPlayed;
        modeStats.gamesPlayed += 1;
        modeStats.timePlayedSeconds += result.durationSeconds;
        
        // Rolling average score (assuming we want to calculate this since it's in ModeStats)
        const totalPreviousScore = modeStats.averageScore * (modeStats.gamesPlayed - 1);
        modeStats.averageScore = (totalPreviousScore + result.score) / modeStats.gamesPlayed;

        modeStats.averageAccuracy = (totalPreviousAccuracy + result.accuracy) / modeStats.gamesPlayed;

        // Recalculate Global Accuracy across all modes
        let globalAcc = 0;
        let totalTrackedPlays = 0;
        Object.values(stats.modes).forEach((m: any) => {
            globalAcc += m.averageAccuracy * m.gamesPlayed;
            totalTrackedPlays += m.gamesPlayed;
        });

        stats.globalAccuracy = totalTrackedPlays > 0 ? (globalAcc / totalTrackedPlays) : 0;
        stats.lastPlayedAt = new Date().toISOString();

        // Save (Triggers local + cloud sync simultaneously)
        StorageEngine.saveUserStats(stats);
    },

    // --- 4. PLAYLIST MANAGEMENT ---
    getPlaylists: (): CustomPlaylist[] => {
        const stats = StorageEngine.getUserStats();
        return stats.playlists || [];
    },

    savePlaylist: (playlist: CustomPlaylist) => {
        const stats = StorageEngine.getUserStats();
        if (!stats.playlists) stats.playlists = [];

        stats.playlists.push(playlist);
        StorageEngine.saveUserStats(stats);
    },

    deletePlaylist: (playlistId: string) => {
        const stats = StorageEngine.getUserStats();
        if (!stats.playlists) return;

        stats.playlists = stats.playlists.filter(p => p.id !== playlistId);
        StorageEngine.saveUserStats(stats);
    },

    // --- 5. EDGE HYDRATION (Called on Login) ---
    syncFromCloud: async (userId: string) => {
        try {
            const res = await fetch(`/api/scores?userId=${userId}`);
            if (res.ok) {
                const cloudData = await res.json();
                if (!cloudData.error) {
                    // Reconstruct into the frontend's nested JSON structure
                    const reconstructedStats: UserStats = {
                        totalGamesPlayed: cloudData.total_games,
                        timePlayedSeconds: cloudData.time_played,
                        globalAccuracy: cloudData.global_accuracy,
                        modes: JSON.parse(cloudData.modes_data || '{}'),
                        playlists: JSON.parse(cloudData.playlists || '[]'),
                        lastPlayedAt: cloudData.last_played_at ? new Date(cloudData.last_played_at).toISOString() : new Date().toISOString()
                    } as any;

                    // Hydrate local storage directly to override the blank slate
                    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(reconstructedStats));
                    return reconstructedStats;
                }
            }
        } catch (err) {
            console.error("Cloud fetch failed:", err);
        }
        return null;
    }
};