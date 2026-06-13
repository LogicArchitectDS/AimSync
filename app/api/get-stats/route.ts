import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Force Next.js to use Cloudflare's Edge network for edge execution
export const runtime = 'edge';

// Helper to retrieve Cloudflare D1 database binding
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

// Converts raw category XP to discrete level
function getLevelFromXp(xp: number): number {
    if (xp < 0) return 1;
    return Math.floor(Math.sqrt(xp / 500)) + 1;
}

export async function GET(request: Request) {
    const session = await auth();
    let userId = session?.user?.id;

    // Allow manual parameter query override for flexibility/debugging
    if (!userId) {
        const { searchParams } = new URL(request.url);
        userId = searchParams.get('userId') || undefined;
    }

    // Baseline structure if no user session is present
    const defaultData = [
        { subject: 'Flicking', level: 1, fullMark: 100 },
        { subject: 'Tracking', level: 1, fullMark: 100 },
        { subject: 'Speed', level: 1, fullMark: 100 },
        { subject: 'Precision', level: 1, fullMark: 100 },
        { subject: 'Perception', level: 1, fullMark: 100 },
        { subject: 'Cognition', level: 1, fullMark: 100 },
    ];

    if (!userId || userId === 'undefined' || userId === 'local' || userId === 'null') {
        return NextResponse.json(defaultData);
    }

    const db = await getDb();
    if (!db) {
        // Local Next.js development server fallback representation
        return NextResponse.json([
            { subject: 'Flicking', level: 12, fullMark: 100 },
            { subject: 'Tracking', level: 18, fullMark: 100 },
            { subject: 'Speed', level: 25, fullMark: 100 },
            { subject: 'Precision', level: 15, fullMark: 100 },
            { subject: 'Perception', level: 20, fullMark: 100 },
            { subject: 'Cognition', level: 22, fullMark: 100 },
        ]);
    }

    try {
        // 1. Direct fetch from optimized player_profiles table
        let profile = await db
            .prepare('SELECT xp_flicking, xp_tracking, xp_speed, xp_precision, xp_perception, xp_cognition FROM player_profiles WHERE user_id = ?')
            .bind(userId)
            .first();

        // 2. Fallback: Aggregate scores_telemetry dynamically at the database level if profiles aren't seeded yet
        if (!profile) {
            const result = await db
                .prepare('SELECT exercise_id, SUM(xp_earned) as total_xp FROM scores_telemetry WHERE user_id = ? AND integrity_flag = \'HIGH_INTEGRITY\' GROUP BY exercise_id')
                .bind(userId)
                .all();

            const rows = result.results || [];
            let flickingXp = 0;
            let trackingXp = 0;
            let speedXp = 0;
            let precisionXp = 0;
            let perceptionXp = 0;
            let cognitionXp = 0;

            for (const row of rows) {
                const exercise = (row.exercise_id || 'unknown').toLowerCase().replace(/_/g, '-');
                const sessionXp = Number(row.total_xp) || 0;
                const primaryXp = Math.floor(sessionXp * 0.70);
                const secondaryXp = Math.floor(sessionXp * 0.30);

                switch (exercise) {
                    case 'static-flick':
                    case 'flick-benchmark':
                    case 'blind-flick':
                        precisionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'tracking-mode':
                    case 'continuous-track':
                    case 'recoil-evasion':
                    case 'recoil-reactive':
                    case 'consistency-check':
                        trackingXp += primaryXp;
                        perceptionXp += secondaryXp;
                        break;
                    case 'reaction-test':
                    case 'cognition-react':
                        speedXp += primaryXp;
                        perceptionXp += secondaryXp;
                        break;
                    case 'target-switch':
                    case 'cognitive-overdrive':
                        cognitionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'micro-adjust':
                    case 'micro-precision':
                        precisionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'burst-reaction':
                    case 'jiggle-peek':
                        speedXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    case 'echolocation':
                        perceptionXp += primaryXp;
                        flickingXp += secondaryXp;
                        break;
                    default:
                        precisionXp += sessionXp;
                }
            }

            profile = {
                xp_flicking: flickingXp,
                xp_tracking: trackingXp,
                xp_speed: speedXp,
                xp_precision: precisionXp,
                xp_perception: perceptionXp,
                xp_cognition: cognitionXp
            };
        }

        // Return compiled levels in JSON array structure
        return NextResponse.json([
            { subject: 'Flicking', level: getLevelFromXp(profile.xp_flicking || 0), fullMark: 100 },
            { subject: 'Tracking', level: getLevelFromXp(profile.xp_tracking || 0), fullMark: 100 },
            { subject: 'Speed', level: getLevelFromXp(profile.xp_speed || 0), fullMark: 100 },
            { subject: 'Precision', level: getLevelFromXp(profile.xp_precision || 0), fullMark: 100 },
            { subject: 'Perception', level: getLevelFromXp(profile.xp_perception || 0), fullMark: 100 },
            { subject: 'Cognition', level: getLevelFromXp(profile.xp_cognition || 0), fullMark: 100 },
        ]);

    } catch (error) {
        console.error('D1 GET stats Error:', error);
        return NextResponse.json({ error: 'Database stats fetch failed' }, { status: 500 });
    }
}
