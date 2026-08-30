import { describe, expect, it } from 'vitest';
import { biomesForAct } from '../data/biomes';
import { ACT_LEGENDARY_POOLS, rollActBossPool } from '../data/enemies';
import { bossReachable, generateActMap, restBeforeBoss } from './map';
import { mulberry32 } from './rng';

describe('spire map', () => {
  it('boss is reachable from start and rest sits before the boss', () => {
    for (const seed of [1, 2, 42, 99, 128]) {
      const rng = mulberry32(seed);
      const biome = biomesForAct(1)[0]!;
      const map = generateActMap(1, biome.id, rng);
      expect(bossReachable(map)).toBe(true);
      expect(restBeforeBoss(map)).toBe(true);
    }
  });

  it('non-boss nodes have outgoing paths', () => {
    const map = generateActMap(2, biomesForAct(2)[0]!.id, mulberry32(7));
    const orphans = map.nodes.filter((n) => n.id !== map.bossId && n.nextIds.length === 0);
    expect(orphans).toHaveLength(0);
  });

  it('each act rolls a unique pool of three legendary bosses', () => {
    for (const act of [1, 2, 3] as const) {
      const pool = rollActBossPool(act, mulberry32(act * 17));
      expect(pool).toHaveLength(3);
      expect(new Set(pool).size).toBe(3);
      expect(pool.every((id) => ACT_LEGENDARY_POOLS[act].includes(id))).toBe(true);
    }
  });

  it('places start and boss on the center lane', () => {
    const map = generateActMap(1, biomesForAct(1)[0]!.id, mulberry32(5));
    const start = map.nodes.find((n) => n.id === map.startId)!;
    const boss = map.nodes.find((n) => n.id === map.bossId)!;
    expect(start.row).toBe(3);
    expect(boss.row).toBe(3);
    expect(start.nextIds.length).toBeGreaterThanOrEqual(2);
  });

  it('start node has outgoing paths', () => {
    const map = generateActMap(3, biomesForAct(3)[0]!.id, mulberry32(11));
    const start = map.nodes.find((n) => n.id === map.startId)!;
    expect(start.nextIds.length).toBeGreaterThan(0);
  });
});
