import type { CaughtPokemon, EVs, IVs, NatureId, StatusAilment, StoredMove } from '../types/game';
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
  'dive',
  'sky-attack',
  'razor-wind',
]);

/** Two-turn moves that make the user untargetable until they strike. */
export const SEMI_INVULNERABLE_MOVE_SLUGS = new Set(['fly', 'dig', 'dive']);

export function isSemiInvulnerableMove(slug: string): boolean {
  return SEMI_INVULNERABLE_MOVE_SLUGS.has(slug);
}

export function chargeMoveMessage(displayName: string, slug: string, moveName: string): string {
  if (slug === 'fly') return `${displayName} flew up high!`;
  if (slug === 'dig') return `${displayName} dug underground!`;
  if (slug === 'dive') return `${displayName} hid underwater!`;
  if (slug === 'solar-beam') return `${displayName} is taking in sunlight!`;
  return `${displayName} is charging ${moveName}!`;
}

export const RECHARGE_MOVE_SLUGS = new Set(['hyper-beam', 'blast-burn', 'frenzy-plant', 'hydro-cannon']);

export const MULTI_HIT_MOVES: Record<string, { min: number; max: number }> = {
  'pin-missile': { min: 2, max: 5 },
  'fury-attack': { min: 2, max: 5 },
  'comet-punch': { min: 2, max: 5 },
  twineedle: { min: 2, max: 5 },
  bonemerang: { min: 2, max: 2 },
  'rock-blast': { min: 2, max: 5 },
  'double-kick': { min: 2, max: 2 },
  'triple-kick': { min: 1, max: 3 },
  'bullet-seed': { min: 2, max: 5 },
  'fury-swipes': { min: 2, max: 5 },
  'arm-thrust': { min: 2, max: 5 },
  barrage: { min: 2, max: 5 },
  'bone-rush': { min: 2, max: 5 },
  'double-slap': { min: 2, max: 5 },
  'icicle-spear': { min: 2, max: 5 },
  'spike-cannon': { min: 2, max: 5 },
  'beat-up': { min: 2, max: 5 },
};

export const RECOIL_MOVES: Record<string, number> = {
  submission: 0.25,
  'double-edge': 0.25,
  'take-down': 0.25,
  'volt-tackle': 1 / 3,
};

export const TRAP_MOVES = new Set(['wrap', 'bind', 'fire-spin', 'clamp', 'sand-tomb', 'whirlpool']);
export const TRAP_STATUS_MOVES = new Set(['mean-look', 'spider-web', 'block']);

export const PRIORITY_MOVES: Record<string, number> = {
  'quick-attack': 1,
  'extreme-speed': 2,
  'mach-punch': 1,
  'fake-out': 3,
  protect: 4,
  detect: 4,
  endure: 4,
  'magic-coat': 4,
  'vital-throw': -1,
  'focus-punch': -3,
  revenge: -4,
};

/** Chance to flinch the target after a damaging hit (0–1). */
export const FLINCH_MOVES: Record<string, number> = {
  'fake-out': 1,
  bite: 0.3,
  headbutt: 0.3,
  stomp: 0.3,
  'rolling-kick': 0.3,
  'needle-arm': 0.3,
  astonish: 0.3,
  'rock-slide': 0.3,
  'sky-attack': 0.3,
  snore: 0.3,
  twister: 0.2,
  waterfall: 0.2,
  'bone-club': 0.1,
  extrasensory: 0.1,
  'hyper-fang': 0.1,
};

export function getFlinchChance(slug: string): number {
  return FLINCH_MOVES[slug] ?? 0;
}

/** Damaging moves that fail before they strike. */
export function getDamagingMoveFailReason(
  slug: string,
  opts: { enteredThisTurn?: boolean; asleep?: boolean; stockpileCount?: number },
): string | null {
  if (slug === 'fake-out' && !opts.enteredThisTurn) return 'But it failed!';
  if ((slug === 'snore' || slug === 'dream-eater') && !opts.asleep) return 'But it failed!';
  if (slug === 'spit-up' && !(opts.stockpileCount && opts.stockpileCount > 0)) return 'But it failed!';
  return null;
}

