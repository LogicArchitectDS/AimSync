import type { GameResult } from "../game/types";
import {
    calculateAccuracy,
    calculateAverageReactionTime,
    calculateBestReactionTime,
    calculateWorstReactionTime,
    calculateTargetsPerSecond,
} from "./gameMath";

type BuildGameResultParams = {
    mode: string;
    difficulty: string;
    score: number;
    hits: number;
    misses: number;
    duration: number;
    reactionTimes: number[];
    totalTargetsSpawned?: number;
    missedByTimeout?: number;
    extraStats?: Record<string, string | number>;
};

export const buildGameResult = ({
    mode,
    difficulty,
    score,
    hits,
    misses,
    duration,
    reactionTimes,
    totalTargetsSpawned,
    missedByTimeout,
    extraStats,
}: BuildGameResultParams): GameResult => {
    return {
        mode,
        difficulty,
        score,
        hits,
        misses,
        accuracy: calculateAccuracy(hits, misses),
        duration,
        totalTargetsSpawned,
        averageReactionTime: calculateAverageReactionTime(reactionTimes),
        bestReactionTime: calculateBestReactionTime(reactionTimes),
        worstReactionTime: calculateWorstReactionTime(reactionTimes),
        targetsPerSecond: calculateTargetsPerSecond(hits, duration),
        missedByTimeout,
        extraStats,
    };
};