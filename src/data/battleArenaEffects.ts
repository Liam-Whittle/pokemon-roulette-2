import type { CaughtPokemon, StoredMove } from '../types/game';
import {
  computeDamage,
  getEffectiveMovePower,
  getFixedDamage,
  rollCrit,
} from './moves';
import { getTypeEffectiveness } from './typeChart';
import {
  physicalDamageReduction,
  physicalDefenseMultiplier,
  type BattleVolatiles,
} from './battleVolatiles';
import { getCritStageBonus } from './moveEffects';
import { physicalDamageMultiplier } from '../utils/status';
import { resolveOhko } from './battleMoveResolver';

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
  } = input;

  const effectiveness = getTypeEffectiveness(move.type, defender.types);
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

  const dmg = computeDamage({
    movePower: getEffectiveMovePower(move, defender.id),
    moveType: move.type,
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
  });

  return {
    damage: fixedDamage ?? dmg,
    crit,
    effectiveness,
    ohko: false,
  };
}
