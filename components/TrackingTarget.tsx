'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeaponStore } from '@/store/weaponStore';
import { useRecoil } from '@/hooks/UseRecoil';

interface TrackingTargetProps {
    id: string;
    baseDistance?: number;
    activeMode?: string;
}

// Reusable vector reference to avoid GC allocations in the 144Hz animation loop
const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);

export default function TrackingTarget({ id, baseDistance = -15, activeMode = 'continuous-track' }: TrackingTargetProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);
    const { getShotTrajectory } = useRecoil(activeWeapon);

    // Generate random frequencies and amplitudes so every target moves uniquely
    const { speedX, speedY, speedZ, radiusX, radiusY, radiusZ } = useMemo(() => ({
        speedX: Math.random() * 1.5 + 0.5, // Horizontal speed
        speedY: Math.random() * 1.5 + 0.5, // Vertical speed
        speedZ: Math.random() * 1.0 + 0.2, // Depth speed (slower)
        radiusX: Math.random() * 6 + 4,    // How far it sweeps left/right
        radiusY: Math.random() * 4 + 2,    // How far it sweeps up/down
        radiusZ: Math.random() * 5 + 2     // How far it pushes in/out
    }), []);

    const evasionOffset = useRef(new THREE.Vector3(0, 0, 0));

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // Get elapsed time for smooth, continuous math
        const t = state.clock.getElapsedTime();

        // Lissajous Curve Math: Complex erratic movement using simple sine/cosine waves
        const xBase = Math.sin(t * speedX) * radiusX;
        const yBase = Math.cos(t * speedY) * radiusY;
        const zBase = baseDistance + Math.sin(t * speedZ) * radiusZ;

        let finalX = xBase;
        let finalY = yBase;
        let finalZ = zBase;

        // Recoil-Reactive Evasion logic
        if (activeMode === 'recoil-reactive' || activeMode === 'recoil-evasion') {
            const recoil = getShotTrajectory();
            const kickY = recoil.kickY || 0;
            const kickX = recoil.kickX || 0;
            const offsetX = recoil.offsetX || 0;
            const offsetY = recoil.offsetY || 0;

            const sprayMagnitude = Math.sqrt(kickX * kickX + kickY * kickY);
            const bloomMagnitude = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

            // Active counter-spray dodge trigger
            if (sprayMagnitude > 0.05 || bloomMagnitude > 0.005) {
                // Dodge away from the weapon spray trajectory
                const dodgeDirX = kickX > 0 ? -1 : 1;
                const dodgeDirY = kickY > 0 ? -1 : 0.5; // Dive down

                evasionOffset.current.x += (dodgeDirX * 15.0 + Math.sin(t * 15) * 5.0) * delta;
                evasionOffset.current.y += (dodgeDirY * 12.0) * delta;
            } else {
                // Return to base Lissajous curve smoothly using static reference
                evasionOffset.current.lerp(ZERO_VECTOR, 0.1);
            }

            // Bind values to prevent the target from completely flying off-screen
            evasionOffset.current.x = Math.max(-8, Math.min(8, evasionOffset.current.x));
            evasionOffset.current.y = Math.max(-6, Math.min(6, evasionOffset.current.y));

            finalX += evasionOffset.current.x;
            finalY += evasionOffset.current.y;
        }

        // Apply the new position
        meshRef.current.position.set(finalX, finalY, finalZ);
    });

    return (
        <mesh
            ref={meshRef}
            name="tracking-target"
            userData={{ id }}
        >
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color="#FF9900" />
        </mesh>
    );
}