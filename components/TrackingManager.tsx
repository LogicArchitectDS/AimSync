'use client';

import TrackingTarget from './TrackingTarget';

export default function TrackingManager({ targetScale = 1 }: { targetScale?: number }) {
    // Tracking mode usually features a single, highly evasive target
    return (
        <>
            <TrackingTarget id="alpha-tracker" baseDistance={-15} />
        </>
    );
}