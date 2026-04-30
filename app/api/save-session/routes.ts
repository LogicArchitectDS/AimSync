import { NextResponse } from 'next/server';
import { auth } from '@/auth'; // Import our new Auth engine

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        // 1. SECURITY CHECK: Verify the player is actually logged in
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
        }

        // 2. The real, un-spoofable Discord ID
        const actualUserId = session.user.id;

        const body = await request.json();
        // We ignore the userId from the frontend completely now
        const { protocol, score, shotsFired, accuracy, kps } = body;

        const db = process.env.DB as any;
        if (!db) throw new Error("D1 Database binding not found.");

        // Insert using the real user ID
        const stmt = db.prepare(`
      INSERT INTO training_sessions (user_id, protocol, score, shots_fired, accuracy, kps)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(actualUserId, protocol, score, shotsFired, accuracy, kps);

        const result = await stmt.run();

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Session saved securely' }, { status: 200 });
        } else {
            throw new Error("Failed to insert into D1");
        }

    } catch (error) {
        console.error("[AimSync DB Error]:", error);
        return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 });
    }
}