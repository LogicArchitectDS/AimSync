'use client';

import TrackingTarget from './TrackingTarget';

export default function TrackingManager() {
    // Tracking mode usually features a single, highly evasive target
    return (
        <>
            <TrackingTarget id="alpha-tracker" baseDistance={-15} />
        </>
    );
}