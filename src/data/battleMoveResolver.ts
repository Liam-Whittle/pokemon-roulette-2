import {
  abilityBlocksConfusion,
  abilityBlocksFlinch,
  abilityBlocksForcedSwitch,
  abilityBlocksRecoil,
  abilityDrainHurtsAttacker,
  abilityPreventsStatDrop,
  abilityRewriteStageDelta,
  abilitySecondaryChanceMultForHit,
  getMonAbility,
  weatherIsSuppressed,
} from './abilities';
import type { CaughtPokemon, StatusCondition, StoredMove } from '../types/game';
import type { BattleField } from './battleField';
import type { BattleVolatiles } from './battleVolatiles';
import {
  applyConfusionVolatile,
  applyRolloutLock,
  applyThrashLock,
  ASSIST_EXCLUDED_SLUGS,
  BATON_PASS_HEAL,
  buildTransformPatch,
  camouflageType,
  COUNTER_MOVE_CATEGORY,
  DRAIN_MOVES,
  getConfusionOnHitChance,
  getFlinchChance,
  getPostDamageStageDelta,
  getSecondaryStatChance,
  getSecondaryStatusChance,
  getStatStageDelta,
  getVolatilePatchForStatusMove,
  HALF_HEAL_MOVES,
  isProtectMove,
  metronomePickSlug,
  naturePowerSlug,
  NEVER_MISS_MOVE_SLUGS,
  rollProtectSuccess,
  OHKO_MOVES,
  RECOIL_MOVES,
  isSelfFaintMove,
  rollMultiHitCount,
  storedMoveFromSlug,
  rollTriAttackStatus,
  SLEEP_TALK_EXCLUDED_SLUGS,
  swallowHealFraction,
  TRAP_MOVES,
  TRAP_STATUS_MOVES,
  typeThatResists,
  WEATHER_HEAL_MOVES,
  type TransformSnapshot,
} from './moveEffects';
import { canApplyStatus, createStatus, isAsleep } from '../utils/status';
import { hasMist, hasSafeguard } from './battleVolatiles';
import { maxHpForMon } from '../utils/stats';
import { setWeatherFromMove, weatherSetMessage } from './battleWeather';
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
  attackerLastMoveSlug?: string | null;
  attackerParty?: CaughtPokemon[];
  attackerStages?: StatStages;
  defenderStages?: StatStages;
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
  attackerStageSet?: Partial<StatStages>;
  painSplitHp?: { attackerHp: number; defenderHp: number };
  haze?: boolean;
  copyFoeStages?: boolean;
  swapStages?: boolean;
  selfFaint?: boolean;
  healPartyStatus?: boolean;
  restorePp?: boolean;
  cutPpSlug?: string;
  attackerTypes?: string[];
  attackerAbility?: string;
  defenderAbility?: string;
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
  let attackerStageSet: Partial<StatStages> | undefined;
  let painSplitHp: StatusMoveResult['painSplitHp'];
  let haze = false;
  let copyFoeStages = false;
  let swapStages = false;
  let selfFaint = false;
  let healPartyStatus = false;
  let restorePp = false;
  let cutPpSlug: string | undefined;
  let attackerTypes: string[] | undefined;
  let attackerAbility: string | undefined;
  let defenderAbility: string | undefined;

  const statDelta = getStatStageDelta(slug);
  if (statDelta?.self) {
    attackerStageDelta = applyStageDelta(attackerStageDelta, statDelta.self);
    if (slug === 'growth') {
      messages.push(`${attacker.displayName}'s offensive power grew!`);
    } else {
      messages.push(...stageMessages(attacker.displayName, statDelta.self));
    }
  }
  if (statDelta?.foe) {
    if (hasMist(ctx.defenderVolatiles)) {
      messages.push(`${defender.displayName} is protected by Mist!`);
    } else {
      defenderStageDelta = applyStageDelta(defenderStageDelta, statDelta.foe);
      messages.push(...stageMessages(defender.displayName, statDelta.foe));
    }
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
  } else if (slug === 'confuse-ray' || slug === 'supersonic' || slug === 'sweet-kiss' || slug === 'teeter-dance') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
    messages.push(`${defender.displayName} became confused!`);
  } else if (slug === 'mind-reader' || slug === 'lock-on') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, mindReaderActive: true };
    messages.push(`${attacker.displayName} took aim!`);
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
  } else if (slug === 'heal-bell' || slug === 'refresh' || slug === 'aromatherapy') {
    clearAttackerStatus = true;
    if (slug === 'aromatherapy') healPartyStatus = true;
    messages.push(
      slug === 'aromatherapy'
        ? `A soothing aroma cured the party's status!`
        : slug === 'refresh'
          ? `${attacker.displayName} refreshed itself!`
          : `A bell chimed! ${attacker.displayName} was cured of its status!`,
    );
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
  } else if (slug === 'whirlwind' || slug === 'roar') {
    if (abilityBlocksForcedSwitch(getMonAbility(defender))) {
      failed = true;
      messages.push(`${defender.displayName} anchored itself with Suction Cups!`);
    } else {
      const stats: (keyof StatStages)[] = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
      const pick = stats[Math.floor(Math.random() * stats.length)]!;
      defenderStageDelta = applyStageDelta(defenderStageDelta, { [pick]: -1 });
      messages.push(...stageMessages(defender.displayName, { [pick]: -1 }));
    }
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
  } else if (slug === 'swagger' || slug === 'flatter') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
    messages.push(`${defender.displayName} became confused!`);
  } else if (isProtectMove(slug)) {
    const streak = ctx.attackerVolatiles.protectStreak ?? 0;
    if (!rollProtectSuccess(streak)) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerVolatilesPatch = {
        ...attackerVolatilesPatch,
        protected: true,
        protectStreak: streak + 1,
        usedProtectThisTurn: true,
      };
      messages.push(`${attacker.displayName} protected itself!`);
    }
  } else if (slug === 'substitute') {
    const maxHp = maxHpForMon(attacker);
    const curHp = attacker.hp ?? maxHp;
    const cost = Math.max(1, Math.floor(maxHp / 4));
    if (curHp <= cost || (ctx.attackerVolatiles.substituteHp ?? 0) > 0) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerHpCost = cost;
      attackerVolatilesPatch = { ...attackerVolatilesPatch, substituteHp: cost };
      messages.push(`${attacker.displayName} put up a substitute!`);
    }
  } else if (slug === 'yawn') {
    if (defender.status || (ctx.defenderVolatiles.yawnTurns ?? 0) > 0 || hasSafeguard(ctx.defenderVolatiles)) {
      failed = true;
      messages.push('But it failed!');
    } else {
      defenderVolatilesPatch = { ...defenderVolatilesPatch, yawnTurns: 2 };
      messages.push(`${defender.displayName} grew drowsy!`);
    }
  } else if (slug === 'wish') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, wishTurns: 2 };
    messages.push(`${attacker.displayName} made a wish!`);
  } else if (slug === 'belly-drum') {
    const maxHp = maxHpForMon(attacker);
    const curHp = attacker.hp ?? maxHp;
    const cost = Math.max(1, Math.floor(maxHp / 2));
    if (curHp <= cost) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerHpCost = cost;
      attackerStageSet = { atk: 6 };
      messages.push(`${attacker.displayName} cut its HP and maximized Attack!`);
    }
  } else if (slug === 'taunt') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, tauntTurns: 3 };
    messages.push(`${defender.displayName} fell for the taunt!`);
  } else if (slug === 'attract') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, infatuated: true };
    messages.push(`${defender.displayName} fell in love!`);
  } else if (slug === 'pain-split') {
    const atkMax = maxHpForMon(attacker);
    const defMax = maxHpForMon(defender);
    const atkHp = attacker.hp ?? atkMax;
    const defHp = defender.hp ?? defMax;
    const avg = Math.floor((atkHp + defHp) / 2);
    painSplitHp = {
      attackerHp: Math.min(atkMax, avg),
      defenderHp: Math.min(defMax, avg),
    };
    messages.push(`The battlers shared their pain!`);
  } else if (slug === 'destiny-bond') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, destinyBond: true };
    messages.push(`${attacker.displayName} is trying to take its foe down with it!`);
  } else if (slug === 'perish-song') {
    attackerVolatilesPatch = {
      ...attackerVolatilesPatch,
      perishTurns: ctx.attackerVolatiles.perishTurns ?? 3,
    };
    defenderVolatilesPatch = {
      ...defenderVolatilesPatch,
      perishTurns: ctx.defenderVolatiles.perishTurns ?? 3,
    };
    messages.push('Both Pokémon will faint in three turns!');
  } else if (slug === 'endure') {
    const streak = ctx.attackerVolatiles.protectStreak ?? 0;
    if (!rollProtectSuccess(streak)) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerVolatilesPatch = {
        ...attackerVolatilesPatch,
        endured: true,
        protectStreak: streak + 1,
        usedProtectThisTurn: true,
      };
      messages.push(`${attacker.displayName} braced itself!`);
    }
  } else if (slug === 'foresight' || slug === 'odor-sleuth') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, identified: true };
    messages.push(`${defender.displayName} was identified!`);
  } else if (slug === 'haze') {
    haze = true;
    messages.push('All stat changes were eliminated!');
  } else if (slug === 'psych-up') {
    copyFoeStages = true;
    messages.push(`${attacker.displayName} copied ${defender.displayName}'s stat changes!`);
  } else if (slug === 'trick') {
    swapStages = true;
    messages.push(`${attacker.displayName} swapped stat changes with ${defender.displayName}!`);
  } else if (slug === 'mist') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, mistTurns: 5 };
    messages.push(`${attacker.displayName} became shrouded in mist!`);
  } else if (slug === 'ingrain') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, ingrained: true, trappedTurns: Math.max(ctx.attackerVolatiles.trappedTurns, 1) };
    messages.push(`${attacker.displayName} planted its roots!`);
  } else if (slug === 'nightmare') {
    if (!isAsleep(defender.status)) {
      failed = true;
      messages.push('But it failed!');
    } else {
      defenderVolatilesPatch = { ...defenderVolatilesPatch, nightmared: true };
      messages.push(`${defender.displayName} began having a nightmare!`);
    }
  } else if (slug === 'magic-coat') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, magicCoat: true };
    messages.push(`${attacker.displayName} shrouded itself with Magic Coat!`);
  } else if (slug === 'charge') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, chargedElectric: true };
    messages.push(`${attacker.displayName} began charging power!`);
  } else if (slug === 'stockpile') {
    const cur = ctx.attackerVolatiles.stockpileCount ?? 0;
    if (cur >= 3) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerVolatilesPatch = { ...attackerVolatilesPatch, stockpileCount: cur + 1 };
      attackerStageDelta = applyStageDelta(attackerStageDelta, { def: 1, spd: 1 });
      messages.push(`${attacker.displayName} stockpiled energy!`);
      messages.push(...stageMessages(attacker.displayName, { def: 1, spd: 1 }));
    }
  } else if (slug === 'swallow') {
    const n = ctx.attackerVolatiles.stockpileCount ?? 0;
    const frac = swallowHealFraction(n);
    if (frac <= 0) {
      failed = true;
      messages.push('But it failed!');
    } else {
      healFraction = frac;
      attackerVolatilesPatch = { ...attackerVolatilesPatch, stockpileCount: 0 };
      attackerStageDelta = applyStageDelta(attackerStageDelta, { def: -n, spd: -n });
      messages.push(`${attacker.displayName} swallowed its stockpile!`);
    }
  } else if (slug === 'memento') {
    selfFaint = true;
    if (hasMist(ctx.defenderVolatiles)) {
      messages.push(`${defender.displayName} is protected by Mist!`);
    } else {
      defenderStageDelta = applyStageDelta(defenderStageDelta, { atk: -2, spa: -2 });
      messages.push(`${attacker.displayName} left a memento!`);
      messages.push(...stageMessages(defender.displayName, { atk: -2, spa: -2 }));
    }
  } else if (slug === 'teleport') {
    clearTrap = true;
    attackerVolatilesPatch = { ...attackerVolatilesPatch, trappedTurns: 0 };
    messages.push(`${attacker.displayName} got away from trouble!`);
  } else if (slug === 'recycle') {
    restorePp = true;
    messages.push(`${attacker.displayName} restored its PP!`);
  } else if (slug === 'spite') {
    if (!ctx.defenderLastMoveSlug) {
      failed = true;
      messages.push('But it failed!');
    } else {
      cutPpSlug = ctx.defenderLastMoveSlug;
      messages.push(`It reduced the PP of ${defender.displayName}'s ${storedMoveFromSlug(ctx.defenderLastMoveSlug)?.name ?? ctx.defenderLastMoveSlug}!`);
    }
  } else if (slug === 'torment') {
    defenderVolatilesPatch = { ...defenderVolatilesPatch, torment: true };
    messages.push(`${defender.displayName} was subjected to torment!`);
  } else if (slug === 'grudge') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, grudge: true };
    messages.push(`${attacker.displayName} wants the foe to feel its grudge!`);
  } else if (slug === 'camouflage') {
    attackerTypes = [camouflageType(ctx.weather ?? 'none')];
    messages.push(`${attacker.displayName} transformed into the ${attackerTypes[0]} type!`);
  } else if (slug === 'conversion') {
    const first = attacker.moves.find((m) => m.type && m.type !== 'status');
    const t = first?.type;
    if (!t) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerTypes = [t];
      messages.push(`${attacker.displayName} transformed into the ${t} type!`);
    }
  } else if (slug === 'conversion-2') {
    const last = ctx.defenderLastMoveSlug ? storedMoveFromSlug(ctx.defenderLastMoveSlug) : null;
    if (!last) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerTypes = [typeThatResists(last.type)];
      messages.push(`${attacker.displayName} transformed into the ${attackerTypes[0]} type!`);
    }
  } else if (slug === 'nature-power') {
    metronomeSlug = naturePowerSlug(ctx.weather ?? 'none');
    messages.push(`${attacker.displayName} turned Nature Power into ${storedMoveFromSlug(metronomeSlug)?.name ?? metronomeSlug}!`);
  } else if (slug === 'assist') {
    const pool = (ctx.attackerParty ?? [])
      .filter((m) => m.caughtAt !== attacker.caughtAt)
      .flatMap((m) => m.moves)
      .filter((m) => !ASSIST_EXCLUDED_SLUGS.has(m.slug));
    if (pool.length === 0) {
      failed = true;
      messages.push('But it failed!');
    } else {
      const picked = pool[Math.floor(Math.random() * pool.length)]!;
      metronomeSlug = picked.slug;
      messages.push(`${attacker.displayName} used Assist!`);
    }
  } else if (slug === 'mimic' || slug === 'mirror-move' || slug === 'sketch') {
    const last = ctx.defenderLastMoveSlug;
    if (!last || last === slug) {
      failed = true;
      messages.push('But it failed!');
    } else {
      metronomeSlug = last;
      messages.push(`${attacker.displayName} copied ${storedMoveFromSlug(last)?.name ?? last}!`);
    }
  } else if (slug === 'role-play') {
    const foeAb = getMonAbility(defender);
    if (!foeAb) {
      failed = true;
      messages.push('But it failed!');
    } else {
      attackerAbility = foeAb;
      messages.push(`${attacker.displayName} copied ${defender.displayName}'s ability!`);
    }
  } else if (slug === 'skill-swap') {
    attackerAbility = getMonAbility(defender);
    defenderAbility = getMonAbility(attacker);
    messages.push(`${attacker.displayName} swapped abilities with ${defender.displayName}!`);
  } else if (slug === 'snatch') {
    copyFoeStages = true;
    messages.push(`${attacker.displayName} snatched ${defender.displayName}'s stat changes!`);
  } else if (slug === 'imprison') {
    const shared = attacker.moves.find((m) => defender.moves.some((d) => d.slug === m.slug));
    if (!shared) {
      failed = true;
      messages.push('But it failed!');
    } else {
      defenderVolatilesPatch = {
        ...defenderVolatilesPatch,
        disabledMoveSlug: shared.slug,
        disableTurns: 5,
      };
      messages.push(`${defender.displayName}'s ${shared.name} was sealed!`);
    }
  } else if (slug === 'mud-sport') {
    fieldPatch = { mudSport: true };
    messages.push("Electricity's power was weakened!");
  } else if (slug === 'water-sport') {
    fieldPatch = { waterSport: true };
    messages.push("Fire's power was weakened!");
  } else {
    const weatherSet = setWeatherFromMove(slug);
    if (weatherSet) {
      fieldPatch = { weather: weatherSet.weather, weatherTurns: weatherSet.turns };
      messages.push(weatherSetMessage(slug));
    } else if (ctx.move.statusEffect && canApplyStatus(defender, ctx.move.statusEffect, ctx.weather ?? 'none', weatherIsSuppressed([getMonAbility(attacker), getMonAbility(defender)])) && !hasSafeguard(ctx.defenderVolatiles)) {
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
    slug === 'roar' ||
    slug === 'sleep-talk' ||
    slug === 'sunny-day' ||
    slug === 'rain-dance' ||
    slug === 'hail' ||
    slug === 'sandstorm' ||
    attackerStageSet != null ||
    painSplitHp != null ||
    metronomeSlug != null ||
    haze ||
    copyFoeStages ||
    swapStages ||
    selfFaint ||
    healPartyStatus ||
    restorePp ||
    cutPpSlug != null ||
    attackerTypes != null ||
    attackerAbility != null ||
    defenderAbility != null ||
    isProtectMove(slug) ||
    ['rest', 'recover', 'soft-boiled', 'transform', 'metronome', 'disable', 'confuse-ray', 'supersonic', 'sweet-kiss', 'teeter-dance', 'swagger', 'flatter', 'mind-reader', 'lock-on', 'safeguard', 'encore', 'heal-bell', 'refresh', 'aromatherapy', 'curse', 'substitute', 'yawn', 'wish', 'belly-drum', 'taunt', 'attract', 'pain-split', 'destiny-bond', 'perish-song', 'endure', 'foresight', 'odor-sleuth', 'haze', 'psych-up', 'trick', 'mist', 'ingrain', 'nightmare', 'magic-coat', 'charge', 'stockpile', 'swallow', 'memento', 'teleport', 'recycle', 'spite', 'torment', 'grudge', 'camouflage', 'conversion', 'conversion-2', 'nature-power', 'assist', 'mimic', 'mirror-move', 'sketch', 'role-play', 'skill-swap', 'snatch', 'imprison', 'mud-sport', 'water-sport'].includes(slug) ||
    (ctx.move.statusEffect && canApplyStatus(defender, ctx.move.statusEffect, ctx.weather ?? 'none', weatherIsSuppressed([getMonAbility(attacker), getMonAbility(defender)])) && !hasSafeguard(ctx.defenderVolatiles))
  ) {
    // handled above
  } else if (ctx.move.statusEffect) {
    failed = true;
    messages.push('But it failed!');
  } else if (!statDelta && !volatilePatch) {
    failed = true;
    messages.push('But it failed!');
  }

  attackerStageDelta = { ...ZERO_DELTA, ...abilityRewriteStageDelta(getMonAbility(attacker), attackerStageDelta) };
  defenderStageDelta = { ...ZERO_DELTA, ...abilityRewriteStageDelta(getMonAbility(defender), defenderStageDelta) };

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
    attackerStageSet,
    painSplitHp,
    haze: haze || undefined,
    copyFoeStages: copyFoeStages || undefined,
    swapStages: swapStages || undefined,
    selfFaint: selfFaint || undefined,
    healPartyStatus: healPartyStatus || undefined,
    restorePp: restorePp || undefined,
    cutPpSlug,
    attackerTypes,
    attackerAbility,
    defenderAbility,
  };
}

