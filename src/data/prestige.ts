import type { RegionId } from './pools';
import { ITEM_SPRITES, SEGMENT_SPRITES, UI_SPRITES } from './icons';
import { MISSINGNO_SPRITE } from './missingno';
import { localPokemonSprite, remotePokemonSprite } from '../utils/localAssets';

export type PrestigeUnlockId =
  | 'arceusBlessing'
  | 'hardcore'
  | 'onTheHouse'
  | 'shinyCharmPlus'
  | 'mewsMischief'
  | 'hundredPercenter'
  | 'weLikeGamba'
  | 'mysteryGift'
  | 'missingNo'
  | 'hiddenStock'
  | 'biggerBetter';

export interface PrestigeUnlockDef {
  id: PrestigeUnlockId;
  name: string;
  description: string;
  /** Cost in prestige points; 0 = free once eligible. */
  cost: number;
  /** Requires at least one Hall of Fame clear to purchase. */
  requiresRegionClear?: boolean;
}

/** Thematic icons for each unlock (gen 1–2 Pokémon + item sprites). */
export const PRESTIGE_UNLOCK_ICONS: Record<PrestigeUnlockId, string> = {
  arceusBlessing: remotePokemonSprite(493), // Arceus (not in local 1–251 set)
  hardcore: UI_SPRITES.life, // heart scale — one-life runs
  onTheHouse: ITEM_SPRITES.shinycharm,
  shinyCharmPlus: ITEM_SPRITES.shinycharm, // gold-tinted in Prestige Shop CSS
  mewsMischief: localPokemonSprite(151),
  hundredPercenter: ITEM_SPRITES.pokeball,
  weLikeGamba: SEGMENT_SPRITES.money100, // amulet coin
  mysteryGift: ITEM_SPRITES.mysterygift,
  missingNo: MISSINGNO_SPRITE,
  hiddenStock: ITEM_SPRITES.masterball,
  biggerBetter: localPokemonSprite(143), // Snorlax — bigger party
};

export const PRESTIGE_UNLOCKS: PrestigeUnlockDef[] = [
  {
    id: 'arceusBlessing',
    name: "Arceus's Blessing",
    description:
      'During the New Pokémon Wheel, 5% chance Arceus offers a choice of 5 regional Pokémon with Total Stats higher than 450.',
    cost: 1,
  },
  {
    id: 'hardcore',
    name: 'Hardcore Nuzlocke',
    description:
      'New Game: spin the New Pokémon Wheel until your party is full for your only team. One life. Catch path hidden.',
    cost: 1,
  },
  {
    id: 'onTheHouse',
    name: 'On The House',
    description: 'Shiny Charm auto-added each new game (removed from shop). Starter is always shiny.',
    cost: 1,
  },
  {
    id: 'shinyCharmPlus',
    name: 'Shiny Charm+',
    description: 'Shiny odds become 1 in 5 (instead of 1 in 15 with Shiny Charm).',
    cost: 1,
  },
  {
    id: 'mewsMischief',
    name: "Mew's Mischief",
    description: 'Small chance a third hub path appears with unique Mischief wheel outcomes.',
    cost: 1,
  },
  {
    id: 'hundredPercenter',
    name: 'Hundred Percenter',
    description:
      'Unlocks the Daily Encounter title mini-game to fill your Global Pokédex. Always on once owned — toggle it from the Prestige Shop only.',
    cost: 0,
    requiresRegionClear: true,
  },
  {
    id: 'weLikeGamba',
    name: 'We Like Gamba',
    description: 'Adds a Game Corner next to the Poké Mart — bet money on a Pokémon slots guess.',
    cost: 1,
  },
  {
    id: 'mysteryGift',
    name: 'Mystery Gift',
    description: 'Start each new game with a Mystery Gift item (25% each unique reward).',
    cost: 1,
  },
  {
    id: 'missingNo',
    name: 'MissingNo.',
    description: '²VIOv—áK²‰ (À ÐÃ”ØÌêI3ˆ@šÚ$éÏ’´›8 € =å’t¡¤ÏH:¿ûŸ Ä”8R {Error} @€ƒTHº®»øŽ!  ®RÒï$ýFR-q ¤Ä³½·JºJ‡8 d™Ïž@ GÊï.¼ŸÏöpŽM’”t¿¤Fâ @€ì6AÒ”ØÔ*‡8 8T»ç',
    cost: 1,
  },
  {
    id: 'hiddenStock',
    name: 'Hidden Stock',
    description: 'Shop gains Rare Candy, a random evolution stone, and a Master Ball.',
    cost: 1,
  },
  {
    id: 'biggerBetter',
    name: 'Bigger = Better',
    description: 'Party cap 6. Most battles gain +1 random regional enemy (Team Rocket excluded).',
    cost: 1,
  },
];

export const ALL_REGION_IDS: RegionId[] = ['Kanto', 'Johto'];

/** Not shown on New Game toggles — meta feature toggled only in Prestige Shop. */
export const META_ONLY_UNLOCKS: PrestigeUnlockId[] = ['hundredPercenter'];

/** Owned by default off on New Game — player must opt in each run. */
export const OPT_IN_UNLOCKS: PrestigeUnlockId[] = ['hardcore', 'biggerBetter'];

export function defaultNewGameUnlocks(owned: PrestigeUnlockId[]): PrestigeUnlockId[] {
  return owned.filter(
    (id) => !META_ONLY_UNLOCKS.includes(id) && !OPT_IN_UNLOCKS.includes(id),
  );
}

export function regionUnlockOrder(region: RegionId): number {
  return ALL_REGION_IDS.indexOf(region);
}

/** Kanto always unlocked; each later region needs the previous cleared. */
export function isRegionUnlocked(
  region: RegionId,
  clearedRegions: RegionId[],
): boolean {
  const idx = regionUnlockOrder(region);
  if (idx <= 0) return true;
  const prev = ALL_REGION_IDS[idx - 1];
  return clearedRegions.includes(prev);
}

export function clearedRegionsFromHall(
  hall: { region: string }[],
): RegionId[] {
  const set = new Set<RegionId>();
  for (const entry of hall) {
    if (entry.region === 'Kanto' || entry.region === 'Johto') {
      set.add(entry.region);
    }
  }
  return ALL_REGION_IDS.filter((r) => set.has(r));
}

export const DEBUG_STORAGE_KEY = 'pokespin-debug-unlocked';

export const MEW_MISCHIEF_CHANCE = 0.12;
export const ARCEUS_BLESSING_CHANCE = 0.05;
export const ARCEUS_BST_MIN = 450;
export const NEW_POKEMON_WHEEL_WEDGES = 20;
export const DAILY_BALL_FLAT_CATCH = 1 / 8;
export const DAILY_ENCOUNTER_SHINY_ODDS = 1 / 40;
export const DEFAULT_DAILY_BALL_CAP = 10;
