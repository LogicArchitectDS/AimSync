// lib/utils/ghostCompression.ts

export interface GhostRecord {
  modeId: string;
  difficulty: string;
  score: number;
  targets: { x: number; y: number; radius: number }[]; // x, y are 0..1000 normalized, radius is 0..1000 normalized
  path: [number, number, number][]; // [x, y, t] (normalized x, y 0..1000, t is elapsed ms)
  hits: { x: number; y: number; t: number }[]; // x, y 0..1000, t is elapsed ms
  username?: string;
}

interface CompressedGhost {
  m: string; // modeId
  d: string; // difficulty
  s: number; // score
  u?: string; // username
  t: [number, number, number][]; // targets: [x, y, radius]
  p: [number, number, number][]; // path: [x, y, t]
  h: [number, number, number][]; // hits: [x, y, t]
}

/**
 * Compresses a GhostRecord into a compact, minified JSON string.
 */
export function compressGhost(ghost: GhostRecord): string {
  const compressed: CompressedGhost = {
    m: ghost.modeId,
    d: ghost.difficulty,
    s: ghost.score,
    u: ghost.username,
    t: ghost.targets.map((tgt) => [
      Math.round(tgt.x),
      Math.round(tgt.y),
      Math.round(tgt.radius),
    ]),
    p: ghost.path.map(([x, y, t]) => [
      Math.round(x),
      Math.round(y),
      Math.round(t),
    ]),
    h: ghost.hits.map((hit) => [
      Math.round(hit.x),
      Math.round(hit.y),
      Math.round(hit.t),
    ]),
  };
  return JSON.stringify(compressed);
}

/**
 * Decompresses a compressed JSON string back into a full GhostRecord.
 */
export function decompressGhost(compressedStr: string): GhostRecord {
  const compressed: CompressedGhost = JSON.parse(compressedStr);
  return {
    modeId: compressed.m,
    difficulty: compressed.d,
    score: compressed.s,
    username: compressed.u,
    targets: (compressed.t || []).map(([x, y, r]) => ({ x, y, radius: r })),
    path: compressed.p || [],
    hits: (compressed.h || []).map(([x, y, t]) => ({ x, y, t })),
  };
}
