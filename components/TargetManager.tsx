'use client';

import { useThree } from '@react-three/fiber';
import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface TargetProps {
    id: number;
    position: [number, number, number];
    onHit: (id: number) => void;
    scale: number;
    isFriendly: boolean;
    activeMode: string;
    spawnTime: number;
}

// ULTRA-LIGHTWEIGHT SPATIAL AUDIO CUE (Protocol 1)
function PositionalSound({ position }: { position: [number, number, number] }) {
    const audioRef = useRef<THREE.PositionalAudio>(null);
    const { camera } = useThree();

    useEffect(() => {
        const sound = audioRef.current;
        if (!sound) return;

        // Retrieve or initialize audio listener on the camera
        let listener = camera.children.find((c) => c instanceof THREE.AudioListener) as THREE.AudioListener;
        if (!listener) {
            listener = new THREE.AudioListener();
            camera.add(listener);
        }

        const ctx = THREE.AudioContext.getContext() as any;
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }

        // Generate synthetic sharp audio cue on the fly
        const rate = ctx.sampleRate || 44100;
        const duration = 0.15; // 150ms duration
        const buffer = ctx.createBuffer(1, rate * duration, rate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / rate;
            // High-density transient attack frequency sweep
            data[i] = Math.sin(2 * Math.PI * 880 * Math.exp(-15 * t) * t) * Math.exp(-25 * t);
        }

        sound.setBuffer(buffer);
        sound.setRefDistance(5);
        sound.setMaxDistance(50);
        sound.play();

        return () => {
            if (sound.isPlaying) sound.stop();
        };
    }, [camera]);

    const listener = camera.children.find((c) => c instanceof THREE.AudioListener) as THREE.AudioListener;
    if (!listener) return null;

    return <positionalAudio ref={audioRef} args={[listener]} position={position} />;
}

// 1. The Individual Target Component
function Target({ id, position, onHit, scale, isFriendly, activeMode, spawnTime }: TargetProps) {
    // Protocol 2: Cognitive Overdrive colors (Red = Hostile, Blue = Friendly/Distractor)
    // Echolocation: high visibility Gold
    // Default: AimSync Signature Blue
    const getTargetColor = () => {
        if (activeMode === 'cognitive-overdrive') {
            return isFriendly ? '#3366FF' : '#FF3333'; // Blue (Friendly), Red (Hostile)
        }
        if (activeMode === 'echolocation') {
            return '#FFD700'; // Gold
        }
        return '#3366FF'; // Blue
    };

    const targetColor = getTargetColor();

    return (
        <group>
            {/* Low-poly mesh and basic unlit material to protect 144Hz framerate */}
            <mesh
                position={position}
                name="target"
                userData={{ id, onHit, isFriendly, spawnTime }}
            >
                <sphereGeometry args={[0.5 * scale, 8, 8]} />
                <meshBasicMaterial color={targetColor} />
            </mesh>
            {activeMode === 'echolocation' && <PositionalSound position={position} />}
        </group>
    );
}

// 2. The Spawner Logic
export default function TargetManager({
    targetScale = 1,
    activeMode = 'static-flick',
}: {
    targetScale?: number;
    activeMode?: string;
}) {
    const { camera } = useThree();
    const spawnDistance = -15;

    const viewport = useThree((state) =>
        state.viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, spawnDistance))
    );

    const maxOffsetX = viewport.width * 0.125;
    const maxOffsetY = viewport.height * 0.075;

    // Spawning ring logic outside FOV (103 deg) at Z = 15m radius
    const getRandomPosition = useCallback((): [number, number, number] => {
        if (activeMode === 'echolocation') {
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            const lookAngle = Math.atan2(cameraDir.x, cameraDir.z); // yaw angle

            // Spawning outside FOV:
            // Half FOV is 51.5 degrees (~0.8988 rad)
            // Remaining angle range is [51.5, 308.5] degrees (~[0.8988, 5.3844] rad)
            const halfFov = (51.5 * Math.PI) / 180;
            const angleRange = Math.PI * 2 - halfFov * 2;
            const angleOffset = halfFov + Math.random() * angleRange;
            const finalAngle = lookAngle + angleOffset;

            // Fixed distance of 15m
            const x = Math.sin(finalAngle) * 15;
            const z = Math.cos(finalAngle) * 15;
            const y = (Math.random() - 0.5) * 2; // slight elevation variance, but close to eye level
            return [x, y, z];
        }

        const randomX = (Math.random() * 2 - 1) * maxOffsetX;
        const randomY = (Math.random() * 2 - 1) * maxOffsetY;
        return [randomX, randomY, spawnDistance];
    }, [activeMode, camera, maxOffsetX, maxOffsetY]);

    const [targets, setTargets] = useState<{ id: number; pos: [number, number, number]; isFriendly: boolean; spawnTime: number }[]>([]);

    useEffect(() => {
        // Initialize camera AudioListener immediately on mount to prevent positional audio race conditions
        let listener = camera.children.find((c) => c instanceof THREE.AudioListener);
        if (!listener) {
            camera.add(new THREE.AudioListener());
        }

        setTargets([
            { id: 1, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false, spawnTime: performance.now() },
            { id: 2, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false, spawnTime: performance.now() },
            { id: 3, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false, spawnTime: performance.now() },
        ]);
    }, [activeMode, getRandomPosition, camera]);

    const handleTargetHit = (id: number) => {
        if (activeMode === 'echolocation') {
            // Protocol 1: Rotate camera spin after hit
            const spin = Math.random() > 0.5 ? Math.PI / 2 : Math.PI;
            camera.rotation.y += spin;
        }

        setTargets((current) =>
            current.map((t) =>
                t.id === id
                    ? {
                          id: t.id,
                          pos: getRandomPosition(),
                          isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false,
                          spawnTime: performance.now()
                      }
                    : t
            )
        );
    };

    return (
        <group>
            {targets.map((target) => (
                <Target
                    key={target.id}
                    id={target.id}
                    position={target.pos}
                    onHit={handleTargetHit}
                    scale={targetScale}
                    isFriendly={target.isFriendly}
                    activeMode={activeMode}
                    spawnTime={target.spawnTime}
                />
            ))}
        </group>
    );
}