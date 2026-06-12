'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSearchParams, useRouter } from 'next/navigation';

// Stores & Components
import WeaponModel from './WeaponModel';
import TargetManager from './TargetManager';
import TrackingManager from './TrackingManager';
import { useWeaponStore } from '@/store/weaponStore';
import { useRecoil } from '@/hooks/UseRecoil';
import { useGameStore } from '@/store/gameStore';
import { StorageEngine } from '@/lib/utils/storage';

// --- THE 3D ENGINE CORE ---
function EngineCore({ targetScale, activeMode }: { targetScale: number, activeMode: string }) {
    const { camera, scene } = useThree();
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);

    const { startFiring, stopFiring } = useRecoil(activeWeapon);
    const { recordShot, recordHit, recordMiss } = useGameStore();

    const raycaster = useRef(new THREE.Raycaster());
    const pendingShot = useRef(false);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                startFiring();
                pendingShot.current = true; // Queue the shot for the next 3D frame
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 0) stopFiring();
        };

        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [startFiring, stopFiring]);

    // Offload all aiming/shooting calculations to the 60+ FPS useFrame loop
    // This completely decouples 3D physics from the React main thread / DOM event loop
    useFrame(() => {
        if (pendingShot.current) {
            pendingShot.current = false; // Consume the shot
            recordShot();

            // Raycast logic
            raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.current.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                const hitObject = intersects[0].object;
                if (hitObject.name === 'target') {
                    // The Death Lock: Prevents ghost-spawns
                    if (!hitObject.userData.isDead) {
                        hitObject.userData.isDead = true;
                        if (hitObject.userData.isFriendly) {
                            // Friendly target hit: instantly reset player combo
                            recordMiss();
                        } else {
                            recordHit(10);
                        }
                        if (hitObject.userData.onHit) {
                            hitObject.userData.onHit(hitObject.userData.id);
                        }
                    }
                } else if (hitObject.name !== 'tracking-target') {
                    recordMiss();
                }
            } else {
                recordMiss();
            }
        }
    });

    return (
        <>
            <PointerLockControls />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} />

            {/* Render the correct manager based on activeMode */}
            {(activeMode === 'static-flick' || activeMode === 'echolocation' || activeMode === 'cognitive-overdrive') && (
                <TargetManager targetScale={targetScale} activeMode={activeMode} />
            )}
            {(activeMode === 'continuous-track' || activeMode === 'recoil-reactive' || activeMode === 'recoil-evasion') && (
                <TrackingManager targetScale={targetScale} activeMode={activeMode} />
            )}

            {/* Fallback if mode isn't built yet */}
            {activeMode !== 'static-flick' && 
             activeMode !== 'echolocation' && 
             activeMode !== 'cognitive-overdrive' && 
             activeMode !== 'continuous-track' && 
             activeMode !== 'recoil-reactive' && 
             activeMode !== 'recoil-evasion' && (
                <TargetManager targetScale={targetScale} activeMode={activeMode} />
            )}

            {activeWeapon && <WeaponModel weaponType={activeWeapon?.type || 'pistol'} />}
        </>
    );
}

