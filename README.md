# AimSync

AimSync is a professional-grade web-based aiming trainer designed to replicate the mechanical precision of tactical shooters (like Counter-Strike 2 and Valorant) directly in the browser. It pushes the boundaries of web technologies to deliver a low-latency, high-refresh-rate training environment with advanced diagnostic feedback.

## Key Features

- **Coalesced Pointer Lock Architecture:** Bypasses OS cursor acceleration and standard browser event throttling. By combining the Pointer Lock API with coalesced event polling, AimSync captures sub-pixel raw hardware data at up to 8000Hz, ensuring buttery-smooth crosshair movement on high-refresh monitors without micro-stutters.
- **Advanced Kinematic Telemetry:** Tracks high-frequency mouse path checkpoints during clicking-centric drills to diagnose mechanical flaws.
  - **Urgency Index (UI):** Identifies hesitant micro-adjustments by comparing initial reaction speed against the final target-acquisition window.
  - **Over-Flicking Coefficient (OFC):** Quantifies routine over-shooting and correction loops by comparing cumulative path distance against the straight-line ideal vector.
- **Web Audio API Synthesizer:** Completely eliminates static audio file dependencies. Adaptive hit and miss tones are generated on-the-fly via native browser oscillators, featuring pitch crescendos and frequency sweeps that scale with your current combo streak.
- **Layered Canvas Engine:** Utilizes isolated, absolute-positioned HTML5 canvases (background, active game, crosshair/UI) and off-screen pre-rendering to maintain rigid 144Hz frametimes even on low-spec hardware.
- **Routine Director & Daily Contracts:** Analyzes historical telemetry to generate custom, time-sensitive daily training regimens designed to target specific mechanical weaknesses.
- **Comprehensive Dashboard:** A sleek, glassmorphic UI offering deep insights into your mechanical progression, including dynamic coaching cards based on recent kinematic data.

## Tech Stack

- **Framework:** Next.js 16.2.1 (App Router)
- **Styling:** Tailwind CSS + Vanilla CSS (Glassmorphic, Cyberpunk aesthetic)
- **Database:** Cloudflare D1 (Edge SQL Database)
- **Graphics:** HTML5 Canvas API
- **Audio:** Web Audio API

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the dashboard.

## Cloudflare D1 Setup (Local Development)

AimSync relies on Cloudflare D1 for telemetry storage. To run locally without errors, ensure you have Wrangler set up, or the application will safely degrade to local mock storage.

Required SQL Migrations (if running your own D1 instance):
```sql
ALTER TABLE scores_telemetry ADD COLUMN average_urgency_index REAL DEFAULT 1.0;
ALTER TABLE scores_telemetry ADD COLUMN over_flick_coefficient REAL DEFAULT 1.0;
```
