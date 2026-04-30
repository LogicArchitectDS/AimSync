'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Stores & Components
import WeaponModel from './WeaponModel';
import TargetManager from './TargetManager';
import { useWeaponStore } from '@/store/weaponStore';
import { useRecoil } from '@/hooks/UseRecoil';
import { useGameStore } from '@/store/gameStore'; // NEW: Added GameStore

function EngineCore() {
    const { camera, scene } = useThree();
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);

    // Pull the math from our custom hook
    const { startFiring, stopFiring, getShotTrajectory } = useRecoil(activeWeapon);

    // NEW: Pull the Freeflow tracking actions
    const { recordShot, recordHit, recordMiss } = useGameStore();

    const raycaster = useRef(new THREE.Raycaster());
    const isHoldingTrigger = useRef(false);
    const lastShotTime = useRef(0);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0 && activeWeapon) {
                startFiring();
                isHoldingTrigger.current = true;
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 0) {
                stopFiring();
                isHoldingTrigger.current = false;
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [activeWeapon, startFiring, stopFiring]);

    useFrame(() => {
        if (!activeWeapon || !isHoldingTrigger.current) return;

        const now = performance.now();
        const timeBetweenShots = 1000 / activeWeapon.fireRate;

        if (now - lastShotTime.current >= timeBetweenShots) {
            lastShotTime.current = now;

            // Log the bullet leaving the chamber
            recordShot();

            const { offsetX, offsetY } = getShotTrajectory();
            raycaster.current.setFromCamera(new THREE.Vector2(offsetX, offsetY), camera);
            const intersects = raycaster.current.intersectObjects(scene.children, true);

            // --- ARKHAM HIT/MISS DETECTOR ---
            if (intersects.length > 0 && intersects[0].object.name === 'target') {
                const hitObject = intersects[0].object;

                // COMBO MAINTAINED: Award 10 base XP (which multiplies by the combo inside the store)
                recordHit(10);

                if (hitObject.userData && hitObject.userData.onHit) {
                    hitObject.userData.onHit(hitObject.userData.id);
                }
            } else {
                // COMBO BROKEN: They clicked and hit the void!
                recordMiss();
            }
        }
    });

    return (
        <>
            <PointerLockControls />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} />

            <TargetManager />
            {activeWeapon && <WeaponModel weaponType={activeWeapon.type} />}
        </>
    );
}

export default function GameCanvas() {
    return (
        <div className="w-full h-screen bg-zinc-900 relative">
            <div className="absolute top-4 left-4 z-10 text-white/50 font-mono text-sm pointer-events-none">
                Click on the game to lock mouse. Press ESC to unlock.
            </div>

            <Canvas>
                <EngineCore />
            </Canvas>
        </div>
    );
}