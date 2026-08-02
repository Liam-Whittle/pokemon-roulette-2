import { describe, expect, it } from 'vitest';
import { PATHWAY_SEGMENTS, SHOP_CATALOG } from '../data/pools';

describe('pools', () => {
  it('explore path has 9 equal wedges including trainer and rival', () => {
    const explore = PATHWAY_SEGMENTS.explore;
    expect(explore).toHaveLength(9);
    expect(explore.some((s) => s.activity === 'trainer')).toBe(true);
    expect(explore.some((s) => s.activity === 'rival')).toBe(true);
    expect(explore.every((s) => s.weight == null)).toBe(true);
  });

  it('full heal costs 250 with limited stock', () => {
    const fullheal = SHOP_CATALOG.find((i) => i.id === 'fullheal');
    expect(fullheal?.price).toBe(250);
    expect(fullheal?.stock).toBe(3);
  });
});
