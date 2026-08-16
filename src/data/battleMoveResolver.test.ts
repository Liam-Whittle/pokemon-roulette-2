import { describe, expect, it } from 'vitest';
import { resolvePostDamage, resolveStatusMove } from '../data/battleMoveResolver';
import { EMPTY_VOLATILES, endOfTurnProtectReset } from '../data/battleVolatiles';
import { getDamagingMoveFailReason, getMovePriority, storedMoveFromSlug } from '../data/moveEffects';
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

  it('faints the Explosion user even when the blast deals no damage', () => {
    const explosion = storedMoveFromSlug('explosion');
    expect(explosion).toBeTruthy();
    const result = resolvePostDamage({
      slug: 'explosion',
      move: explosion!,
      attacker: mockMon({ displayName: 'Electrode' }),
      defender: mockMon({ displayName: 'Gengar', types: ['ghost', 'poison'] }),
      damageDealt: 0,
      connectingHits: 0,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.selfFaint).toBe(true);
  });

  it('faints the Self-Destruct user even when the blast deals no damage', () => {
    const selfDestruct = storedMoveFromSlug('self-destruct');
    expect(selfDestruct).toBeTruthy();
    const result = resolvePostDamage({
      slug: 'self-destruct',
      move: selfDestruct!,
      attacker: mockMon({ displayName: 'Voltorb' }),
      defender: mockMon({ displayName: 'Gastly', types: ['ghost', 'poison'] }),
      damageDealt: 0,
      connectingHits: 0,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.selfFaint).toBe(true);
  });

  it('applies Bulk Up, Calm Mind, and Dragon Dance stage pairs', () => {
    for (const [slug, expected] of [
      ['bulk-up', { atk: 1, def: 1 }],
      ['calm-mind', { spa: 1, spd: 1 }],
      ['dragon-dance', { atk: 1, spe: 1 }],
    ] as const) {
      const move = storedMoveFromSlug(slug)!;
      const result = resolveStatusMove({
        slug,
        move,
        attacker: mockMon({ displayName: 'User' }),
        defender: mockMon({ displayName: 'Foe' }),
        attackerVolatiles: EMPTY_VOLATILES,
        defenderVolatiles: EMPTY_VOLATILES,
      });
      expect(result.failed).toBe(false);
      expect(result.attackerStageDelta).toMatchObject(expected);
    }
  });

  it('heals Slack Off and averages Pain Split HP', () => {
    const slack = storedMoveFromSlug('slack-off')!;
    const slackResult = resolveStatusMove({
      slug: 'slack-off',
      move: slack,
      attacker: mockMon({ hp: 10 }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(slackResult.failed).toBe(false);
    expect(slackResult.healFraction).toBe(0.5);

    const pain = storedMoveFromSlug('pain-split')!;
    const painResult = resolveStatusMove({
      slug: 'pain-split',
      move: pain,
      attacker: mockMon({ hp: 10, displayName: 'Duskull' }),
      defender: mockMon({ hp: 50, displayName: 'Foe' }),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(painResult.failed).toBe(false);
    expect(painResult.painSplitHp?.attackerHp).toBeGreaterThanOrEqual(10);
    expect(painResult.painSplitHp?.defenderHp).toBeLessThanOrEqual(50);
    expect(painResult.painSplitHp?.attackerHp).toBeLessThan(50);
  });

  it('sets Yawn, Wish, Teeter Dance, and Belly Drum', () => {
    const yawn = resolveStatusMove({
      slug: 'yawn',
      move: storedMoveFromSlug('yawn')!,
      attacker: mockMon(),
      defender: mockMon({ displayName: 'Foe' }),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(yawn.defenderVolatilesPatch?.yawnTurns).toBe(2);

    const wish = resolveStatusMove({
      slug: 'wish',
      move: storedMoveFromSlug('wish')!,
      attacker: mockMon({ displayName: 'Illumise' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(wish.attackerVolatilesPatch?.wishTurns).toBe(2);

    const teeter = resolveStatusMove({
      slug: 'teeter-dance',
      move: storedMoveFromSlug('teeter-dance')!,
      attacker: mockMon(),
      defender: mockMon({ displayName: 'Foe' }),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect((teeter.defenderVolatilesPatch?.confusionTurns ?? 0) > 0).toBe(true);

    const drum = resolveStatusMove({
      slug: 'belly-drum',
      move: storedMoveFromSlug('belly-drum')!,
      attacker: mockMon({ hp: 40, displayName: 'Linoone' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(drum.failed).toBe(false);
    expect(drum.attackerStageSet?.atk).toBe(6);
    expect(drum.attackerHpCost).toBeGreaterThan(0);
  });

  it('protects on first use and puts up a substitute', () => {
    const protect = resolveStatusMove({
      slug: 'protect',
      move: storedMoveFromSlug('protect')!,
      attacker: mockMon({ displayName: 'Mudkip' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(protect.failed).toBe(false);
    expect(protect.attackerVolatilesPatch?.protected).toBe(true);

    const sub = resolveStatusMove({
      slug: 'substitute',
      move: storedMoveFromSlug('substitute')!,
      attacker: mockMon({ hp: 40, displayName: 'Sceptile' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(sub.failed).toBe(false);
    expect(sub.attackerVolatilesPatch?.substituteHp).toBeGreaterThan(0);
  });

  it('sets Hail and Sandstorm weather', () => {
    const hail = resolveStatusMove({
      slug: 'hail',
      move: storedMoveFromSlug('hail')!,
      attacker: mockMon(),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(hail.fieldPatch?.weather).toBe('hail');

    const sand = resolveStatusMove({
      slug: 'sandstorm',
      move: storedMoveFromSlug('sandstorm')!,
      attacker: mockMon(),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(sand.fieldPatch?.weather).toBe('sandstorm');
  });

  it('blocks foe stat drops when a Substitute absorbs the hit', () => {
    const rockTomb = storedMoveFromSlug('rock-tomb')!;
    const result = resolvePostDamage({
      slug: 'rock-tomb',
      move: rockTomb,
      attacker: mockMon({ displayName: 'Hariyama' }),
      defender: mockMon({ displayName: 'Sceptile' }),
      damageDealt: 40,
      damageToMon: 0,
      connectingHits: 1,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: { ...EMPTY_VOLATILES, substituteHp: 20 },
    });
    expect(result.defenderStageDelta?.spe ?? 0).toBe(0);
  });

  it('clears screens with Brick Break', () => {
    const brick = storedMoveFromSlug('brick-break')!;
    const result = resolvePostDamage({
      slug: 'brick-break',
      move: brick,
      attacker: mockMon(),
      defender: mockMon(),
      damageDealt: 20,
      connectingHits: 1,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: { ...EMPTY_VOLATILES, reflectTurns: 3, lightScreenTurns: 3 },
    });
    expect(result.defenderVolatilesPatch?.reflectTurns).toBe(0);
    expect(result.defenderVolatilesPatch?.lightScreenTurns).toBe(0);
    expect(result.messages.some((m) => m.includes('screens'))).toBe(true);
  });

  it('always flinches with Fake Out after damage', () => {
    const result = resolvePostDamage({
      slug: 'fake-out',
      move: storedMoveFromSlug('fake-out')!,
      attacker: mockMon({ displayName: 'Meowth' }),
      defender: mockMon({ displayName: 'Rattata' }),
      damageDealt: 12,
      damageToMon: 12,
      connectingHits: 1,
      attackerVolatiles: { ...EMPTY_VOLATILES, enteredThisTurn: true },
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.defenderVolatilesPatch?.flinched).toBe(true);
  });

  it('does not flinch through Inner Focus', () => {
    const result = resolvePostDamage({
      slug: 'fake-out',
      move: storedMoveFromSlug('fake-out')!,
      attacker: mockMon({ displayName: 'Meowth' }),
      defender: mockMon({ displayName: 'Dragonite', ability: 'inner-focus' }),
      damageDealt: 12,
      damageToMon: 12,
      connectingHits: 1,
      attackerVolatiles: { ...EMPTY_VOLATILES, enteredThisTurn: true },
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.defenderVolatilesPatch?.flinched).toBeUndefined();
  });

  it('does not flinch through Shield Dust', () => {
    const result = resolvePostDamage({
      slug: 'fake-out',
      move: storedMoveFromSlug('fake-out')!,
      attacker: mockMon({ displayName: 'Meowth' }),
      defender: mockMon({ displayName: 'Dustox', ability: 'shield-dust' }),
      damageDealt: 12,
      damageToMon: 12,
      connectingHits: 1,
      attackerVolatiles: { ...EMPTY_VOLATILES, enteredThisTurn: true },
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.defenderVolatilesPatch?.flinched).toBeUndefined();
  });

  it('gives Fake Out +3 priority and fails after the first turn out', () => {
    expect(getMovePriority('fake-out')).toBe(3);
    expect(getDamagingMoveFailReason('fake-out', { enteredThisTurn: true })).toBeNull();
    expect(getDamagingMoveFailReason('fake-out', { enteredThisTurn: false })).toBe('But it failed!');
    expect(getDamagingMoveFailReason('snore', { asleep: false })).toBe('But it failed!');
    expect(getDamagingMoveFailReason('snore', { asleep: true })).toBeNull();
  });

  it('clears flinch and first-turn-out at end of turn', () => {
    const next = endOfTurnProtectReset({
      ...EMPTY_VOLATILES,
      flinched: true,
      enteredThisTurn: true,
    });
    expect(next.flinched).toBe(false);
    expect(next.enteredThisTurn).toBe(false);
  });

  it('raises Defense sharply with Acid Armor', () => {
    const result = resolveStatusMove({
      slug: 'acid-armor',
      move: storedMoveFromSlug('acid-armor')!,
      attacker: mockMon({ displayName: 'Vaporeon' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.failed).toBe(false);
    expect(result.attackerStageDelta?.def).toBe(2);
  });

  it('cures the party with Aromatherapy', () => {
    const result = resolveStatusMove({
      slug: 'aromatherapy',
      move: storedMoveFromSlug('aromatherapy')!,
      attacker: mockMon({ displayName: 'Roselia' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.clearAttackerStatus).toBe(true);
    expect(result.healPartyStatus).toBe(true);
  });

  it('braces with Endure without protecting', () => {
    const result = resolveStatusMove({
      slug: 'endure',
      move: storedMoveFromSlug('endure')!,
      attacker: mockMon({ displayName: 'Hitmonlee' }),
      defender: mockMon(),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
    });
    expect(result.failed).toBe(false);
    expect(result.attackerVolatilesPatch?.endured).toBe(true);
    expect(result.attackerVolatilesPatch?.protected).toBeUndefined();
  });

  it('blocks foe stat drops through Mist', () => {
    const result = resolveStatusMove({
      slug: 'growl',
      move: storedMoveFromSlug('growl')!,
      attacker: mockMon({ displayName: 'Player' }),
      defender: mockMon({ displayName: 'Foe' }),
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: { ...EMPTY_VOLATILES, mistTurns: 5 },
    });
    expect(result.defenderStageDelta?.atk ?? 0).toBe(0);
    expect(result.messages.some((m) => m.includes('Mist'))).toBe(true);
  });

  it('fails Dream Eater unless the target is asleep', () => {
    expect(getDamagingMoveFailReason('dream-eater', { asleep: false })).toBe('But it failed!');
    expect(getDamagingMoveFailReason('dream-eater', { asleep: true })).toBeNull();
  });

  it('fails Spit Up without a stockpile', () => {
    expect(getDamagingMoveFailReason('spit-up', { stockpileCount: 0 })).toBe('But it failed!');
    expect(getDamagingMoveFailReason('spit-up', { stockpileCount: 2 })).toBeNull();
  });
});
