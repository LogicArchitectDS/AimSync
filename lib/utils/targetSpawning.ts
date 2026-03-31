import type { Difficulty } from "./drillConfig";
import type { BaseTarget, MovingTarget, SwitchTarget } from "../game/types";

type Position = {
    x: number;
    y: number;
};

const createTargetId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `target-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

// 1. The Updated Full-Canvas Spawner (Ghost Zone Fix)
export const getRandomTargetPosition = (canvasWidth: number, canvasHeight: number, radius: number): Position => {
    const padding = radius + 12;
    const x = Math.random() * (canvasWidth - padding * 2) + padding;
    const y = Math.random() * (canvasHeight - padding * 2) + padding;
    return { x, y };
};

// 2. The Missing Export that caused the crash
export const createStaticTarget = (canvasWidth: number, canvasHeight: number, radius: number): BaseTarget => {
    const { x, y } = getRandomTargetPosition(canvasWidth, canvasHeight, radius);
    return {
        id: createTargetId(),
        x,
        y,
        radius,
        spawnedAt: performance.now(),
    };
};

export const createMicroAdjustTarget = (canvasWidth: number, canvasHeight: number, radius: number, maxOffset = 120): BaseTarget => {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const offsetX = (Math.random() - 0.5) * maxOffset * 2;
    const offsetY = (Math.random() - 0.5) * maxOffset * 2;
    return {
        id: createTargetId(),
        x: centerX + offsetX,
        y: centerY + offsetY,
        radius,
        spawnedAt: performance.now(),
    };
};

export const getTargetSwitchCount = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 2;
        case "medium": return 3;
        case "hard": return 4;
        case "extreme": return 5;
        default: return 3;
    }
};

export const createTargetSwitchWave = (difficulty: Difficulty, canvasWidth: number, canvasHeight: number, radius: number): SwitchTarget[] => {
    const count = getTargetSwitchCount(difficulty);
    const targets: SwitchTarget[] = Array.from({ length: count }, () => {
        const { x, y } = getRandomTargetPosition(canvasWidth, canvasHeight, radius);
        return {
            id: createTargetId(),
            x,
            y,
            radius,
            spawnedAt: performance.now(),
            isCorrect: false,
        };
    });
    const correctIndex = Math.floor(Math.random() * targets.length);
    targets[correctIndex].isCorrect = true;
    return targets;
};

export const getTrackingSpeed = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 2.2;
        case "medium": return 3.2;
        case "hard": return 4.3;
        case "extreme": return 5.4;
        default: return 3;
    }
};

export const createTrackingTarget = (difficulty: Difficulty, canvasWidth: number, canvasHeight: number, radius: number): MovingTarget => {
    const { x, y } = getRandomTargetPosition(canvasWidth, canvasHeight, radius);
    const speed = getTrackingSpeed(difficulty);
    const angle = Math.random() * Math.PI * 2;
    return {
        id: createTargetId(),
        x,
        y,
        radius,
        spawnedAt: performance.now(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
    };
};

export const updateTrackingTargetPosition = (target: MovingTarget, canvasWidth: number, canvasHeight: number): MovingTarget => {
    let nextX = target.x + target.vx;
    let nextY = target.y + target.vy;
    let nextVx = target.vx;
    let nextVy = target.vy;

    if (nextX - target.radius <= 0 || nextX + target.radius >= canvasWidth) {
        nextVx *= -1;
        nextX = target.x + nextVx;
    }
    if (nextY - target.radius <= 0 || nextY + target.radius >= canvasHeight) {
        nextVy *= -1;
        nextY = target.y + nextVy;
    }
    return { ...target, x: nextX, y: nextY, vx: nextVx, vy: nextVy };
};

export const getBurstSize = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 3;
        case "medium": return 4;
        case "hard": return 5;
        case "extreme": return 6;
        default: return 4;
    }
};

export const createBurstTarget = (canvasWidth: number, canvasHeight: number, radius: number): BaseTarget => {
    return createStaticTarget(canvasWidth, canvasHeight, radius);
};

export const getReactionSpawnDelay = (difficulty: Difficulty): number => {
    switch (difficulty) {
        case "easy": return 1100 + Math.random() * 1000;
        case "medium": return 850 + Math.random() * 900;
        case "hard": return 650 + Math.random() * 750;
        case "extreme": return 450 + Math.random() * 650;
        default: return 1000;
    }
};

export const getReactionScoreBonus = (reaction: number): number => {
    if (reaction <= 220) return 45;
    if (reaction <= 300) return 35;
    if (reaction <= 400) return 28;
    return 20;
};