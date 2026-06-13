'use client';

import { useEffect, useRef, useState } from 'react';

// AK/Vandal spray pattern offset coordinates (dx, dy) relative to start center (in pixels)
// Climbing upward climb, then swaying right, then swaying left, then settling.
const SPRAY_PATTERN = [
    { x: 0, y: 0 },
    { x: 2, y: -15 },
    { x: 5, y: -35 },
    { x: 7, y: -60 },
    { x: 10, y: -90 },
    { x: 12, y: -120 },
    { x: 9, y: -150 },
    { x: 4, y: -180 },
    { x: -5, y: -210 },
    { x: -18, y: -230 },
    { x: -32, y: -245 },
    { x: -45, y: -250 }, // Apex, starts shifting right
    { x: -30, y: -250 },
    { x: -10, y: -251 },
    { x: 15, y: -252 },
    { x: 38, y: -253 }, // swing right
    { x: 55, y: -254 },
    { x: 62, y: -254 },
    { x: 50, y: -253 }, // swing left again
    { x: 30, y: -252 },
    { x: 0, y: -251 },
    { x: -25, y: -250 },
    { x: -45, y: -250 },
    { x: -55, y: -250 },
    { x: -60, y: -250 },
];

const FIRE_RATE_MS = 1000 / 9.75; // 9.75 Bullets per second (approx 102.5ms)

