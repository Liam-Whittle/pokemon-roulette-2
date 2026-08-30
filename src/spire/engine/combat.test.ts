import { describe, expect, it } from 'vitest';
import { classPowerDefs, resolveCard } from '../data/cards';
import { getEnemyDef } from '../data/enemies';
import {
  applyPotion,
  canPlayCard,
  chargePotency,
  closePlayerTurn,
  combatOutcome,
  confirmChoiceBand,
  createCombat,
  displayedIntentAmount,
  endTurn,
  incomingAttackDamage,
  liveCardDescription,
  pickFreePlay,
  pickZeroCostCard,
  playCard,
  discardFromHand,
  previewEnemyActions,
  resolveEnemyTurn,
  toggleChoiceBandCard,
} from './combat';
import { mulberry32 } from './rng';
import { pickupGoldFor } from '../data/relics';
import type { CardInstance } from '../types';

function deck(ids: string[]): CardInstance[] {
  return ids.map((defId, i) => ({ instanceId: `t${i}`, defId, upgraded: false }));
}

function start(cardIds: string[], enemyId: string, relics: string[] = [], seed = 7) {
  const rng = mulberry32(seed);
  const state = createCombat({
    hp: 72,
    maxHp: 72,
    deck: deck(cardIds),
    relics,
    potions: [null, null, null],
    enemyDefs: [getEnemyDef(enemyId)],
    playerTypes: ['fire'],
    rng,
  });
  return { state, rng };
}

function seat(state: ReturnType<typeof start>['state'], ...defIds: string[]) {
  const pool = [...state.hand, ...state.drawPile, ...state.discardPile];
  const hand: CardInstance[] = [];
  for (const id of defIds) {
    const i = pool.findIndex((c) => c.defId === id);
    if (i >= 0) hand.push(pool.splice(i, 1)[0]!);
  }
  state.hand = hand;
  state.drawPile = pool;
  state.discardPile = [];
  return state;
}

