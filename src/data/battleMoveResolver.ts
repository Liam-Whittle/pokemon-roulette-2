import type { CaughtPokemon, StatusCondition, StoredMove } from '../types/game';
import type { BattleField } from './battleField';
import type { BattleVolatiles } from './battleVolatiles';
import {
  applyConfusionVolatile,
  applyRolloutLock,
  applyThrashLock,
  BATON_PASS_HEAL,
  buildTransformPatch,
  COUNTER_MOVE_CATEGORY,
  DRAIN_MOVES,
  getPostDamageStageDelta,
  getSecondaryStatChance,
  getSecondaryStatusChance,
  getStatStageDelta,
  getVolatilePatchForStatusMove,
  HALF_HEAL_MOVES,
  metronomePickSlug,
  OHKO_MOVES,
  RECOIL_MOVES,
  rollMultiHitCount,
  storedMoveFromSlug,
  rollTriAttackStatus,
  SLEEP_TALK_EXCLUDED_SLUGS,
  TRAP_MOVES,
  TRAP_STATUS_MOVES,
  WEATHER_HEAL_MOVES,
  type TransformSnapshot,
} from './moveEffects';
import { canApplyStatus, createStatus, isAsleep } from '../utils/status';
import { hasSafeguard } from './battleVolatiles';
import { maxHpForMon } from '../utils/stats';
import { setWeatherFromMove } from './battleWeather';
import type { BattleWeather } from './battleField';

export type StatStages = {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  acc: number;
  eva: number;
};

export interface StatusMoveContext {
  slug: string;
  move: StoredMove;
  attacker: CaughtPokemon;
  defender: CaughtPokemon;
  attackerVolatiles: BattleVolatiles;
  defenderVolatiles: BattleVolatiles;
  transformTarget?: CaughtPokemon;
  defenderLastMoveSlug?: string | null;
  weather?: BattleWeather;
}

export interface StatusMoveResult {
  messages: string[];
  failed: boolean;
  attackerStageDelta?: StatStages;
  defenderStageDelta?: StatStages;
  attackerVolatilesPatch?: Partial<BattleVolatiles>;
  defenderVolatilesPatch?: Partial<BattleVolatiles>;
  defenderStatus?: StatusCondition;
  attackerStatus?: StatusCondition;
  transform?: { patch: Partial<CaughtPokemon>; snapshot: TransformSnapshot };
  metronomeSlug?: string;
  clearAttackerStatus?: boolean;
  attackerHpCost?: number;
  fieldPatch?: Partial<BattleField>;
  healFraction?: number;
  clearTrap?: boolean;
  sleepTalkPrimeOnly?: boolean;
  sleepTalkMove?: { move: StoredMove; powerMultiplier: number };
  clearSpikes?: boolean;
}

const ZERO_DELTA: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };

function applyStageDelta(base: StatStages, delta: Partial<StatStages>): StatStages {
  const next = { ...base };
  for (const key of Object.keys(delta) as (keyof StatStages)[]) {
    const d = delta[key];
    if (d != null) next[key] = Math.max(-6, Math.min(6, base[key] + d));
  }
  return next;
}

