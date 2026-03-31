// We define Difficulty here directly to avoid needing a separate types file for one line.
export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export type DifficultySettings = {
    targetRadius: number;
    targetLifetimeMs: number;
    scorePerHit: number;
    missPenalty: number;
};

export const difficultyLabels: Record<Difficulty, string> = {
    easy: "eco",
    medium: "bonus",
    hard: "force buy",
    extreme: "full buy",
};

export const difficultyConfig: Record<Difficulty, DifficultySettings> = {
    easy: {
        targetRadius: 40,
        targetLifetimeMs: 1400,
        scorePerHit: 100,
        missPenalty: 30,
    },
    medium: {
        targetRadius: 32,
        targetLifetimeMs: 1100,
        scorePerHit: 115,
        missPenalty: 35,
    },
    hard: {
        targetRadius: 25,
        targetLifetimeMs: 850,
        scorePerHit: 130,
        missPenalty: 40,
    },
    extreme: {
        targetRadius: 20,
        targetLifetimeMs: 650,
        scorePerHit: 150,
        missPenalty: 45,
    },
};