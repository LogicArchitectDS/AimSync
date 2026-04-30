// lib/game/tasks.ts

export type AimFactor = 'flicking' | 'tracking' | 'speed' | 'precision' | 'perception' | 'cognition';
export type TaskType = 'daily' | 'weekly';
export type TaskObjective = 'play_rounds' | 'destroy_targets' | 'accuracy_threshold' | 'kps_threshold' | 'reaction_time';

export interface Task {
    id: string;
    type: TaskType;
    title: string;
    objective: TaskObjective;
    targetProtocol: string; // e.g., 'static-flick', 'reaction-test', or 'any'
    targetValue: number;
    rewardFactor: AimFactor; // Which of the 6 pillars this levels up!
    xpReward: number;
}

export const DAILY_TASKS: Task[] = [
    { id: 'd_flick_master', type: 'daily', title: 'Destroy 250 targets in Static Flick', objective: 'destroy_targets', targetProtocol: 'static-flick', targetValue: 250, rewardFactor: 'flicking', xpReward: 200 },
    { id: 'd_hawk_eye', type: 'daily', title: 'Maintain >90% Accuracy', objective: 'accuracy_threshold', targetProtocol: 'any', targetValue: 90, rewardFactor: 'precision', xpReward: 150 },
    { id: 'd_neuron_fire', type: 'daily', title: 'Score sub-180ms on Reaction Test', objective: 'reaction_time', targetProtocol: 'reaction-test', targetValue: 180, rewardFactor: 'perception', xpReward: 250 },
];