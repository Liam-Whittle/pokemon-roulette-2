/** Mulberry32 — small, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function nextSeed(rng: Rng): number {
  return Math.floor(rng() * 0xffffffff) >>> 0;
}

export function pickIndex(rng: Rng, length: number): number {
  if (length <= 0) return 0;
  return Math.floor(rng() * length);
}

export function pickOne<T>(rng: Rng, arr: readonly T[]): T {
  return arr[pickIndex(rng, arr.length)]!;
}

export function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const copy = shuffle(rng, [...arr]);
  return copy.slice(0, Math.min(n, copy.length));
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
