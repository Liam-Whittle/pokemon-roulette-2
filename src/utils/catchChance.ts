/** Wild encounters are treated as if the target has this much HP remaining. */
export const ASSUMED_HP_RATIO = 0.3;

/** Gen 3–7 HP factor at 30% HP: (3 - 2*0.3) / 3 = 0.8 */
const HP_FACTOR = (3 - 2 * ASSUMED_HP_RATIO) / 3;

/** Standard Gen 3–7 ball catch-rate multipliers. */
export const BALL_MULTIPLIERS: Record<string, number> = {
  pokeball: 1,
  greatball: 1.5,
  ultraball: 2,
};

export interface CatchContext {
  a: number;
  modifiedRate: number;
  ballMultiplier: number;
}

export interface CatchShakeResult {
  caught: boolean;
  /** Shakes before break (1–4); 4 on a successful catch. */
  shakes: number;
}

export function computeModifiedRate(catchRate: number, ballId: string): number {
  if (ballId === 'masterball') return 255;
  const mult = BALL_MULTIPLIERS[ballId] ?? 1;
  return Math.min(255, Math.floor(catchRate * mult));
}

export function computeCatchA(catchRate: number, ballId: string): number {
  if (ballId === 'masterball') return 255;
  const modifiedRate = computeModifiedRate(catchRate, ballId);
  return Math.floor(HP_FACTOR * modifiedRate);
}

export function computeCatchContext(catchRate: number, ballId: string): CatchContext {
  const ballMultiplier = ballId === 'masterball' ? Infinity : (BALL_MULTIPLIERS[ballId] ?? 1);
  const modifiedRate = computeModifiedRate(catchRate, ballId);
  const a = computeCatchA(catchRate, ballId);
  return { a, modifiedRate, ballMultiplier };
}

/** Gen 3–7 shake threshold `b` from catch value `a`. */
export function computeShakeB(a: number): number {
  const safeA = Math.max(1, a);
  return Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / safeA)));
}

/** Probability all four shakes succeed (for UI display). */
export function catchProbability(catchRate: number, ballId: string): number {
  if (ballId === 'masterball') return 1;
  const a = computeCatchA(catchRate, ballId);
  if (a >= 255) return 1;
  const b = computeShakeB(a);
  const pShake = b / 65536;
  return Math.pow(pShake, 4);
}

/** Run authentic four-shake catch checks (Gen 3–7). */
export function resolveCatchShakes(
  catchRate: number,
  ballId: string,
  rng: () => number = Math.random,
): CatchShakeResult {
  if (ballId === 'masterball') return { caught: true, shakes: 4 };

  const a = computeCatchA(catchRate, ballId);
  if (a >= 255) return { caught: true, shakes: 4 };

  const b = computeShakeB(a);
  for (let shake = 1; shake <= 4; shake++) {
    if (Math.floor(rng() * 65536) >= b) {
      return { caught: false, shakes: shake };
    }
  }
  return { caught: true, shakes: 4 };
}

/** @deprecated Use resolveCatchShakes */
export function rollCatch(ballId: string, catchRate: number): boolean {
  return resolveCatchShakes(catchRate, ballId).caught;
}

/** @deprecated Use catchProbability */
export function catchChance(ballId: string, catchRate: number): number {
  return catchProbability(catchRate, ballId);
}

/** Skill mode difficulty derived from the same effective catch value `a`. */
export function comboDifficulty(a: number, level: number, isLegendary: boolean) {
  const normalized = 1 - Math.min(a, 255) / 255;
  const levelFactor = level / 40;
  const power = Math.min(1, normalized * 0.7 + levelFactor * 0.3) * (isLegendary ? 1.15 : 1);
  return {
    requiredHits: isLegendary ? 5 : Math.min(5, Math.max(2, 2 + Math.round(power * 3))),
    zoneSize: Math.max(0.08, 0.32 - power * 0.2),
    speedMult: 1 + power * 0.5,
  };
}

export function formatCatchPercent(probability: number): string {
  if (probability >= 1) return '100%';
  if (probability >= 0.995) return '99%+';
  if (probability < 0.005) return '<1%';
  return `${Math.round(probability * 100)}%`;
}
