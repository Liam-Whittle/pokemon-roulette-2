import type { EventDef } from '../types';

export const EVENTS: Record<string, EventDef> = {
  'mysterious-shrine': {
    id: 'mysterious-shrine',
    name: 'Mysterious Shrine',
    text: 'A weathered shrine hums with faint energy. Offerings of berries lie at its base.',
    choices: [
      { label: 'Pray', description: 'Heal 14 HP.', result: { type: 'heal', amount: 14 } },
      {
        label: 'Take the relic',
        description: 'Lose 8 HP. Gain a relic.',
        result: { type: 'combo', results: [{ type: 'damage', amount: 8 }, { type: 'relic' }] },
      },
    ],
  },
  'rocket-grunts': {
    id: 'rocket-grunts',
    name: 'Team Rocket Grunts',
    text: 'Two grunts block the path, rattling a sack of stolen coins.',
    choices: [
      { label: 'Pay them off', description: 'Lose 25 gold.', result: { type: 'gold', amount: -25 } },
      {
        label: 'Rush them',
        description: 'Take 15 damage. Gain 100 gold.',
        result: { type: 'combo', results: [{ type: 'damage', amount: 15 }, { type: 'gold', amount: 100 }] },
      },
      {
        label: 'Sneak by',
        description: '50% chance to sneak past for 50 gold. If caught, lose 50 gold.',
        result: {
          type: 'chance',
          chance: 0.5,
          success: { type: 'gold', amount: 50 },
          fail: { type: 'gold', amount: -50 },
          successTitle: 'Sneaked by',
          successNote: 'You slip past and pocket 50 gold.',
          failTitle: 'Caught',
          failNote: 'They spotted you and took 50 gold.',
        },
      },
    ],
  },
  'abandoned-mart': {
    id: 'abandoned-mart',
    name: 'Abandoned Mart',
    text: 'Shelves are stripped bare except for a dusty crate of potions.',
    choices: [
      {
        label: 'Buy a potion',
        description: 'Spend 30 gold. Gain a potion.',
        result: { type: 'combo', results: [{ type: 'gold', amount: -30 }, { type: 'potion' }] },
      },
      {
        label: 'Smash and grab',
        description: 'Lose 5 HP. Choose an uncommon card.',
        result: {
          type: 'combo',
          results: [
            { type: 'damage', amount: 5 },
            { type: 'chooseCards', pick: 1, offer: 3, rarity: 'uncommon' },
          ],
        },
      },
    ],
  },
  'fishing-guru': {
    id: 'fishing-guru',
    name: 'Fishing Guru',
    text: '"The biggest Magikarp are in this river! Care to learn a trick?"',
    choices: [
      { label: 'Learn a move', description: 'Add a random uncommon card to your deck.', result: { type: 'card', rarity: 'uncommon' } },
      { label: 'Ask for bait', description: 'Gain 25 gold.', result: { type: 'gold', amount: 25 } },
    ],
  },
  'safari-gate': {
    id: 'safari-gate',
    name: 'Safari Gate',
    text: 'The warden offers a handful of extra Safari Balls — or the entry fee back.',
    choices: [
      {
        label: 'Take the balls',
        description: 'Choose 2 of 10 common cards to add to your deck.',
        result: { type: 'chooseCards', pick: 2, offer: 10, rarity: 'common' },
      },
      { label: 'Refund', description: 'Gain 45 gold.', result: { type: 'gold', amount: 45 } },
    ],
  },
  'cursed-rod': {
    id: 'cursed-rod',
    name: 'Cursed Fishing Rod',
    text: 'The old rod tugs toward a rare lure. Taking it feels wrong.',
    choices: [
      {
        label: 'Grab the lure',
        description: 'Gain a rare card. Lose 8 Max HP.',
        result: { type: 'combo', results: [{ type: 'card', rarity: 'rare' }, { type: 'maxHp', amount: -8 }] },
      },
      { label: 'Walk away', description: 'Heal 8 HP.', result: { type: 'heal', amount: 8 } },
    ],
  },
  'pokemon-center-nurse': {
    id: 'pokemon-center-nurse',
    name: 'Wandering Nurse',
    text: 'Joy is making a house call. "We should take a look at that deck, too."',
    choices: [
      { label: 'Full restore', description: 'Heal 15 HP.', result: { type: 'heal', amount: 15 } },
      {
        label: 'Trim the party',
        description: 'Remove 2 cards of your choice from your deck.',
        result: { type: 'removeChoose', count: 2 },
      },
    ],
  },
  'rocket-bargain': {
    id: 'rocket-bargain',
    name: 'Shady Bargain',
    text: 'A grunt in sunglasses opens a trench coat lined with held items.',
    choices: [
      {
        label: 'Buy a relic',
        description: 'Spend 80 gold. Gain a relic.',
        result: { type: 'combo', results: [{ type: 'gold', amount: -80 }, { type: 'relic' }] },
      },
      { label: 'Haggle', description: 'Gain 20 gold.', result: { type: 'gold', amount: 20 } },
    ],
  },
  'mysterious-egg': {
    id: 'mysterious-egg',
    name: 'Mysterious Egg',
    text: 'Someone left an egg on the path. It is warm.',
    choices: [
      {
        label: 'Trade it',
        description: 'Trade a relic for a new random relic.',
        result: { type: 'tradeRelic' },
      },
      { label: 'Sell it', description: 'Gain 35 gold.', result: { type: 'gold', amount: 35 } },
    ],
  },
  'sleeping-snorlax': {
    id: 'sleeping-snorlax',
    name: 'Sleeping Snorlax',
    text: 'A Snorlax blocks the entire trail, snoring like a landslide.',
    choices: [
      { label: 'Rest beside it', description: 'Heal 20 HP.', result: { type: 'heal', amount: 20 } },
      { label: 'Poke it', description: 'Gain 150 gold.', result: { type: 'gold', amount: 150 } },
    ],
  },
  'move-tutor': {
    id: 'move-tutor',
    name: 'Move Tutor',
    text: '"I can polish two of your moves — or just one, and you can rest."',
    choices: [
      { label: 'Intensive training', description: 'Upgrade 2 random cards.', result: { type: 'upgradeRandom', count: 2 } },
      {
        label: 'Light session',
        description: 'Upgrade 1 random card. Heal 10 HP.',
        result: { type: 'combo', results: [{ type: 'upgradeRandom', count: 1 }, { type: 'heal', amount: 10 }] },
      },
    ],
  },
  'bill-pc': {
    id: 'bill-pc',
    name: "Bill's PC",
    text: 'A laptop is still logged into Bill\'s storage system.',
    choices: [
      {
        label: 'Release a box',
        description: 'Remove 1 card of your choice from your deck.',
        result: { type: 'removeChoose', count: 1 },
      },
      { label: 'Withdraw funds', description: 'Gain 50 gold.', result: { type: 'gold', amount: 50 } },
      {
        label: 'Download a ROM',
        description: 'Choose 1 of 3 colorless cards.',
        result: { type: 'chooseCards', pick: 1, offer: 3, colorlessOnly: true },
      },
    ],
  },
};

export function getEventDef(id: string): EventDef {
  const def = EVENTS[id];
  if (!def) throw new Error(`Unknown event ${id}`);
  return def;
}

export const EVENT_IDS = Object.keys(EVENTS);
