import speciesJson from './cache/species-gen1.json';
import movesJson from './cache/moves.json';
import type { BaseStats, MoveCategory, StatusAilment, StoredMove } from '../types/game';
import { applyGen2MoveType } from './gen2MoveTypes';

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

/** Sample up to `count` distinct moves from the curated move cache. */
export function getRandomCachedMoves(count: number): StoredMove[] {
  const slugs = Object.keys(movesMap);
  for (let i = slugs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [slugs[i], slugs[j]] = [slugs[j]!, slugs[i]!];
  }
  const out: StoredMove[] = [];
  for (const slug of slugs) {
    const move = cachedMoveToStored(slug);
    if (!move) continue;
    out.push(move);
    if (out.length >= count) break;
  }
  return out;
}

export function cachedMoveToStored(slug: string): StoredMove | null {
  const m = movesMap[slug];
  if (!m) return null;
  return {
    slug: m.slug,
    name: m.name,
    type: applyGen2MoveType(m.slug, m.type),
    power: m.power,
    accuracy: m.accuracy,
    category: m.category,
    maxPp: m.pp,
    statusEffect: m.isToxic ? 'toxic' : m.statusEffect,
  };
}
