import { describe, expect, it } from 'vitest';
import { cardsForCharacter, colorlessCards, getCardDef } from '../data/cards';
import { CHARACTER_IDS } from '../data/characters';
import { POTION_IDS } from '../data/potions';
import { isRewardCard, rollCardDefId, rollCardRewards, buildCombatRewards, rollPotionId } from './rewards';
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
    expect(cardsForCharacter('bloom').some((c) => c.id === 'petal')).toBe(false);
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

  it('does not roll Potion or Super Potion into the potion pool', () => {
    expect(POTION_IDS).not.toContain('potion');
    expect(POTION_IDS).not.toContain('super-potion');
    const rng = mulberry32(9);
    for (let i = 0; i < 40; i += 1) {
      expect(['potion', 'super-potion']).not.toContain(rollPotionId(rng));
    }
  });
});
