import type { BlessingId, CharacterDef, CharacterId } from '../types';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    speciesId: 4,
    speciesName: 'Charmander',
    types: ['fire'],
    maxHp: 72,
    title: 'The Ember Heart',
    description: 'Burn, Exhaust, and Strength. Hits hard, then hits harder.',
    starterRelic: 'charcoal',
    starterDeck: ['ember', 'ember', 'scratch', 'protect-blaze', 'protect-blaze', 'protect-blaze'],
  },
  tide: {
    id: 'tide',
    name: 'Tide',
    speciesId: 7,
    speciesName: 'Squirtle',
    types: ['water'],
    maxHp: 76,
    title: 'The Shell Wall',
    description: 'Block, Water Charges, and Focus. Let the tide do the work.',
    starterRelic: 'mystic-water',
    starterDeck: ['water-gun', 'water-gun', 'water-gun', 'withdraw', 'withdraw', 'bubble'],
  },
  bloom: {
    id: 'bloom',
    name: 'Bloom',
    speciesId: 1,
    speciesName: 'Bulbasaur',
    types: ['grass', 'poison'],
    maxHp: 74,
    title: 'The Seed Plot',
    description: 'Toxic, Leech, and discard tricks. Win the long fight.',
    starterRelic: 'miracle-seed',
    starterDeck: ['vine-whip', 'vine-whip', 'vine-whip', 'synthesis', 'synthesis', 'poison-powder'],
  },
};

export const CHARACTER_IDS: CharacterId[] = ['blaze', 'tide', 'bloom'];

export const BLESSINGS: { id: BlessingId; name: string; description: string }[] = [
  { id: 'train', name: 'Intense Training', description: 'Upgrade 1 starter card of your choice, then remove 1 card of your choice.' },
  { id: 'gold', name: 'Grant Money', description: 'Gain 100 gold.' },
  { id: 'relic', name: "Oak's Parcel", description: 'Obtain a random relic.' },
  { id: 'card', name: 'Extra Training', description: 'Add a random uncommon card to your deck.' },
];
