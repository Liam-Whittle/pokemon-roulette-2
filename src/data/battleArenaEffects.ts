import type { CaughtPokemon, StoredMove } from '../types/game';
import {
  computeDamage,
  getEffectiveMovePower,
  getFixedDamage,
  rollCrit,
  type MovePowerContext,
} from './moves';
import { getTypeEffectiveness } from './typeChart';
import {
  abilityAbsorbsMove,
  abilityAccuracyMult,
  abilityAttackerDamageMult,
  abilityBlocksCrit,
  abilityCritDamageMult,
  abilityCritStageBonus,
  abilityDefenseMult,
  abilityEvasionBonus,
  abilityIgnoresBurnAtkDrop,
  abilityIgnoresDefenderAbility,
  abilityIgnoresFoeStages,
  abilityIgnoresScreens,
  abilityMultiscaleActive,
  abilityNeverMisses,
  abilityNormalizedMoveType,
  abilityScrappyEffectiveness,
  abilitySeReduction,
  abilitySkillLinkMaxHits,
  abilityStatusAccuracyCap,
  abilitySturdySurvives,
  abilityTypeDamageMult,
  abilityWeightMult,
  abilityWonderGuardBlocks,
  battleAbility,
  friendGuardDamageMult,
  getMonAbility,
  weatherIsSuppressed,
} from './abilities';
import { getSpeciesWeightKg } from './speciesCache';
import { applyRegionMoveType } from './gen2MoveTypes';
import {
  physicalDamageReduction,
  physicalDefenseMultiplier,
  type BattleVolatiles,
} from './battleVolatiles';
import type { BattleWeather } from './battleField';
import { weatherTypeMultiplier } from './battleWeather';
import { physicalDamageMultiplier } from '../utils/status';
import { resolveOhko } from './battleMoveResolver';
import { maxHpForMon } from '../utils/stats';
import { getCritStageBonus, getRolloutPower, rollMultiHitCount, OHKO_MOVES, isSelfFaintMove, weatherBallType, sportTypeMultiplier } from './moveEffects';
import { resolvePresent } from './battleMoveResolver';
import { rollHit } from './moves';

export interface ResolveDamageHitsInput extends Omit<DamageCalcInput, 'hitIndex' | 'rolloutPower'> {
  hitAccuracy: number;
}

export type ResolvedHit = {
  damage: number;
  crit: boolean;
  effectiveness: number;
};

export interface ResolveDamageHitsResult {
  totalDamage: number;
  lastHitDamage: number;
  lastCrit: boolean;
  lastEffectiveness: number;
  hits: number;
  missed: boolean;
  hitResults: ResolvedHit[];
  presentHeal?: number;
  abilityAbsorb?: 'heal' | 'boost' | 'immune';
}

export function resolveDamageHits(input: ResolveDamageHitsInput): ResolveDamageHitsResult {
  const { move, attacker, defender, attackerVolatiles } = input;
  const rawAtk = getMonAbility(attacker);
  const rawDef = getMonAbility(defender);
  const atkAbility = battleAbility(rawAtk, [rawAtk, rawDef]);
  const defAbility = battleAbility(rawDef, [rawAtk, rawDef]);
  const wxOff = weatherIsSuppressed([rawAtk, rawDef]);
  const cappedAccuracy =
    move.category === 'status'
      ? abilityStatusAccuracyCap(defAbility, input.hitAccuracy)
      : input.hitAccuracy;
  const hitAccuracy = abilityNeverMisses(atkAbility, defAbility)
    ? 100
    : Math.max(
        1,
        Math.min(
          100,
          cappedAccuracy *
            abilityAccuracyMult(atkAbility) /
            abilityEvasionBonus(defAbility, input.weather ?? 'none', wxOff, {
              confused: (input.defenderVolatiles.confusionTurns ?? 0) > 0,
            }),
        ),
      );

  const empty = {
    totalDamage: 0,
    lastHitDamage: 0,
    lastCrit: false,
    lastEffectiveness: 1,
    hits: 0,
    missed: true,
    hitResults: [] as ResolvedHit[],
  };

  if (move.slug === 'present') {
    if (!rollHit(hitAccuracy)) return empty;
    const effect = resolvePresent(attacker.level);
    if (effect.kind === 'heal') {
      const max = maxHpForMon(defender);
      return {
        ...empty,
        missed: false,
        hits: 1,
        presentHeal: Math.max(1, Math.floor(max * effect.fraction)),
      };
    }
    const { damage, crit, effectiveness, abilityAbsorb } = calculateMoveDamage({
      ...input,
      move: { ...move, power: effect.power },
      hitIndex: 0,
      rolloutPower: undefined,
    });
    return {
      totalDamage: damage,
      lastHitDamage: damage,
      lastCrit: crit,
      lastEffectiveness: effectiveness,
      hits: 1,
      missed: false,
      hitResults: [{ damage, crit, effectiveness }],
      abilityAbsorb,
    };
  }

  const plannedHits =
    move.slug === 'triple-kick' ? 3 : rollMultiHitCount(move.slug, abilitySkillLinkMaxHits(atkAbility));
  const checkEachHit = move.slug === 'triple-kick';
  if (!checkEachHit && !rollHit(hitAccuracy)) return empty;

  let totalDamage = 0;
  let lastHitDamage = 0;
  let lastCrit = false;
  let lastEffectiveness = 1;
  let abilityAbsorb: ResolveDamageHitsResult['abilityAbsorb'];
  const hitResults: ResolvedHit[] = [];
  const rolloutPower = move.slug === 'rollout' ? getRolloutPower(attackerVolatiles) : undefined;
  let hpLeft = input.defenderHp;
  for (let h = 0; h < plannedHits; h++) {
    if (checkEachHit && !rollHit(hitAccuracy)) {
      if (hitResults.length === 0) return empty;
      break;
    }
    const hit = calculateMoveDamage({
      ...input,
      defenderHp: hpLeft,
      hitIndex: h,
      rolloutPower,
    });
    if (hit.abilityAbsorb) {
      abilityAbsorb = hit.abilityAbsorb;
      break;
    }
    hitResults.push({ damage: hit.damage, crit: hit.crit, effectiveness: hit.effectiveness });
    totalDamage += hit.damage;
    lastHitDamage = hit.damage;
    lastCrit = hit.crit;
    lastEffectiveness = hit.effectiveness;
    hpLeft = Math.max(0, hpLeft - hit.damage);
    if (hpLeft <= 0 || hit.damage <= 0) break;
  }
  return {
    totalDamage,
    lastHitDamage,
    lastCrit,
    lastEffectiveness,
    hits: hitResults.length,
    missed: hitResults.length === 0 && !abilityAbsorb,
    hitResults,
    abilityAbsorb,
  };
}

