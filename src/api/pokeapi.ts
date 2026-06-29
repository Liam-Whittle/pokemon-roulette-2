import type { PokemonData } from '../types/game';
import { extractGen1MoveSlugs } from '../data/moves';
import {
  localPokemonArtwork,
  localPokemonShinyArtwork,
  localPokemonShinySprite,
  localPokemonSprite,
} from '../utils/localAssets';
import { REGION_MAX_DEX_ID } from '../data/pools';

const BASE = 'https://pokeapi.co/api/v2';
// Bump the version suffix whenever the cached shape changes so stale entries
// (e.g. cached before powerLevel/baseStatTotal existed) are ignored.
const CACHE_PREFIX = 'poke-cache-v7-';
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
  past_types?: {
    generation: { name: string };
    types: { type: { name: string } }[];
  }[];
  stats: { base_stat: number }[];
  sprites: {
    front_default: string | null;
    front_shiny: string | null;
    other: { 'official-artwork': { front_default: string | null; front_shiny: string | null } };
  };
  cries?: { latest: string | null; legacy: string | null };
  species: { url: string };
  moves?: {
    move: { name: string };
    version_group_details: { version_group: { name: string } }[];
  }[];
}

interface PokeApiSpecies {
  id: number;
  capture_rate: number;
  is_legendary: boolean;
  evolution_chain?: { url: string };
  flavor_text_entries?: {
    flavor_text: string;
    language: { name: string };
  }[];
  genera?: { genus: string; language: { name: string } }[];
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

const GEN_ORDER: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
};

/** Resolve Gen 1 typings from past_types when PokeAPI has retroactive type changes. */
function gen1Types(data: PokeApiPokemon): string[] {
  const past = (data.past_types ?? [])
    .map((p) => ({
      gen: GEN_ORDER[p.generation.name] ?? 99,
      types: p.types.map((t) => t.type.name),
    }))
    .sort((a, b) => a.gen - b.gen);
  return past[0]?.types ?? data.types.map((t) => t.type.name);
}

/** Species IDs of every direct evolution branch available to `currentName`. */
function findEvolutionTargets(node: EvolutionNode, currentName: string): number[] {
  if (node.species.name === currentName) {
    return node.evolves_to.map((next) => extractId(next.species.url));
  }
  for (const child of node.evolves_to) {
    const targets = findEvolutionTargets(child, currentName);
    if (targets.length) return targets;
  }
  return [];
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
    let evolvesToIds: number[] = [];
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
            // Keep only evolutions inside the current region's dex range so we
            // don't evolve into Pokémon from generations that aren't unlocked
            // yet (e.g. Onix → Steelix, Eevee → Espeon/Umbreon).
            evolvesToIds = findEvolutionTargets(evo.chain, data.name).filter(
              (evoId) => evoId > 0 && evoId <= REGION_MAX_DEX_ID,
            );
          }
        }
      }
    } catch {
      // species fetch optional
    }

    const baseStatTotal = getBaseStatTotal(data.stats);
    const gen1Moves = data.moves ? extractGen1MoveSlugs(data.moves) : [];

    return {
      id: data.id,
      name: data.name,
      displayName: capitalize(data.name),
      types: gen1Types(data),
      sprite: localPokemonSprite(data.id),
      artwork: localPokemonArtwork(data.id),
      shinySprite: localPokemonShinySprite(data.id),
      shinyArtwork: localPokemonShinyArtwork(data.id),
      catchRate,
      isLegendary,
      powerLevel: normalizePowerLevel(baseStatTotal),
      baseStatTotal,
      evolvesToId: evolvesToIds[0] ?? null,
      evolvesToIds,
      cryLatest: data.cries?.latest ?? undefined,
      cryLegacy: data.cries?.legacy ?? undefined,
      moves: gen1Moves,
    };
    },
    (value) => Number.isFinite(value.powerLevel) && Array.isArray(value.moves),
  );
}

export async function fetchPokemonBatch(ids: number[]): Promise<PokemonData[]> {
  return Promise.all(ids.map((id) => fetchPokemon(id)));
}

export interface PokemonListEntry {
  id: number;
  name: string;
}

/** Fetches the Gen 1 (Kanto, #1–151) name list in a single request. */
export async function fetchGen1List(): Promise<PokemonListEntry[]> {
  return cachedFetch('gen1-list', async () => {
    const res = await fetch(`${BASE}/pokemon?limit=151&offset=0`);
    if (!res.ok) throw new Error('Failed to fetch Pokémon list');
    const data = (await res.json()) as { results: { name: string; url: string }[] };
    return data.results
      .map((r) => ({ id: extractId(r.url), name: r.name }))
      .filter((entry) => entry.id > 0);
  });
}

export interface PokemonDetail {
  flavorText: string;
  genus: string;
  heightM: number;
  weightKg: number;
}

interface PokeApiPokemonDims {
  height: number;
  weight: number;
}

function cleanFlavorText(text: string): string {
  return text.replace(/[\f\n\r\u000c]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchPokemonDetail(id: number): Promise<PokemonDetail> {
  return cachedFetch(`detail-${id}`, async () => {
    let flavorText = '';
    let genus = '';
    let heightM = 0;
    let weightKg = 0;

    try {
      const res = await fetch(`${BASE}/pokemon/${id}`);
      if (res.ok) {
        const data = (await res.json()) as PokeApiPokemonDims;
        heightM = data.height / 10;
        weightKg = data.weight / 10;
      }
    } catch {
      // dimensions optional
    }

    try {
      const speciesRes = await fetch(`${BASE}/pokemon-species/${id}`);
      if (speciesRes.ok) {
        const species = (await speciesRes.json()) as PokeApiSpecies;
        const enFlavor = species.flavor_text_entries?.find((e) => e.language.name === 'en');
        if (enFlavor) flavorText = cleanFlavorText(enFlavor.flavor_text);
        const enGenus = species.genera?.find((g) => g.language.name === 'en');
        if (enGenus) genus = enGenus.genus;
      }
    } catch {
      // flavor/genus optional
    }

    return { flavorText, genus, heightM, weightKg };
  });
}

export function getPlaceholderPokemon(id: number): PokemonData {
  return {
    id,
    name: 'unknown',
    displayName: 'Unknown',
    types: ['normal'],
    sprite: localPokemonSprite(id),
    artwork: localPokemonArtwork(id),
    catchRate: 45,
    isLegendary: false,
    powerLevel: 0.3,
    baseStatTotal: 250,
    evolvesToId: null,
    evolvesToIds: [],
    moves: [],
  };
}
