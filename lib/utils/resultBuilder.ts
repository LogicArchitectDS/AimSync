// lib/utils/resultBuilder.ts

import type { GameResult, Difficulty } from "../types/schema";

export function buildGameResult(rawData: any): GameResult {
    // 1. Adapter: Convert old "Burst Reaction" to strict "burst-reaction" modeId
    const rawMode = rawData.mode || "unknown";
    const modeId = rawMode.toLowerCase().replace(/\s+/g, "-");

    // 2. Safety: Ensure math doesn't result in NaN or Infinity
    const totalShots = (rawData.hits || 0) + (rawData.misses || 0);
    const accuracy = totalShots > 0 ? ((rawData.hits || 0) / totalShots) * 100 : 0;

    const reactionTimes = rawData.reactionTimes || [];
    const averageReactionTime = reactionTimes.length > 0
        ? reactionTimes.reduce((a: number, b: number) => a + b, 0) / reactionTimes.length
        : 0;

    const bestReactionTime = reactionTimes.length > 0
        ? Math.min(...reactionTimes)
        : 9999;

    // 3. Adapter: Map friendly difficulty labels back to our strict internal schema
    let diffId: Difficulty = "bonus"; // default fallback
    const rawDiff = (rawData.difficulty || "").toLowerCase();
    if (rawDiff.includes("eco")) diffId = "eco";
    if (rawDiff.includes("bonus")) diffId = "bonus";
    if (rawDiff.includes("force")) diffId = "force-buy";
    if (rawDiff.includes("full")) diffId = "full-buy";

    // 4. Construct the perfect GameResult object
    return {
        id: crypto.randomUUID(), // Generates a unique ID for the database
        modeId: modeId,
        difficulty: diffId,
        score: rawData.score || 0,
        hits: rawData.hits || 0,
        misses: rawData.misses || 0,
        accuracy: accuracy,
        reactionTimes: reactionTimes,
        averageReactionTime: averageReactionTime,
        bestReactionTime: bestReactionTime,
        durationSeconds: rawData.duration || 30,
        createdAt: new Date().toISOString(), // Standardized timestamp for charts
        extraStats: rawData.extraStats || {}
    };
}