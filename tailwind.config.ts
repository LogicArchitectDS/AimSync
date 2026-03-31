import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Near-black stealth background
                background: "#0D0E10",

                // Elevated surface — cards, navbar
                surface: "#17181C",

                // Slate scale — primary light, 400 mid, 600 dark
                slate: {
                    ...require("tailwindcss/colors").slate,
                    primary: "#CBD5E1", // Light silver-gray
                    400:     "#94A3B8", // Mid slate
                    600:     "#475569", // Darker slate
                },

                // Red — prominent, Gen Z danger/miss color
                red: {
                    DEFAULT: "#EF4444",
                    600:     "#DC2626",
                    glow:    "#FF3B3B",
                },

                // Text
                text: {
                    primary: "#F8FAFC", // Crisp near-white
                    muted:   "#64748B", // Cool muted slate
                },
            },
            fontFamily: {
                sans: ["var(--font-space)", "sans-serif"],
            },
        },
    },
    plugins: [],
};

export default config;