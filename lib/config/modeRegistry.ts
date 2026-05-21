// lib/config/modeRegistry.ts

export interface GameModeConfig {
  id: string;
  name: string;
  description: string;
  supportsCombo: boolean; // Crucial layout flag
  baseTargetRadius: number;
}

export const GAME_MODES: Record<string, GameModeConfig> = {
  "static-flick": {
    id: "static-flick",
    name: "Static Flicking",
    description: "Classic snap-to-target drill with combo multipliers to build explosive muscle memory.",
    supportsCombo: true,
    baseTargetRadius: 35
  },
  "tracking-mode": {
    id: "tracking-mode",
    name: "Continuous Tracking",
    description: "Keep your crosshair locked on a fluidly moving target to maximize time-on-target metrics.",
    supportsCombo: true,
    baseTargetRadius: 25
  },
  "target-switch": {
    id: "target-switch",
    name: "Target Switching",
    description: "Train rapid transition speed and target discrimination by selecting hostiles amidst decoys.",
    supportsCombo: true,
    baseTargetRadius: 30
  },
  "burst-reaction": {
    id: "burst-reaction",
    name: "Burst Reaction",
    description: "Eliminate tight target clusters before the timeout window expires.",
    supportsCombo: true,
    baseTargetRadius: 28
  },
  "micro-adjust": {
    id: "micro-adjust",
    name: "Micro Adjust",
    description: "Flick to sub-pixel targets clustered closely together to refine precision tracking adjustments.",
    supportsCombo: true,
    baseTargetRadius: 15
  },
  "flick-benchmark": {
    id: "flick-benchmark",
    name: "Flick Benchmark",
    description: "Standardized 60-second assessment drill to benchmark your baseline static flick tier rank.",
    supportsCombo: false,
    baseTargetRadius: 25
  },
  "reaction-test": {
    id: "reaction-test",
    name: "Reaction Test",
    description: "Measure raw neurological visual-stimulus response latency in milliseconds.",
    supportsCombo: false,
    baseTargetRadius: 0
  },
  "echolocation": {
    id: "echolocation",
    name: "Echolocation",
    description: "Locate invisible targets using 3D spatial HRTF panner audio cues in a black void.",
    supportsCombo: true,
    baseTargetRadius: 40
  },
  "cognitive-overdrive": {
    id: "cognitive-overdrive",
    name: "Cognitive Overdrive",
    description: "Discriminate and eliminate red hostile targets while avoiding moving blue civilian decoys.",
    supportsCombo: true,
    baseTargetRadius: 30
  },
  "recoil-evasion": {
    id: "recoil-evasion",
    name: "Recoil Evasion",
    description: "Control sustained spray recoil patterns while tracking evasive hostiles.",
    supportsCombo: true,
    baseTargetRadius: 30
  },
  "consistency-check": {
    id: "consistency-check",
    name: "Consistency Check",
    description: "A 3-minute endurance track evaluating fatigue and Stability Coefficient of Variation.",
    supportsCombo: false,
    baseTargetRadius: 25
  },
  "sensitivity-finder": {
    id: "sensitivity-finder",
    name: "Sensitivity Finder",
    description: "A matrix-driven calibration routine to mathematically optimize mouse sensitivity.",
    supportsCombo: false,
    baseTargetRadius: 0
  }
};

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
    baseTargetRadius: 30
  };
}
