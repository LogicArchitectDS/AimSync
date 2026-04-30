import { create } from 'zustand';

interface GameState {
    status: 'idle' | 'playing' | 'finished';
    score: number;
    shotsFired: number;
    timeRemaining: number;
    totalDuration: number;
    combo: number;
    maxCombo: number;
    sessionXp: number;

    highScore: number; // <-- NEW: Add to the interface

    startGame: (durationInSeconds: number) => void;
    recordShot: () => void;
    recordHit: (baseXp?: number) => void;
    recordMiss: () => void;
    tickTimer: () => void;
    endGame: () => void;
    reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    status: 'idle',
    score: 0,
    shotsFired: 0,
    timeRemaining: 30,
    totalDuration: 30,
    combo: 0,
    maxCombo: 0,
    sessionXp: 0,

    highScore: 0, // <-- NEW: Initialize it

    startGame: (duration) => set({
        status: 'playing', score: 0, shotsFired: 0,
        timeRemaining: duration, totalDuration: duration,
        combo: 0, maxCombo: 0, sessionXp: 0
    }),

    recordShot: () => set((state) => ({ shotsFired: state.shotsFired + 1 })),

    recordHit: (baseXp = 10) => set((state) => {
        const newCombo = state.combo + 1;
        const xpEarned = baseXp * newCombo;

        return {
            score: state.score + 1,
            combo: newCombo,
            maxCombo: Math.max(state.maxCombo, newCombo),
            sessionXp: state.sessionXp + xpEarned
        };
    }),

    recordMiss: () => set({ combo: 0 }),

    tickTimer: () => set((state) => {
        if (state.timeRemaining <= 1) {
            // NEW: Update the high score automatically when the clock hits zero
            return {
                timeRemaining: 0,
                status: 'finished',
                highScore: Math.max(state.highScore, state.score)
            };
        }
        return { timeRemaining: state.timeRemaining - 1 };
    }),

    // NEW: Also update high score if they manually abort the game early
    endGame: () => set((state) => ({
        status: 'finished',
        highScore: Math.max(state.highScore, state.score)
    })),

    // Make sure we DO NOT reset the high score here, so it persists across rounds
    reset: () => set({
        status: 'idle', score: 0, shotsFired: 0, combo: 0, maxCombo: 0, sessionXp: 0
    })
}));