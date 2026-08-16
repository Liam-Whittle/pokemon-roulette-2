import { assignMoves } from '../data/moves';
import { defaultAbilityForSpecies, rollAbilityForSpecies } from '../data/abilities';
import { rollGenderForSpecies } from '../data/speciesGender';
import { MISSINGNO_DATA, MISSINGNO_ID, MISSINGNO_SPRITE } from '../data/missingno';
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
    ability: rollAbilityForSpecies(pokemon.id),
    gender: rollGenderForSpecies(pokemon.id),
  };
  mon.hp = maxHpForMon(mon);
  return ensureCaughtPokemonFields(mon);
}

/** Fill ability / gender on any acquired mon (debug, gifts, older saves). */
export function ensureCaughtPokemonFields(mon: CaughtPokemon): CaughtPokemon {
  const next = { ...mon };
  if (!next.ability) next.ability = defaultAbilityForSpecies(next.id) ?? next.ability;
  if (next.gender === undefined) next.gender = rollGenderForSpecies(next.id);
  return next;
}

export function ensurePartyFields(party: CaughtPokemon[]): CaughtPokemon[] {
  let changed = false;
  const next = party.map((mon) => {
    if (mon.ability && mon.gender !== undefined) return mon;
    changed = true;
    return ensureCaughtPokemonFields(mon);
  });
  return changed ? next : party;
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
  // MissingNo. is id 0 — must not use `|| 1` (0 is falsy).
  const parsedId = Number(raw.id);
  const id = Number.isFinite(parsedId) ? parsedId : 1;
  const types =
    id === MISSINGNO_ID
      ? [...MISSINGNO_DATA.types]
      : ((raw.types as string[]) ?? ['normal']);

  if (typeof raw.level === 'number' && Array.isArray(raw.moves) && raw.moves.length > 0) {
    const mon = ensureCaughtPokemonFields(raw as unknown as CaughtPokemon);
    if (id !== MISSINGNO_ID) return mon;
    // Existing MissingNo. catches: restore identity, lock lore IVs, refill movesets.
    const ivs = perfectIVs();
    const moves =
      mon.moves.length >= 4 ? mon.moves.slice(0, 4) : assignMoves(MISSINGNO_ID, types, mon.level);
    const patched: CaughtPokemon = {
      ...mon,
      id: MISSINGNO_ID,
      name: MISSINGNO_DATA.name,
      displayName: MISSINGNO_DATA.displayName,
      types,
      sprite: MISSINGNO_SPRITE,
      ivs,
      moves,
    };
    patched.hp = maxHpForMon(patched);
    return ensureCaughtPokemonFields(patched);
  }

  const level = typeof raw.level === 'number' ? raw.level : 5;
  const nature =
    typeof raw.nature === 'string' ? (raw.nature as CaughtPokemon['nature']) : randomNature();
  const ivs = id === MISSINGNO_ID ? perfectIVs() : randomIVs();
  const moves =
    Array.isArray(raw.moves) && raw.moves.length > 0
      ? (raw.moves as CaughtPokemon['moves'])
      : assignMoves(id === MISSINGNO_ID ? MISSINGNO_ID : id, types, level);
  const mon: CaughtPokemon = {
    id,
    name: id === MISSINGNO_ID ? MISSINGNO_DATA.name : String(raw.name ?? 'unknown'),
    displayName:
      id === MISSINGNO_ID
        ? MISSINGNO_DATA.displayName
        : String(raw.displayName ?? raw.name ?? 'Unknown'),
    types,
    sprite: id === MISSINGNO_ID ? MISSINGNO_SPRITE : String(raw.sprite ?? ''),
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
    ability: (raw.ability as string | undefined) ?? defaultAbilityForSpecies(id),
    gender:
      raw.gender === 'male' || raw.gender === 'female' || raw.gender === null
        ? raw.gender
        : rollGenderForSpecies(id),
  };
  if (mon.hp === undefined || id === MISSINGNO_ID) mon.hp = maxHpForMon(mon);
  return ensureCaughtPokemonFields(mon);
}

export function migratePokedexEntry(raw: Record<string, unknown>): { level: number } & Record<string, unknown> {
  const level = typeof raw.level === 'number' ? raw.level : 5;
  return { ...raw, level };
}
