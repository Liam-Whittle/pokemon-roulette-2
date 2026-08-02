import { assignMoves } from '../data/moves';
import { MISSINGNO_ID } from '../data/missingno';
import type { CatchBallId, CaughtPokemon, PokemonData } from '../types/game';
import { encounterLevelForBadges } from './xp';
import { maxHpForMon, perfectIVs, randomIVs, randomNature, zeroEVs } from './stats';

export function createCaughtPokemon(
  pokemon: PokemonData,
  opts: {
    level?: number;
    nickname?: string;
    caughtWithBall?: CatchBallId;
    shiny?: boolean;
    caughtAt?: number;
    preferStrongMoves?: boolean;
  } = {},
): CaughtPokemon {
  const level = opts.level ?? 5;
  const ivs = pokemon.id === MISSINGNO_ID ? perfectIVs() : randomIVs();
  const nature = randomNature();
  const moves = assignMoves(pokemon.id, pokemon.types, level, opts.preferStrongMoves ?? false);
  const mon: CaughtPokemon = {
    id: pokemon.id,
    name: pokemon.name,
    displayName: pokemon.displayName,
    types: pokemon.types,
    sprite: pokemon.sprite,
    shinySprite: pokemon.shinySprite,
    caughtAt: opts.caughtAt ?? Date.now(),
    nickname: opts.nickname,
    level,
    xp: 0,
    ivs,
    evs: zeroEVs(),
    nature,
    moves,
    evolvesToId: pokemon.evolvesToId ?? null,
    shiny: opts.shiny ?? false,
    caughtWithBall: opts.caughtWithBall,
  };
  mon.hp = maxHpForMon(mon);
  return mon;
}

export function createCaughtAtLevel(
  pokemon: PokemonData,
  badgeCount: number,
  nickname?: string,
  caughtWithBall?: CatchBallId,
): CaughtPokemon {
  return createCaughtPokemon(pokemon, {
    level: encounterLevelForBadges(badgeCount),
    nickname,
    caughtWithBall,
  });
}

/** Migrate legacy save entries that used powerLevel. */
export function migrateCaughtPokemon(raw: Record<string, unknown>): CaughtPokemon {
  const id = Number(raw.id) || 1;
  const types = (raw.types as string[]) ?? ['normal'];

  if (typeof raw.level === 'number' && Array.isArray(raw.moves) && raw.moves.length > 0) {
    const mon = raw as unknown as CaughtPokemon;
    if (id !== MISSINGNO_ID) return mon;
    // Existing MissingNo. catches: lock lore IVs and refill empty/corrupt movesets.
    const ivs = perfectIVs();
    const moves =
      mon.moves.length >= 4 ? mon.moves.slice(0, 4) : assignMoves(MISSINGNO_ID, types, mon.level);
    const patched = { ...mon, ivs, moves };
    patched.hp = maxHpForMon(patched);
    return patched;
  }

  const level = typeof raw.level === 'number' ? raw.level : 5;
  const nature =
    typeof raw.nature === 'string' ? (raw.nature as CaughtPokemon['nature']) : randomNature();
  const ivs = id === MISSINGNO_ID ? perfectIVs() : randomIVs();
  const moves =
    Array.isArray(raw.moves) && raw.moves.length > 0
      ? (raw.moves as CaughtPokemon['moves'])
      : assignMoves(id, types, level);
  const mon: CaughtPokemon = {
    id,
    name: String(raw.name ?? 'unknown'),
    displayName: String(raw.displayName ?? raw.name ?? 'Unknown'),
    types,
    sprite: String(raw.sprite ?? ''),
    shinySprite: raw.shinySprite as string | undefined,
    caughtAt: Number(raw.caughtAt) || Date.now(),
    nickname: raw.nickname as string | undefined,
    level,
    xp: typeof raw.xp === 'number' ? raw.xp : 0,
    ivs,
    evs: (raw.evs as CaughtPokemon['evs']) ?? zeroEVs(),
    nature,
    moves: id === MISSINGNO_ID && moves.length < 4 ? assignMoves(MISSINGNO_ID, types, level) : moves,
    evolvesToId: (raw.evolvesToId as number | null) ?? null,
    shiny: Boolean(raw.shiny),
    caughtWithBall: raw.caughtWithBall as CatchBallId | undefined,
    hp: typeof raw.hp === 'number' ? raw.hp : undefined,
    pp: raw.pp as Record<string, number> | undefined,
    guestOwned: raw.guestOwned as boolean | undefined,
    guestLocked: raw.guestLocked as boolean | undefined,
  };
  if (mon.hp === undefined || id === MISSINGNO_ID) mon.hp = maxHpForMon(mon);
  return mon;
}

export function migratePokedexEntry(raw: Record<string, unknown>): { level: number } & Record<string, unknown> {
  const level = typeof raw.level === 'number' ? raw.level : 5;
  return { ...raw, level };
}
