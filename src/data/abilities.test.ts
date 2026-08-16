import { describe, expect, it } from 'vitest';
import {
  abilityWonderGuardBlocks,
  abilityAbsorbsMove,
  abilityAfterBeingHit,
  abilityAttackerDamageMult,
  abilityBlocksCrit,
  abilityBlocksExplosion,
  abilityBlocksForcedSwitch,
  abilityBlocksStatus,
  abilityBlocksWeatherChip,
  abilityCuresStatusEot,
  abilityDrainHurtsAttacker,
  abilityNeverMisses,
  abilityOnKnockOut,
  abilityOnSwitchOut,
  abilityPreventsStatDrop,
  abilityPriorityBonus,
  abilityRetaliateStatDrop,
  abilityRewriteStageDelta,
  abilityScrappyEffectiveness,
  abilitySpeedBoost,
  abilityTrapsFoe,
  abilityWeatherHeal,
  abilityWeightMult,
  defaultAbilityForSpecies,
  describeSwitchInAbility,
  filterPoolForIlluminate,
  forecastTypesForWeather,
  friendGuardDamageMult,
  getAbilityInfo,
  getSpeciesAbilities,
  HIDDEN_ABILITY_CHANCE,
  partyHasAbility,
  pickupSkipsConsume,
  pickStolenCommonItem,
  plusMinusSpaMult,
  rivalryDamageMult,
  rollAbilityForSpecies,
  shouldAutoImposter,
  stickyHoldBlocksSteal,
  abilitySpeedMult,
  gluttonyShouldHeal,
} from './abilities';
import { rollGenderForSpecies } from './speciesGender';
import { ensureCaughtPokemonFields } from '../utils/pokemonInstance';
import { calculateMoveDamage } from './battleArenaEffects';
import { EMPTY_VOLATILES } from './battleVolatiles';
import { cachedMoveToStored } from './speciesCache';
import type { CaughtPokemon } from '../types/game';

const ZERO = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };

