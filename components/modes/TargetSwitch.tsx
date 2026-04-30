'use client';

import { useThree } from '@react-three/fiber';
import { useState, useCallback } from 'react';
import * as THREE from 'three';

interface TargetProps {
    id: string; // Changed to string to support highly randomized IDs
    position: [number, number, number];
    onHit: (id: string) => void;
}

// 1. The Individual Target Component
function Target({ id, position, onHit }: TargetProps) {
    return (
        <mesh
            position={position}
            name="target"
            userData={{ id, onHit }}
        >
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="#3366FF" emissive="#3366FF" emissiveIntensity={0.5} />
        </mesh>
    );
}

// 2. The Spawner Logic
export default function TargetManager() {
    const { camera } = useThree();

    const spawnDistance = -15;

    const viewport = useThree((state) =>
        state.viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, spawnDistance))
    );

    const maxOffsetX = viewport.width * 0.125;
    const maxOffsetY = viewport.height * 0.075;

    const getRandomPosition = useCallback((): [number, number, number] => {
        const randomX = (Math.random() * 2 - 1) * maxOffsetX;
        const randomY = (Math.random() * 2 - 1) * maxOffsetY;
        return [randomX, randomY, spawnDistance];
    }, [maxOffsetX, maxOffsetY]);

    // Initialize with randomized string IDs
    const [targets, setTargets] = useState<{ id: string; pos: [number, number, number] }[]>([
        { id: Math.random().toString(36).substring(7), pos: getRandomPosition() },
        { id: Math.random().toString(36).substring(7), pos: getRandomPosition() },
        { id: Math.random().toString(36).substring(7), pos: getRandomPosition() }
    ]);

    // STRICT ARRAY MANAGEMENT
    const handleTargetHit = useCallback((id: string) => {
        setTargets((current) => {
            // 1. Filter out the dead target
            const remaining = current.filter((t) => t.id !== id);

            // 2. Spawn a completely new one with a fresh ID so React doesn't recycle the "dead" mesh
            const newTarget = {
                id: Math.random().toString(36).substring(7),
                pos: getRandomPosition()
            };

            // 3. Return the clean array
            return [...remaining, newTarget];
        });
    }, [getRandomPosition]);

    return (
        <>
            {targets.map((target) => (
                <Target
                    key={target.id} // The new ID forces a clean re-mount
                    id={target.id}
                    position={target.pos}
                    onHit={handleTargetHit}
                />
            ))}
        </>
    );
}