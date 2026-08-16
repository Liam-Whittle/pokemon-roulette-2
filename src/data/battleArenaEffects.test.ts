import { describe, expect, it } from 'vitest';
import { calculateMoveDamage, resolveDamageHits } from './battleArenaEffects';
import { EMPTY_VOLATILES } from './battleVolatiles';
import { storedMoveFromSlug } from './moveEffects';
import type { CaughtPokemon } from '../types/game';
import { randomIVs, zeroEVs } from '../utils/stats';

const ZERO_STAGES = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };

function mockMon(overrides: Partial<CaughtPokemon> = {}): CaughtPokemon {
  return {
    id: 101,
    name: 'electrode',
    displayName: 'Electrode',
    types: ['electric'],
    sprite: '',
    caughtAt: 1,
    level: 40,
    xp: 0,
    ivs: randomIVs(),
    evs: zeroEVs(),
    nature: 'hardy',
    moves: [],
    evolvesToId: null,
    hp: 100,
    ...overrides,
  };
}

describe('calculateMoveDamage', () => {
  it('Explosion deals damage to a non-Ghost target', () => {
    const explosion = storedMoveFromSlug('explosion');
    expect(explosion).toBeTruthy();
    const result = calculateMoveDamage({
      move: explosion!,
      attacker: mockMon(),
      defender: mockMon({
        id: 1,
        name: 'bulbasaur',
        displayName: 'Bulbasaur',
        types: ['grass', 'poison'],
        hp: 80,
      }),
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    expect(result.effectiveness).toBeGreaterThan(0);
    expect(result.damage).toBeGreaterThan(0);
  });

  it('doubles Facade when the user is burned', () => {
    const facade = storedMoveFromSlug('facade')!;
    const healthy = calculateMoveDamage({
      move: facade,
      attacker: mockMon({ status: undefined }),
      defender: mockMon({ id: 1, types: ['normal'], hp: 80 }),
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    const burned = calculateMoveDamage({
      move: facade,
      attacker: mockMon({ status: { kind: 'paralysis' } }),
      defender: mockMon({ id: 1, types: ['normal'], hp: 80 }),
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    expect(burned.damage).toBeGreaterThan(healthy.damage);
  });

  it('lets Scrappy Tackle hit a Ghost and blocks crits with Battle Armor', () => {
    const tackle = storedMoveFromSlug('tackle')!;
    const ghost = mockMon({ id: 92, types: ['ghost', 'poison'], hp: 80 });
    const blocked = calculateMoveDamage({
      move: tackle,
      attacker: mockMon({ id: 19, types: ['normal'], ability: 'run-away' }),
      defender: ghost,
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    const scrappy = calculateMoveDamage({
      move: tackle,
      attacker: mockMon({ id: 19, types: ['normal'], ability: 'scrappy' }),
      defender: ghost,
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    expect(blocked.effectiveness).toBe(0);
    expect(scrappy.effectiveness).toBe(1);
    expect(scrappy.damage).toBeGreaterThan(blocked.damage);
  });

  it('returns a separate strike for each Double Kick hit', () => {
    const doubleKick = storedMoveFromSlug('double-kick')!;
    const result = resolveDamageHits({
      move: doubleKick,
      attacker: mockMon({ id: 106, types: ['fighting'], ability: 'no-guard' }),
      defender: mockMon({ id: 19, types: ['normal'], hp: 200 }),
      defenderHp: 200,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
      hitAccuracy: 100,
    });
    expect(result.missed).toBe(false);
    expect(result.hitResults).toHaveLength(2);
    expect(result.hits).toBe(2);
    expect(result.totalDamage).toBe(result.hitResults[0]!.damage + result.hitResults[1]!.damage);
    expect(result.hitResults[0]!.damage).toBeGreaterThan(0);
    expect(result.hitResults[1]!.damage).toBeGreaterThan(0);
  });

  it('leaves 1 HP when the defender Endured', () => {
    const tackle = storedMoveFromSlug('tackle')!;
    const result = calculateMoveDamage({
      move: tackle,
      attacker: mockMon({ level: 50, hp: 120 }),
      defender: mockMon({ id: 19, types: ['normal'], hp: 8, level: 5 }),
      defenderHp: 8,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: { ...EMPTY_VOLATILES, endured: true },
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    expect(result.damage).toBe(7);
  });

  it('lets Normal moves hit an identified Ghost', () => {
    const tackle = storedMoveFromSlug('tackle')!;
    const blocked = calculateMoveDamage({
      move: tackle,
      attacker: mockMon({ types: ['normal'] }),
      defender: mockMon({ id: 92, types: ['ghost', 'poison'], hp: 80 }),
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    const identified = calculateMoveDamage({
      move: tackle,
      attacker: mockMon({ types: ['normal'] }),
      defender: mockMon({ id: 92, types: ['ghost', 'poison'], hp: 80 }),
      defenderHp: 80,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: { ...EMPTY_VOLATILES, identified: true },
      attackerStages: ZERO_STAGES,
      defenderStages: ZERO_STAGES,
    });
    expect(blocked.effectiveness).toBe(0);
    expect(identified.effectiveness).toBeGreaterThan(0);
    expect(identified.damage).toBeGreaterThan(0);
  });
});
