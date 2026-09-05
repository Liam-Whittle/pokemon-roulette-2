import type { CardDef, CardInstance, CharacterId, EffectOp } from '../types';

function card(def: CardDef): CardDef {
  const needsEnemy = def.effects.some(
    (e) =>
      (e.op === 'damage' && !e.all) ||
      e.op === 'damageIfStatus' ||
      e.op === 'shredBlock' ||
      (e.op === 'clearEnemyBlock' && !e.all) ||
      (e.op === 'multiplyStatus' && !e.all) ||
      (e.op === 'status' && !e.all && !e.self) ||
      e.op === 'statusIfNoBlock' ||
      e.op === 'toxicIfAlready' ||
      e.op === 'toxicPerFive' ||
      e.op === 'gainMaxHpIfAttacking' ||
      e.op === 'blockEqualToStatus' ||
      (e.op === 'playExhaustedPetals' && !e.all) ||
      (e.op === 'strength' && !e.self && e.amount < 0) ||
      e.op === 'statusIfStatus' ||
      e.op === 'statusIfX' ||
      e.op === 'discardAny',
  );
  const hitsAll = def.effects.some(
    (e) =>
      (e.op === 'damage' && e.all) ||
      (e.op === 'status' && e.all) ||
      (e.op === 'clearEnemyBlock' && e.all) ||
      (e.op === 'playExhaustedPetals' && e.all),
  );
  return {
    ...def,
    target: def.target ?? (hitsAll && !needsEnemy ? 'all' : needsEnemy ? 'enemy' : 'self'),
  };
}

