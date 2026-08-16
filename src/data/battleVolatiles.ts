/** Battle-only volatile effects; cleared on swap / battle segment end. */
export type BattleVolatiles = {
  reflectTurns: number;
  lightScreenTurns: number;
  barrierActive: boolean;
  confusionTurns: number;
  thrashLock?: { slug: string; turnsLeft: number };
  rolloutLock?: { turnsLeft: number; power: number };
  leechSeeded: boolean;
  trappedTurns: number;
  focusEnergy: boolean;
  disabledMoveSlug: string | null;
  disableTurns: number;
  safeguardTurns: number;
  mindReaderActive: boolean;
  encoreMoveSlug: string | null;
  encoreTurns: number;
  counterPending?: { category: 'physical' | 'special'; damage: number; releaseNextTurn?: boolean };
  sleepTalkPrimed?: boolean;
  sleepTalkEligible?: boolean;
  cursed?: boolean;
  /** Set while charging Fly/Dig — attacks against this battler miss. */
  semiInvulnerable?: string;
  protected?: boolean;
  protectStreak?: number;
  usedProtectThisTurn?: boolean;
  substituteHp?: number;
  tauntTurns?: number;
  infatuated?: boolean;
  yawnTurns?: number;
  wishTurns?: number;
  destinyBond?: boolean;
  perishTurns?: number;
  tookDamageThisTurn?: boolean;
  unburdenSpeed?: boolean;
  flinched?: boolean;
  truantLoafing?: boolean;
  /** True the turn this battler was sent out. Fake Out only works while this is set. */
  enteredThisTurn?: boolean;
  endured?: boolean;
  identified?: boolean;
  mistTurns?: number;
  ingrained?: boolean;
  nightmared?: boolean;
  chargedElectric?: boolean;
  magicCoat?: boolean;
  stockpileCount?: number;
  torment?: boolean;
  rageActive?: boolean;
  grudge?: boolean;
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
  safeguardTurns: 0,
  mindReaderActive: false,
  encoreMoveSlug: null,
  encoreTurns: 0,
  sleepTalkPrimed: false,
  sleepTalkEligible: false,
  cursed: false,
};

export function clearVolatiles(): BattleVolatiles {
  return { ...EMPTY_VOLATILES };
}

/** Fresh volatiles for a Pokémon that just entered the field. */
export function volatilesOnSendOut(): BattleVolatiles {
  return { ...clearVolatiles(), enteredThisTurn: true };
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
  if (next.safeguardTurns > 0) next.safeguardTurns -= 1;
  if (next.encoreTurns > 0) {
    next.encoreTurns -= 1;
    if (next.encoreTurns <= 0) next.encoreMoveSlug = null;
  }
  if ((next.tauntTurns ?? 0) > 0) {
    next.tauntTurns = (next.tauntTurns ?? 0) - 1;
  }
  if ((next.mistTurns ?? 0) > 0) {
    next.mistTurns = (next.mistTurns ?? 0) - 1;
  }
  return next;
}

export function isProtected(volatiles: BattleVolatiles): boolean {
  return volatiles.protected === true;
}

export function hasSubstitute(volatiles: BattleVolatiles): boolean {
  return (volatiles.substituteHp ?? 0) > 0;
}

export function isTaunted(volatiles: BattleVolatiles): boolean {
  return (volatiles.tauntTurns ?? 0) > 0;
}

export function absorbSubstituteHit(
  volatiles: BattleVolatiles,
  damage: number,
): { volatiles: BattleVolatiles; damageToMon: number; broke: boolean } {
  const hp = volatiles.substituteHp ?? 0;
  if (hp <= 0) return { volatiles, damageToMon: damage, broke: false };
  if (damage >= hp) {
    return { volatiles: { ...volatiles, substituteHp: undefined }, damageToMon: 0, broke: true };
  }
  return { volatiles: { ...volatiles, substituteHp: hp - damage }, damageToMon: 0, broke: false };
}

export function endOfTurnProtectReset(volatiles: BattleVolatiles): BattleVolatiles {
  return {
    ...volatiles,
    protected: false,
    usedProtectThisTurn: false,
    protectStreak: volatiles.usedProtectThisTurn ? volatiles.protectStreak : 0,
    tookDamageThisTurn: false,
    destinyBond: false,
    flinched: false,
    enteredThisTurn: false,
    endured: false,
    magicCoat: false,
  };
}

export function hasSafeguard(volatiles: BattleVolatiles): boolean {
  return volatiles.safeguardTurns > 0;
}

export function hasMist(volatiles: BattleVolatiles): boolean {
  return (volatiles.mistTurns ?? 0) > 0;
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
  return volatiles.trappedTurns > 0 || volatiles.ingrained === true;
}

export function isThrashLocked(volatiles: BattleVolatiles): boolean {
  return (volatiles.thrashLock?.turnsLeft ?? 0) > 0;
}

export function isSemiInvulnerable(volatiles: BattleVolatiles): boolean {
  return !!volatiles.semiInvulnerable;
}

/** End multi-turn locks when the current foe faints (new opponent = fresh move choice). */
export function clearMoveLocks(volatiles: BattleVolatiles): BattleVolatiles {
  if (!volatiles.thrashLock && !volatiles.rolloutLock) return volatiles;
  return { ...volatiles, thrashLock: undefined, rolloutLock: undefined };
}

export function hasCounterPending(volatiles: BattleVolatiles): boolean {
  return volatiles.counterPending != null;
}

export function isCursed(volatiles: BattleVolatiles): boolean {
  return volatiles.cursed === true;
}

/** Store last-hit damage into an active counter/mirror coat (Gen II uses last hit only). */
export function accumulateCounterDamage(
  volatiles: BattleVolatiles,
  damage: number,
  moveCategory: 'physical' | 'special',
): BattleVolatiles {
  const pending = volatiles.counterPending;
  if (!pending || damage <= 0) return volatiles;
  if (pending.category !== moveCategory) return volatiles;
  return {
    ...volatiles,
    counterPending: { ...pending, damage },
  };
}
