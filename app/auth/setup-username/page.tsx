"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function SetupProfilePage() {
    const { user, updateProfile, isLoading } = useAuth();
    const [username, setUsername] = useState("");
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [showGooglePrompt, setShowGooglePrompt] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth/login");
        }
        if (user) {
            if (user.username && !username) setUsername(user.username);
            if (user.profilePhoto && !preview) setPreview(user.profilePhoto);
        }
        if (user?.authType === "google" && user.profilePhoto && !preview) {
            setShowGooglePrompt(true);
        }
    }, [user, isLoading, router, preview, username]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError("Image too large (Max 2MB)");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
                setShowGooglePrompt(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: Alphabets and digits only
        const usernameRegex = /^[A-Za-z0-9]+$/;
        if (!usernameRegex.test(username)) {
            setError("Username must only contain letters and numbers");
            return;
        }

        if (username.length < 3) {
            setError("Username too short (min 3 chars)");
            return;
        }

        updateProfile({ 
            username, 
            profilePhoto: preview || undefined 
        });

        router.push("/dashboard");
    };

    if (isLoading) return null;

    return (
        <div className="flex-1 flex items-center justify-center p-6 bg-[#050505]">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:48px_48px]"></div>
            
            <div className="relative z-10 w-full max-w-md space-y-8 p-10 border border-white/10 bg-[#121212]/80 rounded-3xl backdrop-blur-2xl shadow-2xl text-center">
                <div className="space-y-2">
                    <p className="text-[#3366FF] text-xs font-bold tracking-[0.4em] uppercase">Onboarding</p>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase">Profile Setup</h1>
                    <p className="text-gray-500 text-sm">Personalize your agent identity</p>
                </div>

                {/* Profile Photo Selection */}
                <div className="flex flex-col items-center space-y-4">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="relative w-32 h-32 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer overflow-hidden hover:border-[#3366FF] transition-all group"
                    >
                        {preview ? (
                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center">
                                <svg className="w-8 h-8 text-gray-500 mx-auto group-hover:text-[#3366FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Upload Avatar</p>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Change</span>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                    />

                    {showGooglePrompt && (
                        <div className="bg-[#3366FF]/10 p-4 rounded-xl border border-[#3366FF]/30 space-y-2">
                            <p className="text-[10px] text-white font-bold uppercase tracking-widest leading-relaxed">
                                We found a Google profile picture. Do you want to keep it or update to a new one?
                            </p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setShowGooglePrompt(false)} className="text-[10px] text-gray-400 font-bold hover:text-white uppercase tracking-widest">Keep Existing</button>
                                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-[#3366FF] font-bold hover:underline uppercase tracking-widest">Update Photo</button>
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1 text-left">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Agent Handle</label>
                        <input 
                            type="text" 
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-[#3366FF] transition-all placeholder:text-gray-700"
                            placeholder="e.g. TenZ_01"
                        />
                        <p className="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-widest">Alphanumeric characters only</p>
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold text-center tracking-wide uppercase">{error}</p>}

                    <button type="submit" className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-[#3366FF] hover:text-white transition-all shadow-lg">
                        Finalize Neural Profile
                    </button>
                </form>
            </div>
        </div>
    );
}