const ALL: CardDef[] = [
  // ── Blaze ──
  card({
    id: 'ember',
    name: 'Ember',
    description: 'Apply 1 Burn. Deal 4 damage.',
    type: 'fire',
    kind: 'attack',
    cost: 1,
    rarity: 'starter',
    character: 'blaze',
    effects: [
      { op: 'status', status: 'burn', stacks: 1 },
      { op: 'damage', amount: 4 },
    ],
    upgrade: {
      description: 'Apply 2 Burn. Deal 5 damage.',
      effects: [
        { op: 'status', status: 'burn', stacks: 2 },
        { op: 'damage', amount: 5 },
      ],
    },
  }),
  card({
    id: 'protect-blaze',
    name: 'Protect',
    description: 'Gain 5 Block.',
    type: 'normal',
    kind: 'skill',
    cost: 1,
    rarity: 'starter',
    character: 'blaze',
    effects: [{ op: 'block', amount: 5 }],
  }),
  card({
    id: 'scratch',
    name: 'Scratch',
    description: 'Deal 4 damage. Apply 1 Vulnerable.',
    type: 'normal',
    kind: 'attack',
    cost: 0,
    rarity: 'starter',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 4 },
      { op: 'status', status: 'vulnerable', stacks: 1 },
    ],
    upgrade: {
      description: 'Deal 6 damage. Apply 2 Vulnerable.',
      effects: [
        { op: 'damage', amount: 6 },
        { op: 'status', status: 'vulnerable', stacks: 2 },
      ],
    },
  }),
  card({
    id: 'flame-burst',
    name: 'Flame Burst',
    description: 'Deal 6 damage. Apply 4 Burn. Take 1 damage.',
    type: 'fire',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'status', status: 'burn', stacks: 4 },
      { op: 'loseHp', amount: 1 },
    ],
    upgrade: {
      description: 'Deal 8 damage. Apply 6 Burn. Take 2 damage.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'status', status: 'burn', stacks: 6 },
        { op: 'loseHp', amount: 2 },
      ],
    },
  }),
  card({
    id: 'heat-up',
    name: 'Heat Up',
    description: 'Gain 2 Strength.',
    type: 'fire',
    kind: 'power',
    cost: 1,
    rarity: 'common',
    character: 'blaze',
    effects: [{ op: 'strength', amount: 2, self: true }],
  }),
  card({
    id: 'fire-spin',
    name: 'Fire Spin',
    description: "Apply 8 Burn. Shred 50% of the enemy's Block.",
    type: 'fire',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'blaze',
    effects: [
      { op: 'status', status: 'burn', stacks: 8 },
      { op: 'shredBlock', percent: 50 },
    ],
    upgrade: {
      description: "Apply 10 Burn. Shred 75% of the enemy's Block.",
      effects: [
        { op: 'status', status: 'burn', stacks: 10 },
        { op: 'shredBlock', percent: 75 },
      ],
    },
  }),
  card({
    id: 'spark-dash',
    name: 'Spark Dash',
    description: 'Deal 7 damage. A random card in your hand is free to play this turn. Exhaust.',
    type: 'fire',
    kind: 'attack',
    cost: 0,
    rarity: 'common',
    character: 'blaze',
    exhaust: true,
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'freePlay', mode: 'random' },
    ],
    upgrade: {
      description: 'Deal 7 damage. Choose a card in your hand. It is free to play this turn. Exhaust.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'freePlay', mode: 'choose' },
      ],
    },
  }),
  card({
    id: 'smoke-screen',
    name: 'Smoke Screen',
    description: 'Gain 8 Block. Take 30% less damage from Vulnerable enemies this turn.',
    type: 'normal',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'blaze',
    effects: [
      { op: 'block', amount: 8 },
      { op: 'smokeScreen', percent: 30 },
    ],
    upgrade: {
      description: 'Gain 10 Block. Take 50% less damage from Vulnerable enemies this turn.',
      effects: [
        { op: 'block', amount: 10 },
        { op: 'smokeScreen', percent: 50 },
      ],
    },
  }),
  card({
    id: 'ember-volley',
    name: 'Ember Volley',
    description: 'Deal 5 damage twice.',
    type: 'fire',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'blaze',
    effects: [{ op: 'damage', amount: 5, times: 2 }],
    upgrade: {
      description: 'Deal 7 damage twice.',
      effects: [{ op: 'damage', amount: 7, times: 2 }],
    },
  }),
  card({
    id: 'fire-fang',
    name: 'Fire Fang',
    description: 'Deal 10 damage. Apply 1 Weak and 1 Vulnerable.',
    type: 'fire',
    kind: 'attack',
    cost: 2,
    rarity: 'common',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 10 },
      { op: 'status', status: 'weak', stacks: 1 },
      { op: 'status', status: 'vulnerable', stacks: 1 },
    ],
    upgrade: {
      description: 'Deal 10 damage. Apply 2 Weak and 2 Vulnerable.',
      cost: 2,
      effects: [
        { op: 'damage', amount: 10 },
        { op: 'status', status: 'weak', stacks: 2 },
        { op: 'status', status: 'vulnerable', stacks: 2 },
      ],
    },
  }),
  card({
    id: 'will-o-wisp',
    name: 'Will-O-Wisp',
    description: 'Apply 5 Burn. Exhaust.',
    type: 'fire',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    character: 'blaze',
    exhaust: true,
    effects: [{ op: 'status', status: 'burn', stacks: 5 }],
    upgrade: {
      description: 'Apply 7 Burn. Exhaust.',
      effects: [{ op: 'status', status: 'burn', stacks: 7 }],
    },
  }),
  card({
    id: 'growl',
    name: 'Growl',
    description: 'Apply 1 Weak.',
    type: 'normal',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    character: 'blaze',
    effects: [{ op: 'status', status: 'weak', stacks: 1 }],
    upgrade: {
      description: 'Apply 2 Weak. Gain 1 Strength this turn only.',
      effects: [
        { op: 'status', status: 'weak', stacks: 2 },
        { op: 'strengthThisTurn', amount: 1 },
      ],
    },
  }),
  card({
    id: 'fire-lash',
    name: 'Fire Lash',
    description: 'Apply 3 Vulnerable. Exhaust.',
    type: 'fire',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'blaze',
    exhaust: true,
    effects: [{ op: 'status', status: 'vulnerable', stacks: 3 }],
    upgrade: {
      description: 'Apply 4 Vulnerable. Exhaust.',
      effects: [{ op: 'status', status: 'vulnerable', stacks: 4 }],
    },
  }),
  card({
    id: 'flamethrower',
    name: 'Flamethrower',
    description: 'Deal 20 damage. Apply 4 Burn. Exhaust.',
    type: 'fire',
    kind: 'attack',
    cost: 3,
    rarity: 'uncommon',
    character: 'blaze',
    exhaust: true,
    effects: [
      { op: 'damage', amount: 20 },
      { op: 'status', status: 'burn', stacks: 4 },
    ],
    upgrade: {
      description: 'Deal 20 damage. Apply 6 Burn.',
      cost: 3,
      exhaust: false,
      effects: [
        { op: 'damage', amount: 20 },
        { op: 'status', status: 'burn', stacks: 6 },
      ],
    },
  }),
  card({
    id: 'swords-dance',
    name: 'Swords Dance',
    description: 'Gain 2 Strength at the start of every turn.',
    type: 'normal',
    kind: 'power',
    cost: 3,
    rarity: 'rare',
    character: 'blaze',
    effects: [{ op: 'applyPower', power: 'swords-dance', stacks: 2 }],
    upgrade: {
      description: 'Gain 3 Strength at the start of every turn.',
      cost: 3,
      effects: [{ op: 'applyPower', power: 'swords-dance', stacks: 3 }],
    },
  }),
  card({
    id: 'overheat',
    name: 'Overheat',
    description: 'Deal 25 damage. Gain 8 Block. Lose 8 HP.',
    type: 'fire',
    kind: 'attack',
    cost: 2,
    rarity: 'uncommon',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 25 },
      { op: 'block', amount: 8 },
      { op: 'loseHp', amount: 8 },
    ],
    upgrade: {
      description: 'Deal 30 damage. Gain 8 Block. Lose 8 HP.',
      cost: 1,
      effects: [
        { op: 'damage', amount: 30 },
        { op: 'block', amount: 8 },
        { op: 'loseHp', amount: 8 },
      ],
    },
  }),
  card({
    id: 'blaze-kick',
    name: 'Blaze Kick',
    description: 'Deal 9 damage. If the enemy has Burn, deal 6 more.',
    type: 'fire',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 9 },
      { op: 'damageIfStatus', status: 'burn', amount: 6 },
    ],
  }),
  card({
    id: 'temper-flare',
    name: 'Temper Flare',
    description: "Deal 10 damage. Double the enemy's Vulnerable.",
    type: 'fire',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 10 },
      { op: 'multiplyStatus', status: 'vulnerable', factor: 2 },
    ],
    upgrade: {
      description: "Deal 10 damage. Triple the enemy's Vulnerable.",
      effects: [
        { op: 'damage', amount: 10 },
        { op: 'multiplyStatus', status: 'vulnerable', factor: 3 },
      ],
    },
  }),
  card({
    id: 'flame-wall',
    name: 'Flame Wall',
    description: 'Gain 15 Block. Lose 2 HP. Exhaust.',
    type: 'fire',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'blaze',
    exhaust: true,
    effects: [
      { op: 'block', amount: 15 },
      { op: 'loseHp', amount: 2 },
    ],
    upgrade: {
      description: 'Gain 15 Block. Lose 2 HP.',
      exhaust: false,
      effects: [
        { op: 'block', amount: 15 },
        { op: 'loseHp', amount: 2 },
      ],
    },
  }),
  card({
    id: 'fire-pledge',
    name: 'Fire Pledge',
    description: 'Whenever you play an Attack, apply 1 Burn.',
    type: 'fire',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'blaze',
    effects: [{ op: 'applyPower', power: 'flame-body', stacks: 1 }],
  }),
  card({
    id: 'combust-power',
    name: 'Combust',
    description: 'Whenever a card is Exhausted, gain 1 Dexterity and deal 2 damage to ALL enemies.',
    type: 'fire',
    kind: 'power',
    cost: 2,
    rarity: 'uncommon',
    character: 'blaze',
    effects: [
      { op: 'applyPower', power: 'combust', stacks: 2 },
      { op: 'applyPower', power: 'combustDex', stacks: 1 },
    ],
    upgrade: {
      description: 'Whenever a card is Exhausted, gain 1 Dexterity and deal 3 damage to ALL enemies.',
      cost: 1,
      effects: [
        { op: 'applyPower', power: 'combust', stacks: 3 },
        { op: 'applyPower', power: 'combustDex', stacks: 1 },
      ],
    },
  }),
  card({
    id: 'flame-charge',
    name: 'Flame Charge',
    description: 'Deal 6 damage. Gain Block equal to the damage dealt.',
    type: 'fire',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'blaze',
    effects: [{ op: 'damage', amount: 6, blockEqualToDamage: true }],
    upgrade: {
      description: 'Deal 8 damage. Gain Block equal to the damage dealt.',
      effects: [{ op: 'damage', amount: 8, blockEqualToDamage: true }],
    },
  }),
  card({
    id: 'blast-burn',
    name: 'Blast Burn',
    description: 'Deal 32 damage. Gain 8 HP. Exhaust.',
    type: 'fire',
    kind: 'attack',
    cost: 3,
    rarity: 'rare',
    character: 'blaze',
    exhaust: true,
    effects: [
      { op: 'damage', amount: 32 },
      { op: 'heal', amount: 8 },
    ],
    upgrade: {
      description: 'Deal 35 damage. Gain 5 Max HP permanently. Exhaust.',
      effects: [
        { op: 'damage', amount: 35 },
        { op: 'gainMaxHp', amount: 5 },
      ],
    },
  }),
  card({
    id: 'drought',
    name: 'Drought',
    description: 'Exhausted cards are discarded instead. They still count as Exhausted.',
    type: 'fire',
    kind: 'power',
    cost: 3,
    rarity: 'rare',
    character: 'blaze',
    effects: [{ op: 'applyPower', power: 'droughtDiscard', stacks: 1 }],
    upgrade: {
      description: 'Exhausted cards are shuffled into your draw pile. They still count as Exhausted.',
      cost: 2,
      effects: [{ op: 'applyPower', power: 'droughtDraw', stacks: 1 }],
    },
  }),
  card({
    id: 'flare-blitz',
    name: 'Flare Blitz',
    description: 'Deal 1 damage to ALL enemies 3 times. If any has Burn, double their Burn.',
    type: 'fire',
    kind: 'attack',
    cost: 2,
    rarity: 'rare',
    character: 'blaze',
    effects: [
      { op: 'damage', amount: 1, times: 3, all: true },
      { op: 'multiplyStatus', status: 'burn', factor: 2, all: true },
    ],
    upgrade: {
      description: 'Deal 1 damage to ALL enemies 4 times. If any has Burn, triple their Burn.',
      cost: 2,
      effects: [
        { op: 'damage', amount: 1, times: 4, all: true },
        { op: 'multiplyStatus', status: 'burn', factor: 3, all: true },
      ],
    },
  }),

  // ── Tide ──
  card({
    id: 'water-gun',
    name: 'Water Gun',
    description: 'Deal 5 damage.',
    type: 'water',
    kind: 'attack',
    cost: 1,
    rarity: 'starter',
    character: 'tide',
    effects: [{ op: 'damage', amount: 5 }],
  }),
  card({
    id: 'withdraw',
    name: 'Withdraw',
    description: 'Gain 7 Block.',
    type: 'water',
    kind: 'skill',
    cost: 1,
    rarity: 'starter',
    character: 'tide',
    effects: [{ op: 'block', amount: 7 }],
    upgrade: {
      description: 'Gain 10 Block.',
      effects: [{ op: 'block', amount: 10 }],
    },
  }),
  card({
    id: 'bubble',
    name: 'Bubble',
    description: 'Add 1 Attack Charge. Attack Charges deal 4 at the end of your turn.',
    type: 'water',
    kind: 'skill',
    cost: 1,
    rarity: 'starter',
    character: 'tide',
    effects: [{ op: 'addCharge', amount: 1, kind: 'attack' }],
    upgrade: {
      cost: 0,
      description: 'Add 1 Attack Charge. Attack Charges deal 4 at the end of your turn.',
      effects: [{ op: 'addCharge', amount: 1, kind: 'attack' }],
    },
  }),
  card({
    id: 'aqua-jet',
    name: 'Aqua Jet',
    description: 'Deal 3 damage. Increase the damage of ALL Aqua Jets by 2 this combat.',
    type: 'water',
    kind: 'attack',
    cost: 0,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'damage', amount: 3 },
      { op: 'applyPower', power: 'aqua-jet', stacks: 2 },
    ],
    upgrade: {
      description: 'Deal 5 damage. Increase the damage of ALL Aqua Jets by 4 this combat.',
      effects: [
        { op: 'damage', amount: 5 },
        { op: 'applyPower', power: 'aqua-jet', stacks: 4 },
      ],
    },
  }),
  card({
    id: 'iron-defense',
    name: 'Iron Defense',
    description: 'Gain 12 Block. Reflect 50% of the damage you take this turn.',
    type: 'steel',
    kind: 'skill',
    cost: 2,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'block', amount: 12 },
      { op: 'reflect', percent: 50 },
    ],
    upgrade: {
      cost: 2,
      description: 'Gain 15 Block. Reflect 75% of the damage you take this turn.',
      effects: [
        { op: 'block', amount: 15 },
        { op: 'reflect', percent: 75 },
      ],
    },
  }),
  card({
    id: 'rain-dance',
    name: 'Rain Dance',
    description: 'Gain 4 Block. Deal 4 damage. Apply 1 Weak.',
    type: 'water',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'block', amount: 4 },
      { op: 'damage', amount: 4 },
      { op: 'status', status: 'weak', stacks: 1 },
    ],
    upgrade: {
      cost: 0,
      description: 'Gain 4 Block. Deal 4 damage. Apply 1 Weak.',
      effects: [
        { op: 'block', amount: 4 },
        { op: 'damage', amount: 4 },
        { op: 'status', status: 'weak', stacks: 1 },
      ],
    },
  }),
  card({
    id: 'bubble-beam',
    name: 'Bubble Beam',
    description: 'Deal 7 damage. Apply 1 Weak. Gain 1 Focus this turn only.',
    type: 'water',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'status', status: 'weak', stacks: 1 },
      { op: 'focus', amount: 1, thisTurn: true },
    ],
    upgrade: {
      description: 'Deal 7 damage. Apply 2 Weak. Gain 1 Focus. Exhaust.',
      exhaust: true,
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'status', status: 'weak', stacks: 2 },
        { op: 'focus', amount: 1 },
      ],
    },
  }),
  card({
    id: 'surf-prep',
    name: 'Dive Prep',
    description: 'Draw 2 cards. 0-cost cards deal 2 extra damage this turn.',
    type: 'water',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'draw', amount: 2 },
      { op: 'applyPower', power: 'zeroCostDamageThisTurn', stacks: 2 },
    ],
    upgrade: {
      description: 'Draw 3 cards. 0-cost cards drawn this way gain Replay.',
      effects: [{ op: 'draw', amount: 3, replayZeroCost: true }],
    },
  }),
  card({
    id: 'water-pulse',
    name: 'Water Pulse',
    description: 'Deal 5 damage. Add 1 Attack Charge.',
    type: 'water',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'addCharge', amount: 1, kind: 'attack' },
    ],
    upgrade: {
      description: 'Deal 5 damage. Add 2 Attack Charges.',
      effects: [
        { op: 'damage', amount: 5 },
        { op: 'addCharge', amount: 2, kind: 'attack' },
      ],
    },
  }),
  card({
    id: 'tackle-tide',
    name: 'Tackle',
    description: 'Deal 5 damage. Deal 2 extra damage for each other 0-cost card played this combat.',
    type: 'normal',
    kind: 'attack',
    cost: 0,
    rarity: 'common',
    character: 'tide',
    effects: [{ op: 'damage', amount: 5, perOtherZeroCost: 2 }],
    upgrade: {
      description: 'Deal 6 damage. Deal 3 extra damage for each other 0-cost card played this combat.',
      effects: [{ op: 'damage', amount: 6, perOtherZeroCost: 3 }],
    },
  }),
  card({
    id: 'brine',
    name: 'Brine',
    description: 'Deal 10 damage. Add a random 0-cost card to your hand from ANY class.',
    type: 'water',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'tide',
    effects: [
      { op: 'damage', amount: 10 },
      { op: 'addZeroCostFromAnyClass', mode: 'random' },
    ],
    upgrade: {
      cost: 1,
      description: 'Deal 10 damage. Choose a 0-cost card to add to your hand from ANY class.',
      effects: [
        { op: 'damage', amount: 10 },
        { op: 'addZeroCostFromAnyClass', mode: 'choose' },
      ],
    },
  }),
  card({
    id: 'surf',
    name: 'Surf',
    description: 'Prevent all damage this turn. End your turn. Deal 10 damage to ALL enemies at the start of next turn.',
    type: 'water',
    kind: 'power',
    cost: 2,
    rarity: 'uncommon',
    character: 'tide',
    effects: [{ op: 'preventDamageAndEndTurn', nextTurnDamage: 10 }],
    upgrade: {
      description: 'Prevent all damage this turn. End your turn. Deal 20 damage to ALL enemies at the start of next turn.',
      effects: [{ op: 'preventDamageAndEndTurn', nextTurnDamage: 20 }],
    },
  }),
  card({
    id: 'aqua-ring',
    name: 'Aqua Ring',
    description: 'At the start of your turn, heal 2 HP.',
    type: 'water',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'tide',
    effects: [{ op: 'applyPower', power: 'aqua-ring', stacks: 2 }],
    upgrade: {
      description: 'At the start of your turn, heal 4 HP.',
      effects: [{ op: 'applyPower', power: 'aqua-ring', stacks: 4 }],
    },
  }),
  card({
    id: 'hydro-pump',
    name: 'Hydro Pump',
    description: 'Gain 1 Focus.',
    type: 'water',
    kind: 'power',
    cost: 2,
    rarity: 'uncommon',
    character: 'tide',
    effects: [{ op: 'focus', amount: 1 }],
    upgrade: {
      description: 'Gain 2 Focus.',
      effects: [{ op: 'focus', amount: 2 }],
    },
  }),
  card({
    id: 'rapid-spin',
    name: 'Rapid Spin',
    description: 'Deal 1 damage. Apply 1 Vulnerable. Draw 1 card.',
    type: 'normal',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'tide',
    effects: [
      { op: 'damage', amount: 1 },
      { op: 'status', status: 'vulnerable', stacks: 1 },
      { op: 'draw', amount: 1 },
    ],
    upgrade: {
      cost: 0,
      description: 'Deal 1 damage and apply 1 Vulnerable to ALL enemies. Draw 1 card.',
      effects: [
        { op: 'damage', amount: 1, all: true },
        { op: 'status', status: 'vulnerable', stacks: 1, all: true },
        { op: 'draw', amount: 1 },
      ],
    },
  }),
  card({
    id: 'water-sport',
    name: 'Water Sport',
    description: 'Add 1 Block Charge and 1 Attack Charge.',
    type: 'water',
    kind: 'skill',
    cost: 2,
    rarity: 'uncommon',
    character: 'tide',
    effects: [
      { op: 'addCharge', amount: 1, kind: 'block' },
      { op: 'addCharge', amount: 1, kind: 'attack' },
    ],
    upgrade: {
      cost: 2,
      description: 'Add 1 Block Charge and 1 Attack Charge.',
      effects: [
        { op: 'addCharge', amount: 1, kind: 'block' },
        { op: 'addCharge', amount: 1, kind: 'attack' },
      ],
    },
  }),
  card({
    id: 'whirlpool',
    name: 'Whirlpool',
    description: 'Deal 8 damage and apply 2 Weak to ALL enemies.',
    type: 'water',
    kind: 'attack',
    cost: 2,
    rarity: 'uncommon',
    character: 'tide',
    effects: [
      { op: 'damage', amount: 8, all: true },
      { op: 'status', status: 'weak', stacks: 2, all: true },
    ],
    upgrade: {
      cost: 2,
      description: 'Enemies lose all Block. Deal 10 damage and apply 2 Weak to ALL enemies.',
      effects: [
        { op: 'clearEnemyBlock', all: true },
        { op: 'damage', amount: 10, all: true },
        { op: 'status', status: 'weak', stacks: 2, all: true },
      ],
    },
  }),
  card({
    id: 'aqua-tail',
    name: 'Aqua Tail',
    description: '0-cost cards gain 2 Block when played this combat.',
    type: 'water',
    kind: 'power',
    cost: 3,
    rarity: 'uncommon',
    character: 'tide',
    effects: [{ op: 'applyPower', power: 'zeroCostBlock', stacks: 2 }],
    upgrade: {
      cost: 2,
      description: '0-cost cards gain 3 Block when played this combat.',
      effects: [{ op: 'applyPower', power: 'zeroCostBlock', stacks: 3 }],
    },
  }),
  card({
    id: 'focus-power',
    name: 'Torrent Focus',
    description: 'Add 1 Block Charge. Draw 1 card.',
    type: 'water',
    kind: 'skill',
    cost: 2,
    rarity: 'uncommon',
    character: 'tide',
    effects: [
      { op: 'addCharge', amount: 1, kind: 'block' },
      { op: 'draw', amount: 1 },
    ],
    upgrade: {
      cost: 1,
      description: 'Add 1 Block Charge. Draw 1 card.',
      effects: [
        { op: 'addCharge', amount: 1, kind: 'block' },
        { op: 'draw', amount: 1 },
      ],
    },
  }),
  card({
    id: 'reservoir',
    name: 'Reservoir',
    description: 'Gain 1 Charge slot.',
    type: 'water',
    kind: 'power',
    cost: 2,
    rarity: 'uncommon',
    character: 'tide',
    effects: [{ op: 'applyPower', power: 'reservoir', stacks: 1 }],
    upgrade: {
      cost: 1,
      description: 'Gain 1 Charge slot.',
      effects: [{ op: 'applyPower', power: 'reservoir', stacks: 1 }],
    },
  }),
  card({
    id: 'hydro-cannon',
    name: 'Hydro Cannon',
    description: 'Deal 30 damage. If the enemy takes unblocked damage, deal 15 more damage. Exhaust.',
    type: 'water',
    kind: 'attack',
    cost: 3,
    rarity: 'rare',
    character: 'tide',
    exhaust: true,
    effects: [{ op: 'damage', amount: 30, repeatIfUnblocked: true, unblockedBonus: 15 }],
    upgrade: {
      cost: 2,
      exhaust: true,
      description: 'Deal 30 damage. If the enemy takes unblocked damage, deal 15 more damage. Exhaust.',
      effects: [{ op: 'damage', amount: 30, repeatIfUnblocked: true, unblockedBonus: 15 }],
    },
  }),
  card({
    id: 'water-spout',
    name: 'Water Spout',
    description: 'Deal 3 damage to ALL enemies. Plays an extra time for every Charge added this combat. Exhaust.',
    type: 'water',
    kind: 'attack',
    cost: 2,
    rarity: 'rare',
    character: 'tide',
    target: 'all',
    exhaust: true,
    effects: [{ op: 'damage', amount: 3, all: true, extraTimesPerChargeAdded: true }],
    upgrade: {
      exhaust: true,
      description: 'Deal 4 damage to ALL enemies. Plays an extra time for every Charge added this combat. Exhaust.',
      effects: [{ op: 'damage', amount: 4, all: true, extraTimesPerChargeAdded: true }],
    },
  }),
  card({
    id: 'rain-lord',
    name: 'Drizzle',
    description: 'Charges trigger twice at the end of your turn.',
    type: 'water',
    kind: 'power',
    cost: 4,
    rarity: 'rare',
    character: 'tide',
    effects: [{ op: 'applyPower', power: 'rain-lord', stacks: 1 }],
    upgrade: {
      cost: 3,
      description: 'Charges trigger twice at the end of your turn.',
      effects: [{ op: 'applyPower', power: 'rain-lord', stacks: 1 }],
    },
  }),

  // ── Bloom ──
  card({
    id: 'petal',
    name: 'Petal',
    description: 'Deal 5 damage. Unaffected by Strength. Exhaust.',
    type: 'grass',
    kind: 'attack',
    cost: 0,
    rarity: 'starter',
    character: 'bloom',
    token: true,
    exhaust: true,
    effects: [{ op: 'damage', amount: 5 }],
  }),
  card({
    id: 'vine-whip',
    name: 'Vine Whip',
    description: 'Deal 2 damage. Deal 5 more if the enemy is Toxic.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'starter',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 2 },
      { op: 'damageIfStatus', status: 'toxic', amount: 5 },
    ],
    upgrade: {
      description: 'Deal 2 damage. Deal 7 more if the enemy is Toxic.',
      effects: [
        { op: 'damage', amount: 2 },
        { op: 'damageIfStatus', status: 'toxic', amount: 7 },
      ],
    },
  }),
  card({
    id: 'seed',
    name: 'Seed',
    description: 'Heal 2 HP. If this is discarded, apply 1 Toxic. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 0,
    rarity: 'starter',
    character: 'bloom',
    token: true,
    exhaust: true,
    effects: [{ op: 'heal', amount: 2 }],
    onDiscard: [{ op: 'status', status: 'toxic', stacks: 1 }],
  }),
  card({
    id: 'synthesis',
    name: 'Synthesis',
    description: 'Gain 5 Block. If this is discarded, gain 7 Block.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'starter',
    character: 'bloom',
    effects: [{ op: 'block', amount: 5 }],
    onDiscard: [{ op: 'block', amount: 7 }],
    upgrade: {
      description: 'Gain 6 Block. If this is discarded, gain 8 Block.',
      effects: [{ op: 'block', amount: 6 }],
      onDiscard: [{ op: 'block', amount: 8 }],
    },
  }),
  card({
    id: 'poison-powder',
    name: 'Poison Powder',
    description: 'Apply 3 Toxic. Discard a card.',
    type: 'poison',
    kind: 'skill',
    cost: 1,
    rarity: 'starter',
    character: 'bloom',
    effects: [
      { op: 'status', status: 'toxic', stacks: 3 },
      { op: 'discard', amount: 1 },
    ],
    upgrade: {
      cost: 0,
      description: 'Apply 5 Toxic. Discard a card.',
      effects: [
        { op: 'status', status: 'toxic', stacks: 5 },
        { op: 'discard', amount: 1 },
      ],
    },
  }),
  card({
    id: 'leech-seed',
    name: 'Leech Seed',
    description: 'Deal 5 damage. Heal for the damage dealt.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [{ op: 'damage', amount: 5, healEqualToDamage: true }],
    upgrade: {
      description: 'Deal 7 damage. Heal for the damage dealt.',
      effects: [{ op: 'damage', amount: 7, healEqualToDamage: true }],
    },
  }),
  card({
    id: 'razor-leaf',
    name: 'Razor Leaf',
    description: 'Gain 5 Block. Discard a card. Add a Petal to your hand.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'block', amount: 5 },
      { op: 'discard', amount: 1, then: [{ op: 'addPetal', amount: 1 }] },
    ],
    upgrade: {
      cost: 0,
      description: 'Gain 5 Block. Discard a card. Add a Petal to your hand.',
      effects: [
        { op: 'block', amount: 5 },
        { op: 'discard', amount: 1, then: [{ op: 'addPetal', amount: 1 }] },
      ],
    },
  }),
  card({
    id: 'sleep-powder',
    name: 'Sleep Powder',
    description: 'Apply 2 Weak and 1 Frail.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'status', status: 'weak', stacks: 2 },
      { op: 'status', status: 'frail', stacks: 1 },
    ],
    upgrade: {
      cost: 0,
      description: 'Apply 2 Weak and 1 Frail.',
      effects: [
        { op: 'status', status: 'weak', stacks: 2 },
        { op: 'status', status: 'frail', stacks: 1 },
      ],
    },
  }),
  card({
    id: 'mega-drain',
    name: 'Mega Drain',
    description: 'Deal 4 damage. If the enemy is Frail, deal 10 damage and heal 5 HP.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 4 },
      { op: 'damageIfStatus', status: 'frail', amount: 6, heal: 5 },
    ],
    upgrade: {
      description: 'Deal 4 damage. If the enemy is Frail, deal 15 damage and heal 7 HP.',
      effects: [
        { op: 'damage', amount: 4 },
        { op: 'damageIfStatus', status: 'frail', amount: 11, heal: 7 },
      ],
    },
  }),
  card({
    id: 'absorb',
    name: 'Absorb',
    description: 'Discard a card. If you discarded a Skill, apply 2 Toxic and heal 3 HP.',
    type: 'grass',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    character: 'bloom',
    effects: [
      {
        op: 'discard',
        amount: 1,
        ifSkill: [
          { op: 'status', status: 'toxic', stacks: 2 },
          { op: 'heal', amount: 3 },
        ],
      },
    ],
    upgrade: {
      description: 'Discard a card. If you discarded a Skill, apply 3 Toxic and heal 4 HP.',
      effects: [
        {
          op: 'discard',
          amount: 1,
          ifSkill: [
            { op: 'status', status: 'toxic', stacks: 3 },
            { op: 'heal', amount: 4 },
          ],
        },
      ],
    },
  }),
  card({
    id: 'growth',
    name: 'Growth',
    description: 'Gain 1 Strength. If this is discarded, gain 2 Strength next turn and exhaust this card.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    exhaustOnDiscard: true,
    effects: [{ op: 'strength', amount: 1, self: true }],
    onDiscard: [{ op: 'strengthNextTurn', amount: 2 }],
    upgrade: {
      description: 'Gain 1 Strength. If this is discarded, gain 3 Strength next turn and exhaust this card.',
      exhaustOnDiscard: true,
      effects: [{ op: 'strength', amount: 1, self: true }],
      onDiscard: [{ op: 'strengthNextTurn', amount: 3 }],
    },
  }),
  card({
    id: 'stun-spore',
    name: 'Stun Spore',
    description: 'Apply 1 Frail. Draw 1 card. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    character: 'bloom',
    exhaust: true,
    effects: [
      { op: 'status', status: 'frail', stacks: 1 },
      { op: 'draw', amount: 1 },
    ],
    upgrade: {
      description: 'Apply 1 Frail to ALL enemies. Draw 1 card. Exhaust.',
      exhaust: true,
      effects: [
        { op: 'status', status: 'frail', stacks: 1, all: true },
        { op: 'draw', amount: 1 },
      ],
    },
  }),
  card({
    id: 'wrap',
    name: 'Wrap',
    description: 'Deal 5 damage. Apply 1 Weak. Apply 3 Toxic.',
    type: 'normal',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'status', status: 'weak', stacks: 1 },
      { op: 'status', status: 'toxic', stacks: 3 },
    ],
    upgrade: {
      description: 'Deal 7 damage. Apply 2 Weak. Apply 4 Toxic.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'status', status: 'weak', stacks: 2 },
        { op: 'status', status: 'toxic', stacks: 4 },
      ],
    },
  }),
  card({
    id: 'bullet-seed',
    name: 'Bullet Seed',
    description: 'Deal 3 damage 3 times.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [{ op: 'damage', amount: 3, times: 3 }],
    upgrade: {
      description: 'Deal 4 damage 3 times.',
      effects: [{ op: 'damage', amount: 4, times: 3 }],
    },
  }),
  card({
    id: 'worry-seed',
    name: 'Worry Seed',
    description: 'Discard a card. Draw 2 cards.',
    type: 'grass',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    character: 'bloom',
    effects: [{ op: 'discard', amount: 1, then: [{ op: 'draw', amount: 2 }] }],
    upgrade: {
      description: 'Discard a card. Draw 3 cards.',
      effects: [{ op: 'discard', amount: 1, then: [{ op: 'draw', amount: 3 }] }],
    },
  }),
  card({
    id: 'magical-leaf',
    name: 'Magical Leaf',
    description: 'Deal 7 damage. If this is discarded, apply 3 Toxic.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [{ op: 'damage', amount: 7 }],
    onDiscard: [{ op: 'status', status: 'toxic', stacks: 3 }],
    upgrade: {
      description: 'Deal 9 damage. If this is discarded, apply 4 Toxic.',
      effects: [{ op: 'damage', amount: 9 }],
      onDiscard: [{ op: 'status', status: 'toxic', stacks: 4 }],
    },
  }),
  card({
    id: 'cotton-spore',
    name: 'Cotton Spore',
    description: 'Gain 5 Block. Add 2 Seeds to your hand.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'block', amount: 5 },
      { op: 'addSeed', amount: 2 },
    ],
    upgrade: {
      cost: 0,
      description: 'Gain 5 Block. Add 2 Seeds to your hand.',
      effects: [
        { op: 'block', amount: 5 },
        { op: 'addSeed', amount: 2 },
      ],
    },
  }),
  card({
    id: 'pollen-puff',
    name: 'Pollen Puff',
    description: 'Heal 4 HP. Add a Petal to your hand.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'heal', amount: 4 },
      { op: 'addPetal', amount: 1 },
    ],
    upgrade: {
      description: 'Heal 5 HP. Add a Petal and a Seed to your hand.',
      effects: [
        { op: 'heal', amount: 5 },
        { op: 'addPetal', amount: 1 },
        { op: 'addSeed', amount: 1 },
      ],
    },
  }),
  card({
    id: 'horn-leech',
    name: 'Horn Leech',
    description: 'Deal 6 damage. Heal 3 HP. Add a Seed to your hand.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'common',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'heal', amount: 3 },
      { op: 'addSeed', amount: 1 },
    ],
    upgrade: {
      description: 'Deal 8 damage. Heal 4 HP. Add a Seed to your hand.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'heal', amount: 4 },
        { op: 'addSeed', amount: 1 },
      ],
    },
  }),
  card({
    id: 'giga-drain',
    name: 'Giga Drain',
    description: 'Deal 30 damage. Gain 1 Max HP permanently.',
    type: 'grass',
    kind: 'attack',
    cost: 3,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 30 },
      { op: 'gainMaxHp', amount: 1 },
    ],
    upgrade: {
      cost: 3,
      description: 'Deal 30 damage. Gain 1 Max HP permanently. If the enemy is attacking this turn, gain 3 Max HP instead and Exhaust.',
      effects: [
        { op: 'damage', amount: 30 },
        { op: 'gainMaxHpIfAttacking', amount: 3, otherwise: 1, exhaust: true },
      ],
    },
  }),
  card({
    id: 'toxic-bloom',
    name: 'Toxic',
    description: 'Apply 2 Toxic. If the enemy is already Toxic, apply 8 instead.',
    type: 'poison',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'toxicIfAlready', apply: 2, already: 8 }],
    upgrade: {
      description: 'Apply 2 Toxic. If the enemy is already Toxic, apply 10 instead.',
      effects: [{ op: 'toxicIfAlready', apply: 2, already: 10 }],
    },
  }),
  card({
    id: 'solar-beam',
    name: 'Solar Beam',
    description: 'Deal 16 damage. Costs 0 if you discarded a card this turn.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    freeIfDiscardedThisTurn: true,
    effects: [{ op: 'damage', amount: 16 }],
    upgrade: {
      cost: 1,
      freeIfDiscardedThisTurn: true,
      description: 'Deal 20 damage. Costs 0 if you discarded a card this turn. If the enemy is Frail, deal 28 damage instead.',
      effects: [
        { op: 'damage', amount: 20 },
        { op: 'damageIfStatus', status: 'frail', amount: 8 },
      ],
    },
  }),
  card({
    id: 'petal-dance',
    name: 'Petal Dance',
    description: 'Add 3 Petals to your hand. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    exhaust: true,
    effects: [{ op: 'addPetal', amount: 3 }],
    upgrade: {
      description: 'Add 4 Petals to your hand. Exhaust.',
      exhaust: true,
      effects: [{ op: 'addPetal', amount: 4 }],
    },
  }),
  card({
    id: 'spore',
    name: 'Spore',
    description: 'Petal cards deal 4 more damage this combat.',
    type: 'grass',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'spore', stacks: 4 }],
    upgrade: {
      description: 'Petal cards deal 4 more damage this combat. Petals deal 2 more damage to Toxic enemies.',
      effects: [
        { op: 'applyPower', power: 'spore', stacks: 4 },
        { op: 'applyPower', power: 'sporeToxic', stacks: 2 },
      ],
    },
  }),
  card({
    id: 'ingrain',
    name: 'Ingrain',
    description: 'At the start of your turn, add a Petal to your hand.',
    type: 'grass',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'ingrainPetal', stacks: 1 }],
    upgrade: {
      cost: 0,
      description: 'At the start of your turn, add a Petal to your hand.',
      effects: [{ op: 'applyPower', power: 'ingrainPetal', stacks: 1 }],
    },
  }),
  card({
    id: 'leaf-blade',
    name: 'Leaf Blade',
    description: 'Deal 15 damage. The next Skill you play costs 0.',
    type: 'grass',
    kind: 'attack',
    cost: 2,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 15 },
      { op: 'freeNext', kind: 'skill' },
    ],
    upgrade: {
      description: 'Deal 15 damage. The next Power you play costs 0.',
      effects: [
        { op: 'damage', amount: 15 },
        { op: 'freeNext', kind: 'power' },
      ],
    },
  }),
  card({
    id: 'acid',
    name: 'Acid',
    description: 'Apply 1 Frail. If the enemy has no Block, apply 6 Toxic.',
    type: 'poison',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [
      { op: 'status', status: 'frail', stacks: 1 },
      { op: 'statusIfNoBlock', status: 'toxic', stacks: 6 },
    ],
    upgrade: {
      description: 'Apply 1 Frail. If the enemy has no Block, apply 9 Toxic.',
      effects: [
        { op: 'status', status: 'frail', stacks: 1 },
        { op: 'statusIfNoBlock', status: 'toxic', stacks: 9 },
      ],
    },
  }),
  card({
    id: 'baneful-bunker',
    name: 'Baneful Bunker',
    description: "Gain Block equal to an enemy's Toxic. Exhaust.",
    type: 'poison',
    kind: 'skill',
    cost: 2,
    rarity: 'uncommon',
    character: 'bloom',
    exhaust: true,
    effects: [{ op: 'blockEqualToStatus', status: 'toxic' }],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: "Gain Block equal to an enemy's Toxic. Exhaust.",
      effects: [{ op: 'blockEqualToStatus', status: 'toxic' }],
    },
  }),
  card({
    id: 'seed-bomb',
    name: 'Seed Bomb',
    description: 'Deal 7 damage. If the enemy is Frail, deal damage equal to their Block.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'damage', amount: 7, plusBlockIfStatus: 'frail' }],
    upgrade: {
      description: 'Deal 9 damage. If the enemy is Frail, deal damage equal to their Block and apply 3 Toxic.',
      effects: [
        { op: 'damage', amount: 9, plusBlockIfStatus: 'frail' },
        { op: 'statusIfStatus', ifStatus: 'frail', status: 'toxic', stacks: 3 },
      ],
    },
  }),
  card({
    id: 'natural-gift',
    name: 'Natural Gift',
    description: 'Gain 6 Block. If this is discarded, draw 1 card.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'block', amount: 6 }],
    onDiscard: [{ op: 'draw', amount: 1 }],
    upgrade: {
      description: 'Gain 8 Block. If this is discarded, draw 1 card.',
      effects: [{ op: 'block', amount: 8 }],
      onDiscard: [{ op: 'draw', amount: 1 }],
    },
  }),
  card({
    id: 'grassy-glide',
    name: 'Grassy Glide',
    description: 'Deal 8 damage. Discard a card. If you discarded a Skill, deal 6 more.',
    type: 'grass',
    kind: 'attack',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 8 },
      { op: 'discard', amount: 1, ifSkill: [{ op: 'damage', amount: 6 }] },
    ],
    upgrade: {
      description: 'Deal 8 damage. Discard a card. If you discarded a Skill, deal 9 more.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'discard', amount: 1, ifSkill: [{ op: 'damage', amount: 9 }] },
      ],
    },
  }),
  card({
    id: 'chlorophyll',
    name: 'Chlorophyll',
    description: 'At the start of your turn, discard a card, then draw a card.',
    type: 'grass',
    kind: 'power',
    cost: 2,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'chlorophyll', stacks: 1 }],
    upgrade: {
      cost: 1,
      description: 'At the start of your turn, discard a card, then draw a card.',
      effects: [{ op: 'applyPower', power: 'chlorophyll', stacks: 1 }],
    },
  }),
  card({
    id: 'strength-sap',
    name: 'Strength Sap',
    description: 'Apply 2 Weak. Heal 4 HP. If this is discarded, add 2 Seeds to your hand.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [
      { op: 'status', status: 'weak', stacks: 2 },
      { op: 'heal', amount: 4 },
    ],
    onDiscard: [{ op: 'addSeed', amount: 2 }],
    upgrade: {
      description: 'Apply 2 Weak. Heal 6 HP. If this is discarded, add 3 Seeds to your hand.',
      effects: [
        { op: 'status', status: 'weak', stacks: 2 },
        { op: 'heal', amount: 6 },
      ],
      onDiscard: [{ op: 'addSeed', amount: 3 }],
    },
  }),
  card({
    id: 'grassy-terrain',
    name: 'Grassy Terrain',
    description: 'At the start of your turn, add a Seed to your hand.',
    type: 'grass',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'grassyTerrain', stacks: 1 }],
    upgrade: {
      cost: 0,
      description: 'At the start of your turn, add a Seed to your hand.',
      effects: [{ op: 'applyPower', power: 'grassyTerrain', stacks: 1 }],
    },
  }),
  card({
    id: 'root-network',
    name: 'Root Network',
    description: 'Whenever a card heals you, apply 1 Toxic to ALL enemies.',
    type: 'grass',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'rootNetwork', stacks: 1 }],
    upgrade: {
      description: 'Whenever a card heals you, apply 1 Toxic to ALL enemies and gain 2 Block.',
      effects: [
        { op: 'applyPower', power: 'rootNetwork', stacks: 1 },
        { op: 'applyPower', power: 'rootNetworkBlock', stacks: 2 },
      ],
    },
  }),
  card({
    id: 'frenzy-plant',
    name: 'Frenzy Plant',
    description: 'Whenever you play a card, deal 3 damage to a random enemy. Unaffected by Strength.',
    type: 'grass',
    kind: 'power',
    cost: 3,
    rarity: 'rare',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'frenzy-plant', stacks: 3 }],
    upgrade: {
      cost: 2,
      description: 'Whenever you play a card, deal 3 damage to a random enemy. Unaffected by Strength.',
      effects: [{ op: 'applyPower', power: 'frenzy-plant', stacks: 3 }],
    },
  }),
  card({
    id: 'blooming',
    name: 'Blooming',
    description: 'Play every Petal in your exhaust pile on the enemy. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 2,
    rarity: 'rare',
    character: 'bloom',
    exhaust: true,
    effects: [{ op: 'playExhaustedPetals' }],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: 'Play every Petal in your exhaust pile on the enemy. Exhaust.',
      effects: [{ op: 'playExhaustedPetals' }],
    },
  }),
  card({
    id: 'forest-curse',
    name: 'Forest Curse',
    description: 'Apply 5 Toxic. Apply 5 more for every 5 Toxic on the enemy. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 2,
    rarity: 'rare',
    character: 'bloom',
    exhaust: true,
    effects: [{ op: 'toxicPerFive', base: 5, perFive: 5 }],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: 'Apply 5 Toxic. Apply 5 more for every 5 Toxic on the enemy. Exhaust.',
      effects: [{ op: 'toxicPerFive', base: 5, perFive: 5 }],
    },
  }),
  card({
    id: 'leaf-storm',
    name: 'Leaf Storm',
    description: 'Discard any number of cards. Deal 5 damage and apply 2 Toxic for each. Exhaust.',
    type: 'grass',
    kind: 'attack',
    cost: 2,
    rarity: 'rare',
    character: 'bloom',
    exhaust: true,
    effects: [
      {
        op: 'discardAny',
        thenPer: [
          { op: 'damage', amount: 5 },
          { op: 'status', status: 'toxic', stacks: 2 },
        ],
      },
    ],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: 'Discard any number of cards. Deal 5 damage and apply 2 Toxic for each. Exhaust.',
      effects: [
        {
          op: 'discardAny',
          thenPer: [
            { op: 'damage', amount: 5 },
            { op: 'status', status: 'toxic', stacks: 2 },
          ],
        },
      ],
    },
  }),
  card({
    id: 'harvest',
    name: 'Harvest',
    description: 'Play every Seed in your hand and discard pile, then Exhaust them. Heal 2 extra for each. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 2,
    rarity: 'rare',
    character: 'bloom',
    exhaust: true,
    effects: [{ op: 'harvestSeeds', healPer: 2 }],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: 'Play every Seed in your hand and discard pile, then Exhaust them. Heal 2 extra for each. Exhaust.',
      effects: [{ op: 'harvestSeeds', healPer: 2 }],
    },
  }),
  card({
    id: 'petal-blizzard',
    name: 'Petal Blizzard',
    description: 'Deal 7 damage to ALL enemies. If any is Frail, deal 4 more to ALL enemies.',
    type: 'grass',
    kind: 'attack',
    cost: 2,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [
      { op: 'damage', amount: 7, all: true },
      { op: 'damage', amount: 4, all: true, ifAnyStatus: 'frail' },
    ],
    upgrade: {
      description: 'Deal 9 damage to ALL enemies. If any is Frail, deal 6 more to ALL enemies.',
      effects: [
        { op: 'damage', amount: 9, all: true },
        { op: 'damage', amount: 6, all: true, ifAnyStatus: 'frail' },
      ],
    },
  }),
  card({
    id: 'sludge-wave',
    name: 'Sludge Wave',
    description: 'Apply 3 Toxic and 1 Weak to ALL enemies. Exhaust.',
    type: 'poison',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    exhaust: true,
    effects: [
      { op: 'status', status: 'toxic', stacks: 3, all: true },
      { op: 'status', status: 'weak', stacks: 1, all: true },
    ],
    upgrade: {
      description: 'Apply 4 Toxic and 1 Weak to ALL enemies.',
      exhaust: false,
      effects: [
        { op: 'status', status: 'toxic', stacks: 4, all: true },
        { op: 'status', status: 'weak', stacks: 1, all: true },
      ],
    },
  }),
  card({
    id: 'effect-spore',
    name: 'Effect Spore',
    description: 'Whenever you apply Frail, apply 2 Toxic.',
    type: 'grass',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'effectSpore', stacks: 2 }],
    upgrade: {
      description: 'Whenever you apply Frail, apply 2 Toxic and 1 Weak.',
      effects: [
        { op: 'applyPower', power: 'effectSpore', stacks: 2 },
        { op: 'applyPower', power: 'effectSporeWeak', stacks: 1 },
      ],
    },
  }),
  card({
    id: 'power-whip',
    name: 'Power Whip',
    description: 'Deal 10 damage. Deal 4 more for each Seed and Petal in your hand.',
    type: 'grass',
    kind: 'attack',
    cost: 2,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'damage', amount: 10, perGardenToken: 4 }],
    upgrade: {
      description: 'Deal 12 damage. Deal 5 more for each Seed and Petal in your hand.',
      effects: [{ op: 'damage', amount: 12, perGardenToken: 5 }],
    },
  }),
  card({
    id: 'overgrow',
    name: 'Overgrow',
    description: 'While below 50% HP, your Attacks deal 3 more damage.',
    type: 'grass',
    kind: 'power',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'overgrow', stacks: 3 }],
    upgrade: {
      description: 'While below 50% HP, your Attacks deal 4 more damage.',
      effects: [{ op: 'applyPower', power: 'overgrow', stacks: 4 }],
    },
  }),
  card({
    id: 'toxic-spikes',
    name: 'Toxic Spikes',
    description: 'Whenever an enemy gains Block, apply 1 Toxic.',
    type: 'poison',
    kind: 'power',
    cost: 2,
    rarity: 'uncommon',
    character: 'bloom',
    effects: [{ op: 'applyPower', power: 'toxicSpikes', stacks: 1 }],
    upgrade: {
      cost: 1,
      description: 'Whenever an enemy gains Block, apply 1 Toxic.',
      effects: [{ op: 'applyPower', power: 'toxicSpikes', stacks: 1 }],
    },
  }),
  card({
    id: 'aromatherapy',
    name: 'Aromatherapy',
    description: 'Clear your debuffs. Heal 6 HP. Draw 1 card. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    character: 'bloom',
    exhaust: true,
    effects: [
      { op: 'clearStatuses' },
      { op: 'heal', amount: 6 },
      { op: 'draw', amount: 1 },
    ],
    upgrade: {
      description: 'Clear your debuffs. Heal 8 HP. Draw 1 card.',
      exhaust: false,
      effects: [
        { op: 'clearStatuses' },
        { op: 'heal', amount: 8 },
        { op: 'draw', amount: 1 },
      ],
    },
  }),
  card({
    id: 'seed-flare',
    name: 'Seed Flare',
    description: 'Exhaust any number of Seeds in your hand. Deal 8 damage and apply 2 Toxic for each. Exhaust.',
    type: 'grass',
    kind: 'attack',
    cost: 2,
    rarity: 'rare',
    character: 'bloom',
    exhaust: true,
    effects: [
      {
        op: 'discardAny',
        filter: 'seed',
        exhaust: true,
        thenPer: [
          { op: 'damage', amount: 8 },
          { op: 'status', status: 'toxic', stacks: 2 },
        ],
      },
    ],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: 'Exhaust any number of Seeds in your hand. Deal 8 damage and apply 2 Toxic for each. Exhaust.',
      effects: [
        {
          op: 'discardAny',
          filter: 'seed',
          exhaust: true,
          thenPer: [
            { op: 'damage', amount: 8 },
            { op: 'status', status: 'toxic', stacks: 2 },
          ],
        },
      ],
    },
  }),
  card({
    id: 'bloom-doom',
    name: 'Bloom Doom',
    description: 'Apply 3 Toxic X times. If X is 3 or more, apply 2 Frail. Exhaust.',
    type: 'grass',
    kind: 'skill',
    cost: 0,
    rarity: 'rare',
    character: 'bloom',
    exhaust: true,
    xCost: true,
    effects: [
      { op: 'status', status: 'toxic', stacks: 3, timesFromX: true },
      { op: 'statusIfX', min: 3, status: 'frail', stacks: 2 },
    ],
    upgrade: {
      xCost: true,
      exhaust: true,
      description: 'Apply 3 Toxic X+1 times. If X is 3 or more, apply 2 Frail. Exhaust.',
      effects: [
        { op: 'status', status: 'toxic', stacks: 3, timesFromX: true, plus: 1 },
        { op: 'statusIfX', min: 3, status: 'frail', stacks: 2 },
      ],
    },
  }),

  // ── Colorless trainer cards ──
  card({
    id: 'potion-card',
    name: 'Potion',
    description: 'Heal 5 HP. Exhaust.',
    type: 'colorless',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    exhaust: true,
    effects: [{ op: 'heal', amount: 5 }],
    upgrade: {
      description: 'Heal 6 HP. Gain 2 Max HP. Exhaust.',
      exhaust: true,
      effects: [
        { op: 'heal', amount: 6 },
        { op: 'gainMaxHp', amount: 2 },
      ],
    },
  }),
  card({
    id: 'great-ball',
    name: 'Great Ball',
    description: 'Draw 2 cards.',
    type: 'colorless',
    kind: 'skill',
    cost: 1,
    rarity: 'common',
    effects: [{ op: 'draw', amount: 2 }],
    upgrade: {
      cost: 0,
      description: 'Draw 2 cards.',
      effects: [{ op: 'draw', amount: 2 }],
    },
  }),
  card({
    id: 'x-attack-card',
    name: 'X Attack',
    description: 'Gain 1 Strength.',
    type: 'colorless',
    kind: 'power',
    cost: 1,
    rarity: 'common',
    effects: [{ op: 'strength', amount: 1, self: true }],
    upgrade: {
      cost: 0,
      description: 'Gain 1 Strength.',
      effects: [{ op: 'strength', amount: 1, self: true }],
    },
  }),
  card({
    id: 'x-defend-card',
    name: 'X Defend',
    description: 'Gain 1 Dexterity.',
    type: 'colorless',
    kind: 'power',
    cost: 1,
    rarity: 'common',
    effects: [{ op: 'dexterity', amount: 1 }],
    upgrade: {
      cost: 0,
      description: 'Gain 1 Dexterity.',
      effects: [{ op: 'dexterity', amount: 1 }],
    },
  }),
  card({
    id: 'poke-flute',
    name: 'Poké Flute',
    description: 'Add a random Power from your class to your hand. It costs 0. Exhaust.',
    type: 'colorless',
    kind: 'skill',
    cost: 2,
    rarity: 'common',
    exhaust: true,
    effects: [{ op: 'addClassPower', costOverride: 0 }],
    upgrade: {
      cost: 1,
      exhaust: true,
      description: 'Add a random Power from your class to your hand. It costs 0. Exhaust.',
      effects: [{ op: 'addClassPower', costOverride: 0 }],
    },
  }),
  card({
    id: 'escape-rope',
    name: 'Escape Rope',
    description: 'Gain 10 Block. Card rewards at the end of combat are upgraded. Exhaust.',
    type: 'colorless',
    kind: 'skill',
    cost: 3,
    rarity: 'uncommon',
    exhaust: true,
    effects: [{ op: 'block', amount: 10 }, { op: 'upgradeCombatRewards' }],
    upgrade: {
      cost: 2,
      exhaust: true,
      description: 'Gain 12 Block. Card rewards at the end of combat are upgraded. Exhaust.',
      effects: [{ op: 'block', amount: 12 }, { op: 'upgradeCombatRewards' }],
    },
  }),
  card({
    id: 'rare-candy-card',
    name: 'Rare Candy',
    description: 'Gain 2 Energy. Exhaust.',
    type: 'colorless',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    exhaust: true,
    effects: [{ op: 'gainEnergy', amount: 2 }],
    upgrade: {
      cost: 2,
      exhaust: true,
      description: 'Gain 2 Energy. Exhaust.',
      effects: [{ op: 'gainEnergy', amount: 2 }],
    },
  }),
  card({
    id: 'poke-doll',
    name: 'Poké Doll',
    description: 'If this is in your discard pile, gain 1 Energy at the start of your turn.',
    type: 'colorless',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    discardEnergy: 1,
    effects: [],
    upgrade: {
      description: 'If this is in your discard pile, gain 2 Energy at the start of your turn.',
      discardEnergy: 2,
      effects: [],
    },
  }),
  card({
    id: 'super-potion-card',
    name: 'Super Potion',
    description: 'Gain 10 Block. Heal 7 HP. Exhaust.',
    type: 'colorless',
    kind: 'skill',
    cost: 1,
    rarity: 'uncommon',
    exhaust: true,
    effects: [
      { op: 'block', amount: 10 },
      { op: 'heal', amount: 7 },
    ],
    upgrade: {
      exhaust: true,
      description: 'Gain 15 Block. Heal 7 HP. Exhaust.',
      effects: [
        { op: 'block', amount: 15 },
        { op: 'heal', amount: 7 },
      ],
    },
  }),
  card({
    id: 'guard-spec',
    name: 'Guard Spec.',
    description: 'Gain 6 Block X times.',
    type: 'colorless',
    kind: 'skill',
    cost: 0,
    rarity: 'uncommon',
    xCost: true,
    effects: [{ op: 'blockTimes', amount: 6 }],
    upgrade: {
      xCost: true,
      cost: 0,
      description: 'Gain 6 Block X+1 times.',
      effects: [{ op: 'blockTimes', amount: 6, plus: 1 }],
    },
  }),
  card({
    id: 'full-heal-card',
    name: 'Full Heal',
    description: 'Clear your debuffs. Gain 5 Block. Heal 4 HP. Exhaust.',
    type: 'colorless',
    kind: 'skill',
    cost: 0,
    rarity: 'common',
    exhaust: true,
    effects: [
      { op: 'clearStatuses' },
      { op: 'block', amount: 5 },
      { op: 'heal', amount: 4 },
    ],
    upgrade: {
      exhaust: true,
      description: 'Clear your debuffs. Gain 5 Block. Heal 5 HP. Exhaust.',
      effects: [
        { op: 'clearStatuses' },
        { op: 'block', amount: 5 },
        { op: 'heal', amount: 5 },
      ],
    },
  }),
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(ALL.map((c) => [c.id, c]));

