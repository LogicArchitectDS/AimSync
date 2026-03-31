export default function LeaderboardPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-black tracking-tight text-text-primary mb-4">
        LEADER<span className="text-cyan">BOARD</span>
      </h1>
      <p className="text-text-muted text-lg max-w-2xl">
        Rankings are loading. Check back soon.
      </p>
    </div>
  );
}