function mon(partial: Partial<CaughtPokemon> & Pick<CaughtPokemon, 'id' | 'types'>): CaughtPokemon {
  return {
    name: 'test',
    displayName: 'Test',
    sprite: '',
    caughtAt: 1,
    level: 50,
    xp: 0,
    ivs: { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
    evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    nature: 'hardy',
    moves: [],
    hp: 100,
    ...partial,
  };
}

describe('abilities data', () => {
  it('gives Shedinja Wonder Guard and Bulbasaur Overgrow + Chlorophyll', () => {
    expect(defaultAbilityForSpecies(292)).toBe('wonder-guard');
    expect(getSpeciesAbilities(1)).toEqual({ standard: ['overgrow'], hidden: 'chlorophyll' });
    expect(getAbilityInfo('wonder-guard')?.name).toBe('Wonder Guard');
  });

  it('blocks non-super-effective hits with Wonder Guard', () => {
    expect(abilityWonderGuardBlocks('wonder-guard', 1, 'physical')).toBe(true);
    expect(abilityWonderGuardBlocks('wonder-guard', 2, 'physical')).toBe(false);
    expect(abilityWonderGuardBlocks('wonder-guard', 0.5, 'status')).toBe(false);
  });

  it('makes Levitate immune to Ground', () => {
    expect(abilityAbsorbsMove('levitate', 'ground')).toBe('immune');
    expect(abilityAbsorbsMove('water-absorb', 'water')).toBe('heal');
  });
});

describe('ability damage hooks', () => {
  it('Wonder Guard zeros a neutral Tackle and allows a super-effective hit', () => {
    const shedinja = mon({
      id: 292,
      types: ['bug', 'ghost'],
      ability: 'wonder-guard',
      displayName: 'Shedinja',
    });
    const attacker = mon({ id: 19, types: ['normal'], displayName: 'Rattata' });
    const tackle = cachedMoveToStored('tackle')!;
    const flamethrower = cachedMoveToStored('flamethrower')!;
    const base = {
      attacker,
      defender: shedinja,
      defenderHp: 1,
      attackerVolatiles: EMPTY_VOLATILES,
      defenderVolatiles: EMPTY_VOLATILES,
      attackerStages: ZERO,
      defenderStages: ZERO,
    };
    expect(calculateMoveDamage({ ...base, move: tackle }).damage).toBe(0);
    expect(calculateMoveDamage({ ...base, move: flamethrower }).damage).toBeGreaterThan(0);
  });
});

describe('ability assignment', () => {
  it('rolls hidden at the configured chance and otherwise among standard', () => {
    expect(rollAbilityForSpecies(254, () => 0)).toBe('unburden');
    expect(rollAbilityForSpecies(254, () => HIDDEN_ABILITY_CHANCE)).toBe('overgrow');
    expect(rollAbilityForSpecies(263, () => 0)).toBe('quick-feet');
    const first = rollAbilityForSpecies(263, () => HIDDEN_ABILITY_CHANCE);
    const second = rollAbilityForSpecies(263, () => 0.99);
    expect(['pickup', 'gluttony']).toContain(first);
    expect(['pickup', 'gluttony']).toContain(second);
    expect(first).not.toBe(second);
  });

  it('treats partyHasAbility as assigned-slot only', () => {
    const sceptile = mon({ id: 254, types: ['grass'], ability: 'overgrow' });
    expect(partyHasAbility([sceptile], 'unburden')).toBe(false);
    expect(partyHasAbility([sceptile], 'overgrow')).toBe(true);
  });

  it('uses this-game tooltip text for remapped abilities', () => {
    expect(getAbilityInfo('unburden')?.shortEffect).toMatch(/item is used/i);
    expect(getAbilityInfo('pickup')?.shortEffect).toMatch(/not consumed/i);
  });
});

describe('gender and rivalry', () => {
  it('fixes Nido lines and randomizes others', () => {
    expect(rollGenderForSpecies(29)).toBe('female');
    expect(rollGenderForSpecies(32)).toBe('male');
    expect(rollGenderForSpecies(132)).toBeNull();
    expect(rollGenderForSpecies(0)).toBeNull();
    expect(rollGenderForSpecies(493)).toBeNull();
    expect(['male', 'female']).toContain(rollGenderForSpecies(254, () => 0.1));
  });

  it('backfills missing gender and ability on acquired mons', () => {
    const filled = ensureCaughtPokemonFields(mon({ id: 1, types: ['grass'] }));
    expect(filled.ability).toBeTruthy();
    expect(filled.gender === 'male' || filled.gender === 'female').toBe(true);
    const ditto = ensureCaughtPokemonFields(mon({ id: 132, types: ['normal'] }));
    expect(ditto.gender).toBeNull();
  });

  it('applies Rivalry only for gendered matchups', () => {
    expect(rivalryDamageMult('rivalry', 'male', 'male')).toBe(1.25);
    expect(rivalryDamageMult('rivalry', 'male', 'female')).toBe(0.75);
    expect(rivalryDamageMult('rivalry', 'male', null)).toBe(1);
    expect(rivalryDamageMult('guts', 'male', 'male')).toBe(1);
  });
});

describe('item and party ability helpers', () => {
  it('blocks steals with Sticky Hold and picks a common item', () => {
    expect(stickyHoldBlocksSteal('sticky-hold')).toBe(true);
    expect(pickStolenCommonItem(['masterball', 'fullheal'])).toBeNull();
    expect(pickStolenCommonItem(['potion', 'xattack'], () => 0)).toBe('potion');
  });

  it('doubles Speed after Unburden and skips the first Pickup consume', () => {
    expect(abilitySpeedMult('unburden', 'none', false, { unburden: true })).toBe(2);
    expect(abilitySpeedMult('unburden', 'none', false)).toBe(1);
    expect(pickupSkipsConsume('pickup', false)).toBe(true);
    expect(pickupSkipsConsume('harvest', true)).toBe(false);
    expect(pickupSkipsConsume('overgrow', false)).toBe(false);
  });

  it('triggers Gluttony once at half HP or below', () => {
    expect(gluttonyShouldHeal('gluttony', 50, 100, false)).toBe(true);
    expect(gluttonyShouldHeal('gluttony', 51, 100, false)).toBe(false);
    expect(gluttonyShouldHeal('gluttony', 40, 100, true)).toBe(false);
    expect(gluttonyShouldHeal('overgrow', 40, 100, false)).toBe(false);
  });

  it('requires both Plus and Minus alive, and Friend Guard only from the bench', () => {
    const plusle = mon({ id: 311, types: ['electric'], ability: 'plus', caughtAt: 1, hp: 20 });
    const minun = mon({ id: 312, types: ['electric'], ability: 'minus', caughtAt: 2, hp: 20 });
    expect(plusMinusSpaMult('plus', [plusle])).toBe(1);
    expect(plusMinusSpaMult('plus', [plusle, minun])).toBe(1.5);
    expect(friendGuardDamageMult(1, [
      mon({ id: 35, types: ['fairy'], ability: 'friend-guard', caughtAt: 1, hp: 20 }),
    ])).toBe(1);
    expect(friendGuardDamageMult(1, [
      mon({ id: 1, types: ['grass'], ability: 'overgrow', caughtAt: 1, hp: 20 }),
      mon({ id: 35, types: ['fairy'], ability: 'friend-guard', caughtAt: 2, hp: 20 }),
    ])).toBe(0.85);
  });

  it('maps Forecast types and only Imposter auto-transforms', () => {
    expect(forecastTypesForWeather('sunny', false)).toEqual(['fire']);
    expect(forecastTypesForWeather('rain', false)).toEqual(['water']);
    expect(forecastTypesForWeather('hail', false)).toEqual(['ice']);
    expect(forecastTypesForWeather('sunny', true)).toEqual(['normal']);
    expect(shouldAutoImposter({ id: 132, ability: 'imposter' })).toBe(true);
    expect(shouldAutoImposter({ id: 132, ability: 'limber' })).toBe(false);
  });

  it('filters Illuminate pools to 10% above median BST', () => {
    const pool = [100, 200, 300, 400, 500].map((bst, i) => ({ id: i, bst }));
    const filtered = filterPoolForIlluminate(pool, (p) => p.bst, 2);
    expect(filtered.every((p) => p.bst >= 330)).toBe(true);
  });
});

describe('newly wired ability helpers', () => {
  it('cures status in rain with Hydration and chips/heals from weather abilities', () => {
    expect(abilityCuresStatusEot('hydration', 'rain', false)).toBe(true);
    expect(abilityCuresStatusEot('hydration', 'sunny', false)).toBe(false);
    expect(abilityWeatherHeal('rain-dish', 'rain', false)).toBeCloseTo(1 / 16);
    expect(abilityWeatherHeal('ice-body', 'hail', false)).toBeCloseTo(1 / 16);
    expect(abilityWeatherHeal('solar-power', 'sunny', false)).toBeCloseTo(-1 / 8);
    expect(abilityWeatherHeal('dry-skin', 'rain', false)).toBeCloseTo(1 / 8);
    expect(abilitySpeedBoost('speed-boost')).toBe(true);
  });

  it('blocks status in sun with Leaf Guard and weather chip with Overcoat', () => {
    expect(abilityBlocksStatus('leaf-guard', 'poison', 'sunny', false)).toBe(true);
    expect(abilityBlocksStatus('leaf-guard', 'poison', 'rain', false)).toBe(false);
    expect(abilityBlocksWeatherChip('overcoat', 'hail')).toBe(true);
    expect(abilityBlocksWeatherChip('sand-force', 'sandstorm')).toBe(true);
    expect(abilityBlocksWeatherChip('overgrow', 'hail')).toBe(false);
  });

  it('applies combat multipliers for Solar Power, Tinted Lens, Sand Force, and Toxic Boost', () => {
    const base = {
      moveSlug: 'flamethrower',
      moveType: 'fire',
      movePower: 90,
      category: 'special',
      attackerTypes: ['fire'],
      attackerHp: 100,
      attackerMaxHp: 100,
    };
    expect(abilityAttackerDamageMult({ ...base, ability: 'solar-power', weather: 'sunny' })).toBeCloseTo(1.5);
    expect(abilityAttackerDamageMult({ ...base, ability: 'tinted-lens', effectiveness: 0.5 })).toBe(2);
    expect(
      abilityAttackerDamageMult({
        ...base,
        ability: 'sand-force',
        moveType: 'rock',
        category: 'physical',
        weather: 'sandstorm',
      }),
    ).toBeCloseTo(1.3);
    expect(
      abilityAttackerDamageMult({
        ...base,
        ability: 'toxic-boost',
        category: 'physical',
        statusKind: 'poison',
      }),
    ).toBeCloseTo(1.5);
    expect(abilityAttackerDamageMult({ ...base, ability: 'analytic', attackerSlower: true })).toBeCloseTo(1.3);
  });

  it('lets Scrappy hit Ghosts and blocks crits with Battle Armor', () => {
    expect(abilityScrappyEffectiveness('scrappy', 'normal', ['ghost'], 0)).toBe(1);
    expect(abilityScrappyEffectiveness('scrappy', 'water', ['ghost'], 0)).toBe(0);
    expect(abilityBlocksCrit('battle-armor')).toBe(true);
    expect(abilityBlocksCrit('shell-armor')).toBe(true);
    expect(abilityBlocksCrit('guts')).toBe(false);
  });

  it('rewrites stages for Simple/Contrary and retaliates with Defiant', () => {
    expect(abilityRewriteStageDelta('contrary', { atk: -1 })).toEqual({ atk: 1 });
    expect(abilityRewriteStageDelta('simple', { spe: 1 })).toEqual({ spe: 2 });
    expect(abilityRetaliateStatDrop('defiant', true)).toEqual({ atk: 2 });
    expect(abilityRetaliateStatDrop('competitive', true)).toEqual({ spa: 2 });
    expect(abilityPreventsStatDrop('big-pecks', 'def')).toBe(true);
  });

  it('traps with Arena Trap / Shadow Tag / Magnet Pull and blocks Roar with Suction Cups', () => {
    expect(abilityTrapsFoe('arena-trap', ['normal'])).toBe(true);
    expect(abilityTrapsFoe('arena-trap', ['flying'])).toBe(false);
    expect(abilityTrapsFoe('arena-trap', ['normal'], 'levitate')).toBe(false);
    expect(abilityTrapsFoe('shadow-tag', ['ghost'])).toBe(true);
    expect(abilityTrapsFoe('magnet-pull', ['steel'])).toBe(true);
    expect(abilityTrapsFoe('magnet-pull', ['water'])).toBe(false);
    expect(abilityBlocksForcedSwitch('suction-cups')).toBe(true);
  });

  it('heals on switch-out with Regenerator and copies with Trace/Download', () => {
    expect(abilityOnSwitchOut('regenerator', 50, 90)).toEqual({ clearStatus: false, heal: 30 });
    expect(abilityOnSwitchOut('natural-cure', 50, 90)).toEqual({ clearStatus: true, heal: 0 });
    const traced = describeSwitchInAbility('trace', 'Gardevoir', {
      foe: { id: 6, types: ['fire'], ability: 'blaze' },
    });
    expect(traced.tracedAbility).toBe('blaze');
    const download = describeSwitchInAbility('download', 'Porygon', {
      foeDefense: 40,
      foeSpDefense: 80,
    });
    expect(download.download).toEqual({ atk: 1 });
  });

  it('applies after-hit triggers and KO payoffs', () => {
    const hit = abilityAfterBeingHit({
      defenderAbility: 'justified',
      defenderName: 'Lucario',
      moveType: 'dark',
      moveSlug: 'crunch',
      category: 'physical',
      crit: false,
      damage: 20,
      rng: () => 1,
    });
    expect(hit.defenderStageDelta?.atk).toBe(1);
    const ko = abilityOnKnockOut({
      attackerAbility: 'moxie',
      defenderAbility: 'aftermath',
      contact: true,
      attackerMaxHp: 80,
    });
    expect(ko.moxie).toBe(true);
    expect(ko.aftermathDamage).toBe(20);
  });

  it('absorbs sound and wind, and doubles weight for Heavy Metal', () => {
    expect(abilityAbsorbsMove('soundproof', 'normal', 'hyper-voice')).toBe('immune');
    expect(abilityAbsorbsMove('wind-rider', 'flying', 'gust')).toBe('boost');
    expect(abilityWeightMult('heavy-metal')).toBe(2);
    expect(abilityWeightMult('light-metal')).toBe(0.5);
    expect(abilityNeverMisses('no-guard', undefined)).toBe(true);
    expect(abilityPriorityBonus('prankster', 'status')).toBe(1);
    expect(abilityBlocksExplosion(['damp'])).toBe(true);
    expect(abilityDrainHurtsAttacker('liquid-ooze')).toBe(true);
  });
});