export function getCardDef(id: string): CardDef {
  const def = CARDS[id];
  if (!def) throw new Error(`Unknown card ${id}`);
  return def;
}

export function zeroCostCardDefs(): CardDef[] {
  return ALL.filter((c) => c.cost === 0 && !c.token && !c.xCost);
}

export function classPowerDefs(characterId: CharacterId): CardDef[] {
  return ALL.filter((c) => c.character === characterId && c.kind === 'power' && !c.token);
}

function effectMagnitude(effect: EffectOp): number | undefined {
  if ('amount' in effect && typeof effect.amount === 'number') return effect.amount;
  if ('stacks' in effect && typeof effect.stacks === 'number') return effect.stacks;
  return undefined;
}

export function rewriteDescription(text: string, fromEffects: EffectOp[], toEffects: EffectOp[]): string {
  let result = '';
  let remaining = text;
  fromEffects.forEach((before, i) => {
    const from = effectMagnitude(before);
    const to = effectMagnitude(toEffects[i] ?? before);
    if (from == null || to == null) return;
    const match = remaining.match(new RegExp(`\\b${from}\\b`));
    if (!match || match.index == null) return;
    result += remaining.slice(0, match.index) + String(to);
    remaining = remaining.slice(match.index + String(from).length);
  });
  return result + remaining;
}