export function resolveStatusMove(ctx: StatusMoveContext): StatusMoveResult {
  const { slug, attacker, defender } = ctx;
  const messages: string[] = [];
  let failed = false;
  let attackerStageDelta = { ...ZERO_DELTA };
  let defenderStageDelta = { ...ZERO_DELTA };
  let attackerVolatilesPatch: Partial<BattleVolatiles> | undefined;
  let defenderVolatilesPatch: Partial<BattleVolatiles> | undefined;
  let defenderStatus: StatusCondition | undefined;
  let attackerStatus: StatusCondition | undefined;
  let transform: StatusMoveResult['transform'];
  let metronomeSlug: string | undefined;
  let clearAttackerStatus = false;
  let attackerHpCost: number | undefined;
  let fieldPatch: Partial<BattleField> | undefined;
  let healFraction: number | undefined;
  let clearTrap = false;
  let sleepTalkPrimeOnly = false;
  let sleepTalkMove: StatusMoveResult['sleepTalkMove'];
  let clearSpikes = false;

  const statDelta = getStatStageDelta(slug);
  if (statDelta?.self) {
    attackerStageDelta = applyStageDelta(attackerStageDelta, statDelta.self);
    if (slug === 'growth') {
      messages.push(`${attacker.displayName}'s offensive power grew!`);
    } else {
      messages.push(stageMessage(attacker.displayName, statDelta.self, true));
    }
  }
  if (statDelta?.foe) {
    defenderStageDelta = applyStageDelta(defenderStageDelta, statDelta.foe);
    messages.push(stageMessage(defender.displayName, statDelta.foe, false));
  }

  const volatilePatch = getVolatilePatchForStatusMove(slug);
  if (volatilePatch) {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, ...volatilePatch };
    if (slug === 'reflect') messages.push(`${attacker.displayName} raised a Reflect barrier!`);
    else if (slug === 'light-screen') messages.push(`${attacker.displayName} raised a Light Screen!`);
    else if (slug === 'barrier') messages.push(`${attacker.displayName} raised a barrier!`);
    else if (slug === 'focus-energy') messages.push(`${attacker.displayName} is getting pumped!`);
    else if (slug === 'leech-seed') {
      defenderVolatilesPatch = { leechSeeded: true };
      messages.push(`${defender.displayName} was seeded!`);
    }
  }

  if (slug === 'rest') {
    attackerStatus = createStatus('sleep');
    messages.push(`${attacker.displayName} slept and restored its HP!`);
  } else if (slug === 'recover' || slug === 'soft-boiled') {
    messages.push(`${attacker.displayName} regained health!`);
  } else if (slug === 'transform' && ctx.transformTarget) {
    const built = buildTransformPatch(attacker, ctx.transformTarget);
    transform = built;
    messages.push(`${attacker.displayName} transformed into ${ctx.transformTarget.displayName}!`);
  } else if (slug === 'metronome') {
    metronomeSlug = metronomePickSlug();
    messages.push(`${attacker.displayName} waggled a finger!`);
  } else if (slug === 'disable') {
    if (!ctx.defenderLastMoveSlug) {
      failed = true;
      messages.push('But it failed!');
    } else {
      const disabledName = storedMoveFromSlug(ctx.defenderLastMoveSlug)?.name ?? ctx.defenderLastMoveSlug;
      defenderVolatilesPatch = {
        ...defenderVolatilesPatch,
        disabledMoveSlug: ctx.defenderLastMoveSlug,
        disableTurns: 4,
      };
      messages.push(`${defender.displayName}'s ${disabledName} was disabled!`);
    }
  } else if (slug === 'confuse-ray' || slug === 'supersonic' || slug === 'sweet-kiss') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
    messages.push(`${defender.displayName} became confused!`);
  } else if (slug === 'mind-reader') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, mindReaderActive: true };
    messages.push(`${attacker.displayName} learned ${defender.displayName}'s move pattern!`);
  } else if (slug === 'safeguard') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, safeguardTurns: 5 };
    messages.push(`${attacker.displayName} cloaked itself in a mystical veil!`);
  } else if (TRAP_STATUS_MOVES.has(slug)) {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, trappedTurns: 5 };
    messages.push(`${defender.displayName} can no longer escape!`);
  } else if (slug === 'encore' && ctx.defenderLastMoveSlug) {
    defenderVolatilesPatch = {
      ...defenderVolatilesPatch,
      encoreMoveSlug: ctx.defenderLastMoveSlug,
      encoreTurns: 3,
    };
    messages.push(`${defender.displayName} received an encore!`);
  } else if (slug === 'heal-bell') {
    clearAttackerStatus = true;
    messages.push(`A bell chimed! ${attacker.displayName} was cured of its status!`);
  } else if (slug === 'curse') {
    if (attacker.types.includes('ghost')) {
      const maxHp = maxHpForMon(attacker);
      const curHp = attacker.hp ?? maxHp;
      const sacrifice = Math.max(1, Math.floor(maxHp / 2));
      if (curHp <= sacrifice) {
        failed = true;
        messages.push('But it failed!');
      } else {
        attackerHpCost = sacrifice;
        defenderVolatilesPatch = { ...defenderVolatilesPatch, cursed: true, leechSeeded: false };
        messages.push(`${defender.displayName} was cursed!`);
      }
    } else {
      attackerStageDelta = applyStageDelta(attackerStageDelta, { atk: +1, def: +1, spe: -1 });
      messages.push(`${attacker.displayName}'s Attack rose!`);
      messages.push(`${attacker.displayName}'s Defense rose!`);
      messages.push(`${attacker.displayName}'s Speed fell!`);
    }
  } else if (HALF_HEAL_MOVES.has(slug)) {
    messages.push(`${attacker.displayName} regained health!`);
    if (!WEATHER_HEAL_MOVES.has(slug)) {
      healFraction = 0.5;
    }
  } else if (slug === 'baton-pass') {
    clearTrap = true;
    healFraction = BATON_PASS_HEAL;
    attackerVolatilesPatch = { ...attackerVolatilesPatch, trappedTurns: 0 };
    messages.push(`${attacker.displayName} passed its problems!`);
  } else if (slug === 'spikes') {
    fieldPatch = { spikesActive: true };
    messages.push(`Spikes were scattered around the foe!`);
  } else if (slug === 'whirlwind') {
    const stats: (keyof StatStages)[] = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
    const pick = stats[Math.floor(Math.random() * stats.length)]!;
    defenderStageDelta = applyStageDelta(defenderStageDelta, { [pick]: -1 });
    messages.push(stageMessage(defender.displayName, { [pick]: -1 }, false));
  } else if (slug === 'sleep-talk') {
    if (isAsleep(attacker.status)) {
      if (!ctx.attackerVolatiles.sleepTalkEligible) {
        failed = true;
        messages.push('But it failed!');
      } else {
        const pool = attacker.moves.filter(
          (m) =>
            m.category !== 'status' &&
            m.power > 0 &&
            !SLEEP_TALK_EXCLUDED_SLUGS.has(m.slug),
        );
        if (pool.length === 0) {
          failed = true;
          messages.push('But it failed!');
        } else {
          const picked = pool[Math.floor(Math.random() * pool.length)]!;
          sleepTalkMove = { move: picked, powerMultiplier: 0.5 };
          attackerVolatilesPatch = { ...attackerVolatilesPatch, sleepTalkEligible: false };
          messages.push(`${attacker.displayName} talked in its sleep!`);
        }
      }
    } else {
      sleepTalkPrimeOnly = true;
      attackerVolatilesPatch = { ...attackerVolatilesPatch, sleepTalkPrimed: true };
      messages.push(`${attacker.displayName} is ready to talk in its sleep!`);
    }
  } else if (slug === 'swagger') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
    messages.push(`${defender.displayName} became confused!`);
  } else {
    const weatherSet = setWeatherFromMove(slug);
    if (weatherSet) {
      fieldPatch = { weather: weatherSet.weather, weatherTurns: weatherSet.turns };
      if (slug === 'sunny-day') messages.push(`The sunlight turned harsh!`);
      else messages.push(`It started to rain!`);
    } else if (ctx.move.statusEffect && canApplyStatus(defender, ctx.move.statusEffect) && !hasSafeguard(ctx.defenderVolatiles)) {
      defenderStatus = createStatus(ctx.move.statusEffect);
      messages.push(`${defender.displayName} was inflicted with ${defenderStatus.kind}!`);
    }
  }

  if (
    statDelta ||
    volatilePatch ||
    HALF_HEAL_MOVES.has(slug) ||
    TRAP_STATUS_MOVES.has(slug) ||
    sleepTalkPrimeOnly ||
    sleepTalkMove ||
    fieldPatch ||
  clearTrap ||
    slug === 'baton-pass' ||
    slug === 'spikes' ||
    slug === 'whirlwind' ||
    slug === 'sleep-talk' ||
    slug === 'sunny-day' ||
    slug === 'rain-dance' ||
    ['rest', 'recover', 'soft-boiled', 'transform', 'metronome', 'disable', 'confuse-ray', 'supersonic', 'sweet-kiss', 'swagger', 'mind-reader', 'safeguard', 'encore', 'heal-bell', 'curse'].includes(slug) ||
    (ctx.move.statusEffect && canApplyStatus(defender, ctx.move.statusEffect) && !hasSafeguard(ctx.defenderVolatiles))
  ) {
    // handled above
  } else if (ctx.move.statusEffect) {
    failed = true;
    messages.push('But it failed!');
  } else if (!statDelta && !volatilePatch) {
    failed = true;
    messages.push('But it failed!');
  }

  return {
    messages,
    failed,
    attackerStageDelta: hasStageChange(attackerStageDelta) ? attackerStageDelta : undefined,
    defenderStageDelta: hasStageChange(defenderStageDelta) ? defenderStageDelta : undefined,
    attackerVolatilesPatch,
    defenderVolatilesPatch,
    defenderStatus,
    attackerStatus,
    transform,
    metronomeSlug,
    clearAttackerStatus: clearAttackerStatus || undefined,
    attackerHpCost,
    fieldPatch,
    healFraction,
    clearTrap: clearTrap || undefined,
    sleepTalkPrimeOnly: sleepTalkPrimeOnly || undefined,
    sleepTalkMove,
    clearSpikes: clearSpikes || undefined,
  };
}

