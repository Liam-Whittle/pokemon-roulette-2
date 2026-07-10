import { getCachedSpecies } from '../data/speciesCache';
import type { BagItem } from '../types/game';
import { getStoneItemIdsForRegion, ITEMS } from '../data/pools';
import type { RegionId, StoneItemId } from '../data/pools';

export interface LevelEvolution {
  toId: number;
  minLevel: number;
}

export interface AvailableEvolution {
  toId: number;
  stoneId?: StoneItemId;
}

const STONE_EVOLUTIONS: Record<number, Array<{ toId: number; stoneId: StoneItemId }>> = {
  25: [{ toId: 26, stoneId: 'thunderstone' }],
  30: [{ toId: 31, stoneId: 'moonstone' }],
  33: [{ toId: 34, stoneId: 'moonstone' }],
  35: [{ toId: 36, stoneId: 'moonstone' }],
  37: [{ toId: 38, stoneId: 'firestone' }],
  39: [{ toId: 40, stoneId: 'moonstone' }],
  44: [
    { toId: 45, stoneId: 'leafstone' },
    { toId: 182, stoneId: 'sunstone' },
  ],
  58: [{ toId: 59, stoneId: 'firestone' }],
  61: [
    { toId: 62, stoneId: 'waterstone' },
    { toId: 186, stoneId: 'kingsrock' },
  ],
  64: [{ toId: 65, stoneId: 'tradestone' }],
  67: [{ toId: 68, stoneId: 'tradestone' }],
  70: [{ toId: 71, stoneId: 'leafstone' }],
  75: [{ toId: 76, stoneId: 'tradestone' }],
  90: [{ toId: 91, stoneId: 'waterstone' }],
  93: [{ toId: 94, stoneId: 'tradestone' }],
  102: [{ toId: 103, stoneId: 'leafstone' }],
  120: [{ toId: 121, stoneId: 'waterstone' }],
  133: [
    { toId: 134, stoneId: 'waterstone' },
    { toId: 135, stoneId: 'thunderstone' },
    { toId: 136, stoneId: 'firestone' },
  ],
  79: [{ toId: 199, stoneId: 'kingsrock' }],
  95: [{ toId: 208, stoneId: 'metalcoat' }],
  123: [{ toId: 212, stoneId: 'metalcoat' }],
  117: [{ toId: 230, stoneId: 'dragonscale' }],
  191: [{ toId: 192, stoneId: 'sunstone' }],
};

const OWNERSHIP_EVOLVE_MS = 5 * 60 * 1000;

const FRIENDSHIP_TIME_EVOLUTIONS: Record<number, number> = {
  42: 169,
  113: 242,
  175: 176,
  172: 25,
  173: 35,
};

const JOHTO_ONLY_EVOLUTION_KEYS = new Set([
  '42->169',
  '113->242',
  '133->196',
  '133->197',
  '175->176',
  '172->25',
  '173->35',
  '61->186',
  '79->199',
  '95->208',
  '117->230',
  '123->212',
  '44->182',
  '191->192',
]);

function isJohtoOnlyEvolution(speciesId: number, toId: number): boolean {
  return JOHTO_ONLY_EVOLUTION_KEYS.has(`${speciesId}->${toId}`);
}

function hasOwnedLongEnough(caughtAt?: number): boolean {
  if (!caughtAt) return false;
  return Date.now() - caughtAt >= OWNERSHIP_EVOLVE_MS;
}

export function getSpeciesEvolutions(speciesId: number): LevelEvolution[] {
  return getCachedSpecies(speciesId)?.evolutions ?? [];
}

/** Level-up evolutions the Pokémon is eligible for right now. */
export function getReadyEvolutions(speciesId: number, level: number): LevelEvolution[] {
  return getSpeciesEvolutions(speciesId).filter((evo) => level >= evo.minLevel);
}

export function canEvolveAtLevel(speciesId: number, level: number): boolean {
  return getReadyEvolutions(speciesId, level).length > 0;
}

export function getStoneEvolutions(speciesId: number): Array<{ toId: number; stoneId: StoneItemId }> {
  return STONE_EVOLUTIONS[speciesId] ?? [];
}

export function findStoneForEvolution(speciesId: number, toId: number): StoneItemId | null {
  const match = getStoneEvolutions(speciesId).find((evo) => evo.toId === toId);
  return match?.stoneId ?? null;
}

interface EvolutionContext {
  region: RegionId;
  caughtAt?: number;
}

function getTimedEvolutions(speciesId: number, ctx: EvolutionContext): AvailableEvolution[] {
  if (ctx.region !== 'Johto' || !hasOwnedLongEnough(ctx.caughtAt)) return [];
  if (speciesId === 133) {
    const hour = new Date().getHours();
    // Gen II: day (6am–6pm) → Espeon, night → Umbreon.
    return [{ toId: hour >= 6 && hour < 18 ? 196 : 197 }];
  }
  const toId = FRIENDSHIP_TIME_EVOLUTIONS[speciesId];
  return toId ? [{ toId }] : [];
}

export function getAvailableEvolutions(
  speciesId: number,
  level: number,
  bag: BagItem[],
  ctx: EvolutionContext = { region: 'Kanto' },
): AvailableEvolution[] {
  const available: AvailableEvolution[] = getReadyEvolutions(speciesId, level)
    .map((evo) => ({ toId: evo.toId }))
    .filter((evo) => ctx.region === 'Johto' || !isJohtoOnlyEvolution(speciesId, evo.toId));
  for (const evo of getTimedEvolutions(speciesId, ctx)) {
    if (!available.some((entry) => entry.toId === evo.toId)) available.push(evo);
  }
  const bagCounts = new Map(bag.map((item) => [item.id, item.quantity]));
  const allowedStones = new Set(getStoneItemIdsForRegion(ctx.region));
  for (const evo of getStoneEvolutions(speciesId)) {
    if (!allowedStones.has(evo.stoneId)) continue;
    if (ctx.region !== 'Johto' && isJohtoOnlyEvolution(speciesId, evo.toId)) continue;
    if ((bagCounts.get(evo.stoneId) ?? 0) <= 0) continue;
    if (!available.some((entry) => entry.toId === evo.toId)) {
      available.push({ toId: evo.toId, stoneId: evo.stoneId });
    }
  }
  return available;
}

export function canEvolveNow(
  speciesId: number,
  level: number,
  bag: BagItem[],
  ctx: EvolutionContext = { region: 'Kanto' },
): boolean {
  return getAvailableEvolutions(speciesId, level, bag, ctx).length > 0;
}

function formatSpeciesName(name: string): string {
  return name
    .split(/[- ]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getEvolutionTargetName(toId: number): string {
  const cached = getCachedSpecies(toId);
  return cached ? formatSpeciesName(cached.name) : `Pokémon #${toId}`;
}

/** Short label for how this evolution is triggered (stone, time, level). */
export function getEvolutionMethodLabel(evo: AvailableEvolution, speciesId: number): string {
  if (evo.stoneId) {
    const stone = ITEMS.find((item) => item.id === evo.stoneId);
    return stone ? `Use ${stone.name}` : 'Use evolution stone';
  }
  if (speciesId === 133 && evo.toId === 196) return 'High friendship (daytime)';
  if (speciesId === 133 && evo.toId === 197) return 'High friendship (nighttime)';
  if (Object.values(FRIENDSHIP_TIME_EVOLUTIONS).includes(evo.toId)) {
    return 'High friendship & time';
  }
  return 'Level up';
}
