/**
 * AimSync Progression Engine
 * Centralized logic for XP and Level calculations to ensure consistency between
 * the frontend UI and the Cloudflare D1/Edge backend.
 * 
 * Formula: Total XP = 500 * (level - 1)^2
 */

export interface LevelProgress {
    currentLevel: number;
    nextLevel: number;
    xpIntoLevel: number;
    xpNeededForNext: number;
    percentageComplete: number;
}

/**
 * Returns the total XP required to reach a specific level.
 * Level 1: 0 XP
 * Level 2: 500 XP
 * Level 3: 2000 XP
 */
export function getXpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    return 500 * Math.pow(level - 1, 2);
}

/**
 * Calculates the discrete level from a total XP value.
 * Uses the inverse of the quadratic formula: level = sqrt(xp / 500) + 1
 */
export function getLevelFromXp(totalXp: number): number {
    if (totalXp <= 0) return 1;
    return Math.floor(Math.sqrt(totalXp / 500)) + 1;
}

/**
 * Calculates detailed progress information for a given XP amount.
 * Useful for progress bars and HUDs.
 */
export function getXpProgressWithinLevel(totalXp: number): LevelProgress {
    const currentLevel = getLevelFromXp(totalXp);
    const nextLevel = currentLevel + 1;

    const currentLevelBaseXp = getXpRequiredForLevel(currentLevel);
    const nextLevelBaseXp = getXpRequiredForLevel(nextLevel);

    const xpIntoLevel = Math.max(0, totalXp - currentLevelBaseXp);
    const xpNeededForNext = nextLevelBaseXp - currentLevelBaseXp;
    
    const percentageComplete = Math.min(100, Math.max(0, (xpIntoLevel / xpNeededForNext) * 100));

    return {
        currentLevel,
        nextLevel,
        xpIntoLevel,
        xpNeededForNext,
        percentageComplete
    };
}
