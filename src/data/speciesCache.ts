import speciesJson from './cache/species-gen1.json';
import movesJson from './cache/moves.json';
import type { BaseStats, MoveCategory, StatusAilment, StoredMove } from '../types/game';

export interface CachedSpecies {
  id: number;
  name: string;
  types: string[];
  baseStats: BaseStats;
  baseStatTotal: number;
  catchRate: number;
  isLegendary: boolean;
  evolvesToIds: number[];
  evolutions?: { toId: number; minLevel: number }[];
  learnset: string[];
  weightKg?: number;
}

const DEFAULT_SPECIES_WEIGHT_KG = 50;

export function getSpeciesWeightKg(speciesId: number): number {
  return getCachedSpecies(speciesId)?.weightKg ?? DEFAULT_SPECIES_WEIGHT_KG;
}

export interface CachedMove {
  slug: string;
  name: string;
  type: string;
  power: number;
  accuracy: number;
  category: MoveCategory;
  pp: number;
  statusEffect: StatusAilment | null;
  isToxic: boolean;
}

const speciesMap = speciesJson as Record<string, CachedSpecies>;
const movesMap = movesJson as Record<string, CachedMove>;

export function getCachedSpecies(id: number): CachedSpecies | undefined {
  return speciesMap[String(id)];
}

export function getCachedMove(slug: string): CachedMove | undefined {
  return movesMap[slug];
}

export function getAllCachedSpecies(): CachedSpecies[] {
  return Object.values(speciesMap);
}

export function cachedMoveToStored(slug: string): StoredMove | null {
  const m = movesMap[slug];
  if (!m) return null;
  return {
    slug: m.slug,
    name: m.name,
    type: m.type,
    power: m.power,
    accuracy: m.accuracy,
    category: m.category,
    maxPp: m.pp,
    statusEffect: m.isToxic ? 'toxic' : m.statusEffect,
  };
}
