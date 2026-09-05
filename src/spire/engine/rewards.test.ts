import { describe, expect, it } from 'vitest';
import { cardsForCharacter, colorlessCards, getCardDef } from '../data/cards';
import { CHARACTER_IDS } from '../data/characters';
import { POTION_IDS } from '../data/potions';
import {
  isRewardCard,
  rollCardDefId,
  rollCardRewards,
  buildCombatRewards,
  buildShopStock,
  relicPrice,
  rollPotionId,
} from './rewards';
import { mulberry32 } from './rng';

describe('spire card rewards', () => {
  it('never includes starter cards in character or colorless pools', () => {
    for (const id of CHARACTER_IDS) {
      expect(cardsForCharacter(id).every(isRewardCard)).toBe(true);
      expect(cardsForCharacter(id, 'starter')).toEqual([]);
    }
    expect(colorlessCards().every(isRewardCard)).toBe(true);
    expect(colorlessCards('starter')).toEqual([]);
    expect(isRewardCard(getCardDef('petal'))).toBe(false);
    expect(isRewardCard(getCardDef('seed'))).toBe(false);
    expect(cardsForCharacter('bloom').some((c) => c.id === 'petal')).toBe(false);
    expect(cardsForCharacter('bloom').some((c) => c.id === 'seed')).toBe(false);
    for (const id of [
      'pollen-puff',
      'petal-blizzard',
      'sludge-wave',
      'effect-spore',
      'power-whip',
      'overgrow',
      'toxic-spikes',
      'aromatherapy',
      'seed-flare',
      'bloom-doom',
    ]) {
      expect(cardsForCharacter('bloom').some((c) => c.id === id)).toBe(true);
      expect(isRewardCard(getCardDef(id))).toBe(true);
    }
  });

  it('never rolls a starter card for combat rewards, shop, or events', () => {
    for (const characterId of CHARACTER_IDS) {
      const rng = mulberry32(characterId === 'blaze' ? 7 : characterId === 'tide' ? 11 : 21);
      const seq = { n: 0 };
      const rewards = rollCardRewards(characterId, rng, seq, 3);
      expect(rewards).toHaveLength(3);
      for (const card of rewards) {
        expect(isRewardCard(getCardDef(card.defId))).toBe(true);
      }
      for (let i = 0; i < 80; i += 1) {
        const id = rollCardDefId(characterId, rng);
        expect(isRewardCard(getCardDef(id))).toBe(true);
        const forced = rollCardDefId(characterId, rng, 'starter');
        expect(isRewardCard(getCardDef(forced))).toBe(true);
      }
    }
  });

  it('escape rope upgrades the combat card reward offers', () => {
    const rng = mulberry32(3);
    const offer = buildCombatRewards({
      characterId: 'blaze',
      rng,
      seq: { n: 0 },
      gold: 10,
      relics: [],
      potions: [null, null, null],
      source: 'monster',
      upgradeCards: true,
    });
    expect(offer.cards.length).toBeGreaterThan(0);
    expect(offer.cards.every((c) => c.upgraded)).toBe(true);
  });

  it('combat rewards never include colorless cards', () => {
    for (const characterId of CHARACTER_IDS) {
      const rng = mulberry32(characterId === 'blaze' ? 7 : characterId === 'tide' ? 11 : 21);
      for (let i = 0; i < 30; i += 1) {
        const rewards = rollCardRewards(characterId, rng, { n: i * 10 }, 3);
        expect(rewards).toHaveLength(3);
        for (const card of rewards) {
          const def = getCardDef(card.defId);
          expect(def.character).toBe(characterId);
          expect(isRewardCard(def)).toBe(true);
        }
      }
    }
  });

  it('shop stocks six cards with at most two colorless and one rare', () => {
    let sawClass = false;
    let sawColorless = false;
    for (let seed = 1; seed < 80; seed += 1) {
      const stock = buildShopStock('blaze', mulberry32(seed), { n: 0 }, []);
      expect(stock.cards).toHaveLength(6);
      const rares = stock.cards.filter((c) => getCardDef(c.defId).rarity === 'rare');
      const colorless = stock.cards.filter((c) => !getCardDef(c.defId).character);
      expect(rares.length).toBeLessThanOrEqual(1);
      expect(colorless.length).toBeLessThanOrEqual(2);
      for (const card of stock.cards) {
        const def = getCardDef(card.defId);
        expect(isRewardCard(def)).toBe(true);
        expect(!def.character || def.character === 'blaze').toBe(true);
        if (def.character === 'blaze') sawClass = true;
        if (!def.character) sawColorless = true;
      }
      expect(stock.relics).not.toContain('amulet-coin');
    }
    expect(sawClass).toBe(true);
    expect(sawColorless).toBe(true);
  });

  it('act boss rewards are three rares and a rare relic', () => {
    const offer = buildCombatRewards({
      characterId: 'bloom',
      rng: mulberry32(4),
      seq: { n: 0 },
      gold: 80,
      relics: [],
      potions: [null, null, null],
      source: 'boss',
    });
    expect(offer.cards).toHaveLength(3);
    expect(offer.cards.every((c) => getCardDef(c.defId).rarity === 'rare')).toBe(true);
    expect(offer.cards.every((c) => getCardDef(c.defId).character === 'bloom')).toBe(true);
    expect(offer.relicId).toBeTruthy();
  });

  it('elite fights drop a potion when the relic roll misses', () => {
    const offer = buildCombatRewards({
      characterId: 'blaze',
      rng: () => 0.9,
      seq: { n: 0 },
      gold: 40,
      relics: [],
      potions: [null, null, null],
      source: 'elite',
    });
    expect(offer.relicId).toBeUndefined();
    expect(offer.potionId).toBeTruthy();
    expect(offer.potionTaken).toBe(false);
  });

  it('can lock rare cards out of shops and hallway rewards without touching relics', () => {
    for (let seed = 1; seed < 80; seed += 1) {
      const stock = buildShopStock('blaze', mulberry32(seed), { n: 0 }, [], { allowRare: false });
      expect(stock.cards.every((c) => getCardDef(c.defId).rarity !== 'rare')).toBe(true);
      expect(stock.relics.length).toBeGreaterThan(0);
    }
    for (let i = 0; i < 40; i += 1) {
      const offer = buildCombatRewards({
        characterId: 'blaze',
        rng: mulberry32(i + 3),
        seq: { n: 0 },
        gold: 20,
        relics: [],
        potions: [null, null, null],
        source: 'monster',
        allowRare: false,
      });
      expect(offer.cards.every((c) => getCardDef(c.defId).rarity !== 'rare')).toBe(true);
    }
    const boss = buildCombatRewards({
      characterId: 'blaze',
      rng: mulberry32(4),
      seq: { n: 0 },
      gold: 80,
      relics: [],
      potions: [null, null, null],
      source: 'boss',
      allowRare: false,
    });
    expect(boss.cards.every((c) => getCardDef(c.defId).rarity === 'rare')).toBe(true);
    expect(boss.relicId).toBeTruthy();
  });

  it('prices shop relics between 250 and 350', () => {
    expect(relicPrice('common')).toBe(250);
    expect(relicPrice('uncommon')).toBe(300);
    expect(relicPrice('rare')).toBe(350);
  });

  it('does not roll Potion or Super Potion into the potion pool', () => {
    expect(POTION_IDS).not.toContain('potion');
    expect(POTION_IDS).not.toContain('super-potion');
    const rng = mulberry32(9);
    for (let i = 0; i < 40; i += 1) {
      expect(['potion', 'super-potion']).not.toContain(rollPotionId(rng));
    }
  });
});
