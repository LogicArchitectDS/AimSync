import { auth } from './firebase';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    User
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// --- GOOGLE AUTH ---
export const loginWithGoogle = async (): Promise<{ user: User | null; error: string | null }> => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return { user: result.user, error: null };
    } catch (error: any) {
        console.error("Google Auth Error:", error.message);
        return { user: null, error: "Google sign-in failed." };
    }
};

// --- EMAIL/PASSWORD AUTH ---
export const registerWithEmail = async (email: string, password: string, username: string) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // Generate a unique, tactical robot avatar based on their username
        const generatedAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}&backgroundColor=052e16`;

        // Attach their gamer tag AND the new avatar to their profile immediately
        await updateProfile(result.user, {
            displayName: username,
            photoURL: generatedAvatar
        });

        return { user: result.user, error: null };
    } catch (error: any) {
        let msg = "Registration failed.";
        if (error.code === 'auth/email-already-in-use') msg = "Email already in use.";
        if (error.code === 'auth/weak-password') msg = "Password must be at least 6 characters.";
        return { user: null, error: msg };
    }
};

export const loginWithEmail = async (email: string, password: string) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return { user: result.user, error: null };
    } catch (error: any) {
        return { user: null, error: "Invalid email or password." };
    }
};

// --- PASSWORD RECOVERY ---
export const resetPassword = async (email: string) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, error: null };
    } catch (error: any) {
        let msg = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
        return { success: false, error: msg };
    }
};

export const logoutUser = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

export const getCurrentUserId = (): string | null => {
    return auth.currentUser?.uid || null;
};