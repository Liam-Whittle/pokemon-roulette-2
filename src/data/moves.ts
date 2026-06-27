import type { BattleMove, CaughtPokemon, PokemonData } from '../types/game';
import { safePower } from '../utils/battle';

/** Preferred Gen 1 damaging moves per type (slug order = priority). */
export const CURATED_MOVES: Record<string, string[]> = {
  normal: ['body-slam', 'hyper-beam', 'strength', 'tackle'],
  fire: ['flamethrower', 'fire-blast', 'ember', 'fire-punch'],
  water: ['surf', 'hydro-pump', 'water-gun', 'bubble-beam'],
  electric: ['thunderbolt', 'thunder', 'thunder-shock', 'thunder-punch'],
  grass: ['razor-leaf', 'solar-beam', 'vine-whip', 'mega-drain'],
  ice: ['blizzard', 'ice-beam', 'aurora-beam', 'ice-punch'],
  fighting: ['submission', 'low-kick', 'karate-chop', 'seismic-toss'],
  poison: ['sludge', 'poison-sting', 'acid'],
  ground: ['earthquake', 'dig', 'bone-club'],
  flying: ['fly', 'drill-peck', 'wing-attack', 'peck'],
  psychic: ['psychic', 'psybeam', 'confusion'],
  bug: ['pin-missile', 'twineedle', 'leech-life'],
  rock: ['rock-slide', 'rock-throw', 'bide'],
  ghost: ['lick', 'night-shade', 'confuse-ray'],
  dragon: ['dragon-rage', 'wrap'],
  dark: ['bite', 'crunch'],
  steel: ['iron-tail', 'metal-claw'],
  fairy: ['swift', 'tackle'],
};

const GEN1_VERSION_GROUPS = new Set(['red-blue', 'blue', 'yellow', 'red-green']);

/** Base PP for each curated move (matches PokeAPI move PP values). */
export const MOVE_PP: Record<string, number> = {
  'body-slam': 15, 'hyper-beam': 5, strength: 15, tackle: 35,
  flamethrower: 15, 'fire-blast': 5, ember: 25, 'fire-punch': 15,
  surf: 15, 'hydro-pump': 5, 'water-gun': 25, 'bubble-beam': 20,
  thunderbolt: 15, thunder: 10, 'thunder-shock': 30, 'thunder-punch': 15,
  'razor-leaf': 25, 'solar-beam': 10, 'vine-whip': 25, 'mega-drain': 15,
  blizzard: 5, 'ice-beam': 10, 'aurora-beam': 20, 'ice-punch': 15,
  submission: 20, 'low-kick': 20, 'karate-chop': 25, 'seismic-toss': 20,
  sludge: 20, 'poison-sting': 35, acid: 30,
  earthquake: 10, dig: 10, 'bone-club': 20,
  fly: 15, 'drill-peck': 20, 'wing-attack': 35, peck: 35,
  psychic: 10, psybeam: 20, confusion: 25,
  'pin-missile': 20, twineedle: 20, 'leech-life': 10,
  'rock-slide': 10, 'rock-throw': 15, bide: 10,
  lick: 30, 'night-shade': 15, 'confuse-ray': 10,
  'dragon-rage': 10, wrap: 20,
  bite: 25, crunch: 15,
  'iron-tail': 15, 'metal-claw': 35,
  swift: 20,
};

const DEFAULT_PP = 15;

/** National Dex id for Magikarp — gets a Splash-only moveset as an easter egg. */
export const MAGIKARP_ID = 129;

export function getMovePp(slug: string): number {
  return MOVE_PP[slug] ?? DEFAULT_PP;
}

/**
 * Magikarp's signature (and only) move. Splash is Normal-type in the real games —
 * the one intentional exception to the "moves match the Pokémon's types" rule — and
 * it does absolutely nothing in battle.
 */
function buildSplashMove(
  ownerCaughtAt: number,
  ownerDisplayName: string,
  fromActive: boolean,
  pp?: Record<string, number>,
): BattleMove {
  const maxPp = 40;
  return {
    slug: 'splash',
    name: 'Splash',
    type: 'normal',
    power: 0,
    ownerCaughtAt,
    ownerDisplayName,
    fromActive,
    maxPp,
    currentPp: pp?.splash ?? maxPp,
    splashGag: true,
  };
}

