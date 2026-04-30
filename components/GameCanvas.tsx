'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Stores & Components
import WeaponModel from './WeaponModel';
import TargetManager from './TargetManager';
import TrackingManager from './TrackingManager'; // NEW: Imported the Tracking Mode
import { useWeaponStore } from '@/store/weaponStore';
import { useRecoil } from '@/hooks/UseRecoil';
import { useGameStore } from '@/store/gameStore';

function EngineCore() {
    const { camera, scene } = useThree();
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);

    // Pull the recoil math and combo trackers
    const { startFiring, stopFiring, getShotTrajectory } = useRecoil(activeWeapon);
    const { recordShot, recordHit, recordMiss } = useGameStore();

    const raycaster = useRef(new THREE.Raycaster());
    const isHoldingTrigger = useRef(false);

    // --- ENGINE 1: STATIC FLICK STATE ---
    const lastShotTime = useRef(0);

    // --- ENGINE 2: TRACKING STATE ---
    const lockOnTime = useRef(0);
    const wasTrackingLastFrame = useRef(false);

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

    // 144+ Hz Game Loop
    useFrame((state, delta) => {
        if (!activeWeapon || !isHoldingTrigger.current) {
            // If they let go of the trigger, break the tracking combo instantly
            if (wasTrackingLastFrame.current) {
                recordMiss();
                wasTrackingLastFrame.current = false;
                lockOnTime.current = 0;
            }
            return;
        }

        const now = performance.now();
        const timeBetweenShots = 1000 / activeWeapon.fireRate;

        // The "Always-On" Hybrid Raycaster
        const { offsetX, offsetY } = getShotTrajectory();
        raycaster.current.setFromCamera(new THREE.Vector2(offsetX, offsetY), camera);
        const intersects = raycaster.current.intersectObjects(scene.children, true);

        const hitObject = intersects.length > 0 ? intersects[0].object : null;

        // ==========================================
        // ENGINE 1: CONTINUOUS TRACKING MODE
        // ==========================================
        if (hitObject && hitObject.name === 'tracking-target') {
            wasTrackingLastFrame.current = true;

            // Accumulate delta time (e.g., +0.016s per frame)
            lockOnTime.current += delta;

            // Every time they hold it for 1 full second, pay out the XP!
            if (lockOnTime.current >= 1.0) {
                recordHit(10); // Award 10 XP & increment Arkham Combo
                lockOnTime.current -= 1.0; // Subtract 1 second, but keep the fractional remainder!
            }
        } else {
            // They slipped off the tracking target!
            if (wasTrackingLastFrame.current) {
                recordMiss(); // SHATTER THE COMBO
                lockOnTime.current = 0;
                wasTrackingLastFrame.current = false;
            }
        }

        // ==========================================
        // ENGINE 2: STATIC FLICK MODE
        // ==========================================
        if (now - lastShotTime.current >= timeBetweenShots) {
            lastShotTime.current = now;
            recordShot();

            if (hitObject && hitObject.name === 'target') {
                // The Death Lock: Prevents ghost-spawns
                if (!hitObject.userData.isDead) {
                    hitObject.userData.isDead = true;
                    recordHit(10);
                    if (hitObject.userData.onHit) {
                        hitObject.userData.onHit(hitObject.userData.id);
                    }
                }
            } else if (!hitObject || hitObject.name !== 'tracking-target') {
                // They fired, missed the blue static target, AND missed the orange tracking target
                recordMiss();
            }
        }
    });

    return (
        <>
            <PointerLockControls />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} />

            {/* For now, both managers run simultaneously so you can test them side-by-side */}
            <TargetManager />
            <TrackingManager />

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