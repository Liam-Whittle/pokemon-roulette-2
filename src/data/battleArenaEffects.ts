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
  physicalDamageReduction,
  physicalDefenseMultiplier,
  type BattleVolatiles,
} from './battleVolatiles';
import type { BattleWeather } from './battleField';
import { weatherTypeMultiplier } from './battleWeather';
import { physicalDamageMultiplier } from '../utils/status';
import { resolveOhko } from './battleMoveResolver';
import { maxHpForMon } from '../utils/stats';
import { getCritStageBonus, getRolloutPower, rollMultiHitCount } from './moveEffects';
import { resolvePresent } from './battleMoveResolver';
import { rollHit } from './moves';

export interface ResolveDamageHitsInput extends Omit<DamageCalcInput, 'hitIndex' | 'rolloutPower'> {
  hitAccuracy: number;
}

export interface ResolveDamageHitsResult {
  totalDamage: number;
  lastHitDamage: number;
  lastCrit: boolean;
  lastEffectiveness: number;
  hits: number;
  missed: boolean;
  presentHeal?: number;
}

export function resolveDamageHits(input: ResolveDamageHitsInput): ResolveDamageHitsResult {
  const { move, attacker, defender, attackerVolatiles, hitAccuracy } = input;

  if (move.slug === 'present') {
    if (!rollHit(hitAccuracy)) {
      return { totalDamage: 0, lastHitDamage: 0, lastCrit: false, lastEffectiveness: 1, hits: 0, missed: true };
    }
    const effect = resolvePresent(attacker.level);
    if (effect.kind === 'heal') {
      const max = maxHpForMon(defender);
      return {
        totalDamage: 0,
        lastHitDamage: 0,
        lastCrit: false,
        lastEffectiveness: 1,
        hits: 1,
        missed: false,
        presentHeal: Math.max(1, Math.floor(max * effect.fraction)),
      };
    }
    const { damage, crit, effectiveness } = calculateMoveDamage({
      ...input,
      move: { ...move, power: effect.power },
      hitIndex: 0,
      rolloutPower: undefined,
    });
    return { totalDamage: damage, lastHitDamage: damage, lastCrit: crit, lastEffectiveness: effectiveness, hits: 1, missed: false };
  }

  if (move.slug === 'triple-kick') {
    let totalDamage = 0;
    let lastHitDamage = 0;
    let lastCrit = false;
    let lastEffectiveness = 1;
    let hits = 0;
    for (let h = 0; h < 3; h++) {
      if (!rollHit(hitAccuracy)) {
        return { totalDamage, lastHitDamage, lastCrit, lastEffectiveness, hits, missed: hits === 0 };
      }
      const { damage, crit, effectiveness } = calculateMoveDamage({
        ...input,
        hitIndex: h,
      });
      totalDamage += damage;
      lastHitDamage = damage;
      lastCrit = crit;
      lastEffectiveness = effectiveness;
      hits += 1;
      if (damage <= 0) break;
    }
    return { totalDamage, lastHitDamage, lastCrit, lastEffectiveness, hits, missed: false };
  }

  const hitCount = rollMultiHitCount(move.slug);
  if (hitCount === 1 && !rollHit(hitAccuracy)) {
    return { totalDamage: 0, lastHitDamage: 0, lastCrit: false, lastEffectiveness: 1, hits: 0, missed: true };
  }
  let totalDamage = 0;
  let lastHitDamage = 0;
  let lastCrit = false;
  let lastEffectiveness = 1;
  const rolloutPower = move.slug === 'rollout' ? getRolloutPower(attackerVolatiles) : undefined;
  for (let h = 0; h < hitCount; h++) {
    const { damage, crit, effectiveness } = calculateMoveDamage({
      ...input,
      hitIndex: h,
      rolloutPower,
    });
    totalDamage += damage;
    lastHitDamage = damage;
    lastCrit = crit;
    lastEffectiveness = effectiveness;
  }
  return { totalDamage, lastHitDamage, lastCrit, lastEffectiveness, hits: hitCount, missed: false };
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
  region?: 'Kanto' | 'Johto';
  hitIndex?: number;
  rolloutPower?: number;
  weather?: BattleWeather;
  hiddenPowerType?: string;
  powerMultiplier?: number;
}

export interface DamageCalcResult {
  damage: number;
  crit: boolean;
  effectiveness: number;
  ohko: boolean;
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
  } = input;

  const moveType =
    move.slug === 'hidden-power' && hiddenPowerType ? hiddenPowerType : move.type;
  const effectiveness = getTypeEffectiveness(moveType, defender.types, region);
  const critBonus = getCritStageBonus(attackerVolatiles);
  const crit = rollCrit(move.slug, critBonus);

  if (resolveOhko(attacker.level, defender.level, move.slug) && effectiveness > 0) {
    return { damage: defenderHp, crit: false, effectiveness, ohko: true };
  }

  const fixedDamage = getFixedDamage(move, attacker.level, defenderHp);
  const category = move.category === 'physical' ? 'physical' : 'special';
  const screenMult = physicalDamageReduction(defenderVolatiles, category);
  const barrierMult = physicalDefenseMultiplier(defenderVolatiles, category);
  const baseDefMult =
    move.category === 'physical' ? stageMult(defenderStages.def) : stageMult(defenderStages.spd);
  const defenseMultiplier = baseDefMult * barrierMult;

  const attackerMaxHp = maxHpForMon(attacker);
  const powerCtx: MovePowerContext = {
    defenderSpeciesId: defender.id,
    attackerHp: attacker.hp ?? attackerMaxHp,
    attackerMaxHp,
    hitIndex,
    rolloutPower,
  };

  const dmg = computeDamage({
    movePower: Math.max(1, Math.round(getEffectiveMovePower(move, powerCtx) * powerMultiplier)),
    moveType,
    category: move.category,
    effectiveness,
    attacker,
    defender,
    crit,
    xAttackPhysical,
    xAttackSpecial,
    physicalMult: physicalDamageMultiplier(attacker.status),
    attackMultiplier:
      move.category === 'physical' ? stageMult(attackerStages.atk) : stageMult(attackerStages.spa),
    defenseMultiplier,
    screenDamageMult: screenMult,
    weatherMult: weatherTypeMultiplier(moveType, weather),
  });

  return {
    damage: fixedDamage ?? dmg,
    crit,
    effectiveness,
    ohko: false,
  };
}
