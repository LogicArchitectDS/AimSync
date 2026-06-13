// lib/utils/statsService.ts
// Edge-aligned XP leveling helpers — runs in both Edge Runtime and Node.
// Mirrors the formula in lib/game/leveling.ts and lib/utils/storage.ts exactly.

export type XpFactorPayload = {
    xpGainedFlicking:   number;
    xpGainedTracking:   number;
    xpGainedSpeed:      number;
    xpGainedPrecision:  number;
    xpGainedPerception: number;
    xpGainedCognition:  number;
};

/** Total XP awarded for a session (score * 10). */
export function computeSessionXp(score: number): number {
    return score * 10;
}

/**
 * Splits the raw session XP into the 6 aim-factor buckets.
 * Distribution: 70% primary, 30% secondary, based on game mode.
 */
export function distributeXp(mode: string, totalXp: number): XpFactorPayload {
    const primaryXp   = Math.floor(totalXp * 0.70);
    const secondaryXp = Math.floor(totalXp * 0.30);

    const dist: XpFactorPayload = {
        xpGainedFlicking:   0,
        xpGainedTracking:   0,
        xpGainedSpeed:      0,
        xpGainedPrecision:  0,
        xpGainedPerception: 0,
        xpGainedCognition:  0,
    };

    switch (mode) {
        case 'static-flick':
            dist.xpGainedPrecision  = primaryXp;
            dist.xpGainedFlicking   = secondaryXp;
            break;
        case 'tracking-mode':
        case 'continuous-track':
            dist.xpGainedTracking   = primaryXp;
            dist.xpGainedPerception = secondaryXp;
            break;
        case 'reaction-test':
            dist.xpGainedSpeed      = primaryXp;
            dist.xpGainedPerception = secondaryXp;
            break;
        case 'target-switch':
            dist.xpGainedCognition  = primaryXp;
            dist.xpGainedFlicking   = secondaryXp;
            break;
        case 'micro-adjust':
        case 'micro-precision':
            dist.xpGainedPrecision  = primaryXp;
            dist.xpGainedFlicking   = secondaryXp;
            break;
        case 'flick-benchmark':
            dist.xpGainedFlicking   = primaryXp;
            dist.xpGainedPrecision  = secondaryXp;
            break;
        case 'burst-reaction':
            dist.xpGainedSpeed      = primaryXp;
            dist.xpGainedCognition  = secondaryXp;
            break;
        case 'cognitive-overdrive':
            dist.xpGainedCognition  = primaryXp;
            dist.xpGainedPerception = secondaryXp;
            break;
        case 'echolocation':
            dist.xpGainedPerception = primaryXp;
            dist.xpGainedCognition  = secondaryXp;
            break;
        case 'recoil-evasion':
            dist.xpGainedTracking   = primaryXp;
            dist.xpGainedSpeed      = secondaryXp;
            break;
        case 'consistency-check':
            dist.xpGainedTracking   = primaryXp;
            dist.xpGainedPrecision  = secondaryXp;
            break;
        default:
            // Fallback: all XP goes to precision
            dist.xpGainedPrecision = totalXp;
    }

    return dist;
}

import { getXpRequiredForLevel, getLevelFromXp as sharedGetLevelFromXp, getXpProgressWithinLevel } from './progressionEngine';

/** XP threshold to reach a given level: 500 * (level - 1)^2. */
export function getXpForLevel(level: number): number {
    return getXpRequiredForLevel(level);
}

/** Discrete level from raw cumulative XP: floor(sqrt(xp / 500)) + 1. */
export function getLevelFromXp(xp: number): number {
    return sharedGetLevelFromXp(xp);
}

/** Progress info for a progress bar. */
export function getLevelProgress(currentXp: number) {
    const progress = getXpProgressWithinLevel(currentXp);
    return {
        currentLevel: progress.currentLevel,
        nextLevel: progress.nextLevel,
        xpIntoLevel: progress.xpIntoLevel,
        xpNeededForNext: progress.xpNeededForNext,
        percentageComplete: progress.percentageComplete
    };
}
