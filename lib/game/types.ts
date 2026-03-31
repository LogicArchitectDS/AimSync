export type GameResult = {
    mode: string;
    difficulty: string;
    score: number;
    hits: number;
    misses: number;
    accuracy: number;
    duration: number;
    totalTargetsSpawned?: number;
    averageReactionTime?: number;
    bestReactionTime?: number;
    worstReactionTime?: number;
    targetsPerSecond?: number;
    missedByTimeout?: number;
    extraStats?: Record<string, string | number>;
};

export type BaseTarget = {
    id: string;
    x: number;
    y: number;
    radius: number;
    spawnedAt: number;
    expiresAt?: number;
};

export type SwitchTarget = BaseTarget & {
    isCorrect?: boolean;
};

export type MovingTarget = BaseTarget & {
    vx: number;
    vy: number;
};

export type GenericTarget = BaseTarget | SwitchTarget | MovingTarget;