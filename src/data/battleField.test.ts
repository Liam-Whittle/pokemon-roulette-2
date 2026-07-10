import { describe, expect, it } from 'vitest';
import { initBattleHiddenPowerTypes, spikesChipDamage } from '../data/battleField';

describe('battleField', () => {
  it('rolls hidden power types for player and enemy teams', () => {
    const types = initBattleHiddenPowerTypes(
      [{ caughtAt: 1, moves: [{ slug: 'hidden-power' }] }],
      [{ caughtAt: 2010, moves: [{ slug: 'hidden-power' }, { slug: 'tackle' }] }],
    );
    expect(types[1]).toBeTruthy();
    expect(types[2010]).toBeTruthy();
    expect(types[1]).not.toBe(types[2010]);
  });

  it('chips non-flying switch-ins for spikes', () => {
    expect(spikesChipDamage(160, ['grass'])).toBe(20);
    expect(spikesChipDamage(160, ['flying'])).toBe(0);
  });
});
