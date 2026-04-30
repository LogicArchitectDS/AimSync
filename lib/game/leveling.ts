// lib/game/leveling.ts

// The multiplier that dictates the steepness of the grind. 
// 0.1 means Level 2 is 100 XP, Level 10 is 8,100 XP, Level 50 is 240,100 XP.
const XP_CONSTANT = 0.1;

/**
 * Converts a raw XP value into a discrete Level.
 */
export function getLevelFromXp(xp: number): number {
    if (xp < 0) return 1;
    return Math.floor(XP_CONSTANT * Math.sqrt(xp)) + 1;
}

/**
 * Calculates the exact total XP required to reach a specific Level from 0.
 */
export function getXpRequirementForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.pow((level - 1) / XP_CONSTANT, 2);
}

/**
 * The ultimate UI helper. Returns everything you need to draw a progress bar.
 */
export function getLevelProgress(currentXp: number) {
    const currentLevel = getLevelFromXp(currentXp);
    const nextLevel = currentLevel + 1;

    // How much XP is needed just to reach the current level
    const currentLevelBaseXp = getXpRequirementForLevel(currentLevel);
    // How much total XP is needed to reach the next level
    const nextLevelBaseXp = getXpRequirementForLevel(nextLevel);

    // The math for the progress bar (e.g., 500 / 1000 XP)
    const xpIntoCurrentLevel = currentXp - currentLevelBaseXp;
    const xpNeededForNextLevel = nextLevelBaseXp - currentLevelBaseXp;

    // Caps at 100% just in case of float math weirdness
    const percentageComplete = Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNextLevel) * 100));

    return {
        currentLevel,
        nextLevel,
        xpIntoCurrentLevel,         // Put this on the left of the slash: ( 500 / 1000 )
        xpNeededForNextLevel,       // Put this on the right of the slash: ( 500 / 1000 )
        percentageComplete          // Use this for a CSS width (e.g., width: `${percentageComplete}%`)
    };
}