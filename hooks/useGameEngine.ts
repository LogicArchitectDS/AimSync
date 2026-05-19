/**
 * useGameEngine.ts
 * 
 * A robust, reusable hook that abstracts all the shared boilerplate
 * from every 2D canvas game mode:
 *   - Lifecycle mount/unmount guard (isMountedRef)
 *   - 3-2-1 Countdown management
 *   - Countdown-aware session timer (only ticks when game is live)
 *   - Automatic canvas resize observer
 *   - Session index (kill-switch for stale closures)
 *   - Fullscreen enter/exit helpers
 * 
 * Usage:
 *   const engine = useGameEngine({ duration: 30, onTimerEnd: endSession });
 *   // Then drive your mode logic off engine.phase, engine.timeLeft, etc.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type EnginePhase = "menu" | "countdown" | "live" | "finished";

interface UseGameEngineOptions {
    /** Duration of the session in seconds */
    defaultDuration?: number;
    /** Called when the timer naturally reaches zero */
    onTimerEnd: () => void;
    /** Reference to the canvas element for resize tracking */
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface CanvasDimensions {
    width: number;
    height: number;
}

interface UseGameEngineReturn {
    phase: EnginePhase;
    timeLeft: number;
    countdown: number | null;
    dimensions: CanvasDimensions;
    isMountedRef: React.MutableRefObject<boolean>;
    sessionIdxRef: React.MutableRefObject<number>;
    /** Start a new session (resets to menu->countdown->live) */
    beginSession: (duration?: number) => void;
    /** Forcefully end the session (e.g., time ran out, manual quit) */
    endSession: () => void;
    /** Reset back to the menu without showing results */
    resetToMenu: () => void;
    /** Current duration setting */
    duration: number;
    setDuration: (d: number) => void;
}

export function useGameEngine({
    defaultDuration = 30,
    onTimerEnd,
    canvasRef,
}: UseGameEngineOptions): UseGameEngineReturn {

    const [phase, setPhase] = useState<EnginePhase>("menu");
    const [timeLeft, setTimeLeft] = useState(defaultDuration);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [duration, setDuration] = useState(defaultDuration);
    const [dimensions, setDimensions] = useState<CanvasDimensions>({ width: 1600, height: 900 });

    const isMountedRef = useRef(true);
    const sessionIdxRef = useRef(0);
    const onTimerEndRef = useRef(onTimerEnd);

    // Keep callback ref up-to-date without causing effect re-runs
    useEffect(() => { onTimerEndRef.current = onTimerEnd; }, [onTimerEnd]);

    // Unmount cleanup
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Canvas resize observer
    useEffect(() => {
        if (phase !== "live" && phase !== "countdown") return;

        const updateSize = () => {
            const canvas = canvasRef.current;
            if (canvas?.parentElement) {
                const { clientWidth, clientHeight } = canvas.parentElement;
                setDimensions({ width: clientWidth, height: clientHeight });
            }
        };

        const observer = new ResizeObserver(updateSize);
        if (canvasRef.current?.parentElement) {
            observer.observe(canvasRef.current.parentElement);
        }
        updateSize(); // Initial sync

        return () => observer.disconnect();
    }, [phase, canvasRef]);

    // Countdown tick
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            setPhase("live");
            return;
        }
        const id = window.setTimeout(() => {
            if (isMountedRef.current) setCountdown(c => (c !== null ? c - 1 : null));
        }, 1000);
        return () => window.clearTimeout(id);
    }, [countdown]);

    // Session timer — only runs when phase === "live"
    useEffect(() => {
        if (phase !== "live") return;

        const id = window.setInterval(() => {
            if (!isMountedRef.current) return;
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(id);
                    onTimerEndRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => window.clearInterval(id);
    }, [phase]);

    const beginSession = useCallback((overrideDuration?: number) => {
        const d = overrideDuration ?? duration;
        sessionIdxRef.current += 1; // Invalidate all stale closures
        setTimeLeft(d);
        setPhase("countdown");
        setCountdown(3);
    }, [duration]);

    const endSession = useCallback(() => {
        sessionIdxRef.current += 1;
        setPhase("finished");
        setTimeLeft(0);
    }, []);

    const resetToMenu = useCallback(() => {
        sessionIdxRef.current += 1;
        setPhase("menu");
        setTimeLeft(duration);
        setCountdown(null);
    }, [duration]);

    return {
        phase,
        timeLeft,
        countdown,
        dimensions,
        isMountedRef,
        sessionIdxRef,
        beginSession,
        endSession,
        resetToMenu,
        duration,
        setDuration,
    };
}
