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
        { subject: 'Flicking', level: 1 },
        { subject: 'Tracking', level: 1 },
        { subject: 'Speed', level: 1 },
        { subject: 'Precision', level: 1 },
        { subject: 'Perception', level: 1 },
        { subject: 'Cognition', level: 1 },
    ];

    if (!userId || userId === 'undefined' || userId === 'local' || userId === 'null') {
        return NextResponse.json(defaultData);
    }

    const db = await getDb();
    if (!db) {
        // Local Next.js development server fallback representation
        return NextResponse.json([
            { subject: 'Flicking', level: 12 },
            { subject: 'Tracking', level: 18 },
            { subject: 'Speed', level: 25 },
            { subject: 'Precision', level: 15 },
            { subject: 'Perception', level: 20 },
            { subject: 'Cognition', level: 22 },
        ]);
    }

    try {
        // Query the D1 telemetry database for the user's exercises
        const result = await db
            .prepare('SELECT exercise_id, hits, xp_earned FROM scores_telemetry WHERE user_id = ?')
            .bind(userId)
            .all();

        const rows = result.results || [];

        let flickingXp = 0;
        let trackingXp = 0;
        let speedXp = 0;
        let precisionXp = 0;
        let perceptionXp = 0;
        let cognitionXp = 0;

        // Distribute XP into the 6 aim factors based on training records
        for (const row of rows) {
            const exercise = (row.exercise_id || 'unknown').toLowerCase().replace(/_/g, '-');
            const sessionXp = Number(row.xp_earned) || (Number(row.hits) * 10);
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

        // Return compiled levels in JSON array structure
        return NextResponse.json([
            { subject: 'Flicking', level: getLevelFromXp(flickingXp), fullMark: 100 },
            { subject: 'Tracking', level: getLevelFromXp(trackingXp), fullMark: 100 },
            { subject: 'Speed', level: getLevelFromXp(speedXp), fullMark: 100 },
            { subject: 'Precision', level: getLevelFromXp(precisionXp), fullMark: 100 },
            { subject: 'Perception', level: getLevelFromXp(perceptionXp), fullMark: 100 },
            { subject: 'Cognition', level: getLevelFromXp(cognitionXp), fullMark: 100 },
        ]);

    } catch (error) {
        console.error('D1 GET stats Error:', error);
        return NextResponse.json({ error: 'Database stats fetch failed' }, { status: 500 });
    }
}
