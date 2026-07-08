import { getAllCachedSpecies } from '../data/speciesCache';

const MIN_LEVEL_BY_SPECIES: Record<number, number> = (() => {
  const minBySpecies: Record<number, number> = {};
  for (const species of getAllCachedSpecies()) {
    for (const evo of species.evolutions ?? []) {
      const existing = minBySpecies[evo.toId];
      if (existing === undefined || evo.minLevel < existing) {
        minBySpecies[evo.toId] = evo.minLevel;
      }
    }
  }
  return minBySpecies;
})();

/**
 * Filters encounter pools so level-evolution species only appear once
 * current encounter level reaches their pre-evolution level requirement.
 * Species with no level-evolution gate are left untouched.
 */
export function filterEncounterPoolByEvolutionLevel(pool: number[], encounterLevel: number): number[] {
  const filtered = pool.filter((id) => {
    const minLevel = MIN_LEVEL_BY_SPECIES[id];
    return minLevel === undefined || encounterLevel >= minLevel;
  });
  return filtered.length > 0 ? filtered : pool;
}

