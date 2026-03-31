export interface CalibrationTrial {
    sensitivity: number;
    accuracy: number;
    comfort: number;
    speed: number;
    overflickRate: number;
    underflickRate: number;
}

export interface RankedCalibrationTrial extends CalibrationTrial {
    compositeScore: number;
}

export interface CalibrationResult {
    recommendedSensitivity: number;
    rankedTrials: RankedCalibrationTrial[];
}