describe('spire combat', () => {
  it('ember applies burn then deals 4 damage', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'protect-blaze', 'protect-blaze'],
      'pidgey',
    );
    const ember = state.hand.find((c) => c.defId === 'ember');
    expect(ember).toBeTruthy();
    state = playCard(state, ember!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.burn).toBe(1);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('pidgey').hp - 4);
    expect(state.energy).toBe(2);
  });

  it('block absorbs incoming attack damage', () => {
    let { state, rng } = start(
      [
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
      ],
      'pidgey',
      [],
      3,
    );
    const hpBefore = state.playerHp;
    for (const card of [...state.hand]) {
      if (state.energy >= 1) state = playCard(state, card.instanceId, undefined, rng);
    }
    expect(state.playerBlock).toBeGreaterThan(0);
    const block = state.playerBlock;
    state = endTurn(state, rng);
    const incoming = getEnemyDef('pidgey').intents[0]!.amount;
    expect(hpBefore - state.playerHp).toBe(Math.max(0, incoming - block));
  });

  it('exhaust cards go to the exhaust pile', () => {
    let { state, rng } = start(
      ['spark-dash', 'spark-dash', 'spark-dash', 'spark-dash', 'spark-dash', 'ember'],
      'pidgey',
      [],
      11,
    );
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.exhaustPile.some((c) => c.instanceId === dash.instanceId)).toBe(true);
    expect(state.discardPile.some((c) => c.instanceId === dash.instanceId)).toBe(false);
  });

  it('does not apply type chart multipliers', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'paras',
      [],
      5,
    );
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('paras').hp - 4);
    expect(state.log.some((line) => /super effective/i.test(line))).toBe(false);
  });

  it('charcoal adds 2 to fire attacks after burn is applied', () => {
    let { state, rng } = start(
      ['ember', 'scratch', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      ['charcoal'],
      9,
    );
    state = seat(state, 'ember', 'scratch', 'ember', 'ember', 'ember');
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.burn).toBe(1);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('pidgey').hp - 6);

    const scratch = state.hand.find((c) => c.defId === 'scratch')!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, scratch.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 4);
  });

  it('weak reduces outgoing damage', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      13,
    );
    state = { ...state, statuses: { weak: 1 } };
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('pidgey').hp - 3);
    expect(state.enemies[0]!.statuses.burn).toBe(1);
  });

  it('water charges deal damage at end of turn', () => {
    const rng = mulberry32(17);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: deck(['bubble', 'bubble', 'bubble', 'bubble', 'bubble', 'withdraw']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    const bubbles = state.hand.filter((c) => c.defId === 'bubble');
    for (const b of bubbles) {
      state = playCard(state, b.instanceId, undefined, rng);
    }
    expect(state.waterCharges.attack).toBeGreaterThan(0);
    expect(state.waterCharges.attack).toBeLessThanOrEqual(3);
    const hpBefore = state.enemies[0]!.hp;
    state = endTurn(state, rng);
    expect(state.enemies[0]!.hp).toBeLessThan(hpBefore);
  });

  it('caps charges at 3 slots until Reservoir is played', () => {
    const rng = mulberry32(19);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: deck(['bubble', 'bubble', 'bubble', 'bubble', 'bubble', 'reservoir']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    const bubbles = [
      ...state.hand.filter((c) => c.defId === 'bubble'),
      ...state.drawPile.filter((c) => c.defId === 'bubble'),
    ];
    state = {
      ...state,
      energy: 10,
      hand: [
        state.hand.find((c) => c.defId === 'reservoir')
          ?? state.drawPile.find((c) => c.defId === 'reservoir')!,
        ...bubbles.slice(0, 5),
      ],
    };
    for (const b of state.hand.filter((c) => c.defId === 'bubble').slice(0, 4)) {
      state = playCard(state, b.instanceId, undefined, rng);
    }
    expect(state.waterCharges.attack).toBe(3);
    const reservoir = state.hand.find((c) => c.defId === 'reservoir')!;
    state = playCard(state, reservoir.instanceId, undefined, rng);
    expect(state.powers.reservoir).toBe(2);
    const leftover = state.hand.find((c) => c.defId === 'bubble');
    expect(leftover).toBeTruthy();
    state = playCard(state, leftover!.instanceId, undefined, rng);
    expect(state.waterCharges.attack).toBe(4);
  });

  it('reports win when all enemies are down', () => {
    let { state, rng } = start(
      ['blast-burn', 'blast-burn', 'blast-burn', 'blast-burn', 'blast-burn'],
      'pidgey',
      [],
      21,
    );
    const card = state.hand.find((c) => c.defId === 'blast-burn')!;
    state.enemies[0]!.hp = 24;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(combatOutcome(state)).toBe('win');
  });

  it('end turn does not finish the fight while enemies are alive', () => {
    let { state, rng } = start(
      [
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
      ],
      'pidgey',
      [],
      3,
    );
    state = endTurn(state, rng);
    expect(combatOutcome(state)).toBe('ongoing');
    expect(state.playerHp).toBeGreaterThan(0);
    expect(state.enemies.some((e) => e.hp > 0)).toBe(true);
    expect(state.hand.length).toBeGreaterThan(0);
  });

  it('does not treat an empty enemy list as a win', () => {
    const { state } = start(['ember', 'ember', 'ember', 'ember', 'ember'], 'pidgey');
    const emptied = { ...state, enemies: [] };
    expect(combatOutcome(emptied)).toBe('ongoing');
  });

  it('previewEnemyActions reports incoming damage after block', () => {
    let { state, rng } = start(
      [
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
      ],
      'pidgey',
      [],
      3,
    );
    for (const card of [...state.hand]) {
      if (state.energy >= 1) state = playCard(state, card.instanceId, undefined, rng);
    }
    const preview = previewEnemyActions(state);
    expect(preview).toHaveLength(1);
    expect(preview[0]!.kind).toBe('attack');
    const incoming = preview[0]!.playerDamage + preview[0]!.blocked;
    expect(incoming).toBeGreaterThan(0);
    expect(preview[0]!.blocked).toBe(Math.min(state.playerBlock, incoming));
  });

  it('toxic deals current stacks then ticks down by 1', () => {
    let { state, rng } = start(
      [
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
      ],
      'pidgey',
      [],
      3,
    );
    const enemy = state.enemies[0]!;
    enemy.statuses = { toxic: 4 };
    const hpBefore = enemy.hp;
    state = endTurn(state, rng);
    expect(state.enemies[0]!.hp).toBe(hpBefore - 4);
    expect(state.enemies[0]!.statuses.toxic).toBe(3);
  });

  it('toxic hits HP through Block before the enemy acts', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      3,
    );
    const enemy = state.enemies[0]!;
    enemy.block = 20;
    enemy.statuses = { toxic: 4 };
    const hpBefore = enemy.hp;
    const playerHp = state.playerHp;
    state = closePlayerTurn(state, rng);
    expect(state.enemies[0]!.hp).toBe(hpBefore - 4);
    expect(state.enemies[0]!.block).toBe(20);
    expect(state.enemies[0]!.statuses.toxic).toBe(3);
    expect(state.playerHp).toBe(playerHp);
    state = resolveEnemyTurn(state, rng);
    expect(state.playerHp).toBeLessThan(playerHp);
    expect(state.enemies[0]!.block).toBe(20);
  });

  it('lethal toxic knocks out the enemy before they attack', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      3,
    );
    const enemy = state.enemies[0]!;
    enemy.hp = 3;
    enemy.block = 99;
    enemy.statuses = { toxic: 4 };
    const playerHp = state.playerHp;
    state = endTurn(state, rng);
    expect(state.enemies[0]!.hp).toBe(0);
    expect(state.playerHp).toBe(playerHp);
    expect(combatOutcome(state)).toBe('win');
  });

  it('weak on an enemy reduces its shown and dealt attack', () => {
    const { state } = start(
      ['growl', 'growl', 'growl', 'growl', 'growl', 'growl'],
      'pidgey',
      [],
      3,
    );
    const enemy = state.enemies[0]!;
    const raw = incomingAttackDamage(state, enemy);
    expect(displayedIntentAmount(state, enemy)).toBe(raw);
    enemy.statuses = { weak: 1 };
    const weakened = incomingAttackDamage(state, enemy);
    expect(weakened).toBe(Math.floor(raw * 0.75));
    expect(displayedIntentAmount(state, enemy)).toBe(weakened);
    expect(weakened).toBeLessThan(raw);
  });

  it('live card text includes strength and dexterity', () => {
    const { state } = start(
      ['ember', 'protect-blaze', 'ember', 'ember', 'ember', 'protect-blaze'],
      'pidgey',
      [],
      4,
    );
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    const protect = state.hand.find((c) => c.defId === 'protect-blaze')!;
    const foe = state.enemies[0];
    expect(liveCardDescription(ember, state, foe)).toBe('Apply 1 Burn. Deal 4 damage.');
    expect(liveCardDescription(protect, state, foe)).toBe('Gain 5 Block.');
    const buffed = { ...state, strength: 2, dexterity: 3 };
    expect(liveCardDescription(ember, buffed, foe)).toBe('Apply 1 Burn. Deal 6 damage.');
    expect(liveCardDescription(protect, buffed, foe)).toBe('Gain 8 Block.');
  });

  it('upgraded X Attack grants Strength and Dexterity', () => {
    const def = resolveCard({ instanceId: 'x+', defId: 'x-attack-card', upgraded: true });
    expect(def.name).toBe('X Attack+');
    expect(def.kind).toBe('power');
    expect(def.description).toBe('Gain 1 Strength and 1 Dexterity.');

    let { state, rng } = start(
      ['x-attack-card', 'x-attack-card', 'x-attack-card', 'x-attack-card', 'x-attack-card', 'ember'],
      'pidgey',
      [],
      4,
    );
    const card = state.hand.find((c) => c.defId === 'x-attack-card')!;
    card.upgraded = true;
    state = playCard(state, card.instanceId, undefined, rng);
    expect(state.strength).toBe(1);
    expect(state.dexterity).toBe(1);
    expect(state.exhaustPile.some((c) => c.instanceId === card.instanceId)).toBe(true);
  });

  it('strength powers exhaust and cannot be cycled', () => {
    let { state, rng } = start(
      ['heat-up', 'heat-up', 'heat-up', 'heat-up', 'heat-up', 'ember'],
      'pidgey',
      [],
      4,
    );
    const card = state.hand.find((c) => c.defId === 'heat-up')!;
    state = playCard(state, card.instanceId, undefined, rng);
    expect(state.strength).toBe(2);
    expect(state.exhaustPile.some((c) => c.instanceId === card.instanceId)).toBe(true);
    expect(state.discardPile.some((c) => c.instanceId === card.instanceId)).toBe(false);
  });

  it('frail lets half of an attack ignore Block', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      9,
    );
    const enemy = state.enemies[0]!;
    enemy.block = 20;
    enemy.statuses = { frail: 1 };
    const hpBefore = enemy.hp;
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, enemy.id, rng);
    expect(state.enemies[0]!.hp).toBe(hpBefore - 2);
    expect(state.enemies[0]!.block).toBe(18);
  });

  it('curl-up grants block after the first unblocked hit', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'kakuna',
      [],
      9,
    );
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('kakuna').hp - 4);
    expect(state.enemies[0]!.block).toBe(8);
    expect(state.enemies[0]!.curlUpUsed).toBe(true);
  });

  it('explode-on-death damages the player', () => {
    let { state, rng } = start(
      ['blast-burn', 'blast-burn', 'blast-burn', 'blast-burn', 'blast-burn'],
      'voltorb',
      [],
      21,
    );
    const hpBefore = state.playerHp;
    const card = state.hand.find((c) => c.defId === 'blast-burn')!;
    state.enemies[0]!.hp = 22;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(0);
    expect(state.playerHp).toBe(hpBefore + 8 - 12);
  });

  it('split-on-death spawns smaller foes', () => {
    let { state, rng } = start(
      ['blast-burn', 'blast-burn', 'blast-burn', 'blast-burn', 'blast-burn', 'ember'],
      'magneton',
      [],
      21,
    );
    state.enemies[0]!.hp = 4;
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(0);
    const living = state.enemies.filter((e) => e.hp > 0);
    expect(living).toHaveLength(2);
    expect(living.every((e) => e.defId === 'magnemite')).toBe(true);
  });

  it('enrage-on-skill gains strength when a skill is played', () => {
    let { state, rng } = start(
      ['protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze'],
      'clefairy',
      [],
      3,
    );
    const skill = state.hand.find((c) => c.defId === 'protect-blaze')!;
    state = playCard(state, skill.instanceId, undefined, rng);
    expect(state.enemies[0]!.strength).toBe(2);
  });

  it('multi-attack hits several times through block', () => {
    const { state } = start(
      ['protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze'],
      'doduo',
      [],
      3,
    );
    expect(state.enemies[0]!.intent.kind).toBe('multiAttack');
    expect(displayedIntentAmount(state, state.enemies[0]!)).toBe(4);
    const preview = previewEnemyActions(state);
    expect(preview[0]!.playerDamage).toBe(12);
  });

  it('summon intent brings in an add', () => {
    let { state, rng } = start(
      ['protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze'],
      'alakazam',
      [],
      3,
    );
    expect(state.enemies[0]!.intent.kind).toBe('summon');
    state = endTurn(state, rng);
    expect(state.enemies.some((e) => e.defId === 'abra' && e.hp > 0)).toBe(true);
  });

  it('geodude starts combat with block', () => {
    const { state } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'geodude',
    );
    expect(state.enemies[0]!.block).toBe(8);
  });

  it('weak, frail, and vulnerable tick down at the end of the owner turn', () => {
    let { state, rng } = start(
      [
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
        'protect-blaze',
      ],
      'pidgey',
      [],
      3,
    );
    state = { ...state, statuses: { weak: 2, frail: 1, vulnerable: 2 } };
    state.enemies[0]!.statuses = { weak: 1, frail: 2 };
    state = endTurn(state, rng);
    expect(state.statuses.weak).toBe(1);
    expect(state.statuses.frail).toBeUndefined();
    expect(state.statuses.vulnerable).toBe(1);
    expect(state.enemies[0]!.statuses.weak).toBeUndefined();
    expect(state.enemies[0]!.statuses.frail).toBe(1);
  });

  it('missing enemy block does not NaN-kill the enemy', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      9,
    );
    state.enemies[0]!.block = undefined as unknown as number;
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(Number.isFinite(state.enemies[0]!.hp)).toBe(true);
    expect(combatOutcome(state)).toBe('ongoing');
  });

  it('scratch applies vulnerable and its upgrade raises both numbers', () => {
    const plus = resolveCard({ instanceId: 's+', defId: 'scratch', upgraded: true });
    expect(plus.effects).toEqual([
      { op: 'damage', amount: 6 },
      { op: 'status', status: 'vulnerable', stacks: 2 },
    ]);

    let { state, rng } = start(
      ['scratch', 'scratch', 'scratch', 'scratch', 'scratch', 'scratch'],
      'pidgey',
      [],
      4,
    );
    const card = state.hand.find((c) => c.defId === 'scratch')!;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('pidgey').hp - 4);
    expect(state.enemies[0]!.statuses.vulnerable).toBe(1);
  });

  it('fire spin shreds half of the target block', () => {
    let { state, rng } = start(
      ['fire-spin', 'fire-spin', 'fire-spin', 'fire-spin', 'fire-spin', 'fire-spin'],
      'geodude',
      [],
      4,
    );
    const card = state.hand.find((c) => c.defId === 'fire-spin')!;
    expect(state.enemies[0]!.block).toBe(8);
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.block).toBe(4);
    expect(state.enemies[0]!.statuses.burn).toBe(8);
  });

  it('spark dash marks a random hand card free this turn', () => {
    let { state, rng } = start(
      ['spark-dash', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      11,
    );
    state = seat(state, 'spark-dash', 'ember', 'ember', 'ember', 'ember');
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    const before = state.hand.filter((c) => c.instanceId !== dash.instanceId).map((c) => c.instanceId);
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.exhaustPile.some((c) => c.instanceId === dash.instanceId)).toBe(true);
    expect(state.freePlayIds).toHaveLength(1);
    expect(before).toContain(state.freePlayIds[0]);
  });

  it('upgraded spark dash lets you choose a free card', () => {
    let { state, rng } = start(
      ['spark-dash', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      11,
    );
    state = seat(state, 'spark-dash', 'ember', 'ember', 'ember', 'ember');
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    dash.upgraded = true;
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.pendingFreePick).toBe(1);
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = pickFreePlay(state, ember.instanceId);
    expect(state.pendingFreePick).toBe(0);
    expect(state.freePlayIds).toContain(ember.instanceId);
    const energy = state.energy;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.energy).toBe(energy);
  });

  it('smoke screen cuts damage from vulnerable enemies this round then fades', () => {
    let { state, rng } = start(
      ['smoke-screen', 'smoke-screen', 'smoke-screen', 'smoke-screen', 'smoke-screen', 'smoke-screen'],
      'pidgey',
      [],
      3,
    );
    state.enemies[0]!.statuses = { vulnerable: 1 };
    const raw = incomingAttackDamage(state, state.enemies[0]!);
    const card = state.hand.find((c) => c.defId === 'smoke-screen')!;
    state = playCard(state, card.instanceId, undefined, rng);
    expect(incomingAttackDamage(state, state.enemies[0]!)).toBe(Math.floor(raw * 0.7));
    state.playerBlock = 0;
    const hpBefore = state.playerHp;
    state = endTurn(state, rng);
    expect(hpBefore - state.playerHp).toBe(Math.floor(raw * 0.7));
    expect(state.smokeScreen).toBe(0);
  });

  it('growl+ grants strength only until the end of your turn', () => {
    let { state, rng } = start(
      ['growl', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    const growl = state.hand.find((c) => c.defId === 'growl')!;
    growl.upgraded = true;
    state = playCard(state, growl.instanceId, state.enemies[0]!.id, rng);
    expect(state.tempStrength).toBe(1);
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, ember.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 5);
    state = endTurn(state, rng);
    expect(state.tempStrength).toBe(0);
  });

  it('combust grants dexterity and damages all enemies on exhaust', () => {
    let { state, rng } = start(
      ['combust-power', 'spark-dash', 'spark-dash', 'spark-dash', 'spark-dash', 'ember'],
      'pidgey',
      [],
      11,
    );
    state = seat(state, 'combust-power', 'spark-dash', 'ember', 'ember', 'ember');
    const combust = state.hand.find((c) => c.defId === 'combust-power')!;
    state = playCard(state, combust.instanceId, undefined, rng);
    expect(state.powers.combust).toBe(2);
    expect(state.dexterity).toBe(1);
    const hpAfterSelf = state.enemies[0]!.hp;
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.dexterity).toBe(2);
    expect(state.enemies[0]!.hp).toBe(hpAfterSelf - 7 - 2);
  });

  it('drought moves exhausted cards to discard while combust still triggers', () => {
    let { state, rng } = start(
      ['drought', 'combust-power', 'spark-dash', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      11,
    );
    state = seat(state, 'drought', 'combust-power', 'spark-dash', 'ember', 'ember');
    state.energy = 10;
    const drought = state.hand.find((c) => c.defId === 'drought')!;
    state.energy = 10;
    state = playCard(state, drought.instanceId, undefined, rng);
    expect(state.powers.droughtDiscard).toBe(1);
    expect(state.exhaustPile.some((c) => c.instanceId === drought.instanceId)).toBe(false);
    expect(state.discardPile.some((c) => c.instanceId === drought.instanceId)).toBe(true);

    const combust = state.hand.find((c) => c.defId === 'combust-power')!;
    state = playCard(state, combust.instanceId, undefined, rng);
    const hp = state.enemies[0]!.hp;
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.exhaustPile.some((c) => c.instanceId === dash.instanceId)).toBe(false);
    expect(state.discardPile.some((c) => c.instanceId === dash.instanceId)).toBe(true);
    expect(state.enemies[0]!.hp).toBe(hp - 7 - 2);
  });

  it('upgraded drought shuffles exhausted cards into the draw pile', () => {
    let { state, rng } = start(
      ['drought', 'spark-dash', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      11,
    );
    state = seat(state, 'drought', 'spark-dash', 'ember', 'ember', 'ember');
    const drought = state.hand.find((c) => c.defId === 'drought')!;
    drought.upgraded = true;
    expect(resolveCard(drought).cost).toBe(2);
    state = playCard(state, drought.instanceId, undefined, rng);
    expect(state.powers.droughtDraw).toBe(1);
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.exhaustPile.some((c) => c.instanceId === dash.instanceId)).toBe(false);
    expect(state.drawPile.some((c) => c.instanceId === dash.instanceId)).toBe(true);
  });

  it('flame charge gains block equal to damage dealt', () => {
    let { state, rng } = start(
      ['flame-charge', 'flame-charge', 'flame-charge', 'flame-charge', 'flame-charge', 'ember'],
      'pidgey',
      [],
      4,
    );
    const card = state.hand.find((c) => c.defId === 'flame-charge')!;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(getEnemyDef('pidgey').hp - 6);
    expect(state.playerBlock).toBe(6);
  });

  it('blast burn+ raises max HP permanently in combat', () => {
    let { state, rng } = start(
      ['blast-burn', 'blast-burn', 'blast-burn', 'blast-burn', 'blast-burn'],
      'pidgey',
      [],
      21,
    );
    const card = state.hand.find((c) => c.defId === 'blast-burn')!;
    card.upgraded = true;
    const max = state.playerMaxHp;
    const hp = state.playerHp;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.playerMaxHp).toBe(max + 5);
    expect(state.playerHp).toBe(hp + 5);
  });

  it('flare blitz multiplies burn if any enemy is burning', () => {
    let { state, rng } = start(
      ['flare-blitz', 'will-o-wisp', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    const wisp = state.hand.find((c) => c.defId === 'will-o-wisp')!;
    state = playCard(state, wisp.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.burn).toBe(5);
    const blitz = state.hand.find((c) => c.defId === 'flare-blitz')!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, blitz.instanceId, undefined, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 3);
    expect(state.enemies[0]!.statuses.burn).toBe(10);
  });

  it('flamethrower+ and flame wall+ lose exhaust', () => {
    const thrower = resolveCard({ instanceId: 'ft+', defId: 'flamethrower', upgraded: true });
    expect(thrower.exhaust).toBe(false);
    expect(thrower.cost).toBe(3);
    const wall = resolveCard({ instanceId: 'fw+', defId: 'flame-wall', upgraded: true });
    expect(wall.exhaust).toBe(false);

    let { state, rng } = start(
      ['flamethrower', 'flame-wall', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    const ft = state.hand.find((c) => c.defId === 'flamethrower')!;
    ft.upgraded = true;
    state = playCard(state, ft.instanceId, state.enemies[0]!.id, rng);
    expect(state.exhaustPile.some((c) => c.instanceId === ft.instanceId)).toBe(false);
    expect(state.discardPile.some((c) => c.instanceId === ft.instanceId)).toBe(true);
  });

  it('fire fang+ keeps cost 2', () => {
    const def = resolveCard({ instanceId: 'ff+', defId: 'fire-fang', upgraded: true });
    expect(def.cost).toBe(2);
    expect(def.effects).toEqual([
      { op: 'damage', amount: 10 },
      { op: 'status', status: 'weak', stacks: 2 },
      { op: 'status', status: 'vulnerable', stacks: 2 },
    ]);
  });

  it('swords dance grants strength at the start of later turns', () => {
    let { state, rng } = start(
      ['swords-dance', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    const dance = state.hand.find((c) => c.defId === 'swords-dance')!;
    state = playCard(state, dance.instanceId, undefined, rng);
    expect(state.strength).toBe(0);
    expect(state.powers['swords-dance']).toBe(2);
    state = endTurn(state, rng);
    expect(state.strength).toBe(2);
  });

  it('ember+ applies 2 burn then deals 5', () => {
    const def = resolveCard({ instanceId: 'e+', defId: 'ember', upgraded: true });
    expect(def.effects).toEqual([
      { op: 'status', status: 'burn', stacks: 2 },
      { op: 'damage', amount: 5 },
    ]);
  });

  it('tide leftover upgrades stay explicit', () => {
    const rain = resolveCard({ instanceId: 'rd+', defId: 'rain-dance', upgraded: true });
    expect(rain.description).toBe('Gain 5 Block. Add 2 Block Charges.');
    expect(rain.effects).toEqual([
      { op: 'block', amount: 5 },
      { op: 'addCharge', amount: 2, kind: 'block' },
    ]);

    const ring = resolveCard({ instanceId: 'ar+', defId: 'aqua-ring', upgraded: true });
    expect(ring.description).toBe('At the start of your turn, heal 4 HP.');
    expect(ring.effects).toEqual([{ op: 'applyPower', power: 'aqua-ring', stacks: 4 }]);

    const drizzle = resolveCard({ instanceId: 'dz+', defId: 'rain-lord', upgraded: true });
    expect(drizzle.cost).toBe(2);
    expect(drizzle.description).toBe('Charges trigger twice at the end of your turn.');
    expect(drizzle.effects).toEqual([{ op: 'applyPower', power: 'rain-lord', stacks: 1 }]);

    const bubble = resolveCard({ instanceId: 'bb+', defId: 'bubble', upgraded: true });
    expect(bubble.cost).toBe(0);
    expect(bubble.effects).toEqual([{ op: 'addCharge', amount: 1, kind: 'attack' }]);
    expect(resolveCard({ instanceId: 'bb', defId: 'bubble', upgraded: false }).cost).toBe(1);
  });

  it('blaze kick still uses the generic upgrade bump', () => {
    const def = resolveCard({ instanceId: 'bk+', defId: 'blaze-kick', upgraded: true });
    expect(def.effects[0]).toMatchObject({ op: 'damage', amount: 12 });
    expect(def.effects[1]).toMatchObject({ op: 'damageIfStatus', amount: 9 });
  });

  it('fire lash applies vulnerable and exhausts', () => {
    const plus = resolveCard({ instanceId: 'fl+', defId: 'fire-lash', upgraded: true });
    expect(plus.effects).toEqual([{ op: 'status', status: 'vulnerable', stacks: 4 }]);
    expect(plus.exhaust).toBe(true);

    let { state, rng } = start(
      ['fire-lash', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    state = seat(state, 'fire-lash', 'ember', 'ember', 'ember', 'ember');
    const card = state.hand.find((c) => c.defId === 'fire-lash')!;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.vulnerable).toBe(3);
    expect(state.exhaustPile.some((c) => c.instanceId === card.instanceId)).toBe(true);
  });

  it('temper flare doubles the target enemy vulnerable after dealing damage', () => {
    let { state, rng } = start(
      ['temper-flare', 'scratch', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    state = seat(state, 'temper-flare', 'scratch', 'ember', 'ember', 'ember');
    const scratch = state.hand.find((c) => c.defId === 'scratch')!;
    state = playCard(state, scratch.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.vulnerable).toBe(1);
    const flare = state.hand.find((c) => c.defId === 'temper-flare')!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, flare.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 15);
    expect(state.enemies[0]!.statuses.vulnerable).toBe(2);
  });

  it('temper flare+ triples the target enemy vulnerable', () => {
    const def = resolveCard({ instanceId: 'tf+', defId: 'temper-flare', upgraded: true });
    expect(def.effects).toEqual([
      { op: 'damage', amount: 10 },
      { op: 'multiplyStatus', status: 'vulnerable', factor: 3 },
    ]);

    let { state, rng } = start(
      ['temper-flare', 'fire-lash', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    state = seat(state, 'temper-flare', 'fire-lash', 'ember', 'ember', 'ember');
    const lash = state.hand.find((c) => c.defId === 'fire-lash')!;
    state = playCard(state, lash.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.vulnerable).toBe(3);
    const flare = state.hand.find((c) => c.defId === 'temper-flare')!;
    flare.upgraded = true;
    state = playCard(state, flare.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.vulnerable).toBe(9);
  });

  it('evokes the rightmost charge when slots are full', () => {
    const rng = mulberry32(31);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: deck(['bubble', 'bubble', 'bubble', 'bubble', 'withdraw', 'withdraw']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    state = {
      ...state,
      energy: 10,
      hand: [...state.hand, ...state.drawPile].filter((c) => c.defId === 'bubble').slice(0, 4),
      drawPile: [],
    };
    for (const b of state.hand.slice(0, 3)) {
      state = playCard(state, b.instanceId, undefined, rng);
    }
    expect(state.chargeQueue).toEqual(['attack', 'attack', 'attack']);
    const hpBefore = state.enemies[0]!.hp;
    const last = state.hand.find((c) => c.defId === 'bubble')!;
    state = playCard(state, last.instanceId, undefined, rng);
    expect(state.chargeQueue).toEqual(['attack', 'attack', 'attack']);
    expect(state.enemies[0]!.hp).toBe(hpBefore - 4);
    expect(state.log.some((line) => line.includes('Evoked Attack Charge'))).toBe(true);
  });

  it('focus raises charge potency until the combat ends', () => {
    const rng = mulberry32(33);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: deck(['hydro-pump', 'bubble', 'bubble', 'withdraw', 'withdraw', 'withdraw']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    state = seat(state, 'hydro-pump', 'bubble');
    state.energy = 3;
    const pump = state.hand.find((c) => c.defId === 'hydro-pump')!;
    state = playCard(state, pump.instanceId, undefined, rng);
    expect(state.powers.focus).toBe(2);
    expect(chargePotency(state)).toBe(6);
    const bubble = state.hand.find((c) => c.defId === 'bubble')!;
    state = playCard(state, bubble.instanceId, undefined, rng);
    const hpBefore = state.enemies[0]!.hp;
    state = endTurn(state, rng);
    expect(state.enemies[0]!.hp).toBe(hpBefore - 6);
  });

  it('aqua jet scales all aqua jets this combat', () => {
    let { state, rng } = start(
      ['aqua-jet', 'aqua-jet', 'withdraw', 'withdraw', 'withdraw'],
      'pidgey',
      [],
      35,
    );
    state = seat(state, 'aqua-jet', 'aqua-jet');
    const first = state.hand[0]!;
    const second = state.hand[1]!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, first.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 3);
    state = playCard(state, second.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 3 - 5);
  });

  it('hydro cannon repeats if the hit is unblocked', () => {
    let { state, rng } = start(
      ['hydro-cannon', 'withdraw', 'withdraw', 'withdraw', 'withdraw'],
      'beedrill',
      [],
      37,
    );
    state = seat(state, 'hydro-cannon');
    state.energy = 3;
    const hp = state.enemies[0]!.hp;
    const card = state.hand[0]!;
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 60);
    expect(state.exhaustPile.some((c) => c.defId === 'hydro-cannon')).toBe(true);
  });

  it('upgraded hydro cannon does not exhaust', () => {
    const rng = mulberry32(39);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: [{ instanceId: 'hc+', defId: 'hydro-cannon', upgraded: true }, ...deck(['withdraw', 'withdraw', 'withdraw', 'withdraw'])],
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('beedrill')],
      playerTypes: ['water'],
      rng,
    });
    state = seat(state, 'hydro-cannon');
    state.energy = 3;
    const card = state.hand[0]!;
    expect(card.upgraded).toBe(true);
    state = playCard(state, card.instanceId, state.enemies[0]!.id, rng);
    expect(state.exhaustPile.some((c) => c.defId === 'hydro-cannon')).toBe(false);
    expect(state.discardPile.some((c) => c.defId === 'hydro-cannon')).toBe(true);
  });

  it('whirlpool plus strips block then hits everyone', () => {
    const rng = mulberry32(41);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: [{ instanceId: 'wp+', defId: 'whirlpool', upgraded: true }, ...deck(['withdraw', 'withdraw', 'withdraw', 'withdraw'])],
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey'), getEnemyDef('rattata')],
      playerTypes: ['water'],
      rng,
    });
    state = seat(state, 'whirlpool');
    state.energy = 3;
    state.enemies[0]!.block = 9;
    state.enemies[1]!.block = 4;
    const hp0 = state.enemies[0]!.hp;
    const hp1 = state.enemies[1]!.hp;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.enemies[0]!.block).toBe(0);
    expect(state.enemies[1]!.block).toBe(0);
    expect(state.enemies[0]!.hp).toBe(hp0 - 10);
    expect(state.enemies[1]!.hp).toBe(hp1 - 10);
    expect(state.enemies[0]!.statuses.weak).toBe(2);
  });

  it('brine plus offers a 0-cost card from any class', () => {
    const rng = mulberry32(43);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: [{ instanceId: 'br+', defId: 'brine', upgraded: true }, ...deck(['withdraw', 'withdraw', 'withdraw', 'withdraw'])],
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    state = seat(state, 'brine');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, state.enemies[0]!.id, rng);
    expect(state.pendingZeroCostOffer.length).toBeGreaterThan(3);
    expect(state.pendingZeroCostOffer.some((c) => c.defId === 'scratch')).toBe(true);
    expect(state.pendingZeroCostOffer.some((c) => c.defId === 'aqua-jet')).toBe(true);
    const pick = state.pendingZeroCostOffer.find((c) => c.defId === 'scratch')!;
    state = pickZeroCostCard(state, pick.instanceId);
    expect(state.hand.some((c) => c.defId === 'scratch')).toBe(true);
    expect(state.pendingZeroCostOffer).toEqual([]);
  });

  it('dive prep plus grants replay to drawn 0-cost cards', () => {
    const rng = mulberry32(45);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: [
        { instanceId: 'dp+', defId: 'surf-prep', upgraded: true },
        { instanceId: 'aj1', defId: 'aqua-jet', upgraded: false },
        { instanceId: 'wg1', defId: 'water-gun', upgraded: false },
        ...deck(['withdraw', 'withdraw']),
      ],
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    state.hand = [state.drawPile.concat(state.hand).find((c) => c.defId === 'surf-prep')!];
    state.drawPile = [
      { instanceId: 'aj1', defId: 'aqua-jet', upgraded: false },
      { instanceId: 'wg1', defId: 'water-gun', upgraded: false },
      { instanceId: 'aj2', defId: 'aqua-jet', upgraded: false },
    ];
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    const drawnZero = state.hand.filter((c) => resolveCard(c).cost === 0);
    expect(drawnZero.length).toBeGreaterThan(0);
    expect(drawnZero.every((c) => (c.replay ?? 0) >= 1)).toBe(true);
  });

  it('torrent focus echoes an attack charge for each block charge', () => {
    const rng = mulberry32(47);
    let state = createCombat({
      hp: 76,
      maxHp: 76,
      deck: deck(['focus-power', 'withdraw', 'withdraw', 'withdraw', 'withdraw', 'withdraw']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['water'],
      rng,
    });
    state = seat(state, 'focus-power');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.powers.torrentEcho).toBe(1);
    expect(state.chargeQueue.filter((k) => k === 'block').length).toBeGreaterThan(0);
    expect(state.chargeQueue.filter((k) => k === 'attack').length).toBeGreaterThan(0);
  });

  it('petals exhaust when played and never appear as rewards', () => {
    const rng = mulberry32(51);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['petal-dance', 'vine-whip', 'synthesis', 'poison-powder', 'leech-seed', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'petal-dance');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    const petals = state.hand.filter((c) => c.defId === 'petal');
    expect(petals).toHaveLength(3);
    const petal = petals[0]!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, petal.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 5);
    expect(state.exhaustPile.some((c) => c.instanceId === petal.instanceId)).toBe(true);
    expect(state.discardPile.some((c) => c.instanceId === petal.instanceId)).toBe(false);
  });

  it('vine whip deals 7 total if the enemy is toxic', () => {
    const rng = mulberry32(53);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['vine-whip', 'poison-powder', 'synthesis', 'synthesis', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'poison-powder', 'vine-whip', 'synthesis');
    state.energy = 3;
    const powder = state.hand.find((c) => c.defId === 'poison-powder')!;
    state = playCard(state, powder.instanceId, state.enemies[0]!.id, rng);
    expect(state.pendingDiscard).toBe(1);
    const synth = state.hand.find((c) => c.defId === 'synthesis')!;
    state = discardFromHand(state, synth.instanceId, rng);
    expect(state.enemies[0]!.statuses.toxic).toBe(3);
    const hp = state.enemies[0]!.hp;
    const whip = state.hand.find((c) => c.defId === 'vine-whip')!;
    state = playCard(state, whip.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 7);
  });

  it('synthesis discarded from hand grants extra block', () => {
    const rng = mulberry32(55);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['poison-powder', 'synthesis', 'vine-whip', 'wrap', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'poison-powder', 'synthesis');
    state.energy = 3;
    state = playCard(state, state.hand.find((c) => c.defId === 'poison-powder')!.instanceId, state.enemies[0]!.id, rng);
    const before = state.playerBlock;
    state = discardFromHand(state, state.hand.find((c) => c.defId === 'synthesis')!.instanceId, rng);
    expect(state.playerBlock).toBe(before + 8);
  });

  it('synthesis leftover at end of turn does not grant discard block', () => {
    const rng = mulberry32(56);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['synthesis', 'vine-whip', 'wrap', 'wrap', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'synthesis');
    state = closePlayerTurn(state, rng);
    expect(state.playerBlock).toBe(0);
  });

  it('razor leaf adds a petal after the discard', () => {
    const rng = mulberry32(57);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['razor-leaf', 'vine-whip', 'synthesis', 'wrap', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'razor-leaf', 'vine-whip');
    state.energy = 3;
    state = playCard(state, state.hand.find((c) => c.defId === 'razor-leaf')!.instanceId, undefined, rng);
    expect(state.playerBlock).toBe(5);
    expect(state.pendingDiscard).toBe(1);
    state = discardFromHand(state, state.hand.find((c) => c.defId === 'vine-whip')!.instanceId, rng);
    expect(state.hand.some((c) => c.defId === 'petal')).toBe(true);
  });

  it('skips the discard prompt when the hand is empty and still applies the rest of the effect', () => {
    const rng = mulberry32(61);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['poison-powder', 'wrap', 'wrap', 'wrap', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'poison-powder');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, state.enemies[0]!.id, rng);
    expect(state.hand).toHaveLength(0);
    expect(state.pendingDiscard).toBe(0);
    expect(state.enemies[0]!.statuses.toxic).toBe(3);
  });

  it('still grants razor leaf petals when there is nothing left to discard', () => {
    const rng = mulberry32(63);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['razor-leaf', 'wrap', 'wrap', 'wrap', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'razor-leaf');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.pendingDiscard).toBe(0);
    expect(state.playerBlock).toBe(5);
    expect(state.hand.some((c) => c.defId === 'petal')).toBe(true);
  });

  it('frenzy plant deals to a random enemy whenever you play a card', () => {
    const rng = mulberry32(59);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['frenzy-plant', 'vine-whip', 'synthesis', 'wrap', 'wrap', 'wrap']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'frenzy-plant', 'vine-whip');
    state.energy = 10;
    state = playCard(state, state.hand.find((c) => c.defId === 'frenzy-plant')!.instanceId, undefined, rng);
    expect(state.powers['frenzy-plant']).toBe(4);
    const hp = state.enemies[0]!.hp;
    state = playCard(state, state.hand.find((c) => c.defId === 'vine-whip')!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 2 - 4);
  });

  it('forest curse adds 5 toxic per 5 already on the enemy', () => {
    const rng = mulberry32(61);
    let state = createCombat({
      hp: 74,
      maxHp: 74,
      deck: deck(['forest-curse', 'wrap', 'synthesis', 'synthesis', 'vine-whip', 'vine-whip']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('beedrill')],
      playerTypes: ['grass'],
      rng,
    });
    state = seat(state, 'wrap', 'forest-curse');
    state.energy = 3;
    state = playCard(state, state.hand.find((c) => c.defId === 'wrap')!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.toxic).toBe(3);
    state = playCard(state, state.hand.find((c) => c.defId === 'forest-curse')!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.statuses.toxic).toBe(8);
  });

  it('potion heals 5 and potion plus also raises max HP', () => {
    let { state, rng } = start(
      ['potion-card', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'potion-card');
    state.playerHp = 40;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.playerHp).toBe(45);
    expect(state.exhaustPile.some((c) => c.defId === 'potion-card')).toBe(true);

    state = start(['potion-card', 'ember', 'ember', 'ember', 'ember', 'ember'], 'pidgey').state;
    const rng2 = mulberry32(8);
    state = seat(state, 'potion-card');
    state.hand[0]!.upgraded = true;
    state.playerHp = 40;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng2);
    expect(state.playerHp).toBe(49);
    expect(state.playerMaxHp).toBe(74);
  });

  it('great ball plus costs 0', () => {
    expect(resolveCard({ instanceId: 'gb', defId: 'great-ball', upgraded: true }).cost).toBe(0);
  });

  it('x defend is a power that grants dexterity', () => {
    let { state, rng } = start(
      ['x-defend-card', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'x-defend-card');
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.dexterity).toBe(2);
    expect(state.exhaustPile.some((c) => c.defId === 'x-defend-card')).toBe(true);

    const plus = resolveCard({ instanceId: 'xd', defId: 'x-defend-card', upgraded: true });
    expect(plus.description).toBe('Gain 5 Block. Gain 2 Dexterity.');
  });

  it('poke flute adds a 0-cost class power', () => {
    const rng = mulberry32(71);
    let state = createCombat({
      hp: 72,
      maxHp: 72,
      deck: deck(['poke-flute', 'ember', 'ember', 'ember', 'ember', 'ember']),
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['fire'],
      rng,
      characterId: 'blaze',
    });
    state = seat(state, 'poke-flute');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    const powerIds = new Set(classPowerDefs('blaze').map((c) => c.id));
    const added = [...state.hand, ...state.discardPile].filter((c) => powerIds.has(c.defId));
    expect(added.length).toBe(1);
    expect(resolveCard(added[0]!).cost).toBe(0);
  });

  it('escape rope flags combat card rewards as upgraded', () => {
    let { state, rng } = start(
      ['escape-rope', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'escape-rope');
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.upgradeCardRewards).toBe(true);
    expect(state.playerBlock).toBe(10);
  });

  it('rare candy plus does not exhaust', () => {
    let { state, rng } = start(
      ['rare-candy-card', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'rare-candy-card');
    state.hand[0]!.upgraded = true;
    state.energy = 0;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.energy).toBe(2);
    expect(state.exhaustPile.some((c) => c.defId === 'rare-candy-card')).toBe(false);
    expect(state.discardPile.some((c) => c.defId === 'rare-candy-card')).toBe(true);
  });

  it('poke doll grants energy from the discard pile', () => {
    let { state, rng } = start(
      ['poke-doll', 'ember', 'ember', 'ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'poke-doll');
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.discardPile.some((c) => c.defId === 'poke-doll')).toBe(true);
    state = endTurn(state, rng);
    expect(state.discardPile.some((c) => c.defId === 'poke-doll')).toBe(true);
    expect(state.energy).toBe(state.energyMax + 1);
  });

  it('poke doll does not grant energy after it shuffles into the draw pile', () => {
    let { state, rng } = start(['poke-doll', 'ember'], 'pidgey');
    state = seat(state, 'poke-doll');
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.discardPile.some((c) => c.defId === 'poke-doll')).toBe(true);
    state = endTurn(state, rng);
    expect(state.discardPile.some((c) => c.defId === 'poke-doll')).toBe(false);
    expect(state.energy).toBe(state.energyMax);
  });

  it('guard spec spends all energy for X block hits', () => {
    let { state, rng } = start(
      ['guard-spec', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'guard-spec');
    state.energy = 3;
    expect(canPlayCard(state, state.hand[0]!.instanceId)).toBe(true);
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.energy).toBe(0);
    expect(state.playerBlock).toBe(18);

    state = start(['guard-spec', 'ember', 'ember', 'ember', 'ember', 'ember'], 'pidgey').state;
    rng = mulberry32(9);
    state = seat(state, 'guard-spec');
    state.hand[0]!.upgraded = true;
    state.energy = 3;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.playerBlock).toBe(24);
  });

  it('full restore heals half max HP and the upgrade heals to full', () => {
    let { state, rng } = start(
      ['full-restore-card', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state = seat(state, 'full-restore-card');
    state.energy = 4;
    state.playerHp = 10;
    state.statuses = { weak: 1 };
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.playerHp).toBe(46);
    expect(state.statuses.weak).toBeUndefined();

    state = start(['full-restore-card', 'ember', 'ember', 'ember', 'ember', 'ember'], 'pidgey').state;
    rng = mulberry32(10);
    state = seat(state, 'full-restore-card');
    state.hand[0]!.upgraded = true;
    state.energy = 5;
    state.playerHp = 10;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.playerMaxHp).toBe(77);
    expect(state.playerHp).toBe(77);
    expect(state.playerBlock).toBe(10);
  });
});

