import type { PokemonData } from '../types/game';
import { MISSINGNO_DATA, MISSINGNO_ID } from '../data/missingno';
import { getCachedSpecies } from '../data/speciesCache';
import {
  localPokemonArtwork,
  localPokemonShinyArtwork,
  localPokemonShinySprite,
  localPokemonSprite,
} from '../utils/localAssets';

const BASE = 'https://pokeapi.co/api/v2';
const CACHE_PREFIX = 'poke-cache-v8-';
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
    // localStorage full
  }
  return data;
}

function speciesToPokemonData(cached: NonNullable<ReturnType<typeof getCachedSpecies>>, cries?: { latest?: string; legacy?: string }): PokemonData {
  return {
    id: cached.id,
    name: cached.name,
    displayName: capitalize(cached.name),
    types: cached.types,
    sprite: localPokemonSprite(cached.id),
    artwork: localPokemonArtwork(cached.id),
    shinySprite: localPokemonShinySprite(cached.id),
    shinyArtwork: localPokemonShinyArtwork(cached.id),
    catchRate: cached.catchRate,
    isLegendary: cached.isLegendary,
    baseStats: cached.baseStats,
    baseStatTotal: cached.baseStatTotal,
    evolvesToId: cached.evolvesToIds[0] ?? null,
    evolvesToIds: cached.evolvesToIds,
    cryLatest: cries?.latest,
    cryLegacy: cries?.legacy,
    moves: cached.learnset,
  };
}

interface PokeApiPokemon {
  cries?: { latest: string | null; legacy: string | null };
  moves?: {
    move: { name: string };
    version_group_details: { version_group: { name: string } }[];
  }[];
}

interface PokeApiSpecies {
  flavor_text_entries?: { flavor_text: string; language: { name: string } }[];
  genera?: { genus: string; language: { name: string } }[];
}

interface PokeApiPokemonDims {
  height: number;
  weight: number;
}

function cleanFlavorText(text: string): string {
  return text.replace(/[\f\n\r\u000c]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchPokemon(id: number): Promise<PokemonData> {
  const cached = getCachedSpecies(id);
  if (cached) {
    return cachedFetch(
      `pokemon-${id}`,
      async () => {
        let cries: { latest?: string; legacy?: string } = {};
        try {
          const res = await fetch(`${BASE}/pokemon/${id}`);
          if (res.ok) {
            const data = (await res.json()) as PokeApiPokemon;
            cries = { latest: data.cries?.latest ?? undefined, legacy: data.cries?.legacy ?? undefined };
          }
        } catch {
          // cries optional
        }
        return speciesToPokemonData(cached, cries);
      },
      (v) => Array.isArray(v.moves) && !!v.baseStats,
    );
  }
  throw new Error(`Species ${id} not in local cache`);
}

export async function fetchPokemonBatch(ids: number[]): Promise<PokemonData[]> {
  return Promise.all(ids.map((id) => fetchPokemon(id)));
}

export interface PokemonListEntry {
  id: number;
  name: string;
}

export async function fetchRegionList(
  region: 'Kanto' | 'Johto' | 'Hoenn',
): Promise<PokemonListEntry[]> {
  const maxId = region === 'Hoenn' ? 386 : region === 'Johto' ? 251 : 151;
  const cacheKey =
    region === 'Hoenn' ? 'gen123-list' : region === 'Johto' ? 'gen12-list' : 'gen1-list';
  return cachedFetch(cacheKey, async () => {
    const entries: PokemonListEntry[] = [];
    for (let id = 1; id <= maxId; id++) {
      const sp = getCachedSpecies(id);
      if (sp) entries.push({ id, name: sp.name });
    }
    return entries;
  });
}

export async function fetchGen1List(): Promise<PokemonListEntry[]> {
  return fetchRegionList('Kanto');
}

export interface PokemonDetail {
  flavorText: string;
  genus: string;
  heightM: number;
  weightKg: number;
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
      // optional
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
      // optional
    }
    return { flavorText, genus, heightM, weightKg };
  });
}

export function getPlaceholderPokemon(id: number): PokemonData {
  // MissingNo. is synthetic (id 0) and not in the species cache.
  if (id === MISSINGNO_ID) return { ...MISSINGNO_DATA };
  const cached = getCachedSpecies(id);
  if (cached) return speciesToPokemonData(cached);
  return {
    id,
    name: 'unknown',
    displayName: 'Unknown',
    types: ['normal'],
    sprite: localPokemonSprite(id),
    artwork: localPokemonArtwork(id),
    catchRate: 45,
    isLegendary: false,
    baseStats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
    baseStatTotal: 300,
    evolvesToId: null,
    evolvesToIds: [],
    moves: [],
  };
}
