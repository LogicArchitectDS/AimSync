/**
 * lib/hooks/useKinematicsTracker.ts
 *
 * High-frequency kinematic telemetry tracker for clicking-centric game modes
 * (StaticFlick, FlickBenchmark).
 *
 * Design Constraints:
 *  - ALL data is stored in useRef dictionaries — no React setState calls.
 *  - Mouse-move callbacks push path points directly into refs, never triggering
 *    a re-render or stalling the 144Hz canvas draw loop.
 *  - Calculation functions are pure and invoked exactly once, at click-time,
 *    on demand — not on every frame.
 */

import { useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TargetKinematics {
  /** performance.now() at target spawn */
  spawnTime: number;
  /** performance.now() when first mouse movement was detected after spawn */
  firstMoveTime: number | null;
  /** Peak instantaneous velocity (px/ms) observed during this target's lifetime */
  peakVelocity: number;
  /** performance.now() when velocity first dropped below peakVelocity * 0.4 (deceleration start) */
  decelerationStartTime: number | null;
  /** performance.now() when click was registered */
  clickTime: number | null;
  /** Straight-line Euclidean distance from cursor to target at spawn (px) */
  initialDistance: number;
  /** Timestamped path sample points, updated on every mousemove event */
  pathPoints: { x: number; y: number; t: number }[];
}

export interface KinematicResult {
  /** UI = AdjustmentWindow / (ReactionWindow + 1) */
  urgencyIndex: number;
  /**
   * OFC = cumulativePathDistance / initialDistance
   * > 1.0 means the mouse traveled farther than a straight-line flick.
   * > 1.15 = confirmed over-flicking pattern.
   */
  overFlickCoefficient: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKinematicsTracker() {
  /**
   * Dictionary of in-flight target kinematic logs, keyed by target ID.
   * Cleared on each new session begin.
   */
  const targetLogRef = useRef<Record<string, TargetKinematics>>({});

  /** Last known cursor position — used to compute inter-sample velocity */
  const lastMouseRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // ─── Session lifecycle ──────────────────────────────────────────────────────

  /** Call at session start to wipe all stale data from any previous run. */
  const resetTracker = () => {
    targetLogRef.current = {};
    lastMouseRef.current = null;
  };

  // ─── Target lifecycle ───────────────────────────────────────────────────────

  /**
   * Register a newly spawned target.
   * @param targetId  Unique target ID string
   * @param targetX   Target centre X in canvas coordinates (px)
   * @param targetY   Target centre Y in canvas coordinates (px)
   * @param cursorX   Current cursor X (px)
   * @param cursorY   Current cursor Y (px)
   */
  const registerTargetSpawn = (
    targetId: string,
    targetX: number,
    targetY: number,
    cursorX: number,
    cursorY: number
  ) => {
    const dx = targetX - cursorX;
    const dy = targetY - cursorY;
    const initialDistance = Math.sqrt(dx * dx + dy * dy) || 1; // guard /0

    targetLogRef.current[targetId] = {
      spawnTime: performance.now(),
      firstMoveTime: null,
      peakVelocity: 0,
      decelerationStartTime: null,
      clickTime: null,
      initialDistance,
      pathPoints: [{ x: cursorX, y: cursorY, t: performance.now() }],
    };
  };

  /**
   * Feed a raw mouse-move event into the active target's kinematic log.
   * This is the hot path — keep it branch-minimal.
   *
   * @param targetId  The currently active target ID
   * @param x         New cursor X (canvas px)
   * @param y         New cursor Y (canvas px)
   */
  const recordMouseMove = (targetId: string, x: number, y: number) => {
    const entry = targetLogRef.current[targetId];
    if (!entry) return;

    const t = performance.now();

    // ── First-move detection ─────────────────────────────────────────────────
    if (entry.firstMoveTime === null) {
      entry.firstMoveTime = t;
    }

    // ── Instantaneous velocity (px/ms) ──────────────────────────────────────
    const last = entry.pathPoints[entry.pathPoints.length - 1];
    const dt = t - last.t;

    if (dt > 0) {
      const dx = x - last.x;
      const dy = y - last.y;
      const v = Math.sqrt(dx * dx + dy * dy) / dt;

      if (v > entry.peakVelocity) {
        entry.peakVelocity = v;
      } else if (
        entry.decelerationStartTime === null &&
        entry.peakVelocity > 0 &&
        v < entry.peakVelocity * 0.4
      ) {
        // Velocity dropped to less than 40% of peak → deceleration phase begun
        entry.decelerationStartTime = t;
      }
    }

    // ── Append path point ────────────────────────────────────────────────────
    // Downsample to at most one point per ~2ms to keep the array bounded
    // while still capturing the full trajectory shape.
    if (dt >= 2) {
      entry.pathPoints.push({ x, y, t });
    }
  };

  /**
   * Finalise the log when a valid hit click is registered, then compute
   * and return the kinematic diagnostics for this target.
   *
   * Returns null if data is insufficient (e.g. target was instantly clicked).
   */
  const computeOnHit = (targetId: string): KinematicResult | null => {
    const entry = targetLogRef.current[targetId];
    if (!entry) return null;

    entry.clickTime = performance.now();

    // ── Guard: need at least two path points ────────────────────────────────
    if (entry.pathPoints.length < 2 || entry.firstMoveTime === null) {
      delete targetLogRef.current[targetId];
      return null;
    }

    // ── Urgency Index ────────────────────────────────────────────────────────
    // ReactionWindow: from spawn to first observed movement
    const reactionWindow = entry.firstMoveTime - entry.spawnTime;
    // AdjustmentWindow: from deceleration start to click
    const decStart = entry.decelerationStartTime ?? entry.firstMoveTime;
    const adjustmentWindow = entry.clickTime - decStart;
    const urgencyIndex = adjustmentWindow / (reactionWindow + 1);

    // ── Over-Flicking Coefficient ────────────────────────────────────────────
    // Cumulative physical path length
    let cumulativeDistance = 0;
    for (let i = 1; i < entry.pathPoints.length; i++) {
      const dx = entry.pathPoints[i].x - entry.pathPoints[i - 1].x;
      const dy = entry.pathPoints[i].y - entry.pathPoints[i - 1].y;
      cumulativeDistance += Math.sqrt(dx * dx + dy * dy);
    }
    const overFlickCoefficient = cumulativeDistance / entry.initialDistance;

    // Clean up — target is done
    delete targetLogRef.current[targetId];

    return {
      urgencyIndex: Math.max(0, parseFloat(urgencyIndex.toFixed(3))),
      overFlickCoefficient: Math.max(1, parseFloat(overFlickCoefficient.toFixed(3))),
    };
  };

  /** Discard data for a target that expired without a hit (timeout/miss). */
  const discardTarget = (targetId: string) => {
    delete targetLogRef.current[targetId];
  };

  return {
    resetTracker,
    registerTargetSpawn,
    recordMouseMove,
    computeOnHit,
    discardTarget,
  };
}
