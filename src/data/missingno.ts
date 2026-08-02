import type { PokemonData } from '../types/game';
import { asset } from '../utils/asset';

/** Synthetic MissingNo. for the easter-egg catch flow. */
export const MISSINGNO_ID = 0;

/** Shared MissingNo. art for prestige, Pokédex, and encounter screens. */
export const MISSINGNO_SPRITE = asset('img/MissingNo.svg');

/** Red/Blue MissingNo. base stats (Special split → 210 on modern BST scale). */
export const MISSINGNO_DATA: PokemonData = {
  id: MISSINGNO_ID,
  name: 'missingno',
  displayName: 'MissingNo.',
  types: ['bird', 'normal'],
  sprite: MISSINGNO_SPRITE,
  artwork: MISSINGNO_SPRITE,
  catchRate: 30,
  isLegendary: false,
  baseStats: {
    hp: 33,
    attack: 136,
    defense: 0,
    specialAttack: 6,
    specialDefense: 6,
    speed: 29,
  },
  baseStatTotal: 210,
};
