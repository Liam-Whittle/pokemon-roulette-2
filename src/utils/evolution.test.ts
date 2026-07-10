import { describe, expect, it } from 'vitest';
import { getAvailableEvolutions } from './evolution';

describe('evolution', () => {
  it('evolves Eevee to Espeon during daytime hours', () => {
    const original = Date.prototype.getHours;
    Date.prototype.getHours = () => 12;
    try {
      const evos = getAvailableEvolutions(133, 20, [], { region: 'Johto', caughtAt: Date.now() - 86_400_000 });
      expect(evos.some((e) => e.toId === 196)).toBe(true);
      expect(evos.some((e) => e.toId === 197)).toBe(false);
    } finally {
      Date.prototype.getHours = original;
    }
  });

  it('evolves Eevee to Umbreon at night', () => {
    const original = Date.prototype.getHours;
    Date.prototype.getHours = () => 22;
    try {
      const evos = getAvailableEvolutions(133, 20, [], { region: 'Johto', caughtAt: Date.now() - 86_400_000 });
      expect(evos.some((e) => e.toId === 197)).toBe(true);
      expect(evos.some((e) => e.toId === 196)).toBe(false);
    } finally {
      Date.prototype.getHours = original;
    }
  });

  it('blocks Johto-only evolutions in Kanto', () => {
    const evos = getAvailableEvolutions(133, 20, [], { region: 'Kanto' });
    expect(evos).toHaveLength(0);
  });

  it('lists stone and time evolutions for Eevee when all requirements are met', () => {
    const original = Date.prototype.getHours;
    Date.prototype.getHours = () => 12;
    try {
      const bag = [
        { id: 'firestone', name: 'Fire Stone', icon: '🔥', quantity: 1 },
        { id: 'waterstone', name: 'Water Stone', icon: '💧', quantity: 1 },
        { id: 'thunderstone', name: 'Thunder Stone', icon: '⚡', quantity: 1 },
      ];
      const evos = getAvailableEvolutions(133, 20, bag, {
        region: 'Johto',
        caughtAt: Date.now() - 6 * 60 * 1000,
      });
      expect(evos.map((e) => e.toId).sort((a, b) => a - b)).toEqual([134, 135, 136, 196]);
    } finally {
      Date.prototype.getHours = original;
    }
  });
});