export const HALF_HEAL_MOVES = new Set([
  'recover',
  'soft-boiled',
  'milk-drink',
  'synthesis',
  'morning-sun',
  'moonlight',
  'slack-off',
]);

export const WEATHER_HEAL_MOVES = new Set(['synthesis', 'morning-sun', 'moonlight']);

export const BATON_PASS_HEAL = 0.25;

export const COUNTER_MOVE_CATEGORY: Record<string, 'physical' | 'special'> = {
  counter: 'physical',
  'mirror-coat': 'special',
};

export const SLEEP_TALK_EXCLUDED_SLUGS = new Set([
  'sleep-talk',
  'solar-beam',
  'skull-bash',
  'fly',
  'dig',
  'dive',
  'sky-attack',
  'razor-wind',
  'hyper-beam',
  'blast-burn',
  'frenzy-plant',
  'hydro-cannon',
]);

export const OHKO_MOVES = new Set(['guillotine', 'horn-drill', 'fissure', 'sheer-cold']);

export const SELF_FAINT_MOVES = new Set(['explosion', 'self-destruct', 'selfdestruct']);

export function isSelfFaintMove(slug: string): boolean {
  return SELF_FAINT_MOVES.has(slug);
}

export const DRAIN_MOVES: Record<string, number> = {
  absorb: 0.5,
  'mega-drain': 0.5,
  'leech-life': 0.5,
  'giga-drain': 0.5,
  'dream-eater': 0.5,
};

export function getMovePriority(slug: string): number {
  return PRIORITY_MOVES[slug] ?? 0;
}

export function rollMultiHitCount(slug: string, maxHits = false): number {
  const range = MULTI_HIT_MOVES[slug];
  if (!range) return 1;
  if (maxHits) return range.max;
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
}

export function getSecondaryStatusChance(slug: string): number {
  if (slug === 'tri-attack') return 0.2;
  if (slug === 'sacred-fire') return 0.5;
  if (slug === 'dragon-breath') return 0.3;
  if (slug === 'bounce') return 0.3;
  if (slug === 'twineedle') return 0.2;
  return 0.1;
}

/** Chance for post-damage stat stage changes (0–1). */
export function getSecondaryStatChance(slug: string): number {
  if (slug === 'metal-claw' || slug === 'steel-wing') return 0.1;
  if (slug === 'crunch') return 0.2;
  if (slug === 'octazooka' || slug === 'crush-claw' || slug === 'rock-smash') return 0.5;
  if (slug === 'ancient-power' || slug === 'silver-wind') return 0.1;
  if (slug === 'meteor-mash') return 0.2;
  if (slug === 'iron-tail' || slug === 'muddy-water') return 0.3;
  if (
    slug === 'psychic' ||
    slug === 'shadow-ball' ||
    slug === 'bubble-beam' ||
    slug === 'acid' ||
    slug === 'aurora-beam' ||
    slug === 'bubble' ||
    slug === 'constrict'
  ) {
    return 0.1;
  }
  if (slug === 'luster-purge' || slug === 'mist-ball') return 0.5;
  return 1;
}

/** Chance to confuse on a damaging hit (0–1). */
export const CONFUSION_ON_HIT: Record<string, number> = {
  confusion: 0.1,
  psybeam: 0.1,
  'signal-beam': 0.1,
  'dynamic-punch': 1,
  'dizzy-punch': 0.2,
  'water-pulse': 0.2,
};

