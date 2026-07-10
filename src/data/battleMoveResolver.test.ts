import { describe, expect, it } from 'vitest';
import { resolveStatusMove } from '../data/battleMoveResolver';
import { EMPTY_VOLATILES } from '../data/battleVolatiles';
import { storedMoveFromSlug } from '../data/moveEffects';
import type { CaughtPokemon } from '../types/game';
import { randomIVs, zeroEVs } from '../utils/stats';

function mockMon(overrides: Partial<CaughtPokemon> = {}): CaughtPokemon {
  return {
    id: 1,
    name: 'bulbasaur',
    displayName: 'Bulbasaur',
    types: ['grass', 'poison'],
    sprite: '',
    caughtAt: 1,
    level: 10,
    xp: 0,
    ivs: randomIVs(),
    evs: zeroEVs(),
    nature: 'hardy',
    moves: [],
    evolvesToId: null,
    hp: 30,
    ...overrides,
  };
}

describe('battleMoveResolver', () => {
  it('applies swagger confusion without duplicating attack boost message', () => {
    const swagger = storedMoveFromSlug('swagger')!;
    const attacker = mockMon({ caughtAt: 2, displayName: 'Player' });
    const defender = mockMon({ caughtAt: 3, displayName: 'Foe' });
    const result = resolveStatusMove({
      slug: 'swagger',
      move: swagger,
      attacker,
      defender,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.failed).toBe(false);
    expect(result.messages.some((m) => m.includes('confused'))).toBe(true);
    expect(result.defenderStageDelta?.atk).toBe(2);
  });

  it('fails disable when foe has not used a move', () => {
    const disable = storedMoveFromSlug('disable')!;
    const result = resolveStatusMove({
      slug: 'disable',
      move: disable,
      attacker: mockMon({ caughtAt: 2 }),
      defender: mockMon({ caughtAt: 3 }),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      defenderLastMoveSlug: null,
    });
    expect(result.failed).toBe(true);
  });

  it('lays spikes on the field', () => {
    const spikes = storedMoveFromSlug('spikes')!;
    const result = resolveStatusMove({
      slug: 'spikes',
      move: spikes,
      attacker: mockMon({ caughtAt: 2 }),
      defender: mockMon({ caughtAt: 3 }),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.fieldPatch?.spikesActive).toBe(true);
  });
});
