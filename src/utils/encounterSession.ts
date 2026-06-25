import { fetchPokemon } from '../api/pokeapi';
import { useGameStore } from '../store/useGameStore';
import type { PokemonData } from '../types/game';

let cachedPokemon: PokemonData | null = null;
let inflight: Promise<PokemonData | null> | null = null;

/**
 * Resolves the current encounter Pokemon exactly once per catch-screen visit.
 * Survives React StrictMode remounts by reusing an in-flight / cached promise.
 */
export function resolveEncounterPokemon(): Promise<PokemonData | null> {
  const state = useGameStore.getState();

  // Fresh encounter in the store — drop any stale cache from a prior visit.
  if (state.currentEncounterId || state.currentPokemon) {
    cachedPokemon = null;
    inflight = null;
  }

  if (cachedPokemon) return Promise.resolve(cachedPokemon);
  if (inflight) return inflight;

  if (state.currentPokemon) {
    cachedPokemon = state.currentPokemon;
    state.clearEncounter();
    return Promise.resolve(cachedPokemon);
  }

  const encounterId = state.currentEncounterId;
  if (!encounterId) return Promise.resolve(null);

  state.clearEncounter();

  inflight = fetchPokemon(encounterId)
    .then((data) => {
      cachedPokemon = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function resetEncounterSession() {
  cachedPokemon = null;
  inflight = null;
}