function hasStageChange(s: StatStages): boolean {
  return Object.values(s).some((v) => v !== 0);
}

function stageMessage(name: string, delta: Partial<StatStages>, self: boolean): string {
  const entries = Object.entries(delta) as [keyof StatStages, number][];
  const [stat, amount] = entries[0] ?? ['atk', 0];
  const label = statLabel(stat);
  const dir = amount > 0 ? 'rose' : 'fell';
  const harsh = Math.abs(amount) >= 2 ? ' sharply' : '';
  return self
    ? `${name}'s ${label}${harsh} ${dir}!`
    : `${name}'s ${label}${harsh} ${dir}!`;
}

function statLabel(stat: keyof StatStages): string {
  switch (stat) {
    case 'atk':
      return 'Attack';
    case 'def':
      return 'Defense';
    case 'spa':
      return 'Special Attack';
    case 'spd':
      return 'Special Defense';
    case 'spe':
      return 'Speed';
    case 'acc':
      return 'Accuracy';
    case 'eva':
      return 'Evasiveness';
    default:
      return stat;
  }
}

export interface PostDamageContext {
  slug: string;
  move: StoredMove;
  attacker: CaughtPokemon;
  defender: CaughtPokemon;
  damageDealt: number;
  connectingHits?: number;
  attackerVolatiles: BattleVolatiles;
  defenderVolatiles: BattleVolatiles;
}

