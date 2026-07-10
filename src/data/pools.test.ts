import { describe, expect, it } from 'vitest';
import { getRegionCatchSegments } from '../data/pools';

describe('pools', () => {
  it('hides fossil wedge in Johto catch path', () => {
    const johto = getRegionCatchSegments('Johto');
    expect(johto.some((s) => s.activity === 'fossil')).toBe(false);
    const kanto = getRegionCatchSegments('Kanto');
    expect(kanto.some((s) => s.activity === 'fossil')).toBe(true);
  });
});
