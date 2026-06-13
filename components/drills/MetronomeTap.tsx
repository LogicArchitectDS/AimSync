'use client';

import { useEffect, useRef, useState } from 'react';

interface FeedbackParticle {
    x: number;
    y: number;
    text: string;
    color: string;
    alpha: number;
    scale: number;
}

const BPM = 100;
const BEAT_INTERVAL_SEC = 60 / BPM; // 0.6 seconds (600ms)
const TOLERANCE_MS = 75; // Hit window is ±75ms
const GAME_DURATION_SEC = 30; // 30 seconds drill

// Target configuration (centered)
const targetCenter = { x: 400, y: 250 };
const targetRadius = 35;

export default function MetronomeTap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Gameplay states
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
    const [score, setScore] = useState(0);
    const [totalClicks, setTotalClicks] = useState(0);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [highScore, setHighScore] = useState<number>(0);
    const [averageTimingError, setAverageTimingError] = useState<number | null>(null);

    // Stats details
    const [hitsCount, setHitsCount] = useState(0);
    const [earlyCount, setEarlyCount] = useState(0);
    const [lateCount, setLateCount] = useState(0);
    const [offTargetCount, setOffTargetCount] = useState(0);

    // Animation & Timing refs
    const animationFrameId = useRef<number>(0);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 400, y: 250 });
    const nextBeatTimeRef = useRef<number>(0);
    const startAudioTimeRef = useRef<number>(0);
    const scheduledBeatsRef = useRef<number[]>([]);
    const feedbackParticlesRef = useRef<FeedbackParticle[]>([]);
    const timingErrorsRef = useRef<number[]>([]);
    const gameTimerIdRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Hoisted Helper Functions
    function playMetronomeTick(ctx: AudioContext, time: number) {
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, time);
            osc.frequency.exponentialRampToValueAtTime(120, time + 0.04);

            gain.gain.setValueAtTime(0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

            osc.start(time);
            osc.stop(time + 0.04);
        } catch {
            // Audio context failure safeguard
        }
    }

    function playFeedbackSound(type: 'HIT' | 'MISS' | 'OFF') {
        try {
            if (!audioCtxRef.current) return;
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'HIT') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(950, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.08);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.start();
                osc.stop(ctx.currentTime + 0.08);
            } else if (type === 'MISS') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(90, ctx.currentTime);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            }
        } catch {
            // Audio fallback
        }
    }

    function drawScene(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        progress: number
    ) {
        // Clear background
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, width, height);

        // Draw crosshair grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
        ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
        ctx.stroke();

        // 1. Shrinking timing ring (if game is active)
        if (isActive) {
            const ringRadius = targetRadius + (1 - progress) * 80;
            const alpha = 0.1 + progress * 0.35;
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(targetCenter.x, targetCenter.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = `rgba(34, 211, 238, ${0.1 * (1 - progress)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(targetCenter.x, targetCenter.y, ringRadius + 15, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 2. Draw static center target
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.arc(targetCenter.x, targetCenter.y, targetRadius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const coreGradient = ctx.createRadialGradient(
            targetCenter.x,
            targetCenter.y,
            2,
            targetCenter.x,
            targetCenter.y,
            targetRadius
        );
        if (isActive) {
            coreGradient.addColorStop(0, '#06b6d4');
            coreGradient.addColorStop(0.5, '#0891b2');
            coreGradient.addColorStop(1, '#0e7490');
        } else {
            coreGradient.addColorStop(0, '#475569');
            coreGradient.addColorStop(0.5, '#334155');
            coreGradient.addColorStop(1, '#1e293b');
        }
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(targetCenter.x, targetCenter.y, targetRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(targetCenter.x, targetCenter.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 3. Draw user cursor
        const mX = mousePosRef.current.x;
        const mY = mousePosRef.current.y;
        ctx.strokeStyle = isActive ? '#22c55e' : '#a8a29e';
        ctx.lineWidth = 1.5;
        const size = 6;
        const gap = 3;

        ctx.beginPath();
        ctx.moveTo(mX - size - gap, mY); ctx.lineTo(mX - gap, mY);
        ctx.moveTo(mX + gap, mY); ctx.lineTo(mX + size + gap, mY);
        ctx.moveTo(mX, mY - size - gap); ctx.lineTo(mX, mY - gap);
        ctx.moveTo(mX, mY + gap); ctx.lineTo(mX, mY + size + gap);
        ctx.stroke();
    }

    function updateParticles(ctx: CanvasRenderingContext2D) {
        const particles = feedbackParticlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.y -= 1.2;
            p.alpha -= 0.02;
            p.scale += 0.005;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.font = 'black 14px "Outfit", system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }

    function updateLoop() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const nowAudio = audioCtxRef.current ? audioCtxRef.current.currentTime : 0;

        if (audioCtxRef.current && isActive) {
            const lookAhead = 0.15;
            while (nextBeatTimeRef.current < nowAudio + lookAhead) {
                const beatTime = nextBeatTimeRef.current;
                playMetronomeTick(audioCtxRef.current, beatTime);
                scheduledBeatsRef.current.push(beatTime);

                scheduledBeatsRef.current = scheduledBeatsRef.current.filter(
                    (t) => t > nowAudio - 1.0
                );

                nextBeatTimeRef.current += BEAT_INTERVAL_SEC;
            }
        }

        let beatProgress = 0;
        if (isActive && audioCtxRef.current) {
            const timeSinceStart = nowAudio - startAudioTimeRef.current;
            const phase = timeSinceStart % BEAT_INTERVAL_SEC;
            beatProgress = phase / BEAT_INTERVAL_SEC;
        }

        drawScene(ctx, canvas.width, canvas.height, beatProgress);
        updateParticles(ctx);

        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    useEffect(() => {
        const savedHigh = localStorage.getItem('aimsync_metronome_highscore');
        if (savedHigh) {
            setTimeout(() => {
                setHighScore(parseInt(savedHigh));
            }, 0);
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#0f1115';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.beginPath();
            ctx.arc(targetCenter.x, targetCenter.y, targetRadius + 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const coreGradient = ctx.createRadialGradient(
                targetCenter.x,
                targetCenter.y,
                2,
                targetCenter.x,
                targetCenter.y,
                targetRadius
            );
            coreGradient.addColorStop(0, '#475569');
            coreGradient.addColorStop(0.5, '#334155');
            coreGradient.addColorStop(1, '#1e293b');
            ctx.fillStyle = coreGradient;
            ctx.beginPath();
            ctx.arc(targetCenter.x, targetCenter.y, targetRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(targetCenter.x, targetCenter.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }, []);

    function startDrill() {
        if (isActive) return;

        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        setIsActive(true);
        setTimeLeft(GAME_DURATION_SEC);
        setScore(0);
        setTotalClicks(0);
        setAccuracy(null);
        setAverageTimingError(null);
        setHitsCount(0);
        setEarlyCount(0);
        setLateCount(0);
        setOffTargetCount(0);

        scheduledBeatsRef.current = [];
        feedbackParticlesRef.current = [];
        timingErrorsRef.current = [];

        const startAudioTime = ctx.currentTime + 0.15;
        startAudioTimeRef.current = startAudioTime;
        nextBeatTimeRef.current = startAudioTime;

        gameTimerIdRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    stopDrill();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    function stopDrill() {
        setIsActive(false);
        if (gameTimerIdRef.current) {
            clearInterval(gameTimerIdRef.current);
            gameTimerIdRef.current = null;
        }

        setTotalClicks((prevTotal) => {
            setHitsCount((prevHits) => {
                if (prevTotal > 0) {
                    const acc = Math.round((prevHits / prevTotal) * 100);
                    setAccuracy(acc);

                    setHighScore((prevHigh) => {
                        if (acc > prevHigh) {
                            localStorage.setItem('aimsync_metronome_highscore', acc.toString());
                            return acc;
                        }
                        return prevHigh;
                    });
                }
                return prevHits;
            });
            return prevTotal;
        });

        if (timingErrorsRef.current.length > 0) {
            const sum = timingErrorsRef.current.reduce((a, b) => a + b, 0);
            const avg = Math.round(sum / timingErrorsRef.current.length);
            setAverageTimingError(avg);
        }

        setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    drawScene(ctx, canvas.width, canvas.height, 0);
                }
            }
        }, 50);
    }

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isActive) {
            startDrill();
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas || !audioCtxRef.current) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const dist = Math.sqrt(Math.pow(mouseX - targetCenter.x, 2) + Math.pow(mouseY - targetCenter.y, 2));
        const clickAudioTime = audioCtxRef.current.currentTime;

        setTotalClicks((prev) => prev + 1);

        if (dist > targetRadius + 6) {
            playFeedbackSound('OFF');
            setOffTargetCount((prev) => prev + 1);
            feedbackParticlesRef.current.push({
                x: mouseX,
                y: mouseY - 10,
                text: 'OFF TARGET',
                color: '#64748b',
                alpha: 1.0,
                scale: 1.0,
            });
            return;
        }

        const scheduledBeats = scheduledBeatsRef.current;
        if (scheduledBeats.length === 0) {
            playFeedbackSound('MISS');
            setEarlyCount((prev) => prev + 1);
            return;
        }

        let closestBeat = scheduledBeats[0];
        let minDiff = Infinity;
        for (const beatTime of scheduledBeats) {
            const diff = Math.abs(clickAudioTime - beatTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestBeat = beatTime;
            }
        }

        const diffSeconds = clickAudioTime - closestBeat;
        const diffMs = Math.round(diffSeconds * 1000);
        const absDiffMs = Math.abs(diffMs);

        timingErrorsRef.current.push(absDiffMs);

        if (absDiffMs <= TOLERANCE_MS) {
            playFeedbackSound('HIT');
            setScore((prev) => prev + 1);
            setHitsCount((prev) => prev + 1);

            const displaySign = diffMs >= 0 ? `+${diffMs}` : `${diffMs}`;
            feedbackParticlesRef.current.push({
                x: mouseX,
                y: mouseY - 10,
                text: `HIT! ${displaySign}ms`,
                color: '#22c55e',
                alpha: 1.0,
                scale: 1.0,
            });
        } else {
            playFeedbackSound('MISS');
            const displaySign = diffMs >= 0 ? `+${diffMs}` : `${diffMs}`;

            if (diffMs < 0) {
                setEarlyCount((prev) => prev + 1);
                feedbackParticlesRef.current.push({
                    x: mouseX,
                    y: mouseY - 10,
                    text: `EARLY! ${displaySign}ms`,
                    color: '#f97316',
                    alpha: 1.0,
                    scale: 1.0,
                });
            } else {
                setLateCount((prev) => prev + 1);
                feedbackParticlesRef.current.push({
                    x: mouseX,
                    y: mouseY - 10,
                    text: `LATE! ${displaySign}ms`,
                    color: '#ef4444',
                    alpha: 1.0,
                    scale: 1.0,
                });
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            mousePosRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    };

    useEffect(() => {
        return () => {
            cancelAnimationFrame(animationFrameId.current);
            if (gameTimerIdRef.current) {
                clearInterval(gameTimerIdRef.current);
            }
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
                    <h1 className="text-2xl font-black tracking-wider text-white uppercase">Metronome Tap</h1>
                </div>
                <div className="flex gap-8 text-right">
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High Score</p>
                        <p className="text-xl font-mono font-black text-[#22c55e]">{highScore}%</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Score (Hits)</p>
                        <p className="text-xl font-mono font-black text-white">{isActive ? score : '--'}</p>
                    </div>
                    {accuracy !== null && (
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Last Run Accuracy</p>
                            <p className="text-xl font-mono font-black text-cyan-400">{accuracy}%</p>
                        </div>
                    )}
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Time Left</p>
                        <p className="text-xl font-mono font-black text-amber-500">{timeLeft}s</p>
                    </div>
                </div>
            </div>

            {/* The Canvas workspace */}
            <div className="relative border border-white/10 rounded-2xl overflow-hidden shadow-inner cursor-none">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={500}
                    onMouseDown={handleCanvasClick}
                    onMouseMove={handleMouseMove}
                    className="block"
                />

                {/* Instruction overlay */}
                {!isActive && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
                        <p className="text-white text-lg font-black tracking-widest uppercase mb-2">CLICK CANVAS TO START</p>
                        <p className="text-slate-400 text-xs max-w-md text-center leading-relaxed mb-4">
                            Match your clicks exactly to the rhythmic audio pulse. Clicks must be within ±75ms of the beat and hit the center target. Firing off-tempo or off-target resets the bloom.
                        </p>
                        <div className="flex gap-4">
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-slate-400 font-mono">BPM: 100</span>
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-slate-400 font-mono">Window: ±75ms</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Session Dashboard stats */}
            {(!isActive && (accuracy !== null || offTargetCount > 0)) && (
                <div className="w-full grid grid-cols-4 gap-4 mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl font-mono text-center">
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Perfect Hits / Clicks</p>
                        <p className="text-lg font-bold text-green-400">{hitsCount} / {totalClicks}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Timing Errors (Early/Late)</p>
                        <p className="text-lg font-bold text-orange-400">{earlyCount} / {lateCount}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Off Target Clicks</p>
                        <p className="text-lg font-bold text-red-500">{offTargetCount}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Avg Timing Offset</p>
                        <p className="text-lg font-bold text-cyan-400">
                            {averageTimingError !== null ? `${averageTimingError}ms` : '--'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