export interface PostDamageResult {
  messages: string[];
  defenderStatus?: StatusCondition;
  defenderVolatilesPatch?: Partial<BattleVolatiles>;
  attackerVolatilesPatch?: Partial<BattleVolatiles>;
  attackerStageDelta?: StatStages;
  defenderStageDelta?: StatStages;
  recoilDamage?: number;
  drainHeal?: number;
  selfFaint?: boolean;
  clearMindReader?: boolean;
  clearSpikes?: boolean;
}

/** Present: random damage (40/80/120) or heal target 25% max HP. */
export function resolvePresent(
  attackerLevel: number,
): { kind: 'damage'; power: number } | { kind: 'heal'; fraction: number } {
  const roll = Math.random();
  if (roll < 0.4) return { kind: 'damage', power: 40 };
  if (roll < 0.8) return { kind: 'damage', power: 80 };
  if (roll < 0.9) return { kind: 'damage', power: 120 };
  void attackerLevel;
  return { kind: 'heal', fraction: 0.25 };
}

export function resolvePostDamage(ctx: PostDamageContext): PostDamageResult {
  const { slug, move, attacker, defender, damageDealt, connectingHits, attackerVolatiles, defenderVolatiles } = ctx;
  const messages: string[] = [];
  let defenderStatus: StatusCondition | undefined;
  let defenderVolatilesPatch: Partial<BattleVolatiles> | undefined;
  let attackerVolatilesPatch: Partial<BattleVolatiles> | undefined;
  let attackerStageDelta: StatStages = { ...ZERO_DELTA };
  let defenderStageDelta: StatStages = { ...ZERO_DELTA };
  let recoilDamage: number | undefined;
  let drainHeal: number | undefined;
  let selfFaint = false;
  let clearMindReader = attackerVolatiles.mindReaderActive;
  let clearSpikes = false;

  if (damageDealt > 0 && TRAP_MOVES.has(slug)) {
    const turns = 2 + Math.floor(Math.random() * 4);
    defenderVolatilesPatch = { trappedTurns: turns };
    messages.push(`${defender.displayName} was trapped!`);
  }

  if (damageDealt > 0 && (slug === 'thrash' || slug === 'petal-dance')) {
    attackerVolatilesPatch = applyThrashLock(attackerVolatiles, slug);
    if (attackerVolatilesPatch.confusionTurns && attackerVolatilesPatch.confusionTurns > 0) {
      messages.push(`${attacker.displayName} became confused!`);
    }
  }

  if (damageDealt > 0 && slug === 'rollout') {
    attackerVolatilesPatch = applyRolloutLock(attackerVolatiles);
  }

  if (damageDealt > 0 && slug === 'rapid-spin') {
    attackerVolatilesPatch = {
      ...attackerVolatilesPatch,
      trappedTurns: 0,
      leechSeeded: false,
    };
    clearSpikes = true;
    messages.push(`${attacker.displayName} blew away the spikes!`);
  }

  if (damageDealt > 0) {
    if (slug === 'tri-attack' && Math.random() < getSecondaryStatusChance(slug)) {
      const kind = rollTriAttackStatus();
      if (canApplyStatus(defender, kind) && !hasSafeguard(defenderVolatiles)) {
        defenderStatus = createStatus(kind);
        messages.push(`${defender.displayName} was inflicted with ${kind}!`);
      }
    } else if (move.statusEffect && slug === 'twineedle' && connectingHits && connectingHits > 0) {
      for (let i = 0; i < connectingHits; i++) {
        if (defenderStatus) break;
        if (Math.random() < getSecondaryStatusChance(slug)) {
          if (canApplyStatus(defender, move.statusEffect) && !hasSafeguard(defenderVolatiles)) {
            defenderStatus = createStatus(move.statusEffect);
            messages.push(`${defender.displayName} was inflicted with ${move.statusEffect}!`);
          }
        }
      }
    } else if (move.statusEffect && Math.random() < getSecondaryStatusChance(slug)) {
      if (canApplyStatus(defender, move.statusEffect) && !hasSafeguard(defenderVolatiles)) {
        defenderStatus = createStatus(move.statusEffect);
        messages.push(`${defender.displayName} was inflicted with ${move.statusEffect}!`);
      }
    } else if (
      (slug === 'confusion' || slug === 'psybeam' || slug === 'dynamic-punch') &&
      damageDealt > 0 &&
      Math.random() < (slug === 'dynamic-punch' ? 1 : getSecondaryStatusChance(slug))
    ) {
      defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
      messages.push(`${defender.displayName} became confused!`);
    }
  }

  const postStat = getPostDamageStageDelta(slug);
  if (damageDealt > 0 && postStat && Math.random() < getSecondaryStatChance(slug)) {
    if (postStat.self) {
      attackerStageDelta = applyStageDelta(attackerStageDelta, postStat.self);
      messages.push(stageMessage(attacker.displayName, postStat.self, true));
    }
    if (postStat.foe) {
      defenderStageDelta = applyStageDelta(defenderStageDelta, postStat.foe);
      messages.push(stageMessage(defender.displayName, postStat.foe, false));
    }
  }

  const recoilFrac = RECOIL_MOVES[slug];
  if (recoilFrac && damageDealt > 0) {
    recoilDamage = Math.max(1, Math.floor(damageDealt * recoilFrac));
    messages.push(`${attacker.displayName} is damaged by recoil!`);
  }

  const drainFrac = DRAIN_MOVES[slug];
  if (drainFrac && damageDealt > 0) {
    drainHeal = Math.max(1, Math.floor(damageDealt * drainFrac));
    messages.push(`${attacker.displayName} drained energy!`);
  }

  if ((slug === 'self-destruct' || slug === 'explosion') && damageDealt > 0) {
    selfFaint = true;
  }

  if (clearMindReader) {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, mindReaderActive: false };
  }

  return {
    messages,
    defenderStatus,
    defenderVolatilesPatch,
    attackerVolatilesPatch,
    attackerStageDelta: hasStageChange(attackerStageDelta) ? attackerStageDelta : undefined,
    defenderStageDelta: hasStageChange(defenderStageDelta) ? defenderStageDelta : undefined,
    recoilDamage,
    drainHeal,
    selfFaint,
    clearMindReader,
    clearSpikes: clearSpikes || undefined,
  };
}

