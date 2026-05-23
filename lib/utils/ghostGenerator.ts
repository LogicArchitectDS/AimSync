// lib/utils/ghostGenerator.ts

import type { GhostRecord } from "./ghostCompression";

/**
 * Generates a realistic, human-looking procedural ghost telemetry file.
 * Simulates mouse movement between target spawns with reaction delay,
 * acceleration, overshoot/micro-corrections, and hand tremors.
 */
export function generateProceduralGhost(
  modeId: string,
  difficulty: string,
  username: string,
  targetScore: number,
  durationSeconds: number = 30
): GhostRecord {
  const gameDurationMs = durationSeconds * 1000;
  
  // Calculate average target hit count based on the score
  // Static Flick hit = 10 pts, plus combo bonus. Let's estimate hit rate.
  let targetHits = Math.max(15, Math.min(180, Math.ceil(targetScore / 13)));
  
  // Eco difficulty hits are slower, Full Buy is faster. Let's adjust slightly.
  const diffLower = difficulty.toLowerCase();
  if (diffLower === "eco") targetHits = Math.min(targetHits, 45);
  else if (diffLower === "full-buy") targetHits = Math.max(targetHits, 70);

  const hitInterval = gameDurationMs / (targetHits + 1);
  
  const targets: { x: number; y: number; radius: number }[] = [];
  const path: [number, number, number][] = [];
  const hits: { x: number; y: number; t: number }[] = [];

  // Start position
  let prevX = 500;
  let prevY = 500;
  path.push([prevX, prevY, 0]);

  for (let i = 0; i < targetHits; i++) {
    // Generate target position (normalized 0..1000)
    const targetX = Math.round(150 + Math.random() * 700);
    const targetY = Math.round(200 + Math.random() * 600);
    const targetRadius = 30; // standard radius in normalized units

    targets.push({ x: targetX, y: targetY, radius: targetRadius });

    const spawnTime = i * hitInterval;
    // Human reaction time: 140ms - 260ms
    const reactionTime = 140 + Math.random() * 100;
    const hitTime = spawnTime + reactionTime + (100 + Math.random() * 150); // total flick time

    // Ensure hitTime fits in game
    if (hitTime >= gameDurationMs) break;

    // Generate path points from prev position to target position
    const startTime = spawnTime;
    const flickDuration = hitTime - startTime;
    const steps = Math.floor(flickDuration / 30); // sample every 30ms

    // Add a random overshoot offset for human error simulation
    const overshootX = (Math.random() - 0.5) * 40;
    const overshootY = (Math.random() - 0.5) * 40;

    for (let s = 1; s <= steps; s++) {
      const tRatio = s / steps;
      const tCurr = startTime + tRatio * flickDuration;

      // Cosine ease-in-out interpolation for natural velocity curve
      const ease = (1 - Math.cos(tRatio * Math.PI)) / 2;

      let currX = prevX + (targetX - prevX) * ease;
      let currY = prevY + (targetY - prevY) * ease;

      // Add human elements:
      // 1. Overshoot that corrects near the end
      if (tRatio < 0.8) {
        const overshootScale = Math.sin(tRatio * Math.PI / 0.8);
        currX += overshootX * overshootScale;
        currY += overshootY * overshootScale;
      }
      
      // 2. Micro hand tremors (sinusoidal wobble)
      currX += Math.sin(tCurr * 0.08) * 1.5;
      currY += Math.cos(tCurr * 0.07) * 1.5;

      path.push([Math.round(currX), Math.round(currY), Math.round(tCurr)]);
    }

    // Lock cursor at final hit position
    path.push([targetX, targetY, Math.round(hitTime)]);
    hits.push({ x: targetX, y: targetY, t: Math.round(hitTime) });

    // Store current position as previous
    prevX = targetX;
    prevY = targetY;
  }

  // Pad the rest of the game with idle jitter if timeline has remaining time
  const lastTime = path.length > 0 ? path[path.length - 1][2] : 0;
  if (lastTime < gameDurationMs) {
    const padSteps = Math.floor((gameDurationMs - lastTime) / 100);
    for (let s = 1; s <= padSteps; s++) {
      const padTime = lastTime + s * 100;
      const jitterX = prevX + (Math.random() - 0.5) * 2;
      const jitterY = prevY + (Math.random() - 0.5) * 2;
      path.push([Math.round(jitterX), Math.round(jitterY), padTime]);
    }
  }

  return {
    modeId,
    difficulty,
    score: targetScore,
    username,
    targets,
    path,
    hits,
  };
}

/**
 * Returns a list of default mock pro rivals for a given mode and difficulty.
 */
export function getMockProRivals(
  modeId: string,
  difficulty: string
): { username: string; score: number }[] {
  const diffLower = difficulty.toLowerCase();
  
  // Base scale factor based on difficulty
  let scale = 1.0;
  if (diffLower === "eco") scale = 0.6;
  else if (diffLower === "bonus") scale = 0.9;
  else if (diffLower === "force-buy") scale = 1.2;
  else if (diffLower === "full-buy") scale = 1.5;

  return [
    { username: "Average Joe 🎯", score: Math.round(1100 * scale) },
    { username: "AimBotz Trainee 🤖", score: Math.round(1450 * scale) },
    { username: "s1mple 🔫", score: Math.round(2100 * scale) },
    { username: "TenZ 👽", score: Math.round(2600 * scale) },
    { username: "shroud 🐐", score: Math.round(2950 * scale) },
  ];
}