export function getConfusionOnHitChance(slug: string): number {
  return CONFUSION_ON_HIT[slug] ?? 0;
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
      return { self: { spa: +1 } };
    case 'minimize':
      return { self: { eva: +1 } };
    case 'swagger':
      return { foe: { atk: +2 } };
    case 'amnesia':
      return { self: { spd: +2 } };
    case 'charm':
      return { foe: { atk: -2 } };
    case 'double-team':
      return { self: { eva: +1 } };
    case 'howl':
      return { self: { atk: +1 } };
    case 'bulk-up':
      return { self: { atk: +1, def: +1 } };
    case 'calm-mind':
      return { self: { spa: +1, spd: +1 } };
    case 'dragon-dance':
      return { self: { atk: +1, spe: +1 } };
    case 'iron-defense':
      return { self: { def: +2 } };
    case 'tail-glow':
      return { self: { spa: +2 } };
    case 'acid-armor':
      return { self: { def: +2 } };
    case 'cosmic-power':
      return { self: { def: +1, spd: +1 } };
    case 'cotton-spore':
      return { foe: { spe: -2 } };
    case 'fake-tears':
      return { foe: { spd: -2 } };
    case 'feather-dance':
      return { foe: { atk: -2 } };
    case 'kinesis':
      return { foe: { acc: -1 } };
    case 'metal-sound':
      return { foe: { spd: -2 } };
    case 'scary-face':
      return { foe: { spe: -2 } };
    case 'sweet-scent':
      return { foe: { eva: -1 } };
    case 'tickle':
      return { foe: { atk: -1, def: -1 } };
    case 'flatter':
      return { foe: { spa: +2 } };
    case 'charge':
      return { self: { spd: +1 } };
    case 'helping-hand':
      return { self: { atk: +1, spa: +1 } };
    case 'follow-me':
      return { self: { eva: +1 } };
    case 'teleport':
      return { self: { spe: +2 } };
    default:
      return null;
  }
}

/** Post-damage stat stage changes (attacker perspective). */
export function getPostDamageStageDelta(slug: string): {
  self?: StatStageDelta;
  foe?: StatStageDelta;
} | null {
  switch (slug) {
    case 'icy-wind':
      return { foe: { spe: -1 } };
    case 'metal-claw':
      return { self: { atk: +1 } };
    case 'steel-wing':
      return { self: { def: +1 } };
    case 'crunch':
      return { foe: { def: -1 } };
    case 'octazooka':
      return { foe: { acc: -1 } };
    case 'ancient-power':
    case 'silver-wind':
      return { self: { atk: +1, def: +1, spa: +1, spd: +1, spe: +1 } };
    case 'meteor-mash':
      return { self: { atk: +1 } };
    case 'iron-tail':
      return { foe: { def: -1 } };
    case 'psychic':
    case 'shadow-ball':
      return { foe: { spd: -1 } };
    case 'bubble-beam':
    case 'rock-tomb':
      return { foe: { spe: -1 } };
    case 'knock-off':
      return { foe: { def: -1 } };
    case 'acid':
      return { foe: { spd: -1 } };
    case 'aurora-beam':
      return { foe: { atk: -1 } };
    case 'bubble':
    case 'constrict':
    case 'mud-shot':
      return { foe: { spe: -1 } };
    case 'crush-claw':
    case 'rock-smash':
      return { foe: { def: -1 } };
    case 'luster-purge':
      return { foe: { spd: -1 } };
    case 'mist-ball':
      return { foe: { spa: -1 } };
    case 'mud-slap':
    case 'muddy-water':
      return { foe: { acc: -1 } };
    case 'overheat':
    case 'psycho-boost':
      return { self: { spa: -2 } };
    case 'superpower':
      return { self: { atk: -1, def: -1 } };
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
    evs: EVs;
    nature: NatureId;
    level: number;
    sprite: string;
    shinySprite?: string;
    shiny?: boolean;
    hp: number;
    maxHp: number;
  };
  hpPercentAtTransform: number;
  transformedStartHp: number;
}