export default function RecoilTracer() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Gameplay states
    const [isFiring, setIsFiring] = useState(false);
    const [accuracy, setAccuracy] = useState<number>(100);
    const [averageAccuracy, setAverageAccuracy] = useState<number | null>(null);
    const [highScore, setHighScore] = useState<number>(0);

    // Animation & Tracking references
    const animationFrameId = useRef<number>(0);
    const sprayIndexRef = useRef<number>(0);
    const lastShotTimeRef = useRef<number>(0);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 400, y: 450 }); // mouse current canvas position
    const startPosRef = useRef<{ x: number; y: number }>({ x: 400, y: 450 }); // click origin position
    const currentTracerPosRef = useRef<{ x: number; y: number }>({ x: 400, y: 450 }); // current target dot position
    const accuracySumRef = useRef<number>(0);
    const accuracyTicksRef = useRef<number>(0);

    // Hoisted functions
    function playGunshotSound() {
        try {
            if (!audioCtxRef.current) {
                const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioCtxRef.current = new AudioContextClass();
                }
            }
            const ctx = audioCtxRef.current;
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sawtooth';
            // Gunshot burst pitch sweep
            osc.frequency.setValueAtTime(180, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.12);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch {
            // Web Audio fallback in case of context block
        }
    }

    function drawScene(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        active: boolean
    ) {
        // Clear canvas
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, width, height);

        const startX = startPosRef.current.x;
        const startY = startPosRef.current.y;

        // Draw crosshair grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
        ctx.moveTo(0, startY); ctx.lineTo(width, startY);
        ctx.stroke();

        // 1. Draw static recoil spray template path (crisp, low-opacity white line)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        for (let i = 1; i < SPRAY_PATTERN.length; i++) {
            ctx.lineTo(startX + SPRAY_PATTERN[i].x, startY + SPRAY_PATTERN[i].y);
        }
        ctx.stroke();

        // 2. Draw ideal counter-drag compensation path (dashed green guide)
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.08)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        for (let i = 1; i < SPRAY_PATTERN.length; i++) {
            ctx.lineTo(startX - SPRAY_PATTERN[i].x, startY - SPRAY_PATTERN[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        if (active) {
            // 3. Draw active target tracking dot (Red) moving along recoil path
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(currentTracerPosRef.current.x, currentTracerPosRef.current.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // 4. Draw ideal compensation target marker (Green)
            const dx = currentTracerPosRef.current.x - startX;
            const dy = currentTracerPosRef.current.y - startY;
            const idealX = startX - dx;
            const idealY = startY - dy;

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(idealX, idealY, 8, 0, Math.PI * 2);
            ctx.stroke();

            // 5. Draw user's cursor position (Blue reticle)
            ctx.fillStyle = '#3366ff';
            ctx.beginPath();
            ctx.arc(mousePosRef.current.x, mousePosRef.current.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Draw link line between user position and ideal compensation target
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mousePosRef.current.x, mousePosRef.current.y);
            ctx.lineTo(idealX, idealY);
            ctx.stroke();
        } else {
            // Draw baseline start anchor
            ctx.fillStyle = '#3366ff';
            ctx.beginPath();
            ctx.arc(startX, startY, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function updateLoop(timestamp: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx || !isFiring) return;

        // 1. Process bullet spray timing
        if (lastShotTimeRef.current === 0) {
            lastShotTimeRef.current = timestamp;
            playGunshotSound();
        }

        const elapsed = timestamp - lastShotTimeRef.current;
        if (elapsed >= FIRE_RATE_MS) {
            sprayIndexRef.current += 1;
            lastShotTimeRef.current = timestamp;

            if (sprayIndexRef.current < SPRAY_PATTERN.length) {
                playGunshotSound();
            } else {
                // Spray complete: end session
                handleStopFiring();
                return;
            }
        }

        // 2. Compute current tracer target dot position along the interpolation route
        const currentIdx = sprayIndexRef.current;
        const nextIdx = Math.min(currentIdx + 1, SPRAY_PATTERN.length - 1);
        const lerpFactor = elapsed / FIRE_RATE_MS;

        const currentOffset = SPRAY_PATTERN[currentIdx];
        const nextOffset = SPRAY_PATTERN[nextIdx];

        // Interpolated spray offset (dx, dy)
        const dx = currentOffset.x + (nextOffset.x - currentOffset.x) * lerpFactor;
        const dy = currentOffset.y + (nextOffset.y - currentOffset.y) * lerpFactor;

        const startX = startPosRef.current.x;
        const startY = startPosRef.current.y;

        // The tracer dot climbs on screen
        currentTracerPosRef.current = {
            x: startX + dx,
            y: startY + dy,
        };

        // 3. Mathematical Spray Compensation Error Check
        // Ideal user offset is the exact negative vector of the recoil (inverse drag)
        const idealUserPos = {
            x: startX - dx,
            y: startY - dy,
        };

        const currentMouseX = mousePosRef.current.x;
        const currentMouseY = mousePosRef.current.y;

        const distError = Math.sqrt(
            Math.pow(currentMouseX - idealUserPos.x, 2) +
            Math.pow(currentMouseY - idealUserPos.y, 2)
        );

        // Normalize error: 0px offset = 100%, 80px offset or more = 0%
        const currentAcc = Math.max(0, 100 - (distError / 0.8));
        setAccuracy(Math.round(currentAcc));

        // Accumulate statistics
        accuracySumRef.current += currentAcc;
        accuracyTicksRef.current += 1;

        // 4. Draw canvas frame
        drawScene(ctx, canvas.width, canvas.height, true);

        // Schedule next frame
        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    // Setup canvas dimension sizes and event handlers
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Static center start
        startPosRef.current = { x: canvas.width / 2, y: canvas.height - 100 };
        mousePosRef.current = { ...startPosRef.current };
        currentTracerPosRef.current = { ...startPosRef.current };

        // Pre-render static scene
        drawScene(ctx, canvas.width, canvas.height, false);

        // Load high score from storage if available
        const savedHigh = localStorage.getItem('aimsync_recoil_highscore');
        if (savedHigh) {
            setTimeout(() => {
                setHighScore(parseFloat(savedHigh));
            }, 0);
        }
    }, []);

    function handleStartFiring(e: React.MouseEvent<HTMLCanvasElement>) {
        if (e.button !== 0 || isFiring) return; // Left click only

        setIsFiring(true);
        setAccuracy(100);
        sprayIndexRef.current = 0;
        lastShotTimeRef.current = 0;
        accuracySumRef.current = 0;
        accuracyTicksRef.current = 0;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            mousePosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }

        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    function handleStopFiring() {
        if (!isFiring) return;
        handleStopExecution();
    }

    function handleStopExecution() {
        setIsFiring(false);
        cancelAnimationFrame(animationFrameId.current);

        // Compute average accuracy
        if (accuracyTicksRef.current > 0) {
            const finalAcc = Math.round(accuracySumRef.current / accuracyTicksRef.current);
            setAverageAccuracy(finalAcc);

            // Update high score
            if (finalAcc > highScore) {
                setHighScore(finalAcc);
                localStorage.setItem('aimsync_recoil_highscore', finalAcc.toString());
            }
        }

        // Clean values
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                drawScene(ctx, canvas.width, canvas.height, false);
            }
        }
    }

    function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            mousePosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    }

    // Clean memory on component unmount
    useEffect(() => {
        return () => {
            cancelAnimationFrame(animationFrameId.current);
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
        };
    }, []);

    return (
        <div className="flex flex-col items-center bg-[#08090c] p-6 rounded-3xl border border-white/5 shadow-2xl w-full max-w-4xl mx-auto">
            {/* Header Dashboard HUD */}
            <div className="w-full flex justify-between items-center mb-6 font-sans">
                <div>
                    <h2 className="text-[#3366ff] text-xs font-bold tracking-[0.4em] uppercase">AimSync Tech</h2>
                    <h1 className="text-2xl font-black tracking-wider text-white uppercase">2D Recoil Tracer</h1>
                </div>
                <div className="flex gap-8 text-right">
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High Score</p>
                        <p className="text-xl font-mono font-black text-[#22c55e]">{highScore}%</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Accuracy</p>
                        <p className="text-xl font-mono font-black text-white">{isFiring ? `${accuracy}%` : '--'}</p>
                    </div>
                    {averageAccuracy !== null && (
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Last Run</p>
                            <p className="text-xl font-mono font-black text-cyan-400">{averageAccuracy}%</p>
                        </div>
                    )}
                </div>
            </div>

            {/* The canvas workspace */}
            <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-inner cursor-none">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={500}
                    onMouseDown={handleStartFiring}
                    onMouseUp={handleStopFiring}
                    onMouseLeave={handleStopFiring}
                    onMouseMove={handleMouseMove}
                    className="block"
                />

                {/* Instruction overlay */}
                {!isFiring && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
                        <p className="text-white text-lg font-black tracking-widest uppercase mb-2">PRESS & HOLD LEFT-CLICK</p>
                        <p className="text-slate-400 text-xs max-w-md text-center leading-relaxed mb-4">
                            A red tracking dot will climb the path. Drag your mouse inverse (downwards and opposite) to keep your blue cursor inside the green target circle.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
