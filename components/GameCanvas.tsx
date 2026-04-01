"use client"; // CRITICAL: This boundary protects Next.js from DOM/Window errors

import { useEffect, useRef } from "react";
import { useGame } from "@/hooks/useGame";

interface GameCanvasProps {
    mode: string;
    difficulty: string;
}

export default function GameCanvas({ mode, difficulty }: GameCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Bring in our controller hook
    const {
        score,
        timeLeft,
        isGameOver,
        initializeEngine,
        cleanupEngine
    } = useGame(mode, difficulty);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 1. Resize canvas to fill its container precisely
        const handleResize = () => {
            canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
            canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
        };

        window.addEventListener("resize", handleResize);
        handleResize(); // Initial sizing

        // 2. Boot the engine
        initializeEngine(canvas);

        // 3. Cleanup on unmount (prevents memory leaks when navigating away)
        return () => {
            window.removeEventListener("resize", handleResize);
            cleanupEngine();
        };
    }, [initializeEngine, cleanupEngine]);

    return (
        <div className="relative w-full h-full flex-1 bg-background overflow-hidden cursor-crosshair">

            {/* The React HUD Overlay */}
            <div className="absolute top-4 left-0 w-full flex justify-between px-8 z-10 pointer-events-none select-none">
                <div className="flex flex-col">
                    <span className="text-text-muted text-sm font-bold uppercase tracking-widest">Score</span>
                    <span className="text-text-primary text-4xl font-black">{score}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-text-muted text-sm font-bold uppercase tracking-widest">Time</span>
                    <span className="text-cyan text-4xl font-black">{timeLeft}s</span>
                </div>
            </div>

            {/* The Actual Canvas Output */}
            <canvas
                ref={canvasRef}
                className="block w-full h-full"
            />

            {/* Game Over Screen Overlay */}
            {isGameOver && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center space-y-4">
                        <h2 className="text-5xl font-black text-orange">SESSION COMPLETE</h2>
                        <button className="bg-cyan text-background px-8 py-3 rounded-md font-bold hover:brightness-110 transition-all pointer-events-auto">
                            Return to Menu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}