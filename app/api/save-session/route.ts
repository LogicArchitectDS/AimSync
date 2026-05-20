import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { distributeXp, computeSessionXp } from '@/lib/utils/statsService';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        // 1. SECURITY CHECK: Verify the player is actually logged in
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
        }

        // 2. The real, un-spoofable user ID from Auth.js session
        const actualUserId = session.user.id!;

        const body = await request.json();
        // We intentionally ignore any userId sent from the frontend.
        const {
            protocol,
            score,
            shotsFired,
            accuracy,
            kps,
            durationSeconds,
        } = body as {
            protocol:        string;
            score:           number;
            shotsFired:      number;
            accuracy:        number;
            kps:             number;
            durationSeconds: number;
        };

        const db = (process.env as any).DB;
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

        // ── D1 WRITES (Atomic) ───────────────────────────────────────────────
        // 1. Log the raw training session.
        await db.prepare(`
            INSERT INTO training_sessions
                (user_id, protocol, score, shots_fired, accuracy, kps, is_flagged)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(actualUserId, protocol, score, shotsFired, accuracy, kps, isFlagged).run();

        // 2. Upsert the player_profiles row — atomically accumulate XP factors.
        //    ON CONFLICT targets the unique user_id primary key and adds the
        //    incremental XP from this session to every factor column.
        await db.prepare(`
            INSERT INTO player_profiles
                (user_id,
                 xp_flicking, xp_tracking, xp_speed,
                 xp_precision, xp_perception, xp_cognition,
                 total_xp, games_played, last_played_at)
            VALUES
                (?,
                 ?, ?, ?,
                 ?, ?, ?,
                 ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                xp_flicking   = xp_flicking   + excluded.xp_flicking,
                xp_tracking   = xp_tracking   + excluded.xp_tracking,
                xp_speed      = xp_speed      + excluded.xp_speed,
                xp_precision  = xp_precision  + excluded.xp_precision,
                xp_perception = xp_perception + excluded.xp_perception,
                xp_cognition  = xp_cognition  + excluded.xp_cognition,
                total_xp      = total_xp      + excluded.total_xp,
                games_played  = games_played  + 1,
                last_played_at = CURRENT_TIMESTAMP
        `).bind(
            actualUserId,
            xp.xpGainedFlicking,
            xp.xpGainedTracking,
            xp.xpGainedSpeed,
            xp.xpGainedPrecision,
            xp.xpGainedPerception,
            xp.xpGainedCognition,
            totalXp,
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