import type { CaughtPokemon } from '../types/game';
import { getCachedSpecies } from '../data/speciesCache';
import { MAX_LEVEL, XP_PER_LEVEL } from './stats';
import { maxHpForMon } from './stats';

export interface XpResult {
  mon: CaughtPokemon;
  leveledUp: boolean;
  levelsGained: number;
}

export function applyXp(mon: CaughtPokemon, amount: number): XpResult {
  if (mon.level >= MAX_LEVEL || amount <= 0) {
    return { mon, leveledUp: false, levelsGained: 0 };
  }
  let level = mon.level;
  let xp = (mon.xp ?? 0) + amount;
  let levelsGained = 0;
  while (xp >= XP_PER_LEVEL && level < MAX_LEVEL) {
    xp -= XP_PER_LEVEL;
    level += 1;
    levelsGained += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
  const oldMax = maxHpForMon({ ...mon, level: mon.level });
  const updated: CaughtPokemon = { ...mon, level, xp };
  const newMax = maxHpForMon(updated);
  const hp = mon.hp ?? oldMax;
  // Living mons: grow current HP with max HP. Fainted (0 HP): keep 0 so leveling never revives.
  updated.hp = hp <= 0 ? 0 : Math.min(hp + (newMax - oldMax), newMax);
  return { mon: updated, leveledUp: levelsGained > 0, levelsGained };
}

export function applyXpToAll(mons: CaughtPokemon[], amount: number): CaughtPokemon[] {
  return mons.map((m) => applyXp(m, amount).mon);
}

export function encounterLevelForBadges(badgeCount: number): number {
  return Math.min(40, 5 + badgeCount * 5);
}

export function getSpeciesCatchRate(id: number): number {
  return getCachedSpecies(id)?.catchRate ?? 45;
}
