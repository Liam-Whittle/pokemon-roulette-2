import { describe, expect, it } from 'vitest';
import { cardKeywordTips, extraKeywordKindsForCard } from '../data/keywordTips';
import { tokenizeCardText } from './cardText';

function kinds(text: string, printed?: string) {
  return tokenizeCardText(text, printed)
    .filter((t) => t.kind)
    .map((t) => `${t.text}:${t.kind}${t.live ? ':live' : ''}`);
}

describe('card text highlighting', () => {
  it('colors damage gold and burn orange', () => {
    expect(kinds('Apply 1 Burn. Deal 4 damage.')).toEqual([
      '1:burn',
      'Burn:burn',
      '4:damage',
    ]);
  });

  it('colors block numbers blue', () => {
    expect(kinds('Gain 5 Block. If this is discarded, gain 8 Block.')).toEqual([
      '5:block',
      'discarded:discard',
      '8:block',
    ]);
  });

  it('colors seeds like the garden token', () => {
    expect(kinds('Gain 5 Block. Add 2 Seeds to your hand.')).toEqual([
      '5:block',
      '2:num',
      'Seeds:seed',
    ]);
  });

  it('colors toxic magenta', () => {
    expect(kinds('Deal 2 damage. Deal 7 damage if the enemy is Toxic.')).toEqual([
      '2:damage',
      '7:damage',
      'Toxic:toxic',
    ]);
  });

  it('does not color Block inside unblocked', () => {
    expect(kinds('If the enemy takes unblocked damage, deal 15 more damage.')).toEqual([
      '15:damage',
    ]);
  });

  it('marks live-changed damage numbers', () => {
    const tokens = tokenizeCardText('Apply 1 Burn. Deal 6 damage.', 'Apply 1 Burn. Deal 4 damage.');
    const six = tokens.find((t) => t.text === '6');
    expect(six?.kind).toBe('damage');
    expect(six?.live).toBe(true);
  });
});

describe('card keyword tips', () => {
  it('explains seed on horn leech and the seed token itself', () => {
    const horn = cardKeywordTips('Deal 6 damage. Heal 3 HP. Add a Seed to your hand.');
    expect(horn.map((tip) => tip.kind)).toEqual(['seed']);
    expect(horn[0]!.body).toMatch(/Heal 2 HP/);
    const token = cardKeywordTips(
      'Heal 2 HP. If this is discarded, apply 1 Toxic. Exhaust.',
      extraKeywordKindsForCard('seed'),
    );
    expect(token.map((tip) => tip.kind)).toEqual(['seed', 'toxic', 'exhaust', 'discard']);
  });

  it('explains frail and weak without printing the rule on the card', () => {
    const tips = cardKeywordTips('Apply 2 Weak and 1 Frail.');
    expect(tips.map((tip) => tip.kind)).toEqual(['frail', 'weak']);
    expect(tips.find((tip) => tip.kind === 'frail')?.body).toMatch(/ignore 50% of Block/);
  });

  it('skips basic damage and block text', () => {
    expect(cardKeywordTips('Deal 5 damage. Gain 3 Block.')).toEqual([]);
  });
});
