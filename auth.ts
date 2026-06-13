import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            signature?: string;
        }
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

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [Discord],
    // We use JWTs because they work perfectly on Cloudflare Edge without needing a database connection just to read a session
    session: { strategy: "jwt" },
    callbacks: {
        // This injects the player's Discord ID into the session so we can save it to D1
        jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string
                
                // Cryptographically sign the user's ID using the server secret
                const secret = process.env.AUTH_SECRET || 'fallback-secret-key-aimsync-dev-2026';
                session.user.signature = await generateHmacSha256(token.id as string, secret);
            }
            return session
        }
    }
})