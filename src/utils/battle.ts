/** Standard critical-hit rate (mainline Gen VI+). */
export const CRIT_CHANCE = 1 / 24;
/** Increased critical-hit rate for moves like Karate Chop and Slash. */
export const HIGH_CRIT_CHANCE = 1 / 8;
/** Critical hits deal 1.5× damage (mainline Gen VI+). */
export const CRIT_MULT = 1.5;/** X-Attack adds 40% of move power to damage for matching category. */
export const XATTACK_POWER_BONUS = 0.4;

export function moveKey(ownerCaughtAt: number, slug: string): string {
  return `${ownerCaughtAt}:${slug}`;
}
