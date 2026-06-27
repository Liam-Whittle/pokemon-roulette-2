/** HP = powerLevel × HP_SCALE (powerLevel is normalized 0.1–1). */
export const HP_SCALE = 200;
export const CRIT_CHANCE = 0.1;
export const CRIT_MULT = 1.3;
export const XATTACK_BONUS = 0.2;
/** At full move power + neutral matchup, damage ≈ this fraction of defender max HP. */
export const MOVE_DMG_RATIO = 0.42;

export function safePower(power: number): number {
  return Number.isFinite(power) ? power : 0.3;
}

export function maxHpFor(powerLevel: number): number {
  return Math.max(20, Math.round(safePower(powerLevel) * HP_SCALE));
}

export function currentHp(member: { hp?: number; powerLevel: number }): number {
  if (member.hp !== undefined && Number.isFinite(member.hp)) return member.hp;
  return maxHpFor(member.powerLevel);
}

export function isFainted(member: { hp?: number; powerLevel: number }): boolean {
  return currentHp(member) <= 0;
}

export function rollCrit(): boolean {
  return Math.random() < CRIT_CHANCE;
}

export function computeDamage(opts: {
  movePower: number;
  defenderMaxHp: number;
  effectiveness: number;
  attackerPower: number;
  defenderPower: number;
  crit: boolean;
}): number {
  const adv = opts.attackerPower - opts.defenderPower;
  const advMult = 1 + Math.max(-0.25, Math.min(0.25, adv * 0.5));
  let dmg =
    opts.movePower * opts.defenderMaxHp * MOVE_DMG_RATIO * opts.effectiveness * advMult;
  if (opts.crit) dmg *= CRIT_MULT;
  return Math.max(1, Math.round(dmg));
}

export function moveKey(ownerCaughtAt: number, slug: string): string {
  return `${ownerCaughtAt}:${slug}`;
}
