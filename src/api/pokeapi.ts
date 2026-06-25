import type { PokemonData } from '../types/game';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

const BASE = 'https://pokeapi.co/api/v2';
// Bump the version suffix whenever the cached shape changes so stale entries
// (e.g. cached before powerLevel/baseStatTotal existed) are ignored.
const CACHE_PREFIX = 'poke-cache-v2-';
const memoryCache = new Map<string, unknown>();

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-([a-z])/g, (_, c) => ` ${c.toUpperCase()}`);
}

async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  isValid?: (value: T) => boolean,
): Promise<T> {
  if (memoryCache.has(key)) {
    const cached = memoryCache.get(key) as T;
    if (!isValid || isValid(cached)) return cached;
    memoryCache.delete(key);
  }

  const stored = localStorage.getItem(CACHE_PREFIX + key);
  if (stored) {
    const parsed = JSON.parse(stored) as T;
    if (!isValid || isValid(parsed)) {
      memoryCache.set(key, parsed);
      return parsed;
    }
  }

  const data = await fetcher();
  memoryCache.set(key, data);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    // localStorage full — memory cache still works
  }
  return data;
}

interface PokeApiPokemon {
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number }[];
  sprites: {
    front_default: string | null;
    other: { 'official-artwork': { front_default: string | null } };
  };
  species: { url: string };
}

interface PokeApiSpecies {
  id: number;
  capture_rate: number;
  is_legendary: boolean;
  evolution_chain?: { url: string };
}

interface EvolutionNode {
  species: { name: string; url: string };
  evolves_to: EvolutionNode[];
}

interface EvolutionChain {
  chain: EvolutionNode;
}

function extractId(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

function getBaseStatTotal(stats: { base_stat: number }[]): number {
  return stats.reduce((sum, stat) => sum + stat.base_stat, 0);
}

function normalizePowerLevel(baseStatTotal: number): number {
  return Math.max(0.1, Math.min(1, (baseStatTotal - 200) / 500));
}

function findEvolutionTarget(node: EvolutionNode, currentName: string): number | null {
  if (node.species.name === currentName) {
    const next = node.evolves_to[0];
    return next ? extractId(next.species.url) : null;
  }
  for (const child of node.evolves_to) {
    const target = findEvolutionTarget(child, currentName);
    if (target) return target;
  }
  return null;
}

export async function fetchPokemon(id: number): Promise<PokemonData> {
  return cachedFetch(
    `pokemon-${id}`,
    async () => {
    const res = await fetch(`${BASE}/pokemon/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch pokemon ${id}`);
    const data = (await res.json()) as PokeApiPokemon;

    let catchRate = 45;
    let isLegendary = false;
    let evolvesToId: number | null = null;
    try {
      const speciesRes = await fetch(data.species.url);
      if (speciesRes.ok) {
        const species = (await speciesRes.json()) as PokeApiSpecies;
        catchRate = species.capture_rate;
        isLegendary = species.is_legendary;
        if (species.evolution_chain?.url) {
          const evoRes = await fetch(species.evolution_chain.url);
          if (evoRes.ok) {
            const evo = (await evoRes.json()) as EvolutionChain;
            evolvesToId = findEvolutionTarget(evo.chain, data.name);
          }
        }
      }
    } catch {
      // species fetch optional
    }

    const baseStatTotal = getBaseStatTotal(data.stats);

    return {
      id: data.id,
      name: data.name,
      displayName: capitalize(data.name),
      types: data.types.map((t) => t.type.name),
      sprite: data.sprites.front_default ?? PLACEHOLDER_SPRITE,
      artwork:
        data.sprites.other['official-artwork'].front_default ??
        data.sprites.front_default ??
        PLACEHOLDER_SPRITE,
      catchRate,
      isLegendary,
      powerLevel: normalizePowerLevel(baseStatTotal),
      baseStatTotal,
      evolvesToId,
    };
    },
    (value) => Number.isFinite(value.powerLevel),
  );
}

export async function fetchPokemonBatch(ids: number[]): Promise<PokemonData[]> {
  return Promise.all(ids.map((id) => fetchPokemon(id)));
}

export function getPlaceholderPokemon(id: number): PokemonData {
  return {
    id,
    name: 'unknown',
    displayName: 'Unknown',
    types: ['normal'],
    sprite: PLACEHOLDER_SPRITE,
    artwork: PLACEHOLDER_SPRITE,
    catchRate: 45,
    isLegendary: false,
    powerLevel: 0.3,
    baseStatTotal: 250,
    evolvesToId: null,
  };
}
