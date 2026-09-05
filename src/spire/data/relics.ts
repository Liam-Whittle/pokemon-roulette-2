import type { RelicDef, RelicHook } from '../types';
import { localItemSprite, remoteItemSprite } from '../../utils/localAssets';

const ALL: RelicDef[] = [
  {
    id: 'charcoal',
    name: 'Charcoal',
    description: 'If an enemy has Burn, Fire attacks deal 2 more damage.',
    rarity: 'starter',
    starter: true,
    character: 'blaze',
    hooks: [{ when: 'bonusIfStatus', status: 'burn', amount: 2, sourceType: 'fire', kind: 'attack' }],
  },
  {
    id: 'mystic-water',
    name: 'Mystic Water',
    description: 'At the start of combat, add 1 Attack Charge. Charges fire at the end of your turn.',
    rarity: 'starter',
    starter: true,
    character: 'tide',
    hooks: [{ when: 'combatStart', effects: [{ op: 'addCharge', amount: 1, kind: 'attack' }] }],
  },
  {
    id: 'miracle-seed',
    name: 'Miracle Seed',
    description: 'At the start of combat, apply 2 Toxic to ALL enemies.',
    rarity: 'starter',
    starter: true,
    character: 'bloom',
    hooks: [{ when: 'combatStart', effects: [{ op: 'status', status: 'toxic', stacks: 2, all: true }] }],
  },
  {
    id: 'lucky-egg',
    name: 'Lucky Egg',
    description: 'Combat rewards give 25% more gold.',
    rarity: 'common',
    hooks: [{ when: 'goldBonus', percent: 25 }],
  },
  {
    id: 'amulet-coin',
    name: 'Amulet Coin',
    description: 'Upon pickup, gain 150 gold.',
    rarity: 'common',
    hooks: [{ when: 'onPickup', gold: 150 }],
  },
  {
    id: 'leftovers',
    name: 'Leftovers',
    description: 'At the start of each combat, heal 3 HP.',
    rarity: 'common',
    hooks: [{ when: 'combatStart', effects: [{ op: 'heal', amount: 3 }] }],
  },
  {
    id: 'quick-claw',
    name: 'Quick Claw',
    description: 'At the start of combat, gain 1 Energy.',
    rarity: 'common',
    hooks: [{ when: 'combatStart', effects: [{ op: 'gainEnergy', amount: 1 }] }],
  },
  {
    id: 'running-shoes',
    name: 'Running Shoes',
    description: 'Draw 1 additional card at the start of combat.',
    rarity: 'common',
    sprite: 'heavy-duty-boots.png',
    spriteUrl:
      'https://raw.githubusercontent.com/msikma/pokesprite/master/items/hold-item/heavy-duty-boots.png',
    hooks: [{ when: 'combatStart', effects: [{ op: 'draw', amount: 1 }] }],
  },
  {
    id: 'sitrus-berry',
    name: 'Sitrus Berry',
    description: 'Pokémon Center heals 10 additional HP.',
    rarity: 'common',
    hooks: [{ when: 'restHealBonus', amount: 10 }],
  },
  {
    id: 'black-belt',
    name: 'Black Belt',
    description: 'At the start of combat, gain 1 Strength.',
    rarity: 'common',
    hooks: [{ when: 'combatStart', effects: [{ op: 'strength', amount: 1, self: true }] }],
  },
  {
    id: 'focus-sash',
    name: 'Focus Sash',
    description: 'The first time you would die in a combat, survive at 1 HP.',
    rarity: 'common',
    hooks: [{ when: 'focusSash' }],
  },
  {
    id: 'kings-rock',
    name: "King's Rock",
    description: 'Whenever you play 2 Attacks in a turn, gain 2 Block.',
    rarity: 'uncommon',
    hooks: [{ when: 'everyNAttacks', n: 2, effects: [{ op: 'block', amount: 2 }] }],
  },
  {
    id: 'scope-lens',
    name: 'Scope Lens',
    description: 'If an enemy is multi-attacking, each hit deals 1 less damage.',
    rarity: 'uncommon',
    hooks: [{ when: 'reduceMultiAttack', amount: 1 }],
  },
  {
    id: 'shell-bell',
    name: 'Shell Bell',
    description: 'Whenever you use a potion, gain 1 Dexterity.',
    rarity: 'uncommon',
    hooks: [{ when: 'onPotion', effects: [{ op: 'dexterity', amount: 1 }] }],
  },
  {
    id: 'choice-band',
    name: 'Choice Band',
    description: 'At the start of combat, discard any number of cards, then draw that many.',
    rarity: 'uncommon',
    hooks: [{ when: 'choiceBand' }],
  },
  {
    id: 'life-orb',
    name: 'Life Orb',
    description: 'Attacks deal 4 extra damage. Lose 1 HP when you play an Attack.',
    rarity: 'uncommon',
    hooks: [
      {
        when: 'onPlay',
        kind: 'attack',
        effects: [
          { op: 'loseHp', amount: 1 },
          { op: 'damage', amount: 4 },
        ],
      },
    ],
  },
  {
    id: 'assault-vest',
    name: 'Assault Vest',
    description: 'If you end your turn without Block, gain 6 Block.',
    rarity: 'uncommon',
    hooks: [{ when: 'turnEndNoBlock', effects: [{ op: 'block', amount: 6 }] }],
  },
  {
    id: 'exp-share',
    name: 'Exp. Share',
    description: 'Your opening hand is upgraded.',
    rarity: 'uncommon',
    hooks: [{ when: 'upgradeOpeningHand' }],
  },
  {
    id: 'soul-dew',
    name: 'Soul Dew',
    description: 'At the start of your turn, gain 2 Energy. Take 4 damage at the end of your turn.',
    rarity: 'rare',
    hooks: [
      { when: 'bonusEnergy', amount: 2 },
      { when: 'turnEnd', effects: [{ op: 'loseHp', amount: 4 }] },
    ],
  },
  {
    id: 'choice-scarf',
    name: 'Choice Scarf',
    description: 'You may use any number of options at Pokémon Centers.',
    rarity: 'rare',
    hooks: [{ when: 'restAny' }],
  },
  {
    id: 'eviolite',
    name: 'Eviolite',
    description: 'At Pokémon Centers, you may gain 1 permanent Dexterity once per visit (up to 3 times).',
    rarity: 'rare',
    hooks: [{ when: 'restPermDex', maxUses: 3 }],
  },
  {
    id: 'lucarionite',
    name: 'Mega Stone',
    description: 'At Pokémon Centers, you may gain 1 permanent Strength once per visit (up to 3 times).',
    rarity: 'rare',
    hooks: [{ when: 'restPermStr', maxUses: 3 }],
  },
  {
    id: 'master-ball-relic',
    name: 'Master Ball',
    description: 'At Pokémon Centers, you may trade a relic for a choice of 1 of 3 relics.',
    rarity: 'rare',
    sprite: 'master-ball.png',
    hooks: [{ when: 'restTrade' }],
  },
  {
    id: 'leftovers-plus',
    name: 'Shell Bell Charm',
    description: 'The first Power you play each turn draws 2 cards.',
    rarity: 'rare',
    sprite: 'shell-bell.png',
    hooks: [{ when: 'onPlay', kind: 'power', oncePerTurn: true, effects: [{ op: 'draw', amount: 2 }] }],
  },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(ALL.map((r) => [r.id, r]));

export function findRelicDef(id: string): RelicDef | undefined {
  return RELICS[id];
}

/** Official PokeAPI item sprite filename for a relic. */
export function relicSpriteFile(id: string): string {
  return findRelicDef(id)?.sprite ?? `${id}.png`;
}

/** Local first when we bundle a sprite that PokeAPI does not host. */
export function relicSpriteCandidates(id: string): string[] {
  const def = findRelicDef(id);
  const file = relicSpriteFile(id);
  const local = localItemSprite(file);
  const remote = def?.spriteUrl ?? remoteItemSprite(file);
  return def?.spriteUrl ? [local, remote] : [remote, local];
}

export function getRelicDef(id: string): RelicDef {
  const def = RELICS[id];
  if (!def) throw new Error(`Unknown relic ${id}`);
  return def;
}

export function relicsByRarity(rarity: RelicDef['rarity'], owned: string[]): RelicDef[] {
  return ALL.filter((r) => !r.starter && r.rarity === rarity && !owned.includes(r.id));
}

export function allObtainableRelics(owned: string[]): RelicDef[] {
  return ALL.filter((r) => !r.starter && !owned.includes(r.id));
}

export function hasRelic(relics: string[] | undefined, id: string): boolean {
  return (relics ?? []).includes(id);
}

export function relicHookAmount(
  relics: string[] | undefined,
  when: RelicHook['when'],
): number {
  let total = 0;
  for (const id of relics ?? []) {
    for (const hook of findRelicDef(id)?.hooks ?? []) {
      if (hook.when !== when) continue;
      if ('amount' in hook && typeof hook.amount === 'number') total += hook.amount;
      if ('gold' in hook && typeof hook.gold === 'number') total += hook.gold;
      if ('maxUses' in hook && typeof hook.maxUses === 'number') total += hook.maxUses;
    }
  }
  return total;
}

export function relicHasHook(relics: string[] | undefined, when: RelicHook['when']): boolean {
  return (relics ?? []).some((id) => findRelicDef(id)?.hooks.some((h) => h.when === when));
}

export function pickupGoldFor(id: string): number {
  return relicHookAmount([id], 'onPickup');
}
