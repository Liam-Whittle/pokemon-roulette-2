/**
 * Gen II move type corrections. Fairy type did not exist until Gen VI;
 * these moves were Normal-type in Gold/Silver/Crystal.
 */
export const GEN2_FAIRY_TO_NORMAL_MOVES = new Set([
  'charm',
  'moonlight',
  'sweet-kiss',
]);

/** Apply Gen II type overrides to a cached move type. */
export function applyGen2MoveType(slug: string, type: string): string {
  if (type === 'fairy' && GEN2_FAIRY_TO_NORMAL_MOVES.has(slug)) {
    return 'normal';
  }
  return type;
}

/**
 * Region-aware move typing. Applies the Gen II fairy corrections, plus — for
 * Kanto (Gen I) runs — reverts every Dark-type move to Normal, since the Dark
 * type did not exist until Gen II. Johto keeps Dark typing as-is.
 */
export function applyRegionMoveType(
  slug: string,
  type: string,
  region: 'Kanto' | 'Johto',
): string {
  const base = applyGen2MoveType(slug, type);
  if (region === 'Kanto' && base === 'dark') {
    return 'normal';
  }
  return base;
}
