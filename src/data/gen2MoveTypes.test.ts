import { describe, expect, it } from 'vitest';
import { applyGen2MoveType } from './gen2MoveTypes';
import { cachedMoveToStored } from './speciesCache';

describe('gen2MoveTypes', () => {
  it('remaps Gen II fairy moves to normal', () => {
    expect(applyGen2MoveType('moonlight', 'fairy')).toBe('normal');
    expect(applyGen2MoveType('charm', 'fairy')).toBe('normal');
    expect(applyGen2MoveType('sweet-kiss', 'fairy')).toBe('normal');
  });

  it('leaves other types unchanged', () => {
    expect(applyGen2MoveType('flamethrower', 'fire')).toBe('fire');
    expect(applyGen2MoveType('moonlight', 'normal')).toBe('normal');
  });

  it('applies via cachedMoveToStored for moonlight', () => {
    const move = cachedMoveToStored('moonlight');
    expect(move?.type).toBe('normal');
  });
});
