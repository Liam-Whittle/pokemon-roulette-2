import { describe, expect, it } from 'vitest';
import { handArchDrop, handFanPose } from './handFan';

describe('handFanPose', () => {
  it('keeps four or fewer cards upright and unshifted', () => {
    expect(handFanPose(0, 1)).toEqual({ fan: 0, lift: 0 });
    expect(handFanPose(0, 2)).toEqual({ fan: 0, lift: 0 });
    expect(handFanPose(1, 2)).toEqual({ fan: 0, lift: 0 });
    expect(handFanPose(0, 4)).toEqual({ fan: 0, lift: 0 });
    expect(handFanPose(3, 4)).toEqual({ fan: 0, lift: 0 });
    expect(handArchDrop(4)).toBe(0);
  });

  it('fans a 5-card hand less than a full hand', () => {
    const small = Math.abs(handFanPose(0, 5).fan);
    const full = Math.abs(handFanPose(0, 10).fan);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(full * 0.45);
  });

  it('fans left negative, right positive, with 0 rotation at the center', () => {
    const n = 5;
    const left = handFanPose(0, n);
    const mid = handFanPose(2, n);
    const right = handFanPose(4, n);
    expect(left.fan).toBeLessThan(0);
    expect(right.fan).toBeGreaterThan(0);
    expect(mid.fan).toBeCloseTo(0);
    expect(left.fan).toBeCloseTo(-right.fan);
  });

  it('drops the edges and keeps the apex highest (smaller translateY)', () => {
    const n = 7;
    const left = handFanPose(0, n);
    const mid = handFanPose(3, n);
    const inner = handFanPose(2, n);
    expect(mid.lift).toBeCloseTo(0);
    expect(left.lift).toBeGreaterThan(inner.lift);
    expect(inner.lift).toBeGreaterThan(mid.lift);
    expect(left.lift).toBeGreaterThanOrEqual(12);
    expect(left.lift).toBeLessThanOrEqual(28);
  });

  it('uses a gentle STS-like tilt for a full hand', () => {
    const edge = handFanPose(0, 10);
    expect(Math.abs(edge.fan)).toBeGreaterThanOrEqual(8);
    expect(Math.abs(edge.fan)).toBeLessThanOrEqual(14);
    expect(edge.lift).toBeGreaterThanOrEqual(12);
    expect(edge.lift).toBeLessThanOrEqual(28);
    expect(edge.lift).toBeCloseTo(handArchDrop(10));
  });
});
