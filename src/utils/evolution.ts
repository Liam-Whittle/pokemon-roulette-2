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
  stoneId?: StoneItemId | 'omnistone';
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
  // Gen 3: Clamperl trade items → Huntail / Gorebyss (Trade Stone choice)
  366: [
    { toId: 367, stoneId: 'tradestone' },
    { toId: 368, stoneId: 'tradestone' },
  ],
};

const OWNERSHIP_EVOLVE_MS = 5 * 60 * 1000;

/** Friendship/time evolutions available in Johto and Hoenn. */
const FRIENDSHIP_TIME_EVOLUTIONS: Record<number, number> = {
  42: 169,
  113: 242,
  175: 176,
  172: 25,
  173: 35,
  // Hoenn babies → Gen 2 adults
  298: 183,
  360: 202,
  // Feebas beauty approximated as ownership timer
  349: 350,
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

/** Evolutions that require Johto or Hoenn (not Kanto). */
const POST_KANTO_EVOLUTION_KEYS = new Set([
  ...JOHTO_ONLY_EVOLUTION_KEYS,
  '298->183',
  '360->202',
  '349->350',
  '366->367',
  '366->368',
]);

function isBlockedInRegion(speciesId: number, toId: number, region: RegionId): boolean {
  const key = `${speciesId}->${toId}`;
  if (region === 'Kanto') return POST_KANTO_EVOLUTION_KEYS.has(key) || JOHTO_ONLY_EVOLUTION_KEYS.has(key);
  // Johto: block Hoenn-only chains that don't exist there as babies-only content is fine for Johto babies
  if (region === 'Johto') {
    return key === '298->183' || key === '360->202' || key === '349->350' || key === '366->367' || key === '366->368';
  }
  // Hoenn: allow Hoenn + shared post-Kanto; Johto-only Gen2 form gates still OK if stones exist
  return false;
}

function hasOwnedLongEnough(caughtAt?: number): boolean {
  if (!caughtAt) return false;
  return Date.now() - caughtAt >= OWNERSHIP_EVOLVE_MS;
}

function regionAllowsTimedEvolutions(region: RegionId): boolean {
  return region === 'Johto' || region === 'Hoenn';
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
  if (!regionAllowsTimedEvolutions(ctx.region) || !hasOwnedLongEnough(ctx.caughtAt)) return [];
  if (speciesId === 133 && ctx.region === 'Johto') {
    const hour = new Date().getHours();
    // Gen II: day (6am–6pm) → Espeon, night → Umbreon.
    return [{ toId: hour >= 6 && hour < 18 ? 196 : 197 }];
  }
  const toId = FRIENDSHIP_TIME_EVOLUTIONS[speciesId];
  if (!toId || isBlockedInRegion(speciesId, toId, ctx.region)) return [];
  return [{ toId }];
}

export function getAvailableEvolutions(
  speciesId: number,
  level: number,
  bag: BagItem[],
  ctx: EvolutionContext = { region: 'Kanto' },
): AvailableEvolution[] {
  const available: AvailableEvolution[] = getReadyEvolutions(speciesId, level)
    .map((evo) => ({ toId: evo.toId }))
    .filter((evo) => !isBlockedInRegion(speciesId, evo.toId, ctx.region));
  for (const evo of getTimedEvolutions(speciesId, ctx)) {
    if (!available.some((entry) => entry.toId === evo.toId)) available.push(evo);
  }
  const bagCounts = new Map(bag.map((item) => [item.id, item.quantity]));
  const allowedStones = new Set(getStoneItemIdsForRegion(ctx.region));
  const hasOmnistone = (bagCounts.get('omnistone') ?? 0) > 0;
  for (const evo of getStoneEvolutions(speciesId)) {
    if (!allowedStones.has(evo.stoneId)) continue;
    if (isBlockedInRegion(speciesId, evo.toId, ctx.region)) continue;
    const hasStone = (bagCounts.get(evo.stoneId) ?? 0) > 0;
    if (!hasStone && !hasOmnistone) continue;
    if (!available.some((entry) => entry.toId === evo.toId)) {
      available.push({
        toId: evo.toId,
        stoneId: hasStone ? evo.stoneId : 'omnistone',
      });
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
  if (speciesId === 349 && evo.toId === 350) return 'High beauty (time)';
  if (Object.values(FRIENDSHIP_TIME_EVOLUTIONS).includes(evo.toId)) {
    return 'High friendship & time';
  }
  return 'Level up';
}
