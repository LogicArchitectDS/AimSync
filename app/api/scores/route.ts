import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';

// Force Next.js to use Cloudflare's Edge network for zero-latency database calls
export const runtime = 'edge';

// --- GET: Fetch player stats from Cloudflare D1 ---
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    try {
        const db = getRequestContext().env.DB; // Connect to Cloudflare D1
        const stmt = db.prepare('SELECT * FROM player_stats WHERE user_id = ?').bind(userId);
        const result = await stmt.first();

        if (!result) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('D1 GET Error:', error);
        return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }
}

// --- POST: Upsert (Save) player stats to Cloudflare D1 ---
export async function POST(request: Request) {
    try {
        const { userId, stats } = await request.json() as { userId: string, stats: any };

        if (!userId || !stats) {
            return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
        }

        const db = getRequestContext().env.DB;

        // Upsert: If the user exists, update their stats. If they are new, insert a new row.
        const stmt = db.prepare(`
            INSERT INTO player_stats (user_id, global_accuracy, total_games, time_played, modes_data, playlists)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
            global_accuracy = excluded.global_accuracy,
            total_games = excluded.total_games,
            time_played = excluded.time_played,
            modes_data = excluded.modes_data,
            playlists = excluded.playlists,
            last_played_at = CURRENT_TIMESTAMP
        `).bind(
            userId,
            stats.globalAccuracy || 0,
            stats.totalGamesPlayed || 0,
            stats.timePlayedSeconds || 0,
            JSON.stringify(stats.modes || {}),
            JSON.stringify(stats.playlists || [])
        );

        await stmt.run();

        return NextResponse.json({ success: true, message: 'Stats synced to cloud successfully' });
    } catch (error) {
        console.error('D1 POST Error:', error);
        return NextResponse.json({ error: 'Database save failed' }, { status: 500 });
    }
}