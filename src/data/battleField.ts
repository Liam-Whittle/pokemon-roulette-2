/** Battle-wide field state (weather, hazards, per-mon Hidden Power types). */
export type BattleWeather = 'none' | 'sunny' | 'rain';

export type BattleField = {
  weather: BattleWeather;
  weatherTurns: number;
  spikesActive: boolean;
  hiddenPowerTypes: Record<number, string>;
};

export const EMPTY_BATTLE_FIELD: BattleField = {
  weather: 'none',
  weatherTurns: 0,
  spikesActive: false,
  hiddenPowerTypes: {},
};

export function clearBattleField(): BattleField {
  return { ...EMPTY_BATTLE_FIELD };
}

const HIDDEN_POWER_TYPES = [
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
] as const;

export function rollHiddenPowerType(): string {
  return HIDDEN_POWER_TYPES[Math.floor(Math.random() * HIDDEN_POWER_TYPES.length)]!;
}

export function initBattleHiddenPowerTypes(
  party: { caughtAt: number; moves: { slug: string }[] }[],
  enemyTeam: { caughtAt: number; moves: { slug: string }[] }[] = [],
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const mon of [...party, ...enemyTeam]) {
    if (mon.moves.some((m) => m.slug === 'hidden-power')) {
      out[mon.caughtAt] = rollHiddenPowerType();
    }
  }
  return out;
}

/** @deprecated Use initBattleHiddenPowerTypes */
export function initHiddenPowerTypes(
  party: { caughtAt: number; moves: { slug: string }[] }[],
): Record<number, string> {
  return initBattleHiddenPowerTypes(party);
}

export function spikesChipDamage(maxHp: number, types: string[]): number {
  if (types.includes('flying')) return 0;
  return Math.max(1, Math.floor(maxHp * 0.125));
}