describe('spire relics', () => {
  it('amulet coin grants 150 gold on pickup', () => {
    expect(pickupGoldFor('amulet-coin')).toBe(150);
  });

  it('leftovers heals 3 HP at combat start', () => {
    const rng = mulberry32(7);
    const state = createCombat({
      hp: 50,
      maxHp: 72,
      deck: deck(['ember', 'ember', 'ember', 'ember', 'ember', 'ember']),
      relics: ['leftovers'],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['fire'],
      rng,
    });
    expect(state.playerHp).toBe(53);
  });

  it('black belt grants 1 Strength at combat start', () => {
    const { state } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      ['black-belt'],
    );
    expect(state.strength).toBe(1);
  });

  it("king's rock grants 4 Block on the second Attack each turn", () => {
    let { state, rng } = start(
      ['scratch', 'scratch', 'scratch', 'scratch', 'scratch', 'scratch'],
      'pidgey',
      ['kings-rock'],
    );
    state = seat(state, 'scratch', 'scratch');
    const first = state.hand[0]!;
    const second = state.hand[1]!;
    state = playCard(state, first.instanceId, state.enemies[0]!.id, rng);
    expect(state.playerBlock).toBe(0);
    state = playCard(state, second.instanceId, state.enemies[0]!.id, rng);
    expect(state.playerBlock).toBe(4);
  });

  it('scope lens reduces each multi-attack hit by 1', () => {
    const { state } = start(
      ['protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze', 'protect-blaze'],
      'doduo',
      ['scope-lens'],
      3,
    );
    expect(state.enemies[0]!.intent.kind).toBe('multiAttack');
    expect(displayedIntentAmount(state, state.enemies[0]!)).toBe(3);
    expect(previewEnemyActions(state)[0]!.playerDamage).toBe(9);
  });

  it('shell bell grants Dexterity when a potion is used', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      ['shell-bell'],
    );
    state.potions = ['x-defend', null, null];
    state = applyPotion(state, 0, undefined, rng);
    expect(state.dexterity).toBe(1);
    expect(state.playerBlock).toBe(15);
    expect(state.potions[0]).toBeNull();
  });

  it('x attack potion grants 5 Strength for this turn only', () => {
    let { state, rng } = start(
      ['scratch', 'scratch', 'scratch', 'scratch', 'scratch', 'scratch'],
      'pidgey',
      [],
    );
    state.potions = ['x-attack', null, null];
    state = applyPotion(state, 0, undefined, rng);
    expect(state.tempStrength).toBe(5);
    expect(state.strength).toBe(0);
    state = seat(state, 'scratch');
    const hp = state.enemies[0]!.hp;
    state = playCard(state, state.hand[0]!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 9);
    state = endTurn(state, rng);
    expect(state.tempStrength).toBe(0);
  });

  it('dire hit deals 20 damage to the targeted enemy', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
    );
    state.potions = ['dire-hit', null, null];
    const hp = state.enemies[0]!.hp;
    state = applyPotion(state, 0, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 20);
  });

  it('assault vest grants 6 Block if you end the turn with none', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      ['assault-vest'],
    );
    expect(state.playerBlock).toBe(0);
    const hp = state.playerHp;
    state = endTurn(state, rng);
    expect(state.playerHp).toBe(hp);
  });

  it('exp. share upgrades the opening hand without changing the deck copies', () => {
    const cards = deck(['ember', 'scratch', 'protect-blaze', 'ember', 'scratch', 'protect-blaze']);
    const rng = mulberry32(7);
    const state = createCombat({
      hp: 72,
      maxHp: 72,
      deck: cards,
      relics: ['exp-share'],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['fire'],
      rng,
    });
    expect(state.hand.length).toBeGreaterThan(0);
    expect(state.hand.every((c) => c.upgraded)).toBe(true);
    expect(cards.every((c) => !c.upgraded)).toBe(true);
  });

  it('soul dew grants 2 Energy and deals 4 at end of turn', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      ['soul-dew'],
    );
    expect(state.energy).toBe(5);
    const hp = state.playerHp;
    const incoming = previewEnemyActions(state)[0]!.playerDamage;
    state = endTurn(state, rng);
    expect(state.playerHp).toBe(hp - 4 - incoming);
  });

  it('miracle seed applies toxic at combat start without blocking plays', () => {
    const { state } = start(
      ['vine-whip', 'vine-whip', 'vine-whip', 'synthesis', 'synthesis', 'poison-powder'],
      'pidgey',
      ['miracle-seed'],
    );
    expect(state.enemies[0]!.statuses.toxic).toBe(2);
    expect(state.pendingDiscard).toBe(0);
    expect(state.energy).toBe(3);
    expect(state.hand.length).toBeGreaterThan(0);
    expect(state.hand.every((card) => canPlayCard(state, card.instanceId))).toBe(true);
  });

  it('choice band discards selected cards and draws that many', () => {
    let { state, rng } = start(
      ['ember', 'scratch', 'protect-blaze', 'ember', 'scratch', 'protect-blaze', 'ember'],
      'pidgey',
      ['choice-band'],
    );
    expect(state.pendingChoiceBand).toBe(true);
    expect(canPlayCard(state, state.hand[0]!.instanceId)).toBe(false);
    const size = state.hand.length;
    const first = state.hand[0]!;
    const second = state.hand[1]!;
    state = toggleChoiceBandCard(state, first.instanceId);
    state = toggleChoiceBandCard(state, second.instanceId);
    expect(state.choiceBandPicks).toHaveLength(2);
    state = confirmChoiceBand(state, rng);
    expect(state.pendingChoiceBand).toBe(false);
    expect(state.hand).toHaveLength(size);
    expect(state.discardPile.some((c) => c.instanceId === first.instanceId)).toBe(true);
    expect(state.discardPile.some((c) => c.instanceId === second.instanceId)).toBe(true);
  });

  it('shell bell charm draws 2 cards on the first Power of the turn only', () => {
    let { state, rng } = start(
      ['heat-up', 'heat-up', 'ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      ['leftovers-plus'],
    );
    state = seat(state, 'heat-up', 'heat-up');
    const drawBefore = state.drawPile.length;
    state = playCard(state, state.hand[0]!.instanceId, undefined, rng);
    expect(state.hand.length).toBe(3);
    expect(state.drawPile.length).toBe(drawBefore - 2);
    const second = state.hand.find((c) => c.defId === 'heat-up');
    expect(second).toBeTruthy();
    const drawAfterFirst = state.drawPile.length;
    state = playCard(state, second!.instanceId, undefined, rng);
    expect(state.drawPile.length).toBe(drawAfterFirst);
  });

  it('draws past a 10-card hand bounce into the discard pile', () => {
    const rng = mulberry32(19);
    const fillers = Array.from({ length: 12 }, (_, i) => ({
      instanceId: `fill-${i}`,
      defId: 'ember',
      upgraded: false,
    }));
    let state = createCombat({
      hp: 72,
      maxHp: 72,
      deck: [
        { instanceId: 'gb', defId: 'great-ball', upgraded: false },
        { instanceId: 'd1', defId: 'scratch', upgraded: false },
        { instanceId: 'd2', defId: 'protect-blaze', upgraded: false },
        ...fillers,
      ],
      relics: [],
      potions: [null, null, null],
      enemyDefs: [getEnemyDef('pidgey')],
      playerTypes: ['fire'],
      rng,
    });
    const greatBall = [...state.hand, ...state.drawPile].find((c) => c.defId === 'great-ball')!;
    const extra = [...state.hand, ...state.drawPile].filter((c) => c.instanceId !== greatBall.instanceId);
    state.hand = [greatBall, ...extra.slice(0, 9)];
    state.drawPile = [
      { instanceId: 'bounce', defId: 'protect-blaze', upgraded: false },
      { instanceId: 'keep', defId: 'scratch', upgraded: false },
    ];
    state.discardPile = [];
    state.energy = 3;
    expect(state.hand.length).toBe(10);
    state = playCard(state, greatBall.instanceId, undefined, rng);
    expect(state.hand.length).toBe(10);
    expect(state.hand.some((c) => c.instanceId === 'keep')).toBe(true);
    expect(state.hand.some((c) => c.instanceId === 'bounce')).toBe(false);
    expect(state.discardPile.some((c) => c.instanceId === 'bounce')).toBe(true);
  });

  it('spark dash does not mark an already 0-cost card free', () => {
    let { state, rng } = start(
      ['spark-dash', 'ember', 'scratch', 'protect-blaze', 'protect-blaze', 'protect-blaze'],
      'pidgey',
      [],
      11,
    );
    state = seat(state, 'spark-dash', 'ember');
    const dash = state.hand.find((c) => c.defId === 'spark-dash')!;
    const ember = state.hand.find((c) => c.defId === 'ember')!;
    state = playCard(state, dash.instanceId, state.enemies[0]!.id, rng);
    expect(state.freePlayIds).toEqual([ember.instanceId]);
  });

  it('vine whip and blaze kick apply strength to both hits', () => {
    let { state, rng } = start(
      ['vine-whip', 'blaze-kick', 'poison-powder', 'will-o-wisp', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    state = seat(state, 'vine-whip', 'blaze-kick', 'will-o-wisp');
    state.strength = 3;
    state.energy = 6;
    state.enemies[0]!.statuses = { toxic: 1 };
    const whipHp = state.enemies[0]!.hp;
    state = playCard(state, state.hand.find((c) => c.defId === 'vine-whip')!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(whipHp - 13);
    state = playCard(state, state.hand.find((c) => c.defId === 'will-o-wisp')!.instanceId, state.enemies[0]!.id, rng);
    const kickHp = state.enemies[0]!.hp;
    state = playCard(state, state.hand.find((c) => c.defId === 'blaze-kick')!.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(kickHp - 21);
  });

  it('petals ignore strength but still get spore', () => {
    let { state, rng } = start(
      ['petal-dance', 'spore', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    state = seat(state, 'petal-dance', 'spore');
    state.energy = 5;
    state.strength = 5;
    state = playCard(state, state.hand.find((c) => c.defId === 'spore')!.instanceId, undefined, rng);
    state = playCard(state, state.hand.find((c) => c.defId === 'petal-dance')!.instanceId, undefined, rng);
    const petal = state.hand.find((c) => c.defId === 'petal')!;
    const hp = state.enemies[0]!.hp;
    state = playCard(state, petal.instanceId, state.enemies[0]!.id, rng);
    expect(state.enemies[0]!.hp).toBe(hp - 9);
  });

  it('played powers stay listed under the player', () => {
    let { state, rng } = start(
      ['heat-up', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      4,
    );
    const card = state.hand.find((c) => c.defId === 'heat-up')!;
    state = playCard(state, card.instanceId, undefined, rng);
    expect(state.activePowers.some((c) => c.instanceId === card.instanceId)).toBe(true);
  });

  it('keeps enemy block after a block intent through the next player turn', () => {
    let { state, rng } = start(
      ['ember', 'ember', 'ember', 'ember', 'ember', 'ember'],
      'pidgey',
      [],
      3,
    );
    state.enemies[0]!.intent = { kind: 'block', amount: 5 };
    state = endTurn(state, rng);
    expect(state.enemies[0]!.block).toBe(5);
  });

  it('forest curse plus does not exhaust', () => {
    const plus = resolveCard({ instanceId: 'fc+', defId: 'forest-curse', upgraded: true });
    expect(plus.exhaust).toBe(false);
    expect(plus.cost).toBe(2);
  });

  it('poke flute and aqua tail use the new costs', () => {
    expect(resolveCard({ instanceId: 'pf', defId: 'poke-flute', upgraded: false }).cost).toBe(3);
    expect(resolveCard({ instanceId: 'pf+', defId: 'poke-flute', upgraded: true }).cost).toBe(2);
    expect(resolveCard({ instanceId: 'at', defId: 'aqua-tail', upgraded: false }).cost).toBe(3);
    expect(resolveCard({ instanceId: 'at+', defId: 'aqua-tail', upgraded: true }).cost).toBe(2);
  });
});
