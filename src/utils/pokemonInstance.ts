import { assignMoves } from '../data/moves';
import type { CatchBallId, CaughtPokemon, PokemonData } from '../types/game';
import { encounterLevelForBadges } from './xp';
import { maxHpForMon, randomIVs, randomNature, zeroEVs } from './stats';

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
  const ivs = randomIVs();
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
  if (typeof raw.level === 'number' && Array.isArray(raw.moves)) {
    return raw as unknown as CaughtPokemon;
  }
  const id = Number(raw.id) || 1;
  const types = (raw.types as string[]) ?? ['normal'];
  const level = 5;
  const ivs = randomIVs();
  const nature = randomNature();
  const moves = assignMoves(id, types, level);
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
    xp: 0,
    ivs,
    evs: zeroEVs(),
    nature,
    moves,
    evolvesToId: (raw.evolvesToId as number | null) ?? null,
    shiny: Boolean(raw.shiny),
    caughtWithBall: raw.caughtWithBall as CatchBallId | undefined,
    hp: typeof raw.hp === 'number' ? raw.hp : undefined,
    pp: raw.pp as Record<string, number> | undefined,
    guestOwned: raw.guestOwned as boolean | undefined,
    guestLocked: raw.guestLocked as boolean | undefined,
  };
  if (mon.hp === undefined) mon.hp = maxHpForMon(mon);
  return mon;
}

export function migratePokedexEntry(raw: Record<string, unknown>): { level: number } & Record<string, unknown> {
  const level = typeof raw.level === 'number' ? raw.level : 5;
  return { ...raw, level };
}
