import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200 selection:bg-emerald-500/30 overflow-hidden relative flex flex-col pt-16">

      {/* Background Grid & Glow Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 gap-8">

        {/* Version Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          System Online
        </div>

        {/* Main Title */}
        <div className="space-y-4">
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter uppercase leading-none">
            <span className="text-white">AIM</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">SYNC</span>
          </h1>
          <p className="text-sm md:text-base font-semibold tracking-[0.3em] uppercase text-gray-400">
            Calibrate Your Mechanics.
          </p>
        </div>

        {/* CTA Row */}
        <div className="flex flex-col items-center gap-6 mt-4">
          <Link
            href="/game"
            className="group relative inline-flex items-center justify-center px-10 py-4 font-black uppercase tracking-widest text-gray-950 transition-all duration-300 bg-emerald-500 rounded-md hover:bg-emerald-400 hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)]"
          >
            Deploy Now
            <svg className="w-5 h-5 ml-3 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          {/* Subtext */}
          <p className="max-w-md text-gray-500 text-sm leading-relaxed font-medium">
            The ultimate environment to perfect your crosshair placement, flick consistency, and tracking stamina.
          </p>
        </div>

      </div>

      {/* Footer / Tech Stack Tagline */}
      <div className="w-full py-8 text-center z-10 border-t border-gray-900/50">
        <p className="text-gray-600 text-xs uppercase tracking-[0.2em] font-bold">
          Powered by React • Telemetry via Firestore
        </p>
      </div>

    </main>
  );
}