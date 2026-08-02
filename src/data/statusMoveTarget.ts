import { getStatStageDelta, getVolatilePatchForStatusMove } from './moveEffects';

const SELF_STATUS_SLUGS = new Set([
  'recover',
  'soft-boiled',
  'rest',
  'reflect',
  'light-screen',
  'barrier',
  'focus-energy',
  'transform',
  'conversion',
  'substitute',
  'safeguard',
  'mind-reader',
  'swords-dance',
  'growth',
  'meditate',
  'sharpen',
  'harden',
  'withdraw',
  'defense-curl',
  'agility',
  'minimize',
  'amnesia',
  'double-team',
]);

const FOE_STATUS_SLUGS = new Set([
  'growl',
  'leer',
  'tail-whip',
  'string-shot',
  'sand-attack',
  'smokescreen',
  'flash',
  'screech',
  'swagger',
  'charm',
  'leech-seed',
  'toxic',
  'poison-powder',
  'poison-gas',
  'stun-spore',
  'thunder-wave',
  'glare',
  'sleep-powder',
  'hypnosis',
  'lovely-kiss',
  'sing',
  'spore',
  'confuse-ray',
  'supersonic',
  'sweet-kiss',
  'disable',
  'spite',
  'spikes',
]);

/** Whether a status move primarily affects the user (buff/heal) vs the foe. */
export function isSelfStatusMove(slug: string): boolean {
  if (FOE_STATUS_SLUGS.has(slug)) return false;
  if (SELF_STATUS_SLUGS.has(slug)) return true;
  const delta = getStatStageDelta(slug);
  if (delta?.foe) return false;
  if (delta?.self) return true;
  const volatile = getVolatilePatchForStatusMove(slug);
  if (volatile && slug !== 'leech-seed') return true;
  return false;
}
