/** Battle-only volatile effects; cleared on swap / battle segment end. */
export type BattleVolatiles = {
  reflectTurns: number;
  lightScreenTurns: number;
  barrierActive: boolean;
  confusionTurns: number;
  thrashLock?: { slug: string; turnsLeft: number };
  leechSeeded: boolean;
  trappedTurns: number;
  focusEnergy: boolean;
  disabledMoveSlug: string | null;
  disableTurns: number;
};

export const EMPTY_VOLATILES: BattleVolatiles = {
  reflectTurns: 0,
  lightScreenTurns: 0,
  barrierActive: false,
  confusionTurns: 0,
  leechSeeded: false,
  trappedTurns: 0,
  focusEnergy: false,
  disabledMoveSlug: null,
  disableTurns: 0,
};

export function clearVolatiles(): BattleVolatiles {
  return { ...EMPTY_VOLATILES };
}

export function tickVolatileTurns(v: BattleVolatiles): BattleVolatiles {
  const next = { ...v };
  if (next.reflectTurns > 0) next.reflectTurns -= 1;
  if (next.lightScreenTurns > 0) next.lightScreenTurns -= 1;
  if (next.trappedTurns > 0) next.trappedTurns -= 1;
  if (next.disableTurns > 0) {
    next.disableTurns -= 1;
    if (next.disableTurns <= 0) {
      next.disabledMoveSlug = null;
    }
  }
  return next;
}

/** Physical damage multiplier from Reflect (0.5) or Barrier (+20% def = /1.2). No stacking: Reflect wins. */
export function physicalDamageReduction(
  volatiles: BattleVolatiles,
  category: 'physical' | 'special',
): number {
  if (category === 'physical' && volatiles.reflectTurns > 0) return 0.5;
  if (category === 'special' && volatiles.lightScreenTurns > 0) return 0.5;
  return 1;
}

export function physicalDefenseMultiplier(volatiles: BattleVolatiles, category: 'physical' | 'special'): number {
  if (category === 'physical' && volatiles.reflectTurns > 0) return 1;
  if (category === 'physical' && volatiles.barrierActive) return 1.2;
  return 1;
}

export function isTrapped(volatiles: BattleVolatiles): boolean {
  return volatiles.trappedTurns > 0;
}

export function isThrashLocked(volatiles: BattleVolatiles): boolean {
  return (volatiles.thrashLock?.turnsLeft ?? 0) > 0;
}
