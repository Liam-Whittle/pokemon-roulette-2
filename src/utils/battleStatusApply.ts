import type { BattleField } from '../data/battleField';
import type { BattleWeather } from '../data/battleField';
import { weatherHealFraction } from '../data/battleWeather';
import { WEATHER_HEAL_MOVES } from '../data/moveEffects';

export function mergeFieldPatch(field: BattleField, patch?: Partial<BattleField>): BattleField {
  if (!patch) return field;
  return { ...field, ...patch };
}

export function healFractionForMove(
  slug: string,
  weather: BattleWeather,
  explicit?: number,
): number {
  if (explicit != null) return explicit;
  if (WEATHER_HEAL_MOVES.has(slug)) return weatherHealFraction(weather);
  return 0.5;
}

export function hiddenPowerTypeFor(
  field: BattleField,
  caughtAt: number,
): string | undefined {
  return field.hiddenPowerTypes[caughtAt];
}