export type StatStages = {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  acc: number;
  eva: number;
};

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

export interface DamageCalcInput {
  move: StoredMove;
  attacker: CaughtPokemon;
  defender: CaughtPokemon;
  defenderHp: number;
  attackerVolatiles: BattleVolatiles;
  defenderVolatiles: BattleVolatiles;
  attackerStages: StatStages;
  defenderStages: StatStages;
  xAttackPhysical?: boolean;
  xAttackSpecial?: boolean;
  region?: 'Kanto' | 'Johto' | 'Hoenn';
  hitIndex?: number;
  rolloutPower?: number;
  weather?: BattleWeather;
  hiddenPowerType?: string;
  powerMultiplier?: number;
  attackerParty?: CaughtPokemon[];
  defenderParty?: CaughtPokemon[];
  attackerSlower?: boolean;
  mudSport?: boolean;
  waterSport?: boolean;
}

export interface DamageCalcResult {
  damage: number;
  crit: boolean;
  effectiveness: number;
  ohko: boolean;
  abilityAbsorb?: 'heal' | 'boost' | 'immune';
}

export function calculateMoveDamage(input: DamageCalcInput): DamageCalcResult {
  const {
    move,
    attacker,
    defender,
    defenderHp,
    attackerVolatiles,
    defenderVolatiles,
    attackerStages,
    defenderStages,
    xAttackPhysical,
    xAttackSpecial,
    region = 'Kanto',
    hitIndex = 0,
    rolloutPower,
    weather = 'none',
    hiddenPowerType,
    powerMultiplier = 1,
    attackerParty,
    defenderParty,
    attackerSlower,
    mudSport,
    waterSport,
  } = input;

  const rawMoveType =
    move.slug === 'weather-ball'
      ? weatherBallType(weather)
      : move.slug === 'hidden-power' && hiddenPowerType
        ? hiddenPowerType
        : applyRegionMoveType(move.slug, move.type, region);
  const rawAtk = getMonAbility(attacker);
  const rawDef = getMonAbility(defender);
  const attackerAbility = battleAbility(rawAtk, [rawAtk, rawDef]);
  const defenderAbility = abilityIgnoresDefenderAbility(attackerAbility)
    ? undefined
    : battleAbility(rawDef, [rawAtk, rawDef]);
  const weatherSuppressed = weatherIsSuppressed([rawAtk, rawDef]);
  const activeWeather = weatherSuppressed ? 'none' : weather;
  const moveType = abilityNormalizedMoveType(attackerAbility, rawMoveType);

  let effectiveness = getTypeEffectiveness(moveType, defender.types, region);
  effectiveness = abilityScrappyEffectiveness(attackerAbility, moveType, defender.types, effectiveness);
  if (defenderVolatiles.identified) {
    effectiveness = abilityScrappyEffectiveness('scrappy', moveType, defender.types, effectiveness);
  }
  const absorb = move.category === 'status' ? null : abilityAbsorbsMove(defenderAbility, moveType, move.slug);
  if (absorb === 'immune' || absorb === 'heal' || absorb === 'boost') {
    return { damage: 0, crit: false, effectiveness: absorb === 'immune' ? 0 : effectiveness, ohko: false, abilityAbsorb: absorb };
  }
  if (abilityWonderGuardBlocks(defenderAbility, effectiveness, move.category)) {
    return { damage: 0, crit: false, effectiveness: 0, ohko: false, abilityAbsorb: 'immune' };
  }

  const critBonus = getCritStageBonus(attackerVolatiles) + abilityCritStageBonus(attackerAbility);
  const crit = abilityBlocksCrit(defenderAbility) ? false : rollCrit(move.slug, critBonus);

  if (OHKO_MOVES.has(move.slug)) {
    // OHKO moves never use the normal damage formula. A connecting hit either
    // faints the target outright or fails outright (immune / higher level).
    if (effectiveness > 0 && resolveOhko(attacker.level, defender.level, move.slug)) {
      return { damage: defenderHp, crit: false, effectiveness, ohko: true };
    }
    return { damage: 0, crit: false, effectiveness, ohko: false };
  }

  const fixedDamage = getFixedDamage(move, attacker.level, defenderHp);
  const category = move.category === 'physical' ? 'physical' : 'special';
  const screenMult =
    move.slug === 'brick-break' || abilityIgnoresScreens(attackerAbility)
      ? 1
      : physicalDamageReduction(defenderVolatiles, category);
  const barrierMult = physicalDefenseMultiplier(defenderVolatiles, category);
  const ignoreDefStages = abilityIgnoresFoeStages(attackerAbility);
  const ignoreAtkStages = abilityIgnoresFoeStages(defenderAbility);
  const baseDefMult =
    move.category === 'physical'
      ? stageMult(ignoreDefStages ? 0 : defenderStages.def)
      : stageMult(ignoreDefStages ? 0 : defenderStages.spd);
  // Explosion / Self-Destruct (Gens 1–4) hit against half the target's Defense.
  const explodeMult = isSelfFaintMove(move.slug) && category === 'physical' ? 0.5 : 1;
  const defenseMultiplier =
    baseDefMult *
    barrierMult *
    explodeMult *
    abilityDefenseMult(defenderAbility, defender.status?.kind);

  const attackerMaxHp = maxHpForMon(attacker);
  const defenderMaxHp = maxHpForMon(defender);
  const powerCtx: MovePowerContext = {
    defenderSpeciesId: defender.id,
    attackerHp: attacker.hp ?? attackerMaxHp,
    attackerMaxHp,
    hitIndex,
    rolloutPower,
    attackerStatusKind: attacker.status?.kind,
    weather: activeWeather,
    defenderWeightKg: getSpeciesWeightKg(defender.id) * abilityWeightMult(defenderAbility),
    stockpileCount: attackerVolatiles.stockpileCount,
    tookDamageThisTurn: attackerVolatiles.tookDamageThisTurn,
  };

  const movePower = Math.max(1, Math.round(getEffectiveMovePower(move, powerCtx) * powerMultiplier));
  const burnMult =
    abilityIgnoresBurnAtkDrop(attackerAbility) ? 1 : physicalDamageMultiplier(attacker.status);

  let dmg = computeDamage({
    movePower,
    moveType,
    category: move.category,
    effectiveness,
    attacker,
    defender,
    crit,
    xAttackPhysical,
    xAttackSpecial,
    physicalMult: burnMult,
    attackMultiplier:
      move.category === 'physical'
        ? stageMult(ignoreAtkStages ? 0 : attackerStages.atk)
        : stageMult(ignoreAtkStages ? 0 : attackerStages.spa),
    defenseMultiplier,
    screenDamageMult: screenMult,
    weatherMult: weatherTypeMultiplier(moveType, activeWeather),
  });

  if (fixedDamage == null) {
    dmg = Math.max(
      1,
      Math.round(
        dmg *
          abilityAttackerDamageMult({
            ability: attackerAbility,
            moveSlug: move.slug,
            moveType,
            movePower,
            category: move.category,
            attackerTypes: attacker.types,
            attackerHp: attacker.hp ?? attackerMaxHp,
            attackerMaxHp,
            statusKind: attacker.status?.kind,
            attackerGender: attacker.gender,
            defenderGender: defender.gender,
            plusMinusParty: attackerParty,
            weather: activeWeather,
            weatherSuppressed,
            effectiveness,
            attackerSlower,
          }) *
          abilityTypeDamageMult(defenderAbility, moveType) *
          abilitySeReduction(defenderAbility, effectiveness) *
          abilityCritDamageMult(attackerAbility, crit) *
          (abilityMultiscaleActive(defenderAbility, defenderHp, defenderMaxHp) ? 0.5 : 1) *
          friendGuardDamageMult(defender.caughtAt, defenderParty ?? []) *
          sportTypeMultiplier(moveType, { mudSport, waterSport }) *
          (moveType === 'electric' && attackerVolatiles.chargedElectric ? 2 : 1),
      ),
    );
  }

  let damage = fixedDamage ?? dmg;
  if (abilitySturdySurvives(defenderAbility, defenderHp, defenderMaxHp, damage)) {
    damage = Math.max(0, defenderHp - 1);
  }
  if (defenderVolatiles.endured && defenderHp > 0 && damage >= defenderHp) {
    damage = defenderHp - 1;
  }
  if (move.slug === 'false-swipe' && defenderHp > 0 && damage >= defenderHp) {
    damage = defenderHp - 1;
  }

  return {
    damage,
    crit,
    effectiveness,
    ohko: false,
  };
}
