import type { CaughtPokemon, StatusCondition, StoredMove } from '../types/game';
import type { BattleVolatiles } from './battleVolatiles';
import {
  applyConfusionVolatile,
  applyThrashLock,
  buildTransformPatch,
  DRAIN_MOVES,
  getSecondaryStatusChance,
  getStatStageDelta,
  getVolatilePatchForStatusMove,
  metronomePickSlug,
  OHKO_MOVES,
  RECOIL_MOVES,
  rollMultiHitCount,
  rollTriAttackStatus,
  TRAP_MOVES,
  type TransformSnapshot,
} from './moveEffects';
import { canApplyStatus, createStatus } from '../utils/status';

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
  } else if (slug === 'disable' && ctx.defenderLastMoveSlug) {
    defenderVolatilesPatch = {
      ...defenderVolatilesPatch,
      disabledMoveSlug: ctx.defenderLastMoveSlug,
      disableTurns: 4,
    };
    messages.push(`${defender.displayName}'s ${ctx.defenderLastMoveSlug} was disabled!`);
  } else if (slug === 'confuse-ray' || slug === 'supersonic') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
    messages.push(`${defender.displayName} became confused!`);
  } else if (slug === 'swagger') {
    defenderStageDelta = applyStageDelta(defenderStageDelta, { atk: +2 });
    defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
    messages.push(`${defender.displayName}'s Attack sharply rose!`);
    messages.push(`${defender.displayName} became confused!`);
  } else if (ctx.move.statusEffect && canApplyStatus(defender, ctx.move.statusEffect)) {
    defenderStatus = createStatus(ctx.move.statusEffect);
    messages.push(`${defender.displayName} was inflicted with ${defenderStatus.kind}!`);
  } else if (
    statDelta ||
    volatilePatch ||
    ['rest', 'recover', 'soft-boiled', 'transform', 'metronome', 'disable', 'confuse-ray', 'supersonic', 'swagger'].includes(slug) ||
    (ctx.move.statusEffect && canApplyStatus(defender, ctx.move.statusEffect))
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
  attackerVolatiles: BattleVolatiles;
  defenderVolatiles: BattleVolatiles;
}

export interface PostDamageResult {
  messages: string[];
  defenderStatus?: StatusCondition;
  defenderVolatilesPatch?: Partial<BattleVolatiles>;
  attackerVolatilesPatch?: Partial<BattleVolatiles>;
  recoilDamage?: number;
  drainHeal?: number;
  selfFaint?: boolean;
}

export function resolvePostDamage(ctx: PostDamageContext): PostDamageResult {
  const { slug, move, attacker, defender, damageDealt, attackerVolatiles } = ctx;
  const messages: string[] = [];
  let defenderStatus: StatusCondition | undefined;
  let defenderVolatilesPatch: Partial<BattleVolatiles> | undefined;
  let attackerVolatilesPatch: Partial<BattleVolatiles> | undefined;
  let recoilDamage: number | undefined;
  let drainHeal: number | undefined;
  let selfFaint = false;

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

  if (damageDealt > 0) {
    if (slug === 'tri-attack' && Math.random() < getSecondaryStatusChance(slug)) {
      const kind = rollTriAttackStatus();
      if (canApplyStatus(defender, kind)) {
        defenderStatus = createStatus(kind);
        messages.push(`${defender.displayName} was inflicted with ${kind}!`);
      }
    } else if (move.statusEffect && Math.random() < getSecondaryStatusChance(slug)) {
      if (canApplyStatus(defender, move.statusEffect)) {
        defenderStatus = createStatus(move.statusEffect);
        messages.push(`${defender.displayName} was inflicted with ${move.statusEffect}!`);
      }
    } else if (
      (slug === 'confusion' || slug === 'psybeam') &&
      damageDealt > 0 &&
      Math.random() < getSecondaryStatusChance(slug)
    ) {
      defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
      messages.push(`${defender.displayName} became confused!`);
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

  return { messages, defenderStatus, defenderVolatilesPatch, attackerVolatilesPatch, recoilDamage, drainHeal, selfFaint };
}

export function resolveOhko(attackerLevel: number, defenderLevel: number, slug: string): boolean {
  if (!OHKO_MOVES.has(slug)) return false;
  return defenderLevel <= attackerLevel && Math.random() < 0.3 + (attackerLevel - defenderLevel) * 0.01;
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

export function effectiveAccuracy(slug: string, accuracy: number): number {
  if (slug === 'swift') return 100;
  return accuracy;
}
