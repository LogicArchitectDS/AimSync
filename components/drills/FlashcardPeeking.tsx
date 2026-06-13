'use client';

import { useEffect, useRef, useState } from 'react';

interface PeekAngle {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ActiveTarget {
    angleId: string;
    spawnTime: number;
    duration: number;
}

interface FeedbackParticle {
    x: number;
    y: number;
    text: string;
    color: string;
    alpha: number;
}

const PEEK_ANGLES: PeekAngle[] = [
    { id: 'wine', name: 'Wine Corner', x: 80, y: 340, width: 30, height: 60 },
    { id: 'close_left', name: 'Close Left Corner', x: 180, y: 330, width: 30, height: 60 },
    { id: 'site_generator', name: 'A Generator', x: 380, y: 280, width: 25, height: 50 },
    { id: 'green_box', name: 'A Green Box', x: 520, y: 290, width: 25, height: 50 },
    { id: 'heaven', name: 'A Heaven Peek', x: 650, y: 150, width: 24, height: 48 },
];

const GAME_DURATION_SEC = 30;

// Module-level helper functions defined outside React scope to maintain purity rules
function getRandomAngle(excludeId?: string): PeekAngle {
    const available = excludeId ? PEEK_ANGLES.filter((a) => a.id !== excludeId) : PEEK_ANGLES;
    return available[Math.floor(Math.random() * available.length)];
}

function getRandomSpawnDelay(): number {
    return Math.random() * 600 + 400; // 400ms to 1000ms
}

function getNextTargetSpawnDelay(): number {
    return Math.random() * 500 + 400; // 400ms to 900ms
}

function getTargetDuration(score: number): number {
    const baseDuration = 1250;
    return Math.max(700, baseDuration - score * 12);
}

export default function FlashcardPeeking() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Image reference
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const [, setIsImageLoaded] = useState(false);

    // Gameplay states
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
    const [score, setScore] = useState(0);
    const [totalShots, setTotalShots] = useState(0);
    const [hits, setHits] = useState(0);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [highScore, setHighScore] = useState<number>(0);
    const [damageTaken, setDamageTaken] = useState(0);

