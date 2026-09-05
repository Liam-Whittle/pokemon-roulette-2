import { describe, expect, it } from 'vitest';
import { getCardDef } from '../data/cards';
import { EVENTS } from '../data/events';
import { applyEventResult, eventGrantsRareCard, pickEventId, resolveEventTrade } from './events';
import { rollCardOffer } from './rewards';
import { mulberry32 } from './rng';
import type { SpireRun } from '../types';

function stubRun(over: Partial<SpireRun> = {}): SpireRun {
  return {
    seed: 1,
    rngState: 1,
    instanceSeq: 0,
    view: 'event',
    characterId: 'blaze',
    hp: 50,
    maxHp: 72,
    gold: 100,
    deck: [
      { instanceId: 'a', defId: 'ember', upgraded: false },
      { instanceId: 'b', defId: 'scratch', upgraded: false },
      { instanceId: 'c', defId: 'protect-blaze', upgraded: false },
    ],
    relics: ['charcoal', 'lucky-egg'],
    potions: [null, null, null],
    act: 1,
    map: null,
    currentNodeId: null,
    visitedNodeIds: [],
    combat: null,
    combatResult: null,
    pendingRewards: null,
    shopStock: null,
    currentEventId: 'rocket-grunts',
    blessingIds: [],
    activeEncounterId: null,
    smithUsed: false,
    smithedCardId: null,
    restHealUsed: false,
    restDexUsed: false,
    restStrUsed: false,
    hallwayTheme: null,
    permStrength: 0,
    permDexterity: 0,
    evioliteUses: 0,
    megaStoneUses: 0,
    restTrade: null,
    eventFollowup: null,
    blessingFollowup: null,
    lastMonsterEncounterId: null,
    lastEliteEncounterId: null,
    pendingAcquire: null,
    actRareTaken: false,
    ...over,
  };
}

describe('spire events', () => {
  it('drops the Leave choice from Mysterious Shrine', () => {
    expect(EVENTS['mysterious-shrine']!.choices.map((c) => c.label)).toEqual(['Pray', 'Take the offering']);
  });

  it('sneak by succeeds for 50 gold when the roll is low', () => {
    const run = stubRun();
    applyEventResult(run, EVENTS['rocket-grunts']!.choices[2]!.result, () => 0.1);
    expect(run.gold).toBe(150);
    expect(run.eventFollowup).toMatchObject({ kind: 'message', title: 'Sneaked by' });
  });

  it('sneak by loses 50 gold when the roll is high', () => {
    const run = stubRun({ gold: 100 });
    applyEventResult(run, EVENTS['rocket-grunts']!.choices[2]!.result, () => 0.9);
    expect(run.gold).toBe(50);
    expect(run.eventFollowup).toMatchObject({ kind: 'message', title: 'Caught' });
  });

  it('smash and grab deals 5 and offers 3 uncommons', () => {
    const run = stubRun();
    applyEventResult(run, EVENTS['abandoned-mart']!.choices[1]!.result, mulberry32(3));
    expect(run.hp).toBe(45);
    expect(run.eventFollowup?.kind).toBe('chooseCards');
    if (run.eventFollowup?.kind !== 'chooseCards') return;
    expect(run.eventFollowup.pick).toBe(1);
    expect(run.eventFollowup.cards).toHaveLength(3);
    expect(run.eventFollowup.cards.every((c) => getCardDef(c.defId).rarity === 'uncommon')).toBe(true);
  });

  it('safari balls offer 10 unique commons', () => {
    const run = stubRun();
    applyEventResult(run, EVENTS['safari-gate']!.choices[0]!.result, mulberry32(11));
    expect(run.eventFollowup?.kind).toBe('chooseCards');
    if (run.eventFollowup?.kind !== 'chooseCards') return;
    expect(run.eventFollowup.pick).toBe(2);
    expect(run.eventFollowup.cards).toHaveLength(10);
    const ids = run.eventFollowup.cards.map((c) => c.defId);
    expect(new Set(ids).size).toBe(10);
    expect(run.eventFollowup.cards.every((c) => getCardDef(c.defId).rarity === 'common')).toBe(true);
  });

  it('download a ROM offers 3 colorless cards', () => {
    const run = stubRun({ currentEventId: 'bill-pc' });
    applyEventResult(run, EVENTS['bill-pc']!.choices[2]!.result, mulberry32(5));
    expect(run.eventFollowup?.kind).toBe('chooseCards');
    if (run.eventFollowup?.kind !== 'chooseCards') return;
    expect(run.eventFollowup.cards).toHaveLength(3);
    expect(run.eventFollowup.cards.every((c) => !getCardDef(c.defId).character)).toBe(true);
  });

  it('trim the party asks to remove 2 cards', () => {
    const run = stubRun();
    applyEventResult(run, EVENTS['pokemon-center-nurse']!.choices[1]!.result, mulberry32(1));
    expect(run.eventFollowup).toEqual({ kind: 'removeCards', pick: 2, selected: [] });
  });

  it('trading a relic replaces it with a different obtainable relic', () => {
    const run = stubRun();
    applyEventResult(run, EVENTS['mysterious-egg']!.choices[0]!.result, mulberry32(2));
    expect(run.eventFollowup?.kind).toBe('tradeRelic');
    resolveEventTrade(run, 'lucky-egg', mulberry32(8));
    expect(run.relics).not.toContain('lucky-egg');
    expect(run.relics).toContain('charcoal');
    expect(run.relics.length).toBe(2);
    expect(run.eventFollowup?.kind).toBe('message');
  });

  it('taking a relic from an event queues an acquire reveal', () => {
    const run = stubRun({ relics: ['charcoal'] });
    applyEventResult(run, { type: 'relic' }, mulberry32(4));
    expect(run.eventFollowup).toBeNull();
    expect(run.pendingAcquire?.[0]?.type).toBe('relic');
    expect(run.relics.length).toBeGreaterThan(1);
  });

  it('hides rare-card events after the act rare has been taken', () => {
    expect(eventGrantsRareCard('cursed-rod')).toBe(true);
    expect(eventGrantsRareCard('mysterious-shrine')).toBe(false);
    const pool = ['mysterious-shrine', 'cursed-rod', 'abandoned-mart'];
    for (let seed = 1; seed < 40; seed += 1) {
      expect(pickEventId(pool, mulberry32(seed), false)).not.toBe('cursed-rod');
    }
    const run = stubRun();
    applyEventResult(run, EVENTS['cursed-rod']!.choices[0]!.result, mulberry32(6));
    expect(run.actRareTaken).toBe(true);
    expect(run.deck.some((c) => getCardDef(c.defId).rarity === 'rare')).toBe(true);
  });

  it('rollCardOffer can fill a 10-common safari pack', () => {
    const cards = rollCardOffer('blaze', mulberry32(21), { n: 0 }, 10, { rarity: 'common' });
    expect(cards).toHaveLength(10);
  });
});
