import type { MouseEvent as ReactMouseEvent } from "react";

export const calculateAccuracy = (hits: number, misses: number): number => {
    const total = hits + misses;
    if (total === 0) return 0;
    return Number(((hits / total) * 100).toFixed(1));
};

export const calculateAverageReactionTime = (reactionTimes: number[]): number | undefined => {
    if (reactionTimes.length === 0) return undefined;
    const average = reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length;
    return Number(average.toFixed(1));
};

export const calculateBestReactionTime = (reactionTimes: number[]): number | undefined => {
    if (reactionTimes.length === 0) return undefined;
    return Number(Math.min(...reactionTimes).toFixed(1));
};

export const calculateWorstReactionTime = (reactionTimes: number[]): number | undefined => {
    if (reactionTimes.length === 0) return undefined;
    return Number(Math.max(...reactionTimes).toFixed(1));
};

export const calculateTargetsPerSecond = (hits: number, durationSeconds: number): number | undefined => {
    if (durationSeconds <= 0) return undefined;
    return Number((hits / durationSeconds).toFixed(2));
};

export const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
};

export const isPointInsideTarget = (
    clickX: number,
    clickY: number,
    targetX: number,
    targetY: number,
    radius: number
): boolean => {
    return getDistance(clickX, clickY, targetX, targetY) <= radius;
};

export const getScaledCanvasCoordinates = (
    event: ReactMouseEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number
) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    };
};