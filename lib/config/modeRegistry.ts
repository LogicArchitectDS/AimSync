// lib/config/modeRegistry.ts

export interface DetailedModeSchema {
  id: string;
  name: string;
  description: string;
  supportsCombo: boolean; // Crucial layout flag
  baseTargetRadius: number;
  interactionType: 'CLICK' | 'HOVER_TRACK' | 'REACTION_FLASH';
  spawnBoundingBox: { minX: number; maxX: number; minY: number; maxY: number };
  targetCount: number; // For multi-target modes like Target Switch
  movementVelocity?: number; // Null or 0 for static modes
}

export type GameModeConfig = DetailedModeSchema;

const DEFAULT_BOUNDING_BOX = { minX: 0.05, maxX: 0.95, minY: 0.15, maxY: 0.95 };

export const GAME_MODES: Record<string, GameModeConfig> = {
  "static-flick": {
    id: "static-flick",
    name: "Static Flicking",
    description: "Classic snap-to-target drill with combo multipliers to build explosive muscle memory.",
    supportsCombo: true,
    baseTargetRadius: 35,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  },
  "tracking-mode": {
    id: "tracking-mode",
    name: "Continuous Tracking",
    description: "Keep your crosshair locked on a fluidly moving target to maximize time-on-target metrics.",
    supportsCombo: true,
    baseTargetRadius: 25,
    interactionType: "HOVER_TRACK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 3.2
  },
  "target-switch": {
    id: "target-switch",
    name: "Target Switching",
    description: "Train rapid transition speed and target discrimination by selecting hostiles amidst decoys.",
    supportsCombo: true,
    baseTargetRadius: 30,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 3,
    movementVelocity: 0
  },
  "burst-reaction": {
    id: "burst-reaction",
    name: "Burst Reaction",
    description: "Eliminate tight target clusters before the timeout window expires.",
    supportsCombo: true,
    baseTargetRadius: 28,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 4,
    movementVelocity: 0
  },
  "micro-adjust": {
    id: "micro-adjust",
    name: "Micro Adjust",
    description: "Flick to sub-pixel targets clustered closely together to refine precision tracking adjustments.",
    supportsCombo: true,
    baseTargetRadius: 15,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  },
  "flick-benchmark": {
    id: "flick-benchmark",
    name: "Flick Benchmark",
    description: "Standardized 60-second assessment drill to benchmark your baseline static flick tier rank.",
    supportsCombo: false,
    baseTargetRadius: 25,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  },
  "reaction-test": {
    id: "reaction-test",
    name: "Reaction Test",
    description: "Measure raw neurological visual-stimulus response latency in milliseconds.",
    supportsCombo: false,
    baseTargetRadius: 0,
    interactionType: "REACTION_FLASH",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 0,
    movementVelocity: 0
  },
  "echolocation": {
    id: "echolocation",
    name: "Echolocation",
    description: "Locate invisible targets using 3D spatial HRTF panner audio cues in a black void.",
    supportsCombo: true,
    baseTargetRadius: 40,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  },
  "cognitive-overdrive": {
    id: "cognitive-overdrive",
    name: "Cognitive Overdrive",
    description: "Discriminate and eliminate red hostile targets while avoiding moving blue civilian decoys.",
    supportsCombo: true,
    baseTargetRadius: 30,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  },
  "recoil-evasion": {
    id: "recoil-evasion",
    name: "Recoil Evasion",
    description: "Control sustained spray recoil patterns while tracking evasive hostiles.",
    supportsCombo: true,
    baseTargetRadius: 30,
    interactionType: "HOVER_TRACK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 1.5
  },
  "consistency-check": {
    id: "consistency-check",
    name: "Consistency Check",
    description: "A 3-minute endurance track evaluating fatigue and Stability Coefficient of Variation.",
    supportsCombo: false,
    baseTargetRadius: 25,
    interactionType: "HOVER_TRACK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 3.2
  },
  "sensitivity-finder": {
    id: "sensitivity-finder",
    name: "Sensitivity Finder",
    description: "A matrix-driven calibration routine to mathematically optimize mouse sensitivity.",
    supportsCombo: false,
    baseTargetRadius: 0,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  }
};

export const modeRegistry = GAME_MODES;

export function getModeConfig(modeId: string): GameModeConfig {
  const normalizedId = modeId.toLowerCase().replace(/_/g, "-");
  
  // Custom aliases to resolve underscore/dash variations
  if (normalizedId === "continuous-tracking" || normalizedId === "tracking-protocol") {
    return GAME_MODES["tracking-mode"];
  }
  if (normalizedId === "flick-benchmark") {
    return GAME_MODES["flick-benchmark"];
  }
  if (normalizedId === "reaction-test") {
    return GAME_MODES["reaction-test"];
  }
  if (normalizedId === "micro-adjust") {
    return GAME_MODES["micro-adjust"];
  }

  return GAME_MODES[normalizedId] || {
    id: modeId,
    name: modeId,
    description: "Unknown Training Drill",
    supportsCombo: false,
    baseTargetRadius: 30,
    interactionType: "CLICK",
    spawnBoundingBox: DEFAULT_BOUNDING_BOX,
    targetCount: 1,
    movementVelocity: 0
  };
}
