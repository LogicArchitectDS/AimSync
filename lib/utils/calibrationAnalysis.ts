import {
    CalibrationResult,
    CalibrationTrial,
    RankedCalibrationTrial,
} from "../game/calibration";

function round(value: number, decimals = 3): number {
    return Number(value.toFixed(decimals));
}

export function buildSensitivityCandidates(baseSensitivity: number): CalibrationTrial[] {
    const multipliers = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3];

    return multipliers.map((multiplier) => ({
        sensitivity: round(baseSensitivity * multiplier),
        accuracy: 75,
        comfort: 75,
        speed: 75,
        overflickRate: 25,
        underflickRate: 25,
    }));
}

export function calculateCompositeScore(trial: CalibrationTrial): number {
    const controlScore = trial.accuracy * 0.35;
    const comfortScore = trial.comfort * 0.25;
    const speedScore = trial.speed * 0.2;
    const overPenalty = trial.overflickRate * 0.1;
    const underPenalty = trial.underflickRate * 0.1;

    return controlScore + comfortScore + speedScore - overPenalty - underPenalty;
}

export function analyzeCalibrationTrials(trials: CalibrationTrial[]): CalibrationResult {
    const rankedTrials: RankedCalibrationTrial[] = [...trials]
        .map((trial) => ({
            ...trial,
            compositeScore: Number(calculateCompositeScore(trial).toFixed(2)),
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore);

    return {
        recommendedSensitivity: rankedTrials[0]?.sensitivity ?? 0,
        rankedTrials,
    };
}