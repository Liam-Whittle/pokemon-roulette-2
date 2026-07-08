import type { BaseStats, CaughtPokemon, IVs, NatureId, StatKey } from '../types/game';
import { getCachedSpecies } from '../data/speciesCache';

export const MAX_LEVEL = 100;
export const XP_PER_LEVEL = 100;

export interface NatureDef {
  id: NatureId;
  label: string;
  increased: StatKey | null;
  decreased: StatKey | null;
}

export const NATURES: NatureDef[] = [
  { id: 'hardy', label: 'Hardy', increased: 'attack', decreased: 'attack' },
  { id: 'lonely', label: 'Lonely', increased: 'attack', decreased: 'defense' },
  { id: 'brave', label: 'Brave', increased: 'attack', decreased: 'speed' },
  { id: 'adamant', label: 'Adamant', increased: 'attack', decreased: 'specialAttack' },
  { id: 'naughty', label: 'Naughty', increased: 'attack', decreased: 'specialDefense' },
  { id: 'bold', label: 'Bold', increased: 'defense', decreased: 'attack' },
  { id: 'docile', label: 'Docile', increased: 'defense', decreased: 'defense' },
  { id: 'relaxed', label: 'Relaxed', increased: 'defense', decreased: 'speed' },
  { id: 'impish', label: 'Impish', increased: 'defense', decreased: 'specialAttack' },
  { id: 'lax', label: 'Lax', increased: 'defense', decreased: 'specialDefense' },
  { id: 'timid', label: 'Timid', increased: 'speed', decreased: 'attack' },
  { id: 'hasty', label: 'Hasty', increased: 'speed', decreased: 'defense' },
  { id: 'serious', label: 'Serious', increased: 'speed', decreased: 'speed' },
  { id: 'jolly', label: 'Jolly', increased: 'speed', decreased: 'specialAttack' },
  { id: 'naive', label: 'Naive', increased: 'speed', decreased: 'specialDefense' },
  { id: 'modest', label: 'Modest', increased: 'specialAttack', decreased: 'attack' },
  { id: 'mild', label: 'Mild', increased: 'specialAttack', decreased: 'defense' },
  { id: 'quiet', label: 'Quiet', increased: 'specialAttack', decreased: 'speed' },
  { id: 'bashful', label: 'Bashful', increased: 'specialAttack', decreased: 'specialAttack' },
  { id: 'rash', label: 'Rash', increased: 'specialAttack', decreased: 'specialDefense' },
  { id: 'calm', label: 'Calm', increased: 'specialDefense', decreased: 'attack' },
  { id: 'gentle', label: 'Gentle', increased: 'specialDefense', decreased: 'defense' },
  { id: 'sassy', label: 'Sassy', increased: 'specialDefense', decreased: 'speed' },
  { id: 'careful', label: 'Careful', increased: 'specialDefense', decreased: 'specialAttack' },
  { id: 'quirky', label: 'Quirky', increased: 'specialDefense', decreased: 'specialDefense' },
];

const NATURE_BY_ID = Object.fromEntries(NATURES.map((n) => [n.id, n])) as Record<NatureId, NatureDef>;

export function randomIVs(): IVs {
  const roll = () => Math.floor(Math.random() * 32);
  return {
    hp: roll(),
    attack: roll(),
    defense: roll(),
    specialAttack: roll(),
    specialDefense: roll(),
    speed: roll(),
  };
}

export function zeroEVs(): IVs {
  return { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
}

export function randomNature(): NatureId {
  return NATURES[Math.floor(Math.random() * NATURES.length)].id;
}

export function getNatureLabel(nature: NatureId): string {
  return NATURE_BY_ID[nature]?.label ?? nature;
}

function clampedLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
}

function hpStat(base: number, level: number, iv: number, ev: number): number {
  // Mainline-style HP formula.
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

function nonHpStat(base: number, level: number, iv: number, ev: number): number {
  // Mainline-style non-HP formula before Nature.
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
}

export function computeStats(
  base: BaseStats,
  level: number,
  ivs: IVs,
  evs: IVs,
  nature: NatureId,
): BaseStats {
  const lv = clampedLevel(level);
  const stats: BaseStats = {
    hp: hpStat(base.hp, lv, ivs.hp, evs.hp),
    attack: nonHpStat(base.attack, lv, ivs.attack, evs.attack),
    defense: nonHpStat(base.defense, lv, ivs.defense, evs.defense),
    specialAttack: nonHpStat(base.specialAttack, lv, ivs.specialAttack, evs.specialAttack),
    specialDefense: nonHpStat(base.specialDefense, lv, ivs.specialDefense, evs.specialDefense),
    speed: nonHpStat(base.speed, lv, ivs.speed, evs.speed),
  };
  return applyNature(stats, nature);
}

export function applyNature(stats: BaseStats, nature: NatureId): BaseStats {
  const def = NATURE_BY_ID[nature];
  if (!def || def.increased === def.decreased) return { ...stats };
  const result = { ...stats };
  if (def.increased) {
    result[def.increased] = Math.floor(result[def.increased] * 1.1);
  }
  if (def.decreased) {
    result[def.decreased] = Math.floor(result[def.decreased] * 0.9);
  }
  return result;
}

export function getBaseStatsForSpecies(id: number): BaseStats {
  const sp = getCachedSpecies(id);
  return sp?.baseStats ?? { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 };
}

export function getComputedStats(mon: Pick<CaughtPokemon, 'id' | 'level' | 'ivs' | 'evs' | 'nature'>): BaseStats {
  return computeStats(getBaseStatsForSpecies(mon.id), mon.level, mon.ivs, mon.evs, mon.nature);
}

export function maxHpForMon(mon: Pick<CaughtPokemon, 'id' | 'level' | 'ivs' | 'evs' | 'nature'>): number {
  return getComputedStats(mon).hp;
}

export function currentHp(mon: Pick<CaughtPokemon, 'hp' | 'id' | 'level' | 'ivs' | 'evs' | 'nature'>): number {
  if (mon.hp !== undefined && Number.isFinite(mon.hp)) return mon.hp;
  return maxHpForMon(mon);
}

export function isFainted(mon: Pick<CaughtPokemon, 'hp' | 'id' | 'level' | 'ivs' | 'evs' | 'nature'>): boolean {
  return currentHp(mon) <= 0;
}

/** Stat deltas vs neutral same-level stats (Hardy, 0 IV/EV). */
export function statDeltasFromBase(
  id: number,
  level: number,
  ivs: IVs,
  evs: IVs,
  nature: NatureId,
): BaseStats {
  const base = getBaseStatsForSpecies(id);
  const neutral = computeStats(base, level, zeroEVs(), zeroEVs(), 'hardy');
  const actual = computeStats(base, level, ivs, evs, nature);
  return {
    hp: actual.hp - neutral.hp,
    attack: actual.attack - neutral.attack,
    defense: actual.defense - neutral.defense,
    specialAttack: actual.specialAttack - neutral.specialAttack,
    specialDefense: actual.specialDefense - neutral.specialDefense,
    speed: actual.speed - neutral.speed,
  };
}

export function effectiveSpeed(mon: Pick<CaughtPokemon, 'id' | 'level' | 'ivs' | 'evs' | 'nature' | 'status'>): number {
  let speed = getComputedStats(mon).speed;
  if (mon.status?.kind === 'paralysis') speed = Math.floor(speed * 0.75);
  return speed;
}
