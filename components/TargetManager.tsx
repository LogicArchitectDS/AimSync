'use client';

import { useThree } from '@react-three/fiber';
import { useState, useCallback } from 'react';
import * as THREE from 'three';

interface TargetProps {
    id: number;
    position: [number, number, number];
    onHit: (id: number) => void;
    scale: number;
}

// 1. The Individual Target Component
function Target({ id, position, onHit, scale }: TargetProps) {
    return (
        <mesh
            position={position}
            name="target"
            // We store the ID and the callback inside the mesh's userData
            // so the Raycaster in GameCanvas can trigger it upon a ballistic impact!
            userData={{ id, onHit }}
        >
            <sphereGeometry args={[0.5 * scale, 32, 32]} />
            <meshStandardMaterial color="#3366FF" emissive="#3366FF" emissiveIntensity={0.5} />
        </mesh>
    );
}

// 2. The Spawner Logic
export default function TargetManager({ targetScale = 1 }: { targetScale?: number }) {
    const { camera } = useThree();

    // How far away the "wall" of targets is from the player
    const spawnDistance = -15;

    // Ask the engine: "How wide/tall is the screen exactly 15 units away?"
    const viewport = useThree((state) =>
        state.viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, spawnDistance))
    );

    // Apply your PEZ Math to the 3D bounds
    // +/- 12.5% from center (25% total width)
    const maxOffsetX = viewport.width * 0.125;
    // +/- 7.5% from center (15% total height)
    const maxOffsetY = viewport.height * 0.075;

    const getRandomPosition = useCallback((): [number, number, number] => {
        // Generate a random spot strictly within the Kill Box
        const randomX = (Math.random() * 2 - 1) * maxOffsetX;
        const randomY = (Math.random() * 2 - 1) * maxOffsetY;

        return [randomX, randomY, spawnDistance];
    }, [maxOffsetX, maxOffsetY]);

    // State to hold 3 active targets at all times
    const [targets, setTargets] = useState<{ id: number; pos: [number, number, number] }[]>([
        { id: 1, pos: getRandomPosition() },
        { id: 2, pos: getRandomPosition() },
        { id: 3, pos: getRandomPosition() }
    ]);

    // When a target is shot by the Raycaster, destroy it and spawn a new one
    const handleTargetHit = (id: number) => {
        setTargets((current) =>
            current.map((t) => (t.id === id ? { id: t.id, pos: getRandomPosition() } : t))
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
                />
            ))}
        </group>
    );
}