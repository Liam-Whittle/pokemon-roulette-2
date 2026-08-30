import type { PotionDef } from '../types';

const POOL: PotionDef[] = [
  {
    id: 'x-attack',
    name: 'X Attack',
    description: 'Gain 5 Strength this turn.',
    effects: [{ op: 'strengthThisTurn', amount: 5 }],
  },
  {
    id: 'x-defend',
    name: 'X Defend',
    description: 'Gain 15 Block.',
    effects: [{ op: 'block', amount: 15 }],
  },
  {
    id: 'antidote',
    name: 'Antidote',
    description: 'Clear your debuffs.',
    effects: [{ op: 'clearStatuses' }],
  },
  {
    id: 'energy-root',
    name: 'Energy Root',
    description: 'Gain 2 Energy.',
    effects: [{ op: 'gainEnergy', amount: 2 }],
  },
  {
    id: 'dire-hit',
    name: 'Dire Hit',
    description: 'Deal 20 damage to the targeted enemy.',
    effects: [{ op: 'damage', amount: 20 }],
  },
  {
    id: 'full-heal',
    name: 'Full Heal Mix',
    description: 'Heal 8 HP and gain 8 Block.',
    effects: [
      { op: 'heal', amount: 8 },
      { op: 'block', amount: 8 },
    ],
  },
];

const LEGACY: PotionDef[] = [
  {
    id: 'potion',
    name: 'Potion',
    description: 'Heal 12 HP.',
    effects: [{ op: 'heal', amount: 12 }],
  },
  {
    id: 'super-potion',
    name: 'Super Potion',
    description: 'Heal 22 HP.',
    effects: [{ op: 'heal', amount: 22 }],
  },
];

export const POTIONS: Record<string, PotionDef> = Object.fromEntries(
  [...POOL, ...LEGACY].map((p) => [p.id, p]),
);

export function getPotionDef(id: string): PotionDef {
  const def = POTIONS[id];
  if (!def) throw new Error(`Unknown potion ${id}`);
  return def;
}

export const POTION_IDS = POOL.map((p) => p.id);
