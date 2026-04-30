'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TrackingTargetProps {
    id: string;
    baseDistance?: number;
}

export default function TrackingTarget({ id, baseDistance = -15 }: TrackingTargetProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Generate random frequencies and amplitudes so every target moves uniquely
    const { speedX, speedY, speedZ, radiusX, radiusY, radiusZ } = useMemo(() => ({
        speedX: Math.random() * 1.5 + 0.5, // Horizontal speed
        speedY: Math.random() * 1.5 + 0.5, // Vertical speed
        speedZ: Math.random() * 1.0 + 0.2, // Depth speed (slower)
        radiusX: Math.random() * 6 + 4,    // How far it sweeps left/right
        radiusY: Math.random() * 4 + 2,    // How far it sweeps up/down
        radiusZ: Math.random() * 5 + 2     // How far it pushes in/out
    }), []);

    useFrame((state) => {
        if (!meshRef.current) return;

        // Get elapsed time for smooth, continuous math
        const t = state.clock.getElapsedTime();

        // Lissajous Curve Math: Complex erratic movement using simple sine/cosine waves
        const x = Math.sin(t * speedX) * radiusX;
        const y = Math.cos(t * speedY) * radiusY;
        const z = baseDistance + Math.sin(t * speedZ) * radiusZ;

        // Apply the new position 144+ times a second
        meshRef.current.position.set(x, y, z);
    });

    return (
        <mesh
            ref={meshRef}
            name="tracking-target"
            userData={{ id }}
        >
            <sphereGeometry args={[0.5, 32, 32]} />
            {/* Tracking targets glow Orange to differentiate them from Blue Static targets */}
            <meshStandardMaterial color="#FF9900" emissive="#FF9900" emissiveIntensity={0.6} />
        </mesh>
    );
}