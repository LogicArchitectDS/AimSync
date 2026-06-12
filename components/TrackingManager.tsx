'use client';

import TrackingTarget from './TrackingTarget';

export default function TrackingManager({
    targetScale = 1,
    activeMode = 'continuous-track',
}: {
    targetScale?: number;
    activeMode?: string;
}) {
    // Tracking mode features a single target; recoil evasion will alter its physics
    return (
        <>
            <TrackingTarget id="alpha-tracker" baseDistance={-15} activeMode={activeMode} />
        </>
    );
}