/** Copy species, moves, IVs/EVs/nature/level/sprites — keep user's HP%. */
export function buildTransformPatch(
  user: CaughtPokemon,
  target: CaughtPokemon,
): { patch: Partial<CaughtPokemon>; snapshot: TransformSnapshot } {
  const userMax = maxHpForMon(user);
  const cur = user.hp ?? userMax;
  const hpPercent = userMax > 0 ? cur / userMax : 1;
  const asTarget: CaughtPokemon = {
    ...user,
    id: target.id,
    ivs: { ...target.ivs },
    evs: { ...target.evs },
    nature: target.nature,
    level: target.level,
  };
  const newMax = maxHpForMon(asTarget);
  const newHp = Math.max(1, Math.round(newMax * hpPercent));
  const transformedStartHp = newHp;
  const targetName = target.nickname ?? target.displayName;

  const snapshot: TransformSnapshot = {
    original: {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      types: [...user.types],
      moves: user.moves.map((m) => ({ ...m })),
      ivs: { ...user.ivs },
      evs: { ...user.evs },
      nature: user.nature,
      level: user.level,
      sprite: user.sprite,
      shinySprite: user.shinySprite,
      shiny: user.shiny,
      hp: cur,
      maxHp: userMax,
    },
    hpPercentAtTransform: hpPercent,
    transformedStartHp,
  };

  const patch: Partial<CaughtPokemon> = {
    id: target.id,
    name: target.name,
    displayName: targetName,
    types: [...target.types],
    moves: target.moves.map((m) => ({ ...m })),
    ivs: { ...target.ivs },
    evs: { ...target.evs },
    nature: target.nature,
    level: target.level,
    sprite: target.sprite,
    shinySprite: target.shinySprite,
    shiny: target.shiny,
    hp: newHp,
    pp: Object.fromEntries(target.moves.map((m) => [m.slug, m.maxPp])),
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
    evs: { ...orig.evs },
    nature: orig.nature,
    level: orig.level,
    sprite: orig.sprite,
    shinySprite: orig.shinySprite,
    shiny: orig.shiny,
    hp: finalHp,
  };
}

export function pickRandomTransformTarget(party: CaughtPokemon[]): CaughtPokemon | null {
  if (party.length === 0) return null;
  return party[Math.floor(Math.random() * party.length)] ?? null;
}

export function enemyNeedsAutoTransform(mon: CaughtPokemon): boolean {
  return mon.id === 132 && mon.moves.some((m) => m.slug === 'transform');
}

export function applyRolloutLock(volatiles: BattleVolatiles): BattleVolatiles {
  const existing = volatiles.rolloutLock;
  if (existing && existing.turnsLeft > 0) {
    const turnsLeft = existing.turnsLeft - 1;
    if (turnsLeft <= 0) {
      return { ...volatiles, rolloutLock: undefined };
    }
    return {
      ...volatiles,
      rolloutLock: { turnsLeft, power: Math.min(480, existing.power * 2) },
    };
  }
  return { ...volatiles, rolloutLock: { turnsLeft: 4, power: 30 } };
}

export function getRolloutPower(volatiles: BattleVolatiles): number {
  return volatiles.rolloutLock?.power ?? 30;
}