// --- THE MATCH CONTROLLER & SEQUENCE ENGINE ---
export default function GameCanvas() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // 1. URL Parameter Parsing
    const playlistId = searchParams.get('playlist');
    const paramMode = searchParams.get('mode') || 'static-flick';
    const paramTime = parseInt(searchParams.get('time') || '0', 10);
    const paramDiff = searchParams.get('diff') || 'Normal';

    // 2. Sequence State
    const [playlistTasks, setPlaylistTasks] = useState<any[]>([]);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

    // Match State
    const [activeMode, setActiveMode] = useState(paramMode);
    const [timeLimit, setTimeLimit] = useState(paramTime);
    const [difficulty, setDifficulty] = useState(paramDiff);
    const [timeLeft, setTimeLeft] = useState(paramTime);
    const [isMatchOver, setIsMatchOver] = useState(false);

    // 3. Playlist Initialization
    useEffect(() => {
        if (playlistId) {
            const allPlaylists = StorageEngine.getPlaylists();
            const foundPlaylist = allPlaylists.find(p => p.id === playlistId);

            if (foundPlaylist && foundPlaylist.tasks.length > 0) {
                setPlaylistTasks(foundPlaylist.tasks);

                // Load the first task of the sequence
                const firstTask = foundPlaylist.tasks[0];
                setActiveMode(firstTask.mode);
                setDifficulty(firstTask.difficulty);
                setTimeLimit(firstTask.timeLimit);
                setTimeLeft(firstTask.timeLimit);
            }
        } else {
            // Standard single-mode deployment
            setActiveMode(paramMode);
            setDifficulty(paramDiff);
            setTimeLimit(paramTime);
            setTimeLeft(paramTime);
        }
    }, [playlistId, paramMode, paramTime, paramDiff]);

    // 4. The Countdown Timer
    useEffect(() => {
        if (timeLimit <= 0) return; // Freeplay sandbox mode

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsMatchOver(true);
                    // Automatically unlock pointer so they can click the Next Task button
                    document.exitPointerLock?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLimit, currentTaskIndex]); // Restart timer if task index changes

    // 5. Tactical Difficulty Scaler
    const getTargetScale = () => {
        switch (difficulty.toLowerCase()) {
            case 'eco': return 1.2;
            case 'normal': return 1.0;
            case 'bonus': return 0.75;
            case 'force buy': return 0.5;
            case 'full buy': return 0.3;
            default: return 1.0;
        }
    };

    // 6. Sequence Logic (Next Task)
    const handleNextTask = () => {
        if (currentTaskIndex + 1 < playlistTasks.length) {
            const nextIndex = currentTaskIndex + 1;
            const nextTask = playlistTasks[nextIndex];

            setCurrentTaskIndex(nextIndex);
            setActiveMode(nextTask.mode);
            setDifficulty(nextTask.difficulty);
            setTimeLimit(nextTask.timeLimit);
            setTimeLeft(nextTask.timeLimit);
            setIsMatchOver(false);
        } else {
            router.push('/dashboard');
        }
    };

    // --- RESULTS / BRIEFING SCREEN ---
    if (isMatchOver) {
        const isPlaylist = playlistTasks.length > 0;
        const hasNext = isPlaylist && currentTaskIndex + 1 < playlistTasks.length;

        return (
            <div className="w-full h-screen bg-[#121212] flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[#3366FF]/10 blur-[100px] pointer-events-none rounded-full scale-150" />

                <h1 className="text-6xl font-black text-[#3366FF] mb-4 uppercase tracking-widest relative z-10">Time Up</h1>

                {isPlaylist && (
                    <p className="text-sm font-mono text-slate-400 mb-2 relative z-10">
                        Task {currentTaskIndex + 1} of {playlistTasks.length} Complete
                    </p>
                )}

                <p className="text-xl text-slate-300 mb-12 relative z-10">
                    Data recorded. Preparing next phase.
                </p>

                <div className="flex gap-4 relative z-10">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 font-bold uppercase tracking-widest rounded transition-all"
                    >
                        Abort Sequence
                    </button>

                    {hasNext ? (
                        <button
                            onClick={handleNextTask}
                            className="px-8 py-4 bg-[#3366FF] hover:bg-blue-500 font-black uppercase tracking-widest rounded transition-colors shadow-[0_0_20px_rgba(51,102,255,0.3)]"
                        >
                            Deploy Next Task
                        </button>
                    ) : (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-8 py-4 bg-[#3366FF] hover:bg-blue-500 font-black uppercase tracking-widest rounded transition-colors shadow-[0_0_20px_rgba(51,102,255,0.3)]"
                        >
                            Return to Mission Control
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- REGULAR GAME RENDER ---
    return (
        <div className="w-full h-screen bg-zinc-900 relative">

            <div className="absolute top-4 left-4 z-10 text-white/50 font-mono text-[10px] uppercase tracking-widest pointer-events-none">
                {activeMode.replace('-', ' ')} // {difficulty} // Click to lock crosshair
            </div>

            {/* The Tactical HUD */}
            {timeLimit > 0 && (
                <div className="absolute top-8 left-0 right-0 flex flex-col items-center z-10 pointer-events-none">
                    <div className="text-4xl font-mono font-black text-white bg-[#121212]/80 backdrop-blur-md px-8 py-2 rounded-lg border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                        {timeLeft}<span className="text-[#3366FF] text-2xl">s</span>
                    </div>
                    {/* The Playlist Progress Tracker */}
                    {playlistTasks.length > 0 && (
                        <div className="mt-2 flex gap-1">
                            {playlistTasks.map((_, i) => (
                                <div key={i} className={`h-1.5 w-6 rounded-full ${i <= currentTaskIndex ? 'bg-[#3366FF] shadow-[0_0_10px_rgba(51,102,255,0.8)]' : 'bg-white/10'}`} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Canvas>
                <EngineCore targetScale={getTargetScale()} activeMode={activeMode} />
            </Canvas>
        </div>
    );
}