import { NextResponse } from 'next/server';

// Force Next.js to run this API on Cloudflare's Edge network
export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, protocol, score, shotsFired, accuracy, kps } = body;

        // Grab the D1 database binding from the Edge environment
        // Note: process.env.DB requires the @cloudflare/next-on-pages setup
        const db = process.env.DB as any;

        if (!db) {
            throw new Error("D1 Database binding not found.");
        }

        // Prepare and execute the SQL statement
        const stmt = db.prepare(`
      INSERT INTO training_sessions (user_id, protocol, score, shots_fired, accuracy, kps)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, protocol, score, shotsFired, accuracy, kps);

        const result = await stmt.run();

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Session saved to D1' }, { status: 200 });
        } else {
            throw new Error("Failed to insert into D1");
        }

    } catch (error) {
        console.error("[AimSync DB Error]:", error);
        return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 });
    }
}