/**
 * Shiny Magikarp's ultimate easter-egg move. A SHINY Magikarp ("Magichad") wields
 * "Hollow Purple" — infinite power and PP. Using it triggers a win cinematic rather
 * than dealing normal damage (see BattleArena), so its numeric power stays 0.
 */
function buildHollowPurpleMove(
  ownerCaughtAt: number,
  ownerDisplayName: string,
  fromActive: boolean,
): BattleMove {
  return {
    slug: 'hollow-purple',
    name: 'Hollow Purple',
    type: 'god',
    power: 0,
    ownerCaughtAt,
    ownerDisplayName,
    fromActive,
    maxPp: Infinity,
    currentPp: Infinity,
    hollowPurple: true,
  };
}

/** True if any of a member's recorded move PP values are below their max. */
export function hasReducedPp(pp: Record<string, number> | undefined): boolean {
  if (!pp) return false;
  return Object.entries(pp).some(([slug, value]) => value < getMovePp(slug));
}

function slugToDisplay(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function pickMoveForType(type: string, learnset: Set<string>): string {
  const curated = CURATED_MOVES[type.toLowerCase()] ?? CURATED_MOVES.normal;
  const legal = curated.find((slug) => learnset.has(slug));
  return legal ?? curated[0];
}

/** Build battle moves from a Pokemon's types and Gen 1 learnset. */
export function buildMovesForPokemon(
  pokemon: Pick<PokemonData, 'id' | 'types' | 'moves' | 'powerLevel' | 'displayName'>,
  ownerCaughtAt: number,
  fromActive: boolean,
  pp?: Record<string, number>,
  shiny = false,
): BattleMove[] {
  if (pokemon.id === MAGIKARP_ID) {
    // A SHINY Magikarp ("Magichad") gets Hollow Purple instead of Splash.
    return shiny
      ? [buildHollowPurpleMove(ownerCaughtAt, pokemon.displayName, fromActive)]
      : [buildSplashMove(ownerCaughtAt, pokemon.displayName, fromActive, pp)];
  }

  const learnset = new Set(pokemon.moves ?? []);
  const types = pokemon.types.length > 0 ? pokemon.types : ['normal'];
  const basePower = safePower(pokemon.powerLevel);
  const perTypePower = types.length > 1 ? basePower / 2 : basePower;

  return types.map((type) => {
    const slug = pickMoveForType(type, learnset);
    const maxPp = getMovePp(slug);
    const currentPp = pp?.[slug] ?? maxPp;
    return {
      slug,
      name: slugToDisplay(slug),
      type: type.toLowerCase(),
      power: perTypePower,
      ownerCaughtAt,
      ownerDisplayName: pokemon.displayName,
      fromActive,
      maxPp,
      currentPp,
    };
  });
}

/** All moves available to the party; marks which belong to slot 0. */
export function buildPartyMoves(
  party: CaughtPokemon[],
  moveLearnsets: Map<number, string[]>,
): BattleMove[] {
  const activeCaughtAt = party[0]?.caughtAt;
  const moves: BattleMove[] = [];

  party.forEach((member) => {
    const learnset = moveLearnsets.get(member.id) ?? [];
    const built = buildMovesForPokemon(
      {
        id: member.id,
        types: member.types,
        moves: learnset,
        powerLevel: member.powerLevel,
        displayName: member.nickname ?? member.displayName,
      },
      member.caughtAt,
      member.caughtAt === activeCaughtAt,
      member.pp,
      member.shiny ?? false,
    );
    moves.push(...built);
  });

  return moves;
}

/** Extract Gen 1 learnable move slugs from a PokeAPI /pokemon payload. */
export function extractGen1MoveSlugs(
  moves: { move: { name: string }; version_group_details: { version_group: { name: string } }[] }[],
): string[] {
  const slugs = new Set<string>();
  for (const entry of moves) {
    const hasGen1 = entry.version_group_details.some((d) =>
      GEN1_VERSION_GROUPS.has(d.version_group.name),
    );
    if (hasGen1) slugs.add(entry.move.name);
  }
  return Array.from(slugs);
}
