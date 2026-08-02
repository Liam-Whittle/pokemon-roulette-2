import { getCachedSpecies } from '../data/speciesCache';
import { getRegionAllPokemonPool, pickRandom, type RegionId } from '../data/pools';
import type { GymLeader } from '../types/game';

export function buildRandomRegionalTeam(
  region: RegionId,
  count: number,
  base: GymLeader,
): GymLeader {
  const pool = [...getRegionAllPokemonPool(region)].sort(() => Math.random() - 0.5);
  const picked = pool.slice(0, Math.max(1, count));
  return {
    ...base,
    pokemon: picked.map((id) => {
      const species = getCachedSpecies(id);
      return {
        id,
        name: species?.name ?? `pokemon-${id}`,
        level: 1,
      };
    }),
  };
}

export function pickRandomRegionalIds(region: RegionId, count: number, exclude: number[] = []): number[] {
  const excludeSet = new Set(exclude);
  const pool = getRegionAllPokemonPool(region).filter((id) => !excludeSet.has(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function pickOneRegionalId(region: RegionId, exclude: number[] = []): number {
  const ids = pickRandomRegionalIds(region, 1, exclude);
  return ids[0] ?? pickRandom(getRegionAllPokemonPool(region));
}
