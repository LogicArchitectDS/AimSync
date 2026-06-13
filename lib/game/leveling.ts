/**
 * Legacy Leveling Utility
 * Now redirects to the centralized progressionEngine.
 */
import { 
    getLevelFromXp as sharedGetLevelFromXp, 
    getXpRequiredForLevel, 
    getXpProgressWithinLevel 
} from "../utils/progressionEngine";

export function getLevelFromXp(xp: number): number {
    return sharedGetLevelFromXp(xp);
}

export function getXpRequirementForLevel(level: number): number {
    return getXpRequiredForLevel(level);
}

export function getLevelProgress(currentXp: number) {
    const progress = getXpProgressWithinLevel(currentXp);
    return {
        currentLevel: progress.currentLevel,
        nextLevel: progress.nextLevel,
        xpIntoCurrentLevel: progress.xpIntoLevel,
        xpNeededForNextLevel: progress.xpNeededForNext,
        percentageComplete: progress.percentageComplete
    };
}
