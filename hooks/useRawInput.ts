/**
 * useRawInput.ts
 * 
 * A high-performance React hook that manages the Pointer Lock API and raw mouse input.
 * It reads unconstrained hardware mouse deltas (bypassing screen-edge boundaries)
 * and processes them using coalesced event aggregation.
 * Includes a low-overhead camera kick and decay solver using frame-rate independent
 * linear interpolation (lerp).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface UseRawInputOptions {
  sensitivity?: number;
  isEnabled?: boolean;
}

export function useRawInput({
  sensitivity = 1.0,
  isEnabled = true,
}: UseRawInputOptions = {}) {
  const { camera, gl } = useThree();
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  // Camera yaw (left/right) and pitch (up/down) in radians
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  // Recoil offsets applied on top of player's aim
  const recoilXRef = useRef(0);
  const recoilYRef = useRef(0);
  const recoilZRef = useRef(0);

  // Mouse move listener: accumulates hardware deltas
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isLockedRef.current || !isEnabled) return;

    let movementX = 0;
    let movementY = 0;

    // Use coalesced events to prevent sub-frame delta loss on high-Hz gaming mice
    const pe = e as PointerEvent;
    if (typeof pe.getCoalescedEvents === 'function') {
      const coalesced = pe.getCoalescedEvents();
      for (const evt of coalesced) {
        movementX += evt.movementX;
        movementY += evt.movementY;
      }
    } else {
      movementX = e.movementX;
      movementY = e.movementY;
    }

    // Multiply by a standard base sensitivity coefficient (0.00015 is standard for R3F radian rotation)
    const sensFactor = 0.00015 * sensitivity;
    yawRef.current -= movementX * sensFactor;
    pitchRef.current -= movementY * sensFactor;

    // Clamp pitch to prevent looking upside down (roughly -89 to 89 degrees)
    const maxPitch = Math.PI / 2 - 0.02;
    pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
  }, [sensitivity, isEnabled]);

  // Request Pointer Lock on user click
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !isLockedRef.current && isEnabled) {
        try {
          const promise = (canvas.requestPointerLock as any)({
            unadjustedMovement: true,
          });
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => canvas.requestPointerLock());
          }
        } catch {
          canvas.requestPointerLock();
        }
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setIsLocked(locked);
      isLockedRef.current = locked;

      // When locking, sync pitch/yaw refs to current camera state to prevent view jumps
      if (locked) {
        pitchRef.current = camera.rotation.x;
        yawRef.current = camera.rotation.y;
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl, camera, handleMouseMove, isEnabled]);

  // Expose function to add weapon kickback / camera shake
  const addRecoil = useCallback((kickX: number, kickY: number, kickZ: number = 0) => {
    if (!isLockedRef.current) return;
    recoilXRef.current += kickX;
    recoilYRef.current += kickY;
    recoilZRef.current += kickZ;
  }, []);

  // Frame-rate independent decay loop (using lerp)
  useFrame((state, delta) => {
    if (!isLockedRef.current) return;

    // Decay recoil offsets back to zero at a high rate (e.g. speed factor 18)
    const decaySpeed = 18.0;
    const t = Math.min(1.0, decaySpeed * delta);

    // lerp(current, target, ratio)
    recoilXRef.current = recoilXRef.current + (0 - recoilXRef.current) * t;
    recoilYRef.current = recoilYRef.current + (0 - recoilYRef.current) * t;
    recoilZRef.current = recoilZRef.current + (0 - recoilZRef.current) * t;

    // Enforce YXZ order for first-person camera gimbal security
    camera.rotation.order = 'YXZ';
    camera.rotation.x = pitchRef.current + recoilXRef.current;
    camera.rotation.y = yawRef.current + recoilYRef.current;
    camera.rotation.z = recoilZRef.current;
  });

  return {
    isLocked,
    addRecoil,
    yawRef,
    pitchRef,
  };
}