export function resolveCard(inst: CardInstance): CardDef {
  const base = getCardDef(inst.defId);
  const overlay = inst.upgraded
    ? base.upgrade
      ? {
          ...base,
          ...base.upgrade,
          name: `${base.name}+`,
          upgrade: undefined,
        }
      : genericUpgrade(base)
    : base;
  if (inst.costOverride != null) {
    return { ...overlay, cost: inst.costOverride, xCost: false };
  }
  return overlay;
}

function genericUpgrade(base: CardDef): CardDef {
  const bump = (e: EffectOp): EffectOp => {
    if (e.op === 'damage') return { ...e, amount: e.amount + 3 };
    if (e.op === 'damageIfStatus') return { ...e, amount: e.amount + 3 };
    if (e.op === 'block') return { ...e, amount: e.amount + 3 };
    if (e.op === 'heal') return { ...e, amount: e.amount + 3 };
    if (e.op === 'status') return { ...e, stacks: e.stacks + 1 };
    if (e.op === 'strength' || e.op === 'dexterity') return { ...e, amount: e.amount + 1 };
    if (e.op === 'addCharge' || e.op === 'addSeed' || e.op === 'addPetal') return { ...e, amount: e.amount + 1 };
    if (e.op === 'draw') return { ...e, amount: e.amount + 1 };
    if (e.op === 'applyPower') return { ...e, stacks: (e.stacks ?? 1) + 1 };
    if (e.op === 'focus') return { ...e, amount: e.amount + 1 };
    if (e.op === 'reflect') return { ...e, percent: Math.min(100, e.percent + 25) };
    return e;
  };
  const effects = base.effects.map(bump);
  return {
    ...base,
    name: `${base.name}+`,
    cost: base.cost >= 2 ? base.cost - 1 : base.cost,
    effects,
    description: rewriteDescription(base.description, base.effects, effects),
  };
}

export function cardsForCharacter(characterId: CharacterId, rarity?: CardDef['rarity']): CardDef[] {
  if (rarity === 'starter') return [];
  return ALL.filter((c) => {
    if (c.token) return false;
    if (c.character && c.character !== characterId) return false;
    if (c.rarity === 'starter') return false;
    if (rarity && c.rarity !== rarity) return false;
    return true;
  });
}

export function colorlessCards(rarity?: CardDef['rarity']): CardDef[] {
  if (rarity === 'starter') return [];
  return ALL.filter((c) => !c.character && c.rarity !== 'starter' && (!rarity || c.rarity === rarity));
}

export function cardNeedsTarget(def: CardDef): boolean {
  return def.target === 'enemy';
}
