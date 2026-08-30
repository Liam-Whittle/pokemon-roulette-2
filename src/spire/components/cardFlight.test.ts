import { describe, expect, it } from 'vitest';
import { diffCardZones, wouldExhaust } from './cardFlight';
import type { CardInstance } from '../types';

function card(id: string, defId: string): CardInstance {
  return { instanceId: id, defId, upgraded: false };
}

describe('diffCardZones', () => {
  it('treats the first snapshot as a full draw into hand', () => {
    const a = card('a', 'ember');
    const b = card('b', 'scratch');
    const diff = diffCardZones(null, { hand: [a, b], discard: [], exhaust: [], draw: [] });
    expect(diff.arriving.map((c) => c.instanceId)).toEqual(['a', 'b']);
    expect(diff.departing).toEqual([]);
  });

  it('detects draws and discards independently', () => {
    const keep = card('keep', 'protect-blaze');
    const gone = card('gone', 'ember');
    const fresh = card('fresh', 'scratch');
    const diff = diffCardZones(
      { hand: [keep, gone], discard: [], exhaust: [], draw: [fresh] },
      { hand: [keep, fresh], discard: [gone], exhaust: [], draw: [] },
    );
    expect(diff.arriving.map((c) => c.instanceId)).toEqual(['fresh']);
    expect(diff.departing).toEqual([
      { card: gone, motion: 'discard', dest: 'discard' },
    ]);
  });

  it('routes exhausted cards to the exhaust pile with exhaust motion', () => {
    const dash = card('dash', 'flame-charge');
    const diff = diffCardZones(
      { hand: [dash], discard: [], exhaust: [], draw: [] },
      { hand: [], discard: [], exhaust: [dash], draw: [] },
    );
    expect(diff.departing).toEqual([
      { card: dash, motion: 'exhaust', dest: 'exhaust' },
    ]);
  });

  it('uses discard motion when a card lands in the discard pile', () => {
    const power = card('power', 'swords-dance');
    expect(wouldExhaust(power)).toBe(true);
    const diff = diffCardZones(
      { hand: [power], discard: [], exhaust: [], draw: [] },
      { hand: [], discard: [power], exhaust: [], draw: [] },
    );
    expect(diff.departing).toEqual([
      { card: power, motion: 'discard', dest: 'discard' },
    ]);
  });

  it('does not fly a played power that stays under the player', () => {
    const power = card('power', 'heat-up');
    const diff = diffCardZones(
      { hand: [power], discard: [], exhaust: [], draw: [] },
      { hand: [], discard: [], exhaust: [power], draw: [], powers: [power] },
    );
    expect(diff.departing).toEqual([]);
  });
});
