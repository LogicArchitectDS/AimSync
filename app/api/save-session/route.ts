import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { distributeXp, computeSessionXp } from '@/lib/utils/statsService';

export const runtime = 'edge';

// Edge-aligned Cloudflare D1 database binding resolver
async function getDb(): Promise<any> {
    try {
        const db = (process.env as any).DB;
        if (db) return db;
        const { getRequestContext } = await import('@cloudflare/next-on-pages');
        return getRequestContext().env.DB;
    } catch {
        return null;
    }
}

// Edge-compatible HMAC-SHA256 signature generator
async function generateHmacSha256(message: string, secretKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const msgData = encoder.encode(message);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, msgData);
    return Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function POST(request: Request) {
    try {
        // 1. Session Guarding: Verify session exists and is cryptographically intact via NextAuth v5
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized. Please log in.' },
                { status: 401 }
            );
        }

        const actualUserId = session.user.id;
        const actualUserEmail = session.user.email || '';

        // 2. Parse Incoming Telemetry Headers
        const headerUserId = request.headers.get('x-user-id');
        const headerUserEmail = request.headers.get('x-user-email');
        const headerSignature = request.headers.get('x-session-signature');

        // 3. Cryptographic Matching: Check user signature
        const secret = process.env.AUTH_SECRET || 'fallback-secret-key-aimsync-dev-2026';
        const expectedSignature = await generateHmacSha256(actualUserId, secret);

        // 4. Parse JSON Payload
        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON payload' },
                { status: 400 }
            );
        }

        const bodyUserId = body.userId || body.user_id || body.userProfile?.id || body.user?.id;
        const bodyUserEmail = body.userEmail || body.user_email || body.userProfile?.email || body.user?.email;

        // 5. Deep Security Checks: Mismatch Cross-Validation
        let isAnomalyDetected = false;
        const mismatchReasons: string[] = [];

        // Validate headers (if sent)
        if (headerUserId && headerUserId !== actualUserId) {
            isAnomalyDetected = true;
            mismatchReasons.push(`Header User ID mismatch (session: "${actualUserId}", header: "${headerUserId}")`);
        }
        if (headerUserEmail && headerUserEmail !== actualUserEmail) {
            isAnomalyDetected = true;
            mismatchReasons.push(`Header Email mismatch (session: "${actualUserEmail}", header: "${headerUserEmail}")`);
        }

        // Validate cryptographic session signature
        if (!headerSignature) {
            isAnomalyDetected = true;
            mismatchReasons.push('Cryptographic session signature header is missing');
        } else if (headerSignature !== expectedSignature) {
            isAnomalyDetected = true;
            mismatchReasons.push('Cryptographic session signature header is invalid');
        }

        // Validate request body metadata
        if (bodyUserId && bodyUserId !== actualUserId) {
            isAnomalyDetected = true;
            mismatchReasons.push(`Payload User ID mismatch (session: "${actualUserId}", body: "${bodyUserId}")`);
        }
        if (bodyUserEmail && bodyUserEmail !== actualUserEmail) {
            isAnomalyDetected = true;
            mismatchReasons.push(`Payload Email mismatch (session: "${actualUserEmail}", body: "${bodyUserEmail}")`);
        }

        // 6. Lock down if anomaly detected
        if (isAnomalyDetected) {
            console.error(
                `[SECURITY LOCKDOWN - DEVCONSOLE SPOOFING BLOCKED] Active user ID: ${actualUserId}. Mismatches: ${mismatchReasons.join(' | ')}`
            );
            
            // DROP telemetry inputs entirely to protect the database integrity
            return NextResponse.json(
                {
                    success: false,
                    error: 'Forbidden. Session validation credentials mismatch. Anomaly flagged.',
                },
                { status: 403 }
            );
        }

        // 7. Telemetry Extraction
        const {
            protocol,
            score,
            shotsFired,
            accuracy,
            kps,
            durationSeconds,
            coordinates,
            missQuadrants,
        } = body as {
            protocol:        string;
            score:           number;
            shotsFired:      number;
            accuracy:        number;
            kps:             number;
            durationSeconds: number;
            coordinates?:    Array<{ dx?: number; dy?: number; x?: number; y?: number; targetX?: number; targetY?: number }>;
            missQuadrants?:  { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number };
        };

        const db = await getDb();
        if (!db) throw new Error('D1 Database binding not found.');

        // ── TIME-SYNC ANTI-CHEAT ─────────────────────────────────────────────
        // If a user sends >500 shots in >300 seconds, flag the score as
        // Low Integrity. Suspicious runs are stored but excluded from rankings.
        let isFlagged = 0;
        if (shotsFired > 500 && durationSeconds > 300) {
            isFlagged = 1;
            console.warn(`[Anti-Cheat] Flagged score from ${actualUserId}: ${shotsFired} shots in ${durationSeconds}s`);
        }

        // ── XP CALCULATION ───────────────────────────────────────────────────
        // Compute total session XP and split it across the 6 aim-factor columns.
        const totalXp = computeSessionXp(score);
        const xp      = distributeXp(protocol, totalXp);

        // ── QUADRANT ACCUMULATION & ROLLING AVERAGES ──────────────────────────
        let qTL = 0;
        let qTR = 0;
        let qBL = 0;
        let qBR = 0;

        if (coordinates && coordinates.length > 0) {
            let tl = 0, tr = 0, bl = 0, br = 0;
            for (const coord of coordinates) {
                let dx = 0;
                let dy = 0;
                if (coord.dx !== undefined && coord.dy !== undefined) {
                    dx = coord.dx;
                    dy = coord.dy;
                } else if (coord.x !== undefined && coord.y !== undefined && coord.targetX !== undefined && coord.targetY !== undefined) {
                    dx = coord.x - coord.targetX;
                    dy = coord.y - coord.targetY;
                } else {
                    continue;
                }

                if (dx < 0 && dy < 0) tl++;
                else if (dx >= 0 && dy < 0) tr++;
                else if (dx < 0 && dy >= 0) bl++;
                else if (dx >= 0 && dy >= 0) br++;
            }
            const total = tl + tr + bl + br;
            if (total > 0) {
                qTL = tl / total;
                qTR = tr / total;
                qBL = bl / total;
                qBR = br / total;
            }
        } else if (missQuadrants) {
            const tl = missQuadrants.topLeft || 0;
            const tr = missQuadrants.topRight || 0;
            const bl = missQuadrants.bottomLeft || 0;
            const br = missQuadrants.bottomRight || 0;
            const total = tl + tr + bl + br;
            if (total > 0) {
                qTL = tl / total;
                qTR = tr / total;
                qBL = bl / total;
                qBR = br / total;
            }
        }

        // ── D1 WRITES (Atomic) ───────────────────────────────────────────────
        // 1. Log the raw training session.
        await db.prepare(`
            INSERT INTO training_sessions
                (user_id, protocol, score, shots_fired, accuracy, kps, is_flagged,
                 quadrant_top_left, quadrant_top_right, quadrant_bottom_left, quadrant_bottom_right)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(actualUserId, protocol, score, shotsFired, accuracy, kps, isFlagged, qTL, qTR, qBL, qBR).run();

        // 2. Upsert the player_profiles row — atomically accumulate XP factors.
        //    ON CONFLICT targets the unique user_id primary key and adds the
        //    incremental XP from this session to every factor column.
        await db.prepare(`
            INSERT INTO player_profiles
                (user_id,
                 xp_flicking, xp_tracking, xp_speed,
                 xp_precision, xp_perception, xp_cognition,
                 total_xp, games_played, last_played_at,
                 quadrant_top_left, quadrant_top_right, quadrant_bottom_left, quadrant_bottom_right)
            VALUES
                (?,
                 ?, ?, ?,
                 ?, ?, ?,
                 ?, 1, CURRENT_TIMESTAMP,
                 ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                xp_flicking   = xp_flicking   + excluded.xp_flicking,
                xp_tracking   = xp_tracking   + excluded.xp_tracking,
                xp_speed      = xp_speed      + excluded.xp_speed,
                xp_precision  = xp_precision  + excluded.xp_precision,
                xp_perception = xp_perception + excluded.xp_perception,
                xp_cognition  = xp_cognition  + excluded.xp_cognition,
                total_xp      = total_xp      + excluded.total_xp,
                games_played  = games_played  + 1,
                last_played_at = CURRENT_TIMESTAMP,
                quadrant_top_left     = CASE WHEN games_played = 0 THEN excluded.quadrant_top_left ELSE (quadrant_top_left * 0.8 + excluded.quadrant_top_left * 0.2) END,
                quadrant_top_right    = CASE WHEN games_played = 0 THEN excluded.quadrant_top_right ELSE (quadrant_top_right * 0.8 + excluded.quadrant_top_right * 0.2) END,
                quadrant_bottom_left  = CASE WHEN games_played = 0 THEN excluded.quadrant_bottom_left ELSE (quadrant_bottom_left * 0.8 + excluded.quadrant_bottom_left * 0.2) END,
                quadrant_bottom_right = CASE WHEN games_played = 0 THEN excluded.quadrant_bottom_right ELSE (quadrant_bottom_right * 0.8 + excluded.quadrant_bottom_right * 0.2) END
        `).bind(
            actualUserId,
            xp.xpGainedFlicking,
            xp.xpGainedTracking,
            xp.xpGainedSpeed,
            xp.xpGainedPrecision,
            xp.xpGainedPerception,
            xp.xpGainedCognition,
            totalXp,
            qTL,
            qTR,
            qBL,
            qBR
        ).run();

        return NextResponse.json(
            { success: true, message: 'Session saved securely', xpAwarded: totalXp },
            { status: 200 },
        );

    } catch (error) {
        console.error('[AimSync DB Error]:', error);
        return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 });
    }
}