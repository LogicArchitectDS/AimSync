import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Force Next.js to use Cloudflare's Edge network for zero-latency database calls
export const runtime = 'edge';

// Helper: get D1 binding at runtime (checks process.env and fallback to getRequestContext)
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

// --- GET: Fetch player stats from Cloudflare D1 ---
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const history = searchParams.get('history') === 'true';

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
        // Not running on Cloudflare edge (local Next.js dev server).
        // Return a clean 503 so the dashboard can degrade gracefully without noise.
        return NextResponse.json({ error: 'D1 unavailable in local dev' }, { status: 503 });
    }

    try {
        if (history) {
            const result = await db
                .prepare('SELECT accuracy FROM scores_telemetry WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
                .bind(userId)
                .all();
            return NextResponse.json(result.results || []);
        }

        const result = await db
            .prepare('SELECT * FROM player_stats WHERE user_id = ?')
            .bind(userId)
            .first();

        if (!result) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('D1 GET Error:', error);
        return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }
}

// --- POST: Save telemetry, process level-up, milestone check and atomic write to Cloudflare D1 ---
export async function POST(request: Request) {
    // 1. Session Guarding: Ensure user is logged in
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Parse and normalize the incoming payload
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const exerciseId = body.exerciseId || body.exercise_id || 'unknown';
    const hits = typeof body.hits === 'number' ? body.hits : (body.rawScoreData?.hits ?? 0);
    const misses = typeof body.misses === 'number' ? body.misses : (body.rawScoreData?.misses ?? 0);
    const maxCombo = typeof body.maxCombo === 'number' ? body.maxCombo : (body.rawScoreData?.maxCombo ?? 0);
    const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : (body.rawScoreData?.durationSeconds ?? body.duration_seconds ?? 0);

    const totalTargets = hits + misses;
    const accuracy = totalTargets > 0 ? (hits / totalTargets) * 100 : 0;

    // 2. Input Anti-Cheat Validation
    const inputVelocity = durationSeconds > 0 ? (totalTargets / durationSeconds) : 0;
    let integrityFlag = 'HIGH_INTEGRITY';
    let xpEarned = 0;
    const baseXp = (hits * 10) + (maxCombo * 5);

    if (durationSeconds < 5 || inputVelocity > 15) {
        integrityFlag = 'LOW_INTEGRITY';
        xpEarned = 0;
    } else {
        xpEarned = baseXp;
    }

    const db = await getDb();

    // Local dev mock fallback if database is not bound
    if (!db) {
        const mockTotalXpBefore = 0;
        const mockLevelBefore = 1;
        const newTotalXp = mockTotalXpBefore + xpEarned;

        let level = mockLevelBefore;
        let tempXp = newTotalXp;
        while (tempXp >= 500 * (level * level)) {
            tempXp -= 500 * (level * level);
            level++;
        }

        const currentLevel = level;
        const currentXp = tempXp;
        const xpNeededForNext = 500 * (level * level);
        const levelUp = currentLevel > mockLevelBefore;

        return NextResponse.json({
            success: true,
            xpEarned,
            levelUp,
            currentLevel,
            currentXp,
            xpNeededForNext,
            mocked: true
        });
    }

    try {
        // Read current stats from D1
        const userProgress = await db.prepare(
            "SELECT current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked FROM user_progression WHERE user_id = ?"
        ).bind(userId).first();

        let oldLevel = 1;
        let oldTotalXp = 0;
        let oldSurgeon = 0;
        let oldVector = 0;

        if (userProgress) {
            oldLevel = Number(userProgress.current_level) || 1;
            oldTotalXp = Number(userProgress.total_xp) || 0;
            oldSurgeon = Number(userProgress.surgeon_badge_unlocked) || 0;
            oldVector = Number(userProgress.vector_lock_badge_unlocked) || 0;
        }

        // Milestone Badge Checklist
        const normId = exerciseId.toLowerCase().replace(/_/g, '-');
        const isMicroAdjust = normId === 'micro-adjust' || normId === 'micro_adjust';
        const isTracking = normId === 'continuous-tracking' || normId === 'continuous_tracking' || normId === 'tracking-mode' || normId === 'tracking_mode' || normId === 'tracking-protocol';

        let surgeonBadgeUnlocked = oldSurgeon;
        if (isMicroAdjust && accuracy >= 98 && totalTargets >= 50) {
            surgeonBadgeUnlocked = 1;
        }

        let vectorLockBadgeUnlocked = oldVector;
        if (isTracking && accuracy >= 90) {
            vectorLockBadgeUnlocked = 1;
        }

        // Quadratic Level Math Engine
        const newTotalXp = oldTotalXp + xpEarned;
        let level = 1;
        let tempXp = newTotalXp;
        while (tempXp >= 500 * (level * level)) {
            tempXp -= 500 * (level * level);
            level++;
        }

        const currentLevel = level;
        const currentXp = tempXp;
        const xpNeededForNext = 500 * (level * level);
        const levelUp = currentLevel > oldLevel;

        // Atomic D1 Execution
        const stmtTelemetry = db.prepare(`
            INSERT INTO scores_telemetry (user_id, exercise_id, hits, misses, accuracy, max_combo, duration_seconds, xp_earned, integrity_flag)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(userId, exerciseId, hits, misses, accuracy, maxCombo, durationSeconds, xpEarned, integrityFlag);

        const stmtProgression = db.prepare(`
            INSERT INTO user_progression (user_id, current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                current_level = excluded.current_level,
                total_xp = excluded.total_xp,
                surgeon_badge_unlocked = excluded.surgeon_badge_unlocked,
                vector_lock_badge_unlocked = excluded.vector_lock_badge_unlocked,
                updated_at = CURRENT_TIMESTAMP
        `).bind(userId, currentLevel, newTotalXp, surgeonBadgeUnlocked, vectorLockBadgeUnlocked);

        await db.batch([stmtTelemetry, stmtProgression]);

        return NextResponse.json({
            success: true,
            xpEarned,
            levelUp,
            currentLevel,
            currentXp,
            xpNeededForNext
        });

    } catch (error) {
        console.error('D1 POST Telemetry/Progression Error:', error);
        return NextResponse.json({ error: 'Database operations failed' }, { status: 500 });
    }
}