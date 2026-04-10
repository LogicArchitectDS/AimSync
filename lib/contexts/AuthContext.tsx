"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthStorage, UserProfile } from "@/lib/utils/authStorage";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    user: UserProfile | null;
    isTrial: boolean;
    login: (email: string, passwordHash?: string) => { success: boolean; error?: string };
    register: (user: UserProfile) => { success: boolean; error?: string };
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

    useEffect(() => {
        const storedUser = AuthStorage.getCurrentUser();
        if (storedUser) {
            setUser(storedUser);
            setIsTrial(false);
        } else {
            const trialStatus = localStorage.getItem("aimsync_trial_active") === "true";
            setIsTrial(trialStatus);
        }
        setIsLoading(false);
    }, []);

    const login = (email: string, passwordHash?: string) => {
        const res = AuthStorage.login(email, passwordHash);
        if (res.success && res.user) {
            setUser(res.user);
            setIsTrial(false);
            localStorage.removeItem("aimsync_trial_active");
        }
        return res;
    };

    const register = (newUser: UserProfile) => {
        return AuthStorage.register(newUser);
    };

    const startTrial = () => {
        setIsTrial(true);
        setUser(null);
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

    // Simple Auth Guard Logic: Priortize Trial Mode for guests
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
    }, [user, isTrial, pathname, isLoading, router, startTrial]);

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
