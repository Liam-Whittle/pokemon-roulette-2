import type { CaughtPokemon, IVs, StatusAilment, StoredMove } from '../types/game';
import type { BattleVolatiles } from './battleVolatiles';
import { cachedMoveToStored } from './speciesCache';
import { maxHpForMon } from '../utils/stats';

export const METRONOME_POOL = [
  'flamethrower',
  'thunderbolt',
  'ice-beam',
  'psychic',
  'earthquake',
  'hyper-beam',
  'solar-beam',
  'surf',
  'thunder-wave',
  'sleep-powder',
  'leer',
  'growl',
  'swift',
  'body-slam',
  'recover',
] as const;

export const CHARGE_MOVE_SLUGS = new Set([
  'solar-beam',
  'skull-bash',
  'fly',
  'dig',
  'sky-attack',
]);

export const RECHARGE_MOVE_SLUGS = new Set(['hyper-beam']);

export const MULTI_HIT_MOVES: Record<string, { min: number; max: number }> = {
  'pin-missile': { min: 2, max: 5 },
  'fury-attack': { min: 2, max: 5 },
  'comet-punch': { min: 2, max: 5 },
  twineedle: { min: 2, max: 5 },
  bonemerang: { min: 2, max: 2 },
  'rock-blast': { min: 2, max: 5 },
};

export const RECOIL_MOVES: Record<string, number> = {
  submission: 0.25,
  'double-edge': 0.25,
  'take-down': 0.25,
};

export const TRAP_MOVES = new Set(['wrap', 'bind', 'fire-spin', 'clamp']);

export const PRIORITY_MOVES: Record<string, number> = {
  'quick-attack': 1,
  'extreme-speed': 2,
};

export const OHKO_MOVES = new Set(['guillotine', 'horn-drill', 'fissure']);

export const DRAIN_MOVES: Record<string, number> = {
  absorb: 0.5,
  'mega-drain': 0.5,
  'leech-life': 0.5,
};

export function getMovePriority(slug: string): number {
  return PRIORITY_MOVES[slug] ?? 0;
}

export function rollMultiHitCount(slug: string): number {
  const range = MULTI_HIT_MOVES[slug];
  if (!range) return 1;
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
}

export function getSecondaryStatusChance(slug: string): number {
  if (slug === 'tri-attack') return 0.2;
  return 0.1;
}

export function rollTriAttackStatus(): StatusAilment {
  const roll = Math.random();
  if (roll < 1 / 3) return 'paralysis';
  if (roll < 2 / 3) return 'burn';
  return 'freeze';
}

