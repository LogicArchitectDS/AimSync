export type DifficultyLevel = "eco" | "bonus" | "force buy" | "full buy";

export type ModeId =
    | "static-flick"
    | "reaction-test"
    | "sensitivity-finder"
    | "warmup-routine"
    | "consistency-check"
    | "flick-benchmark";

export interface RoutineStep {
    id: string;
    modeId: ModeId;
    label: string;
    durationSeconds: number;
    difficulty?: DifficultyLevel;
    notes?: string;
}

export interface TrainingRoutine {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    steps: RoutineStep[];
}

export interface RoutineSessionResult {
    stepId: string;
    modeId: ModeId;
    label: string;
    completedAt: string;
    score?: number;
    accuracy?: number;
    reactionMs?: number;
    consistencyScore?: number;
    notes?: string;
}