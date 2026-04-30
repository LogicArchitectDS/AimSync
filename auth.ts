import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"

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
        session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string
            }
            return session
        }
    }
})