export function isRolloutLocked(volatiles: BattleVolatiles): boolean {
  return (volatiles.rolloutLock?.turnsLeft ?? 0) > 0;
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

export const NEVER_MISS_MOVE_SLUGS = new Set([
  'swift',
  'feint-attack',
  'aerial-ace',
  'shock-wave',
  'vital-throw',
  'magical-leaf',
  'shadow-punch',
]);

export const CRASH_MOVE_SLUGS = new Set(['high-jump-kick', 'jump-kick']);

export const PROTECT_MOVE_SLUGS = new Set(['protect', 'detect']);

export const DELAYED_ATTACK_SLUGS = new Set(['doom-desire']);

export function isCrashMove(slug: string): boolean {
  return CRASH_MOVE_SLUGS.has(slug);
}

export function getCrashDamage(maxHp: number): number {
  return Math.max(1, Math.floor(maxHp / 2));
}

export function isProtectMove(slug: string): boolean {
  return PROTECT_MOVE_SLUGS.has(slug);
}

export function rollProtectSuccess(streak: number): boolean {
  if (streak <= 0) return true;
  return Math.random() < 1 / 3;
}

export function canHitSemiInvulnerable(moveSlug: string, semiSlug?: string): boolean {
  if (!semiSlug) return true;
  if (moveSlug === 'sky-uppercut' && semiSlug === 'fly') return true;
  if ((moveSlug === 'surf' || moveSlug === 'whirlpool') && semiSlug === 'dive') return true;
  if (moveSlug === 'earthquake' && semiSlug === 'dig') return true;
  if (moveSlug === 'gust' || moveSlug === 'twister') {
    if (semiSlug === 'fly') return true;
  }
  return false;
}

export function naturePowerSlug(weather: 'none' | 'sunny' | 'rain' | 'hail' | 'sandstorm'): string {
  if (weather === 'sunny') return 'flamethrower';
  if (weather === 'rain') return 'surf';
  if (weather === 'hail') return 'ice-beam';
  if (weather === 'sandstorm') return 'earthquake';
  return 'swift';
}

export function camouflageType(weather: 'none' | 'sunny' | 'rain' | 'hail' | 'sandstorm'): string {
  if (weather === 'sunny') return 'fire';
  if (weather === 'rain') return 'water';
  if (weather === 'hail') return 'ice';
  if (weather === 'sandstorm') return 'ground';
  return 'normal';
}

export function typeThatResists(moveType: string): string {
  const resists: Record<string, string> = {
    normal: 'rock',
    fire: 'water',
    water: 'grass',
    electric: 'ground',
    grass: 'fire',
    ice: 'steel',
    fighting: 'flying',
    poison: 'steel',
    ground: 'flying',
    flying: 'electric',
    psychic: 'dark',
    bug: 'fire',
    rock: 'fighting',
    ghost: 'dark',
    dragon: 'steel',
    dark: 'fighting',
    steel: 'fire',
  };
  return resists[moveType] ?? 'normal';
}

export function spitUpPower(stockpileCount: number): number {
  if (stockpileCount <= 0) return 0;
  return Math.min(3, stockpileCount) * 100;
}

export function swallowHealFraction(stockpileCount: number): number {
  if (stockpileCount <= 0) return 0;
  if (stockpileCount === 1) return 0.25;
  if (stockpileCount === 2) return 0.5;
  return 1;
}

export const ASSIST_EXCLUDED_SLUGS = new Set([
  'assist',
  'metronome',
  'sleep-talk',
  'mimic',
  'mirror-move',
  'sketch',
  'nature-power',
  'copycat',
]);

export function sportTypeMultiplier(
  moveType: string,
  field: { mudSport?: boolean; waterSport?: boolean },
): number {
  if (moveType === 'electric' && field.mudSport) return 0.5;
  if (moveType === 'fire' && field.waterSport) return 0.5;
  return 1;
}

export function isFacadeBoosted(statusKind?: string | null): boolean {
  return statusKind === 'burn' || statusKind === 'poison' || statusKind === 'toxic' || statusKind === 'paralysis';
}

export function weatherBallType(weather: 'none' | 'sunny' | 'rain' | 'hail' | 'sandstorm'): string {
  if (weather === 'sunny') return 'fire';
  if (weather === 'rain') return 'water';
  if (weather === 'hail') return 'ice';
  if (weather === 'sandstorm') return 'rock';
  return 'normal';
}

export function weatherBallPower(basePower: number, weather: 'none' | 'sunny' | 'rain' | 'hail' | 'sandstorm'): number {
  return weather === 'none' ? basePower : basePower * 2;
}

export function isWeatherResidualImmune(
  types: string[],
  weather: 'none' | 'sunny' | 'rain' | 'hail' | 'sandstorm',
): boolean {
  if (weather === 'hail') return types.includes('ice');
  if (weather === 'sandstorm') {
    return types.includes('rock') || types.includes('ground') || types.includes('steel');
  }
  return true;
}

export function weatherResidualDamage(maxHp: number): number {
  return Math.max(1, Math.floor(maxHp / 16));
}

export function statusBlockedBySubstitute(slug: string): boolean {
  if (slug === 'perish-song' || slug === 'spikes') return false;
  if (slug === 'sunny-day' || slug === 'rain-dance' || slug === 'hail' || slug === 'sandstorm') return false;
  if (slug === 'pain-split') return false;
  return true;
}
