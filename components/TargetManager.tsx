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
}

// POSITIONAL SOUND HELPER (Protocol 1)
function PositionalSound({ position }: { position: [number, number, number] }) {
    const { camera } = useThree();

    useEffect(() => {
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

        const sound = new THREE.PositionalAudio(listener);

        // Generate synthetic spatial footprint sound locally
        const rate = ctx ? ctx.sampleRate : 44100;
        const duration = 0.2; // 200ms
        const buffer = ctx ? ctx.createBuffer(1, rate * duration, rate) : null;
        if (buffer) {
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                // Decaying pitch footstep simulation
                data[i] = Math.sin(i * 0.05) * Math.exp(-i * 0.005);
            }
            sound.setBuffer(buffer);
        }
        sound.setRefDistance(2);
        sound.setMaxDistance(100);

        sound.position.set(position[0], position[1], position[2]);
        sound.play();

        return () => {
            if (sound.isPlaying) sound.stop();
        };
    }, [camera, position]);

    return null;
}

// 1. The Individual Target Component
function Target({ id, position, onHit, scale, isFriendly, activeMode }: TargetProps) {
    // Protocol 2: Cognitive Overdrive colors (Red = Hostile, Green = Friendly)
    // Echolocation: high visibility Gold
    // Default: AimSync Signature Blue
    const getTargetColor = () => {
        if (activeMode === 'cognitive-overdrive') {
            return isFriendly ? '#33FF33' : '#FF3333';
        }
        if (activeMode === 'echolocation') {
            return '#FFD700'; // Gold
        }
        return '#3366FF'; // Blue
    };

    const targetColor = getTargetColor();

    return (
        <group>
            <mesh
                position={position}
                name="target"
                userData={{ id, onHit, isFriendly }}
            >
                <sphereGeometry args={[0.5 * scale, 32, 32]} />
                <meshStandardMaterial
                    color={targetColor}
                    emissive={targetColor}
                    emissiveIntensity={0.6}
                />
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

    const getRandomPosition = useCallback((): [number, number, number] => {
        if (activeMode === 'echolocation') {
            // Protocol 1: Echolocation: Spawn targets in 360-degree radial ring outside camera FOV
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            const currentYaw = Math.atan2(cameraDir.x, cameraDir.z);

            // Spawn target 90 to 270 degrees away from current look direction
            const angleOffset = Math.PI / 2 + Math.random() * Math.PI;
            const finalAngle = currentYaw + angleOffset;

            const radius = 12 + Math.random() * 8; // 12-20 units distance
            const x = Math.sin(finalAngle) * radius;
            const z = Math.cos(finalAngle) * radius;
            const y = (Math.random() - 0.5) * 5; // vertical offset

            return [x, y, z];
        }

        const randomX = (Math.random() * 2 - 1) * maxOffsetX;
        const randomY = (Math.random() * 2 - 1) * maxOffsetY;
        return [randomX, randomY, spawnDistance];
    }, [activeMode, camera, maxOffsetX, maxOffsetY]);

    const [targets, setTargets] = useState<{ id: number; pos: [number, number, number]; isFriendly: boolean }[]>([]);

    useEffect(() => {
        setTargets([
            { id: 1, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false },
            { id: 2, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false },
            { id: 3, pos: getRandomPosition(), isFriendly: activeMode === 'cognitive-overdrive' ? Math.random() < 0.35 : false },
        ]);
    }, [activeMode, getRandomPosition]);

    const handleTargetHit = (id: number) => {
        if (activeMode === 'echolocation') {
            // Protocol 1: Force camera tracking to rotate rapidly by 90 or 180 degrees
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
                />
            ))}
        </group>
    );
}