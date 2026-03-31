import { useState, useRef, useCallback } from "react";
import { GameResult } from "@/lib/game/types";

// This is a placeholder interface until we see your friend's actual engine.ts
interface IGameEngine {
    start: () => void;
    stop: () => void;
    destroy: () => void;
    // We expect the engine to call this when the game finishes
    onGameOver: (callback: (result: GameResult) => void) => void;
    // We expect the engine to call this to update the React HUD safely
    onTick: (callback: (stats: { score: number; timeLeft: number }) => void) => void;
}

export function useGame(mode: string, difficulty: string) {
    // UI State for the HUD
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60); // Default to 60s
    const [isGameOver, setIsGameOver] = useState(false);
    const [result, setResult] = useState<GameResult | null>(null);

    // We store the engine instance in a ref so it persists without causing re-renders
    const engineRef = useRef<IGameEngine | null>(null);

    const initializeEngine = useCallback((canvas: HTMLCanvasElement) => {
        // TODO: This is where we will instantiate your friend's ACTUAL engine
        // Example: engineRef.current = new AimSyncEngine(canvas, mode, difficulty);

        console.log(`Engine initializing... Mode: ${mode}, Difficulty: ${difficulty}`);

        // Set up listeners to update React state based on engine events
        /*
        engineRef.current.onTick((stats) => {
          setScore(stats.score);
          setTimeLeft(stats.timeLeft);
        });
    
        engineRef.current.onGameOver((finalResult) => {
          setIsGameOver(true);
          setResult(finalResult);
          // Here we will eventually send the finalResult to the database
        });
        */
    }, [mode, difficulty]);

    const cleanupEngine = useCallback(() => {
        if (engineRef.current) {
            engineRef.current.destroy();
            engineRef.current = null;
        }
    }, []);

    return {
        score,
        timeLeft,
        isGameOver,
        result,
        initializeEngine,
        cleanupEngine,
    };
}