import { describe, expect, it } from 'vitest';
import { RELICS, relicSpriteCandidates, relicSpriteFile } from './relics';

describe('relic sprites', () => {
  it('maps every relic to a PokeAPI item filename', () => {
    expect(Object.keys(RELICS).length).toBeGreaterThan(0);
    for (const id of Object.keys(RELICS)) {
      expect(relicSpriteFile(id)).toMatch(/^[a-z0-9-]+\.png$/);
    }
  });

  it('uses official item sprites when the relic id is not an item name', () => {
    expect(relicSpriteFile('running-shoes')).toBe('heavy-duty-boots.png');
    expect(relicSpriteFile('master-ball-relic')).toBe('master-ball.png');
    expect(relicSpriteFile('leftovers-plus')).toBe('shell-bell.png');
    expect(relicSpriteFile('charcoal')).toBe('charcoal.png');
  });

  it('loads Running Shoes from the bundled boots sprite first', () => {
    const [local, remote] = relicSpriteCandidates('running-shoes');
    expect(local).toContain('heavy-duty-boots.png');
    expect(remote).toContain('heavy-duty-boots.png');
  });
});
