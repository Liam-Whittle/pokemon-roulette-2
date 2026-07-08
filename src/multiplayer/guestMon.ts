import { fetchPokemon } from '../api/pokeapi';
import { pickRandom } from '../data/pools';
import type { PokemonData } from '../types/game';
import { createCaughtPokemon } from '../utils/pokemonInstance';
import { getComputedStats } from '../utils/stats';

/** Minimum total computed stats at Lv. 5 for a guest mon (replaces old power floor). */
export const GUEST_MIN_STAT_TOTAL = 250;

const GEN1_STRONG_CANDIDATES: number[] = [
  3, 6, 9, 18, 20, 22, 24, 26, 28, 31, 34, 36, 38, 40, 45, 47, 49, 51, 53, 55, 57, 59, 62, 65, 68, 71,
  73, 76, 78, 80, 82, 89, 91, 94, 97, 99, 101, 103, 105, 106, 107, 110, 112, 113, 115, 117, 119, 121,
  122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 134, 135, 136, 139, 141, 142, 143, 144, 145, 146,
  149, 150, 151,
];

function meetsGuestThreshold(pokemon: PokemonData): boolean {
  const mon = createCaughtPokemon(pokemon, { level: 5, preferStrongMoves: true });
  const stats = getComputedStats(mon);
  const total =
    stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;
  return total >= GUEST_MIN_STAT_TOTAL;
}

/**
 * Pick a random Gen 1 Pokémon strong enough for a guest mon.
 * Retries a few candidates; falls back to the strongest fetched.
 */
export async function pickGuestPokemon(): Promise<PokemonData> {
  const pool = [...GEN1_STRONG_CANDIDATES];
  const tried: PokemonData[] = [];

  for (let attempt = 0; attempt < 12 && pool.length > 0; attempt++) {
    const id = pickRandom(pool);
    pool.splice(pool.indexOf(id), 1);
    try {
      const data = await fetchPokemon(id);
      tried.push(data);
      if (meetsGuestThreshold(data)) return data;
    } catch {
      // try another
    }
  }

  if (tried.length === 0) {
    return fetchPokemon(130);
  }
  tried.sort((a, b) => {
    const aMon = createCaughtPokemon(a, { level: 5, preferStrongMoves: true });
    const bMon = createCaughtPokemon(b, { level: 5, preferStrongMoves: true });
    const aStats = getComputedStats(aMon);
    const bStats = getComputedStats(bMon);
    const aTotal =
      aStats.hp + aStats.attack + aStats.defense + aStats.specialAttack + aStats.specialDefense + aStats.speed;
    const bTotal =
      bStats.hp + bStats.attack + bStats.defense + bStats.specialAttack + bStats.specialDefense + bStats.speed;
    return bTotal - aTotal;
  });
  return tried[0]!;
}
