const FAN_AFTER = 4;

/** Edge drop in px for a given hand size. No arch at 4 cards or fewer. */
export function handArchDrop(count: number): number {
  if (count <= FAN_AFTER) return 0;
  return Math.min(26, (count - FAN_AFTER) * 4);
}

/** Per-card fan pose for a Slay the Spire-style arched hand. */
export function handFanPose(index: number, count: number): { fan: number; lift: number } {
  if (count <= FAN_AFTER) return { fan: 0, lift: 0 };
  const mid = (count - 1) / 2;
  const t = (index - mid) / mid;
  const maxFan = Math.min(13, (count - FAN_AFTER) * 2.1);
  const maxDrop = handArchDrop(count);
  return {
    fan: t * maxFan,
    lift: t * t * maxDrop,
  };
}
