import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-8">

      {/* Hero text */}
      <div className="space-y-3">
        <h1 className="text-7xl font-bold tracking-tighter uppercase">
          <span className="text-text-primary">AIM</span>
          <span className="text-red">SYNC</span>
        </h1>
        <p className="text-sm font-semibold tracking-[0.25em] uppercase text-text-muted">
          Your Aim. Evolved.
        </p>
      </div>

      {/* CTA row */}
      <div className="flex items-center gap-5 mt-2">
        {/* Play now — red pill */}
        <Link
          href="/game"
          className="bg-red text-white px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wider hover:bg-red-600 transition-all duration-150 shadow-[0_0_16px_rgba(239,68,68,0.45)]"
        >
          Play now
        </Link>

        {/* Miss badge — white */}
        <span className="bg-text-primary text-background px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wide">
          Miss
        </span>

        {/* Score */}
        <div className="text-left">
          <p className="text-text-primary text-2xl font-black tracking-tight">24,850</p>
          <p className="text-text-muted text-xs uppercase tracking-widest font-semibold">score</p>
        </div>
      </div>

      {/* Tagline */}
      <p className="text-text-muted text-xs uppercase tracking-[0.3em] font-medium mt-2">
        Tactical shooter meets luxury
      </p>

    </div>
  );
}