// lib/utils/authStorage.ts
import { StorageEngine } from "./storage";

export interface UserProfile {
    email: string;
    username?: string;
    profilePhoto?: string; // Base64
    authType: 'email' | 'google';
    passwordHash?: string; // Basic mock hash
}

const AUTH_KEYS = {
    USER: "aimsync_current_user",
    ACCOUNTS: "aimsync_accounts",
};

const isBrowser = typeof window !== "undefined";

export const AuthStorage = {
    getAccounts: (): UserProfile[] => {
        if (!isBrowser) return [];
        const data = localStorage.getItem(AUTH_KEYS.ACCOUNTS);
        return data ? JSON.parse(data) : [];
    },

    register: (user: UserProfile): { success: boolean; error?: string } => {
        const accounts = AuthStorage.getAccounts();
        if (accounts.some(a => a.email === user.email)) {
            return { success: false, error: "Email already registered" };
        }
        accounts.push(user);
        localStorage.setItem(AUTH_KEYS.ACCOUNTS, JSON.stringify(accounts));
        return { success: true };
    },

    login: (email: string, passwordHash?: string): { success: boolean; user?: UserProfile; error?: string } => {
        const accounts = AuthStorage.getAccounts();
        const user = accounts.find(a => a.email === email && (!passwordHash || a.passwordHash === passwordHash));
        
        if (user) {
            localStorage.setItem(AUTH_KEYS.USER, JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, error: "Invalid credentials" };
    },

    getCurrentUser: (): UserProfile | null => {
        if (!isBrowser) return null;
        const data = localStorage.getItem(AUTH_KEYS.USER);
        return data ? JSON.parse(data) : null;
    },

    updateUser: (updates: Partial<UserProfile>): void => {
        const currentUser = AuthStorage.getCurrentUser();
        if (!currentUser) return;

        const newUser = { ...currentUser, ...updates };
        localStorage.setItem(AUTH_KEYS.USER, JSON.stringify(newUser));

        // Sync with accounts list
        const accounts = AuthStorage.getAccounts();
        const index = accounts.findIndex(a => a.email === currentUser.email);
        if (index >= 0) {
            accounts[index] = newUser;
            localStorage.setItem(AUTH_KEYS.ACCOUNTS, JSON.stringify(accounts));
        }
    },

    logout: () => {
        if (!isBrowser) return;
        localStorage.removeItem(AUTH_KEYS.USER);
    }
};