    // Anim & Timer refs
    const animationFrameId = useRef<number>(0);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 400, y: 250 });
    const activeTargetRef = useRef<ActiveTarget | null>(null);
    const nextSpawnTimeRef = useRef<number>(0);
    const feedbackParticlesRef = useRef<FeedbackParticle[]>([]);
    const screenFlashAlphaRef = useRef<number>(0);
    const lastTargetIdRef = useRef<string>('');
    const gameTimerIdRef = useRef<NodeJS.Timeout | null>(null);

    // Hoisted helper functions
    function playSound(type: 'GUNSHOT' | 'DINK' | 'DAMAGE') {
        try {
            if (!audioCtxRef.current) {
                const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioCtxRef.current = new AudioContextClass();
                }
            }
            const ctx = audioCtxRef.current;
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();

            const gain = ctx.createGain();
            gain.connect(ctx.destination);

            if (type === 'GUNSHOT') {
                const osc = ctx.createOscillator();
                osc.connect(gain);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
            } else if (type === 'DINK') {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc1.connect(gain);
                osc2.connect(gain);
                osc1.type = 'sine';
                osc2.type = 'triangle';
                osc1.frequency.setValueAtTime(1300, ctx.currentTime);
                osc2.frequency.setValueAtTime(1900, ctx.currentTime);
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                osc1.start(); osc2.start();
                osc1.stop(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.15);
            } else if (type === 'DAMAGE') {
                const osc = ctx.createOscillator();
                osc.connect(gain);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(90, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.22);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.start();
                osc.stop(ctx.currentTime + 0.22);
            }
        } catch {
            // Audio context protection
        }
    }

    function drawStaticScene(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, width, height);

        PEEK_ANGLES.forEach((angle) => {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(
                angle.x - angle.width / 2,
                angle.y - angle.height / 2,
                angle.width,
                angle.height
            );
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(angle.name, angle.x, angle.y + angle.height / 2 + 12);
        });
    }

    function drawTargetSilhouette(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        lifespanPct: number
    ) {
        ctx.save();

        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(239, 68, 68, ${0.4 + 0.6 * lifespanPct})`;

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x + w / 3, y - h / 6);
        ctx.lineTo(x - w / 3, y - h / 6);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.arc(x, y - h / 3, w / 2.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(x, y - h / 3, w / 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x - w / 2, y + h / 2 + 6, w, 4);

        ctx.fillStyle = lifespanPct > 0.4 ? '#22c55e' : '#f97316';
        ctx.fillRect(x - w / 2, y + h / 2 + 6, w * lifespanPct, 4);

        ctx.restore();
    }

    function drawCrosshair(ctx: CanvasRenderingContext2D) {
        const mX = mousePosRef.current.x;
        const mY = mousePosRef.current.y;

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        const size = 5;
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
            p.y -= 1.0;
            p.alpha -= 0.02;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }

    function updateLoop(timestamp: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (isActive) {
            const active = activeTargetRef.current;
            if (active) {
                const elapsed = timestamp - active.spawnTime;
                if (elapsed >= active.duration) {
                    playSound('DAMAGE');
                    setDamageTaken((prev) => prev + 1);
                    setScore((prev) => Math.max(0, prev - 150));

                    const angle = PEEK_ANGLES.find((a) => a.id === active.angleId);
                    if (angle) {
                        feedbackParticlesRef.current.push({
                            x: angle.x,
                            y: angle.y - 20,
                            text: 'SHOT BACK! (-150)',
                            color: '#ef4444',
                            alpha: 1.0,
                        });
                    }

                    screenFlashAlphaRef.current = 0.45;
                    activeTargetRef.current = null;
                    nextSpawnTimeRef.current = timestamp + getRandomSpawnDelay();
                }
            } else {
                if (timestamp >= nextSpawnTimeRef.current) {
                    const randomAngle = getRandomAngle(lastTargetIdRef.current);
                    lastTargetIdRef.current = randomAngle.id;

                    activeTargetRef.current = {
                        angleId: randomAngle.id,
                        spawnTime: timestamp,
                        duration: getTargetDuration(score),
                    };
                }
            }
        }

        if (bgImageRef.current) {
            ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
        } else {
            drawStaticScene(ctx, canvas.width, canvas.height);
        }

        const active = activeTargetRef.current;
        if (active && isActive) {
            const angle = PEEK_ANGLES.find((a) => a.id === active.angleId);
            if (angle) {
                const elapsed = timestamp - active.spawnTime;
                const pct = Math.max(0, 1 - elapsed / active.duration);
                drawTargetSilhouette(ctx, angle.x, angle.y, angle.width, angle.height, pct);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(angle.x - 50, angle.y - angle.height / 2 - 25, 100, 16);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(angle.name, angle.x, angle.y - angle.height / 2 - 14);
            }
        }

        if (screenFlashAlphaRef.current > 0) {
            ctx.fillStyle = `rgba(239, 68, 68, ${screenFlashAlphaRef.current})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            screenFlashAlphaRef.current -= 0.03;
        }

        updateParticles(ctx);
        drawCrosshair(ctx);

        animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    // Load static image backdrop
    useEffect(() => {
        const img = new Image();
        img.src = '/images/ascent_a_main.png';
        img.onload = () => {
            bgImageRef.current = img;
            setIsImageLoaded(true);

            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) drawStaticScene(ctx, canvas.width, canvas.height);
            }
        };

        const savedHigh = localStorage.getItem('aimsync_peeking_highscore');
        if (savedHigh) {
            setTimeout(() => {
                setHighScore(parseInt(savedHigh));
            }, 0);
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
        if (ctx.state === 'suspended') ctx.resume();

        setIsActive(true);
        setTimeLeft(GAME_DURATION_SEC);
        setScore(0);
        setTotalShots(0);
        setHits(0);
        setAccuracy(null);
        setDamageTaken(0);
        feedbackParticlesRef.current = [];
        screenFlashAlphaRef.current = 0;

        nextSpawnTimeRef.current = performance.now() + 500;

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
        activeTargetRef.current = null;

        if (gameTimerIdRef.current) {
            clearInterval(gameTimerIdRef.current);
            gameTimerIdRef.current = null;
        }

        setTotalShots((prevTotal) => {
            setHits((prevHits) => {
                if (prevTotal > 0) {
                    const acc = Math.round((prevHits / prevTotal) * 100);
                    setAccuracy(acc);
                }
                return prevHits;
            });
            return prevTotal;
        });

        setScore((finalScore) => {
            setHighScore((prevHigh) => {
                if (finalScore > prevHigh) {
                    localStorage.setItem('aimsync_peeking_highscore', finalScore.toString());
                    return finalScore;
                }
                return prevHigh;
            });
            return finalScore;
        });

        setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) drawStaticScene(ctx, canvas.width, canvas.height);
            }
        }, 50);
    }

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isActive) {
            startDrill();
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        playSound('GUNSHOT');
        setTotalShots((prev) => prev + 1);

        const active = activeTargetRef.current;
        if (active) {
            const angle = PEEK_ANGLES.find((a) => a.id === active.angleId);
            if (angle) {
                const hLeft = angle.x - angle.width / 2;
                const hRight = angle.x + angle.width / 2;
                const hTop = angle.y - angle.height / 2;
                const hBottom = angle.y + angle.height / 2;

                if (clickX >= hLeft && clickX <= hRight && clickY >= hTop && clickY <= hBottom) {
                    playSound('DINK');
                    setHits((prev) => prev + 1);

                    const reactTime = Math.round(performance.now() - active.spawnTime);
                    const ptsEarned = Math.max(100, 500 - reactTime);

                    setScore((prev) => prev + ptsEarned);

                    feedbackParticlesRef.current.push({
                        x: clickX,
                        y: clickY - 15,
                        text: `DINK! +${ptsEarned} (${reactTime}ms)`,
                        color: '#22c55e',
                        alpha: 1.0,
                    });

                    activeTargetRef.current = null;
                    nextSpawnTimeRef.current = performance.now() + getNextTargetSpawnDelay();
                    return;
                }
            }
        }

        setScore((prev) => Math.max(0, prev - 50));
        feedbackParticlesRef.current.push({
            x: clickX,
            y: clickY - 15,
            text: 'MISSED SHOT (-50)',
            color: '#94a3b8',
            alpha: 1.0,
        });
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
            if (gameTimerIdRef.current) clearInterval(gameTimerIdRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    return (
        <div className="flex flex-col items-center bg-[#08090c] p-6 rounded-3xl border border-white/5 shadow-2xl w-full max-w-4xl mx-auto">
            {/* Header Dashboard HUD */}
            <div className="w-full flex justify-between items-center mb-6 font-sans">
                <div>
                    <h2 className="text-[#3366ff] text-xs font-bold tracking-[0.4em] uppercase">AimSync Tech</h2>
                    <h1 className="text-2xl font-black tracking-wider text-white uppercase">Flashcard Peeking</h1>
                </div>
                <div className="flex gap-8 text-right">
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High Score</p>
                        <p className="text-xl font-mono font-black text-[#22c55e]">{highScore}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Score</p>
                        <p className="text-xl font-mono font-black text-white">{isActive ? score : '--'}</p>
                    </div>
                    {accuracy !== null && (
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Accuracy</p>
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
                            Ascent A-Main angle pre-aim trainer. Targets flash into sight at standard peeking spots. Hit them before they shoot back! Speed grants higher point values.
                        </p>
                        <div className="flex gap-4">
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-slate-400 font-mono">Backdrop: Ascent A-Main</span>
                            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-slate-400 font-mono">Angles: 5 Spots</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Session Stats HUD */}
            {(!isActive && (accuracy !== null || damageTaken > 0)) && (
                <div className="w-full grid grid-cols-3 gap-4 mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl font-mono text-center">
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Dink Hits / Total Shots</p>
                        <p className="text-lg font-bold text-green-400">{hits} / {totalShots}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Times Shot Back (Took Damage)</p>
                        <p className="text-lg font-bold text-red-400">{damageTaken}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1">Final Score</p>
                        <p className="text-lg font-bold text-cyan-400">{score}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
