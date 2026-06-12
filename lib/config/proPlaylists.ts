export interface ProPlaylistTask {
    modeId: string;
    name: string;
    duration: number; // in seconds
    difficulty: "Eco" | "Bonus" | "Force Buy" | "Full Buy";
}

export interface ProPlaylist {
    id: string;
    proName: string;
    creatorType: "pro-team" | "specialist";
    gameFocus: "Valorant" | "CS2" | "Hybrid";
    team: string; // e.g., 'Sentinels', 'Team Spirit', 'Movement', 'Aim Community'
    description: string;
    accentColor: string; // Tailwind classes for text/border/glow states
    sequence: ProPlaylistTask[];
}

export const proPlaylists: ProPlaylist[] = [
    {
        id: "tenz",
        proName: "TenZ",
        creatorType: "pro-team",
        gameFocus: "Valorant",
        team: "Sentinels",
        description: "High-intensity micro-flicking and maximum mechanical velocity tracking.",
        accentColor: "border-red-500/30 hover:border-red-500 focus-within:border-red-500 shadow-red-500/5 hover:shadow-red-500/20",
        sequence: [
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 60,
                difficulty: "Full Buy",
            },
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 60,
                difficulty: "Full Buy",
            },
            {
                modeId: "continuous-track",
                name: "Continuous Tracking",
                duration: 60,
                difficulty: "Force Buy",
            },
        ],
    },
    {
        id: "aspas",
        proName: "aspas",
        creatorType: "pro-team",
        gameFocus: "Valorant",
        team: "Leviatán",
        description: "Flawless crosshair tracking and perfectly paced lateral angle sweeping.",
        accentColor: "border-cyan-500/30 hover:border-cyan-500 focus-within:border-cyan-500 shadow-cyan-500/5 hover:shadow-cyan-500/20",
        sequence: [
            {
                modeId: "continuous-track",
                name: "Continuous Tracking",
                duration: 60,
                difficulty: "Force Buy",
            },
            {
                modeId: "flick-track-hybrid",
                name: "Flick-Track Hybrid",
                duration: 60,
                difficulty: "Full Buy",
            },
        ],
    },
    {
        id: "primmie",
        proName: "Primmie",
        creatorType: "pro-team",
        gameFocus: "Valorant",
        team: "Talon Esports",
        description: "Aggressive ranked-demon style high-sensitivity snapping and spray transfers.",
        accentColor: "border-amber-500/30 hover:border-amber-500 focus-within:border-amber-500 shadow-amber-500/5 hover:shadow-amber-500/20",
        sequence: [
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 45,
                difficulty: "Full Buy",
            },
            {
                modeId: "cognitive-overdrive",
                name: "Cognitive Overdrive",
                duration: 60,
                difficulty: "Force Buy",
            },
        ],
    },
    {
        id: "demon1",
        proName: "Demon1",
        creatorType: "pro-team",
        gameFocus: "Valorant",
        team: "Champions Elite",
        description: "Strict geometric crosshair isolation and low-sens pixel adjustments.",
        accentColor: "border-blue-500/30 hover:border-blue-500 focus-within:border-blue-500 shadow-blue-500/5 hover:shadow-blue-500/20",
        sequence: [
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 90,
                difficulty: "Full Buy",
            },
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 60,
                difficulty: "Bonus",
            },
        ],
    },
    {
        id: "donk",
        proName: "donk",
        creatorType: "pro-team",
        gameFocus: "CS2",
        team: "Team Spirit",
        description: "Pure explosive spray tracking and aggressive crosshair pulling mechanics.",
        accentColor: "border-teal-500/30 hover:border-teal-500 focus-within:border-teal-500 shadow-teal-500/5 hover:shadow-teal-500/20",
        sequence: [
            {
                modeId: "recoil-reactive",
                name: "Recoil Reactive",
                duration: 60,
                difficulty: "Full Buy",
            },
            {
                modeId: "flick-track-hybrid",
                name: "Flick-Track Hybrid",
                duration: 60,
                difficulty: "Full Buy",
            },
        ],
    },
    {
        id: "m0nesy",
        proName: "m0NESY",
        creatorType: "pro-team",
        gameFocus: "CS2",
        team: "G2 Esports",
        description: "Insane mechanical reaction speeds and wide-angle target switching.",
        accentColor: "border-slate-400/30 hover:border-slate-400 focus-within:border-slate-400 shadow-slate-400/5 hover:shadow-slate-400/20",
        sequence: [
            {
                modeId: "spatial-flick",
                name: "Spatial Flick",
                duration: 45,
                difficulty: "Full Buy",
            },
            {
                modeId: "vertical-flick",
                name: "Vertical Flick",
                duration: 60,
                difficulty: "Force Buy",
            },
        ],
    },
    {
        id: "zywoo",
        proName: "ZywOo",
        creatorType: "pro-team",
        gameFocus: "CS2",
        team: "Vitality",
        description: "Flawless positioning simulation and calm, macro-level angle adjustments.",
        accentColor: "border-yellow-500/30 hover:border-yellow-500 focus-within:border-yellow-500 shadow-yellow-500/5 hover:shadow-yellow-500/20",
        sequence: [
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 90,
                difficulty: "Eco",
            },
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 60,
                difficulty: "Bonus",
            },
        ],
    },
    {
        id: "ropz",
        proName: "ropz",
        creatorType: "pro-team",
        gameFocus: "CS2",
        team: "FaZe Clan",
        description: "Mathematical isolation and perfect static crosshair alignment routines.",
        accentColor: "border-rose-500/30 hover:border-rose-500 focus-within:border-rose-500 shadow-rose-500/5 hover:shadow-rose-500/20",
        sequence: [
            {
                modeId: "recoil-reactive",
                name: "Recoil Reactive",
                duration: 90,
                difficulty: "Full Buy",
            },
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 60,
                difficulty: "Full Buy",
            },
        ],
    },
    {
        id: "kaemi",
        proName: "Kaemi",
        creatorType: "specialist",
        gameFocus: "Valorant",
        team: "Aim Community",
        description: "The 'Marshal God' sequence. High verticality and giant screen transitions.",
        accentColor: "border-yellow-500/30 hover:border-yellow-500 focus-within:border-yellow-500 shadow-yellow-500/5 hover:shadow-yellow-500/20",
        sequence: [
            {
                modeId: "vertical-flick",
                name: "Vertical Flick",
                duration: 60,
                difficulty: "Force Buy",
            },
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 60,
                difficulty: "Full Buy",
            },
        ],
    },
    {
        id: "temet",
        proName: "Temet",
        creatorType: "specialist",
        gameFocus: "Valorant",
        team: "Movement",
        description: "Neon velocity simulation. Tracking targets perfectly while moving at max speed.",
        accentColor: "border-pink-500/30 hover:border-pink-500 focus-within:border-pink-500 shadow-pink-500/5 hover:shadow-pink-500/20",
        sequence: [
            {
                modeId: "tracking-while-moving",
                name: "Tracking while Moving",
                duration: 60,
                difficulty: "Bonus",
            },
            {
                modeId: "spatial-flick",
                name: "Spatial Flick",
                duration: 45,
                difficulty: "Full Buy",
            },
        ],
    },
    {
        id: "horcus",
        proName: "Horcus",
        creatorType: "specialist",
        gameFocus: "Valorant",
        team: "Aim Community",
        description: "Extreme pixel-smoothness pacing and ultra-high tracking discipline.",
        accentColor: "border-purple-500/30 hover:border-purple-500 focus-within:border-purple-500 shadow-purple-500/5 hover:shadow-purple-500/20",
        sequence: [
            {
                modeId: "smoothness-track",
                name: "Smoothness Tracking",
                duration: 90,
                difficulty: "Eco",
            },
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 60,
                difficulty: "Bonus",
            },
        ],
    },
    {
        id: "rawzu",
        proName: "Rawzu",
        creatorType: "specialist",
        gameFocus: "Valorant",
        team: "Aim Community",
        description: "The 'Calm Aim' blueprint—complete eradication of hand tension and panic spam.",
        accentColor: "border-emerald-500/30 hover:border-emerald-500 focus-within:border-emerald-500 shadow-emerald-500/5 hover:shadow-emerald-500/20",
        sequence: [
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 120,
                difficulty: "Eco",
            },
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 60,
                difficulty: "Eco",
            },
        ],
    },
    {
        id: "shroud",
        proName: "shroud",
        creatorType: "specialist",
        gameFocus: "Hybrid",
        team: "Legend",
        description: "Pure instinctual mouse-to-target muscle memory translation.",
        accentColor: "border-indigo-500/30 hover:border-indigo-500 focus-within:border-indigo-500 shadow-indigo-500/5 hover:shadow-indigo-500/20",
        sequence: [
            {
                modeId: "static-flick",
                name: "Static Flick",
                duration: 60,
                difficulty: "Bonus",
            },
            {
                modeId: "continuous-track",
                name: "Continuous Tracking",
                duration: 60,
                difficulty: "Force Buy",
            },
        ],
    },
    {
        id: "s1mple",
        proName: "s1mple",
        creatorType: "specialist",
        gameFocus: "CS2",
        team: "Legend",
        description: "Highly aggressive, twitchy, and unpredictable micro-adjusting protocols.",
        accentColor: "border-amber-400/30 hover:border-amber-400 focus-within:border-amber-400 shadow-amber-400/5 hover:shadow-amber-400/20",
        sequence: [
            {
                modeId: "spatial-flick",
                name: "Spatial Flick",
                duration: 60,
                difficulty: "Full Buy",
            },
            {
                modeId: "micro-precision",
                name: "Micro Precision",
                duration: 45,
                difficulty: "Full Buy",
            },
        ],
    },
];
