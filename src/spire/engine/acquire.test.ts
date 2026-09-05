import { describe, expect, it } from 'vitest';
import { grantCard, grantPotion, grantRelic } from './acquire';
import type { SpireRun } from '../types';

function stubRun(over: Partial<SpireRun> = {}): SpireRun {
  return {
    seed: 1,
    rngState: 1,
    instanceSeq: 0,
    view: 'map',
    characterId: 'blaze',
    hp: 50,
    maxHp: 72,
    gold: 99,
    deck: [],
    relics: ['charcoal'],
    potions: [null, null, null],
    act: 1,
    map: null,
    currentNodeId: null,
    visitedNodeIds: [],
    combat: null,
    combatResult: null,
    pendingRewards: null,
    shopStock: null,
    currentEventId: null,
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

describe('acquire grants', () => {
  it('queues a relic, potion, and card for the obtain modal', () => {
    const run = stubRun();
    expect(grantRelic(run, 'lucky-egg')).toBe(true);
    expect(grantPotion(run, 'x-attack')).toBe(true);
    grantCard(run, { instanceId: 'c1', defId: 'ember', upgraded: false });
    expect(run.pendingAcquire).toEqual([
      { type: 'relic', id: 'lucky-egg' },
      { type: 'potion', id: 'x-attack' },
      { type: 'card', card: { instanceId: 'c1', defId: 'ember', upgraded: false } },
    ]);
  });

  it('does not queue a duplicate relic', () => {
    const run = stubRun();
    expect(grantRelic(run, 'charcoal')).toBe(false);
    expect(run.pendingAcquire).toBeNull();
  });

  it('marks the act rare-card slot when a rare card is granted', () => {
    const run = stubRun();
    grantCard(run, { instanceId: 'c1', defId: 'ember', upgraded: false });
    expect(run.actRareTaken).toBe(false);
    grantCard(run, { instanceId: 'c2', defId: 'swords-dance', upgraded: false });
    expect(run.actRareTaken).toBe(true);
  });
});
