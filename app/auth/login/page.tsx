"use client";

import { useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { login, startTrial } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const res = login(email, password); // Note: Simplified hashing for local demo
        if (res.success) {
            router.push("/dashboard");
        } else {
            setError(res.error || "Login failed");
        }
    };

    const handleGoogleLogin = () => {
        // Mock Google Login
        const mockGoogleUser = {
            email: "google_user@gmail.com",
            authType: "google" as const,
            profilePhoto: "https://lh3.googleusercontent.com/a/ACg8ocL...", // Dummy URL to trigger prompt later
        };
        const res = login(mockGoogleUser.email);
        if (res.success) {
            router.push("/dashboard");
        } else {
            // If doesn't exist, register it first
            login(mockGoogleUser.email); // Re-try login or handle registration logic
            router.push("/dashboard");
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center p-6 bg-[#050505]">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px]"></div>
            
            <div className="relative z-10 w-full max-w-md space-y-8 p-10 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-2xl shadow-2xl">
                <div className="text-center space-y-2">
                    <p className="text-[#3366FF] text-xs font-bold tracking-[0.4em] uppercase">AimSync Core</p>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase">Initialize</h1>
                    <p className="text-gray-500 text-sm">Access your performance neural network</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Email Terminal</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#3366FF] transition-all placeholder:text-gray-700"
                                placeholder="agent@aimsync.io"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Access Phrase</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#3366FF] transition-all placeholder:text-gray-700"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold text-center tracking-wide uppercase">{error}</p>}

                    <button type="submit" className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-[#3366FF] hover:text-white transition-all shadow-lg">
                        Execute Login
                    </button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-[#121212] px-4 text-gray-600">Alternative Entry</span></div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <button 
                        onClick={handleGoogleLogin}
                        className="flex items-center justify-center gap-3 w-full py-4 bg-black/60 border border-white/10 rounded-xl hover:bg-white hover:text-black transition-all group"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="font-bold tracking-widest uppercase text-xs">Login with Google</span>
                    </button>

                    <button 
                        onClick={startTrial}
                        className="w-full py-4 bg-[#ec4899]/10 border border-[#ec4899]/30 text-[#ec4899] font-black uppercase tracking-widest rounded-xl hover:bg-[#ec4899] hover:text-white transition-all shadow-[0_0_20px_rgba(236,72,153,0.1)]"
                    >
                        Deploy Trial Sequence
                    </button>
                </div>

                <div className="pt-4 text-center">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                        New Agent? <Link href="/auth/register" className="text-[#3366FF] hover:underline">Register Protocol</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
