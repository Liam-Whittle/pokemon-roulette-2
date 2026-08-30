import { describe, expect, it } from 'vitest';
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
      '8:block',
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
    expect(kinds('If the enemy takes unblocked damage, deal 30 more damage.')).toEqual([
      '30:damage',
    ]);
  });

  it('marks live-changed damage numbers', () => {
    const tokens = tokenizeCardText('Apply 1 Burn. Deal 6 damage.', 'Apply 1 Burn. Deal 4 damage.');
    const six = tokens.find((t) => t.text === '6');
    expect(six?.kind).toBe('damage');
    expect(six?.live).toBe(true);
  });
});
