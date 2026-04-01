// lib/utils/routineEngine.ts
import { Routine } from "../game/types";

export const DEFAULT_ROUTINES: Record<string, Routine> = {
    "daily-warmup": {
        id: "daily-warmup",
        name: "Daily Warmup",
        description: "A 3-minute high-intensity sequence to prime your mechanics.",
        authorId: "system",
        createdAt: new Date().toISOString(),
        drills: [
            { id: "1", modeId: "static-flick", difficulty: "medium", durationSeconds: 60 },
            { id: "2", modeId: "tracking-mode", difficulty: "medium", durationSeconds: 60 },
            { id: "3", modeId: "micro-adjust", difficulty: "hard", durationSeconds: 60 }
        ]
    }
};