export interface HUDData {
    mode: string;
    difficulty: string;
    timeLeft: number;
    score: number;
    hits: number;
    misses: number;
    accuracy: number;
    averageReactionTime?: number;
    bestReactionTime?: number;
    combo?: number;
    burstRemaining?: number;
    extraLines?: Array<{ label: string; value: string | number }>;
}