"use client";

import { useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const { register, login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        const res = register({
            email,
            passwordHash: password, // Simplified for demo
            authType: "email"
        });

        if (res.success) {
            // Log in immediately
            login(email, password);
            router.push("/auth/setup-username");
        } else {
            setError(res.error || "Registration failed");
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center p-6 bg-[#050505]">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px]"></div>
            
            <div className="relative z-10 w-full max-w-md space-y-8 p-10 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-2xl shadow-2xl">
                <div className="text-center space-y-2">
                    <p className="text-[#3366FF] text-xs font-bold tracking-[0.4em] uppercase">Registration Protocol</p>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase">Register</h1>
                    <p className="text-gray-500 text-sm">Create your performance profile</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Email Identifier</label>
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
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">New Access Phrase</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#3366FF] transition-all placeholder:text-gray-700"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Confirm Phrase</label>
                            <input 
                                type="password" 
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#3366FF] transition-all placeholder:text-gray-700"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold text-center tracking-wide uppercase">{error}</p>}

                    <button type="submit" className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-[#3366FF] hover:text-white transition-all shadow-lg">
                        Execute Registration
                    </button>
                </form>

                <div className="pt-4 text-center">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                        Already have access? <Link href="/auth/login" className="text-[#3366FF] hover:underline">Return to Terminal</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