function hasStageChange(s: StatStages): boolean {
  return Object.values(s).some((v) => v !== 0);
}

function stageMessages(name: string, delta: Partial<StatStages>): string[] {
  return (Object.entries(delta) as [keyof StatStages, number][])
    .filter(([, amount]) => amount !== 0)
    .map(([stat, amount]) => {
      const label = statLabel(stat);
      const dir = amount > 0 ? 'rose' : 'fell';
      const harsh = Math.abs(amount) >= 2 ? ' sharply' : '';
      return `${name}'s ${label}${harsh} ${dir}!`;
    });
}

function stageMessage(name: string, delta: Partial<StatStages>, _self: boolean): string {
  return stageMessages(name, delta)[0] ?? `${name}'s stats did not change!`;
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
  /** Damage that reached the Pokémon. 0 when a Substitute absorbed the hit. */
  damageToMon?: number;
  connectingHits?: number;
  attackerVolatiles: BattleVolatiles;
  defenderVolatiles: BattleVolatiles;
  weather?: BattleWeather;
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
  const damageToMon = ctx.damageToMon ?? damageDealt;
  const hitFoe = damageToMon > 0;
  const atkAbility = getMonAbility(attacker);
  const defAbility = getMonAbility(defender);
  const wxOff = weatherIsSuppressed([atkAbility, defAbility]);
  const weather = ctx.weather ?? 'none';
  const secMult = abilitySecondaryChanceMultForHit(atkAbility, defAbility);
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

  if (hitFoe && TRAP_MOVES.has(slug)) {
    const turns = 2 + Math.floor(Math.random() * 4);
    defenderVolatilesPatch = { trappedTurns: turns };
    messages.push(`${defender.displayName} was trapped!`);
  }

  if (damageDealt > 0 && (slug === 'thrash' || slug === 'petal-dance' || slug === 'outrage')) {
    attackerVolatilesPatch = applyThrashLock(attackerVolatiles, slug);
    if (attackerVolatilesPatch.confusionTurns && attackerVolatilesPatch.confusionTurns > 0) {
      messages.push(`${attacker.displayName} became confused!`);
    }
  }

  if (damageDealt > 0 && slug === 'rollout') {
    attackerVolatilesPatch = applyRolloutLock(attackerVolatiles);
  }

  if (slug === 'brick-break') {
    defenderVolatilesPatch = {
      ...defenderVolatilesPatch,
      reflectTurns: 0,
      lightScreenTurns: 0,
    };
    if (defenderVolatiles.reflectTurns > 0 || defenderVolatiles.lightScreenTurns > 0) {
      messages.push('The protective screens were torn down!');
    }
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

  if (hitFoe) {
    if (slug === 'tri-attack' && Math.random() < getSecondaryStatusChance(slug) * secMult) {
      const kind = rollTriAttackStatus();
      if (canApplyStatus(defender, kind, weather, wxOff) && !hasSafeguard(defenderVolatiles)) {
        defenderStatus = createStatus(kind);
        messages.push(`${defender.displayName} was inflicted with ${kind}!`);
      }
    } else if (move.statusEffect && slug === 'twineedle' && connectingHits && connectingHits > 0) {
      for (let i = 0; i < connectingHits; i++) {
        if (defenderStatus) break;
        if (Math.random() < getSecondaryStatusChance(slug) * secMult) {
          if (canApplyStatus(defender, move.statusEffect, weather, wxOff) && !hasSafeguard(defenderVolatiles)) {
            defenderStatus = createStatus(move.statusEffect);
            messages.push(`${defender.displayName} was inflicted with ${move.statusEffect}!`);
          }
        }
      }
    } else if (move.statusEffect && Math.random() < getSecondaryStatusChance(slug) * secMult) {
      if (canApplyStatus(defender, move.statusEffect, weather, wxOff) && !hasSafeguard(defenderVolatiles)) {
        defenderStatus = createStatus(move.statusEffect);
        messages.push(`${defender.displayName} was inflicted with ${move.statusEffect}!`);
      }
    } else if (damageDealt > 0) {
      const confuseChance = getConfusionOnHitChance(slug);
      if (confuseChance > 0 && Math.random() < confuseChance * secMult && !abilityBlocksConfusion(defAbility)) {
        defenderVolatilesPatch = { ...defenderVolatilesPatch, ...applyConfusionVolatile() };
        messages.push(`${defender.displayName} became confused!`);
      }
    }

    const flinchChance = getFlinchChance(slug);
    if (flinchChance > 0 && !abilityBlocksFlinch(defAbility) && Math.random() < flinchChance * secMult) {
      defenderVolatilesPatch = { ...defenderVolatilesPatch, flinched: true };
    }
  }

  const postStat = getPostDamageStageDelta(slug);
  if (damageDealt > 0 && postStat && Math.random() < getSecondaryStatChance(slug) * secMult) {
    if (postStat.self) {
      attackerStageDelta = applyStageDelta(attackerStageDelta, postStat.self);
      messages.push(stageMessage(attacker.displayName, postStat.self, true));
    }
    if (hitFoe && postStat.foe) {
      const foeDrops = Object.values(postStat.foe).some((v) => (v ?? 0) < 0);
      if (foeDrops && hasMist(defenderVolatiles)) {
        messages.push(`${defender.displayName} is protected by Mist!`);
      } else {
        const dropped = Object.entries(postStat.foe).filter(
          ([stat, delta]) => (delta ?? 0) < 0 && !abilityPreventsStatDrop(defAbility, stat),
        );
        const allowed = { ...postStat.foe };
        for (const [stat] of Object.entries(postStat.foe)) {
          if (abilityPreventsStatDrop(defAbility, stat) && (postStat.foe[stat as keyof typeof postStat.foe] ?? 0) < 0) {
            delete (allowed as Record<string, number>)[stat];
          }
        }
        if (dropped.length > 0 || Object.values(allowed).some((v) => v)) {
          defenderStageDelta = applyStageDelta(defenderStageDelta, allowed);
          if (Object.values(allowed).some((v) => v)) {
            messages.push(stageMessage(defender.displayName, allowed, false));
          }
        }
      }
    }
  }

  const recoilFrac = RECOIL_MOVES[slug];
  if (recoilFrac && damageDealt > 0 && !abilityBlocksRecoil(atkAbility)) {
    recoilDamage = Math.max(1, Math.floor(damageDealt * recoilFrac));
    messages.push(`${attacker.displayName} is damaged by recoil!`);
  }

  const drainFrac = DRAIN_MOVES[slug];
  if (drainFrac && damageDealt > 0) {
    const amount = Math.max(1, Math.floor(damageDealt * drainFrac));
    if (abilityDrainHurtsAttacker(defAbility)) {
      recoilDamage = (recoilDamage ?? 0) + amount;
      messages.push(`${attacker.displayName} was hurt by Liquid Ooze!`);
    } else {
      drainHeal = amount;
      messages.push(`${attacker.displayName} drained energy!`);
    }
  }

  if (slug === 'rage' && damageDealt > 0) {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, rageActive: true };
  } else if (damageDealt > 0 && attackerVolatiles.rageActive) {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, rageActive: false };
  }

  if (hitFoe && damageToMon > 0 && defenderVolatiles.rageActive) {
    defenderStageDelta = applyStageDelta(defenderStageDelta, { atk: 1 });
    messages.push(`${defender.displayName}'s rage is building!`);
  }

  if (slug === 'spit-up') {
    const n = attackerVolatiles.stockpileCount ?? 0;
    attackerVolatilesPatch = { ...attackerVolatilesPatch, stockpileCount: 0 };
    if (n > 0) {
      attackerStageDelta = applyStageDelta(attackerStageDelta, { def: -n, spd: -n });
      messages.push(`${attacker.displayName} spent its stockpile!`);
    }
  }

  if (attackerVolatiles.chargedElectric && move.type === 'electric') {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, chargedElectric: false };
  }

  if (isSelfFaintMove(slug)) {
    selfFaint = true;
  }

  if (clearMindReader) {
    attackerVolatilesPatch = { ...attackerVolatilesPatch, mindReaderActive: false };
  }

  attackerStageDelta = { ...ZERO_DELTA, ...abilityRewriteStageDelta(atkAbility, attackerStageDelta) };
  defenderStageDelta = { ...ZERO_DELTA, ...abilityRewriteStageDelta(defAbility, defenderStageDelta) };

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
  if (NEVER_MISS_MOVE_SLUGS.has(slug)) return 100;
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
