import { getCachedSpecies } from '../data/speciesCache';
import type { BagItem } from '../types/game';
import type { StoneItemId } from '../data/pools';

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
  44: [{ toId: 45, stoneId: 'leafstone' }],
  58: [{ toId: 59, stoneId: 'firestone' }],
  61: [{ toId: 62, stoneId: 'waterstone' }],
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
};

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

export function getAvailableEvolutions(speciesId: number, level: number, bag: BagItem[]): AvailableEvolution[] {
  const available: AvailableEvolution[] = getReadyEvolutions(speciesId, level).map((evo) => ({
    toId: evo.toId,
  }));
  const bagCounts = new Map(bag.map((item) => [item.id, item.quantity]));
  for (const evo of getStoneEvolutions(speciesId)) {
    if ((bagCounts.get(evo.stoneId) ?? 0) <= 0) continue;
    if (!available.some((entry) => entry.toId === evo.toId)) {
      available.push({ toId: evo.toId, stoneId: evo.stoneId });
    }
  }
  return available;
}

export function canEvolveNow(speciesId: number, level: number, bag: BagItem[]): boolean {
  return getAvailableEvolutions(speciesId, level, bag).length > 0;
}
