// lib/game/modeRegistry.ts

export interface ModeConfig {
    id: string;
    name: string;
    supportsCombo: boolean;
}

export const GAME_MODES: Record<string, ModeConfig> = {
    "static-flick": { id: "static-flick", name: "Static Flick", supportsCombo: true },
    "tracking-mode": { id: "tracking-mode", name: "Continuous Tracking", supportsCombo: true },
    "target-switch": { id: "target-switch", name: "Target Switch", supportsCombo: true },
    "burst-reaction": { id: "burst-reaction", name: "Burst Reaction", supportsCombo: true },
    "micro-adjust": { id: "micro-adjust", name: "Micro Adjust", supportsCombo: true },
    "sensitivity-finder": { id: "sensitivity-finder", name: "Sens Matrix", supportsCombo: false },
    "consistency-check": { id: "consistency-check", name: "Consistency Check", supportsCombo: false },
    "custom-routine": { id: "custom-routine", name: "Custom Routine", supportsCombo: false },
    "flick-benchmark": { id: "flick-benchmark", name: "Flick Benchmark", supportsCombo: false },
    "reaction-test": { id: "reaction-test", name: "Reaction Test", supportsCombo: false },
    "echolocation": { id: "echolocation", name: "Echolocation", supportsCombo: true },
    "cognitive-overdrive": { id: "cognitive-overdrive", name: "Cognitive Overdrive", supportsCombo: true },
    "recoil-evasion": { id: "recoil-evasion", name: "Recoil Evasion", supportsCombo: true },
};

export function getModeConfig(modeId: string): ModeConfig {
    return GAME_MODES[modeId] || { id: modeId, name: modeId, supportsCombo: false };
}