export function metronomePickSlug(): string {
  const pool = METRONOME_POOL;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function storedMoveFromSlug(slug: string): StoredMove | null {
  return cachedMoveToStored(slug) ?? null;
}

export type StatStageDelta = Partial<{
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  acc: number;
  eva: number;
}>;

/** Stat stage changes for status moves (attacker perspective: positive = buff self). */
export function getStatStageDelta(slug: string): {
  self?: StatStageDelta;
  foe?: StatStageDelta;
} | null {
  switch (slug) {
    case 'growl':
      return { foe: { atk: -1 } };
    case 'leer':
    case 'tail-whip':
      return { foe: { def: -1 } };
    case 'string-shot':
      return { foe: { spe: -2 } };
    case 'sand-attack':
    case 'smokescreen':
    case 'flash':
      return { foe: { acc: -1 } };
    case 'screech':
      return { foe: { def: -2 } };
    case 'harden':
    case 'withdraw':
    case 'defense-curl':
      return { self: { def: +1 } };
    case 'meditate':
    case 'sharpen':
      return { self: { atk: +1 } };
    case 'swords-dance':
      return { self: { atk: +2 } };
    case 'agility':
      return { self: { spe: +2 } };
    case 'growth':
      return { self: { spa: +1, spd: +1 } };
    case 'minimize':
      return { self: { eva: +1 } };
    case 'swagger':
      return { foe: { atk: +2 } };
    default:
      return null;
  }
}

export type VolatilePatch = Partial<BattleVolatiles>;

export function getVolatilePatchForStatusMove(slug: string): VolatilePatch | null {
  switch (slug) {
    case 'reflect':
      return { reflectTurns: 3 };
    case 'light-screen':
      return { lightScreenTurns: 3 };
    case 'barrier':
      return { barrierActive: true };
    case 'focus-energy':
      return { focusEnergy: true };
    case 'leech-seed':
      return { leechSeeded: true };
    default:
      return null;
  }
}

export interface TransformSnapshot {
  original: {
    id: number;
    name: string;
    displayName: string;
    types: string[];
    moves: StoredMove[];
    ivs: IVs;
    hp: number;
    maxHp: number;
  };
  hpPercentAtTransform: number;
  transformedStartHp: number;
}

export function buildTransformPatch(
  user: CaughtPokemon,
  enemy: CaughtPokemon,
): { patch: Partial<CaughtPokemon>; snapshot: TransformSnapshot } {
  const userMax = maxHpForMon(user);
  const cur = user.hp ?? userMax;
  const hpPercent = userMax > 0 ? cur / userMax : 1;
  const enemyMax = maxHpForMon(enemy);
  const newHp = Math.max(1, Math.round(enemyMax * hpPercent));
  const transformedStartHp = newHp;

  const snapshot: TransformSnapshot = {
    original: {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      types: [...user.types],
      moves: user.moves.map((m) => ({ ...m })),
      ivs: { ...user.ivs },
      hp: cur,
      maxHp: userMax,
    },
    hpPercentAtTransform: hpPercent,
    transformedStartHp,
  };

  const patch: Partial<CaughtPokemon> = {
    id: enemy.id,
    name: enemy.name,
    displayName: enemy.displayName,
    types: [...enemy.types],
    moves: enemy.moves.map((m) => ({ ...m })),
    ivs: { ...enemy.ivs },
    hp: newHp,
  };

  return { patch, snapshot };
}

export function revertTransform(
  user: CaughtPokemon,
  snapshot: TransformSnapshot,
): Partial<CaughtPokemon> {
  const orig = snapshot.original;
  const curHp = user.hp ?? snapshot.transformedStartHp;
  const damageTaken = Math.max(0, snapshot.transformedStartHp - curHp);
  const finalHp = Math.max(0, Math.min(orig.maxHp, orig.hp - damageTaken));
  return {
    id: orig.id,
    name: orig.name,
    displayName: orig.displayName,
    types: [...orig.types],
    moves: orig.moves.map((m) => ({ ...m })),
    ivs: { ...orig.ivs },
    hp: finalHp,
  };
}

export function applyThrashLock(volatiles: BattleVolatiles, slug: string): BattleVolatiles {
  const existing = volatiles.thrashLock;
  if (existing && existing.slug === slug && existing.turnsLeft > 0) {
    const turnsLeft = existing.turnsLeft - 1;
    if (turnsLeft <= 0) {
      return {
        ...volatiles,
        thrashLock: undefined,
        confusionTurns: 1 + Math.floor(Math.random() * 4),
      };
    }
    return { ...volatiles, thrashLock: { slug, turnsLeft } };
  }
  return { ...volatiles, thrashLock: { slug, turnsLeft: 2 } };
}

export function confusionSelfDamagePower(): number {
  return 40;
}

export function isConfused(volatiles: BattleVolatiles): boolean {
  return volatiles.confusionTurns > 0;
}

export function rollConfusionSelfHit(): boolean {
  return Math.random() < 0.5;
}

export function applyConfusionVolatile(turns = 1 + Math.floor(Math.random() * 4)): VolatilePatch {
  return { confusionTurns: turns };
}

export function checkOhko(attackerLevel: number, defenderLevel: number): boolean {
  return defenderLevel <= attackerLevel;
}

export function getCritStageBonus(volatiles: BattleVolatiles): number {
  return volatiles.focusEnergy ? 1 : 0;
}
