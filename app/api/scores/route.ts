import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLevelFromXp, getXpProgressWithinLevel } from '@/lib/utils/progressionEngine';

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

    if (!userId || userId === 'undefined' || userId === 'local' || userId === 'null') {
        return NextResponse.json(history ? [] : {
            total_games: 0,
            time_played: 0,
            global_accuracy: 0,
            modes_data: '{}',
            playlists: '[]',
            last_played_at: new Date().toISOString()
        });
    }

    const db = await getDb();
    if (!db) {
        // Not running on Cloudflare edge (local Next.js dev server).
        // Return a clean 200 with default mock/empty structure to keep the developer console silent.
        return NextResponse.json(history ? [] : {
            total_games: 0,
            time_played: 0,
            global_accuracy: 0,
            modes_data: '{}',
            playlists: '[]',
            last_played_at: new Date().toISOString()
        });
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
    // Parse and normalize the incoming payload
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 1. Session Guarding: Ensure user is logged in (and not a trial guest)
    const session = await auth();
    const isTrialUser = body.isTrial === true || !session || !session.user || !session.user.id || session.user.id === 'guest' || session.user.id === 'trial' || session.user.id === 'local';

    if (isTrialUser || !session || !session.user || !session.user.id) {
        // Return a mock response, short-circuiting database execution and leveling triggers
        return NextResponse.json({
            success: true,
            xpEarned: 0,
            levelUp: false,
            currentLevel: 1,
            currentXp: 0,
            xpNeededForNext: 500,
            mocked: true
        });
    }

    const userId = session.user.id;

    if (body.stats) {
        const db = await getDb();
        if (!db) {
            return NextResponse.json({ success: true, mocked: true });
        }
        try {
            await db.prepare(`
                INSERT INTO player_stats (user_id, global_accuracy, total_games, time_played, modes_data, playlists, miss_quadrants, last_played_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    global_accuracy = excluded.global_accuracy,
                    total_games = excluded.total_games,
                    time_played = excluded.time_played,
                    modes_data = excluded.modes_data,
                    playlists = excluded.playlists,
                    miss_quadrants = excluded.miss_quadrants,
                    last_played_at = CURRENT_TIMESTAMP
            `).bind(
                userId,
                body.stats.globalAccuracy || 0,
                body.stats.totalGamesPlayed || 0,
                body.stats.timePlayedSeconds || 0,
                JSON.stringify(body.stats.modes || {}),
                JSON.stringify(body.stats.playlists || []),
                JSON.stringify(body.stats.missQuadrants || {})
            ).run();
            return NextResponse.json({ success: true });
        } catch (error) {
            console.error('D1 sync stats error:', error);
            return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
        }
    }

    const exerciseId = body.exerciseId || body.exercise_id || 'unknown';
    const hits = typeof body.hits === 'number' ? body.hits : (body.rawScoreData?.hits ?? 0);
    const misses = typeof body.misses === 'number' ? body.misses : (body.rawScoreData?.misses ?? 0);
    const maxCombo = typeof body.maxCombo === 'number' ? body.maxCombo : (body.rawScoreData?.maxCombo ?? 0);
    const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : (body.rawScoreData?.durationSeconds ?? body.duration_seconds ?? 0);
    // Advanced kinematic telemetry (StaticFlick / FlickBenchmark only; defaults to 1.0 for other modes)
    const averageUrgencyIndex   = typeof body.averageUrgencyIndex   === 'number' ? body.averageUrgencyIndex   : 1.0;
    const overFlickCoefficient  = typeof body.overFlickCoefficient  === 'number' ? body.overFlickCoefficient  : 1.0;
    const difficulty            = body.difficulty || "medium";
    const username              = session.user.name || session.user.email || "Player";
    const ghostTelemetry        = body.ghostTelemetry || body.ghost_telemetry || null;
    const missQuadrants         = body.missQuadrants || body.miss_quadrants || null;
    const neuralStabilityScore  = typeof body.neuralStabilityScore === 'number' ? body.neuralStabilityScore : null;

    const totalTargets = hits + misses;
    const accuracyFraction = totalTargets > 0 ? (hits / totalTargets) : 0;
    const accuracy = accuracyFraction * 100;

    // 2. Input Anti-Cheat & Telemetry Progression Validation
    const inputVelocity = durationSeconds > 0 ? (totalTargets / durationSeconds) : 0;
    const isArithmeticProgression = checkArithmeticProgression(ghostTelemetry);
    const isFlagged = (durationSeconds < 5 || inputVelocity > 15 || isArithmeticProgression) ? 1 : 0;
    
    let integrityFlag = 'HIGH_INTEGRITY';
    let xpEarned = 0;
    
    // XP Delta = Base Run Fee (100) + (Score / 10) * (Accuracy > 0.90 ? 1.5 : 1.0)
    const score = typeof body.score === 'number' ? body.score : (body.rawScoreData?.score ?? (hits * 10 + maxCombo * 5));
    const accuracyMultiplier = accuracyFraction > 0.90 ? 1.5 : 1.0;
    const baseXp = 100 + (score / 10) * accuracyMultiplier;

    if (isFlagged === 1) {
        integrityFlag = 'LOW_INTEGRITY';
        xpEarned = 0;

        // Shoot non-blocking, fast alert fetch to n8n webhook
        const n8nWebhookUrl = process.env.N8N_SECURITY_WEBHOOK_URL;
        if (n8nWebhookUrl) {
            const alertPromise = fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    score,
                    is_flagged: 1,
                    reason: isArithmeticProgression ? 'Arithmetic Progression Timing (Bot/Script)' : 'Velocity/Duration Threshold Exceeded',
                    hardwareProfile: body.hardwareProfile || body.hardware || 'Unknown HWID',
                    telemetrySummary: {
                        hits,
                        misses,
                        accuracy: Number(accuracy.toFixed(2)),
                        durationSeconds,
                        inputVelocity: Number(inputVelocity.toFixed(2))
                    }
                })
            }).catch(err => console.error('[Anti-Cheat Alert Webhook Error]:', err));

            // Offload HTTP request so it doesn't block the score response
            try {
                import('@cloudflare/next-on-pages').then(({ getRequestContext }) => {
                    const ctxObj = getRequestContext().ctx;
                    if (ctxObj && typeof ctxObj.waitUntil === 'function') {
                        ctxObj.waitUntil(alertPromise);
                    }
                }).catch(() => {});
            } catch {
                // Fallback for non-Cloudflare environments
            }
        }
    } else {
        xpEarned = Math.round(baseXp);
    }

    const db = await getDb();

    // Local dev mock fallback if database is not bound
    if (!db) {
        const mockTotalXpBefore = 0;
        const mockLevelBefore = 1;
        const newTotalXp = mockTotalXpBefore + xpEarned;

        const progress = getXpProgressWithinLevel(newTotalXp);
        const currentLevel = progress.currentLevel;
        const currentXp = progress.xpIntoLevel;
        const xpNeededForNext = progress.xpNeededForNext;
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
            "SELECT current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked FROM user_progression WHERE user_id = ?"
        ).bind(userId).first();

        let oldLevel = 1;
        let oldTotalXp = 0;
        let oldSurgeon = 0;
        let oldVector = 0;
        let oldVanguard = 0;

        if (userProgress) {
            oldLevel = Number(userProgress.current_level) || 1;
            oldTotalXp = Number(userProgress.total_xp) || 0;
            oldSurgeon = Number(userProgress.surgeon_badge_unlocked) || 0;
            oldVector = Number(userProgress.vector_lock_badge_unlocked) || 0;
            oldVanguard = Number(userProgress.vanguard_badge_unlocked) || 0;
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
        const progress = getXpProgressWithinLevel(newTotalXp);
        
        const currentLevel = progress.currentLevel;
        const currentXp = progress.xpIntoLevel;
        const xpNeededForNext = progress.xpNeededForNext;
        const levelUp = currentLevel > oldLevel;

        // Atomic D1 Execution
        // SQL migration required on first deploy:
        //   ALTER TABLE scores_telemetry ADD COLUMN average_urgency_index REAL DEFAULT 1.0;
        //   ALTER TABLE scores_telemetry ADD COLUMN over_flick_coefficient REAL DEFAULT 1.0;
        //   ALTER TABLE scores_telemetry ADD COLUMN miss_quadrants TEXT;
        //   ALTER TABLE scores_telemetry ADD COLUMN neural_stability_score REAL DEFAULT NULL;
        const missQuadrantsStr = missQuadrants ? JSON.stringify(missQuadrants) : null;
        const stmtTelemetry = db.prepare(`
            INSERT INTO scores_telemetry
                (user_id, exercise_id, difficulty, username, ghost_telemetry, hits, misses, accuracy, max_combo, duration_seconds,
                 xp_earned, integrity_flag, average_urgency_index, over_flick_coefficient, miss_quadrants, neural_stability_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            userId, exerciseId, difficulty, username, ghostTelemetry, hits, misses, accuracy, maxCombo, durationSeconds,
            xpEarned, integrityFlag, averageUrgencyIndex, overFlickCoefficient, missQuadrantsStr, neuralStabilityScore
        );

        const stmtProgression = db.prepare(`
            INSERT INTO user_progression (user_id, current_level, total_xp, surgeon_badge_unlocked, vector_lock_badge_unlocked, vanguard_badge_unlocked, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                current_level = excluded.current_level,
                total_xp = excluded.total_xp,
                surgeon_badge_unlocked = excluded.surgeon_badge_unlocked,
                vector_lock_badge_unlocked = excluded.vector_lock_badge_unlocked,
                vanguard_badge_unlocked = excluded.vanguard_badge_unlocked,
                updated_at = CURRENT_TIMESTAMP
        `).bind(userId, currentLevel, newTotalXp, surgeonBadgeUnlocked, vectorLockBadgeUnlocked, oldVanguard);

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

// --- Helper: Check for bot-like periodic hits forming a perfect arithmetic progression ---
function checkArithmeticProgression(ghostTelemetry: any): boolean {
    if (!ghostTelemetry) return false;
    try {
        const telemetry = typeof ghostTelemetry === 'string' ? JSON.parse(ghostTelemetry) : ghostTelemetry;
        let timestamps: number[] = [];
        if (Array.isArray(telemetry)) {
            if (telemetry.length < 5) return false;
            if (typeof telemetry[0] === 'number') {
                timestamps = telemetry;
            } else if (telemetry[0] && typeof telemetry[0].t === 'number') {
                timestamps = telemetry.map((item: any) => item.t);
            } else if (telemetry[0] && typeof telemetry[0].timestamp === 'number') {
                timestamps = telemetry.map((item: any) => item.timestamp);
            }
        }
        if (timestamps.length < 5) return false;

        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        if (mean <= 0) return false;

        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        // Standard deviation < 2ms with consistent rate indicates auto-firing scripts
        if (stdDev < 2.0) {
            return true;
        }
    } catch {
        // Fail-safe to avoid false positives or crashes on corrupt client inputs
    }
    return false;
}