export function resolveOhko(attackerLevel: number, defenderLevel: number, slug: string): boolean {
  if (!OHKO_MOVES.has(slug)) return false;
  // The move's own accuracy already gated the hit; a connecting OHKO always
  // faints the target as long as it isn't higher level than the attacker.
  return defenderLevel <= attackerLevel;
}

export function getMultiHitCount(slug: string): number {
  return rollMultiHitCount(slug);
}

export function mergeStageDelta(base: StatStages, delta?: StatStages): StatStages {
  if (!delta) return base;
  return applyStageDelta(base, delta);
}

export function applyVolatilesPatch(v: BattleVolatiles, patch?: Partial<BattleVolatiles>): BattleVolatiles {
  if (!patch) return v;
  return { ...v, ...patch };
}

export function effectiveAccuracy(
  slug: string,
  accuracy: number,
  attackerVolatiles?: BattleVolatiles,
  weather: BattleWeather = 'none',
): number {
  if (slug === 'swift' || slug === 'feint-attack') return 100;
  if (slug === 'thunder' && weather === 'rain') return 100;
  if (attackerVolatiles?.mindReaderActive) return 100;
  return accuracy;
}

/** Volatile patch when sleep is newly applied. */
export function volatilesPatchOnSleep(volatiles: BattleVolatiles): Partial<BattleVolatiles> {
  if (volatiles.sleepTalkPrimed) {
    return { sleepTalkEligible: true, sleepTalkPrimed: false };
  }
  return { sleepTalkPrimed: false };
}

export function isCounterMove(slug: string): boolean {
  return slug in COUNTER_MOVE_CATEGORY;
}

export function resolveCounterMove(
  slug: string,
  attackerName: string,
  moveName: string,
): { messages: string[]; attackerVolatilesPatch: Partial<BattleVolatiles> } {
  const category = COUNTER_MOVE_CATEGORY[slug]!;
  return {
    messages: [`${attackerName} used ${moveName}!`],
    attackerVolatilesPatch: { counterPending: { category, damage: 0 } },
  };
}

export function counterReleaseDamage(pending: NonNullable<BattleVolatiles['counterPending']>): number {
  if (pending.damage <= 0) return 0;
  return pending.damage * 2;
}
