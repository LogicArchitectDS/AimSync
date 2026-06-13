"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthStorage, UserProfile } from "@/lib/utils/authStorage";
import { StorageEngine } from "@/lib/utils/storage"; // <-- Added the new D1 Storage Engine
import { useRouter, usePathname } from "next/navigation";
import { useWeaponAudio } from "@/hooks/useWeaponAudio";

interface AuthContextType {
    user: UserProfile | null;
    isTrial: boolean;
    login: (email: string, passwordHash?: string) => Promise<{ success: boolean; error?: string }>;
    register: (user: Omit<UserProfile, 'id'>) => Promise<{ success: boolean; error?: string }>;
    startTrial: () => void;
    logout: () => void;
    updateProfile: (updates: Partial<UserProfile>) => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isTrial, setIsTrial] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Preload weapon audios into memory on mount
    useWeaponAudio();

    // 1. REHYDRATION & BACKGROUND SYNC
    useEffect(() => {
        const storedUser = AuthStorage.getCurrentUser();
        if (storedUser) {
            setUser(storedUser);
            setIsTrial(false);

            // Fire a background sync to D1 to ensure local stats match the cloud
            StorageEngine.syncFromCloud(storedUser.id).catch(err =>
                console.error("Failed to sync from cloud on refresh:", err)
            );
        } else {
            const trialStatus = localStorage.getItem("aimsync_trial_active") === "true";
            setIsTrial(trialStatus);
        }
        setIsLoading(false);
    }, []);

    // 2. LOGIN (With Edge Hydration)
    const login = async (email: string, passwordHash?: string) => {
        setIsLoading(true); // Lock the UI
        const res = AuthStorage.login(email, passwordHash);

        if (res.success && res.user) {
            setUser(res.user);
            setIsTrial(false);

            // Wait for Cloudflare D1 to return the user's stats/playlists before routing
            await StorageEngine.syncFromCloud(res.user.id);

            router.push("/dashboard");
        }
        setIsLoading(false); // Unlock the UI
        return res;
    };

    // 3. REGISTER (With Edge Hydration)
    const register = async (newUser: Omit<UserProfile, 'id'>) => {
        setIsLoading(true);
        const fullUser: UserProfile = {
            ...newUser,
            id: crypto.randomUUID()
        };
        const res = AuthStorage.register(fullUser);

        if (res.success && res.user) {
            setUser(res.user);
            setIsTrial(false);

            // Initialize their blank slate in the cloud
            await StorageEngine.syncFromCloud(res.user.id);

            router.push("/auth/setup-username");
        }
        setIsLoading(false);
        return res;
    };

    const startTrial = () => {
        setUser(null);
        setIsTrial(true);
        localStorage.setItem("aimsync_trial_active", "true");
        router.push("/dashboard");
    };

    const logout = () => {
        AuthStorage.logout();
        setUser(null);
        setIsTrial(false);
        localStorage.removeItem("aimsync_trial_active");
        router.push("/auth/login");
    };

    const updateProfile = (updates: Partial<UserProfile>) => {
        AuthStorage.updateUser(updates);
        setUser(AuthStorage.getCurrentUser());
    };

    // 4. AUTH GUARD LOGIC
    useEffect(() => {
        if (isLoading) return;

        const publicPaths = ["/auth/login", "/auth/register", "/"];
        const isPublicPath = publicPaths.includes(pathname);

        if (!user && !isTrial && !isPublicPath) {
            // Auto-start trial instead of forcing login
            startTrial();
        } else if (user && !user.username && isPublicPath && pathname !== "/auth/setup-username") {
            // Redirect to setup if logged in but no username
            router.push("/auth/setup-username");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isTrial, pathname, isLoading, router]); // Omitted startTrial from deps to prevent infinite loops

    return (
        <AuthContext.Provider value={{ user, isTrial, login, register, startTrial, logout, updateProfile, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}