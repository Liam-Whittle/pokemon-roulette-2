import type { ActMap, MapNode, NodeKind } from '../types';
import type { Rng } from './rng';
import { intBetween } from './rng';

const COLUMNS = 14;
const ROWS = 7;
const REST_COLUMN = 12;
const BOSS_COLUMN = 13;
const TREASURE_COLUMN = 9;

function kindFor(column: number, rng: Rng): NodeKind {
  if (column === 0) return 'start';
  if (column === BOSS_COLUMN) return 'boss';
  if (column === REST_COLUMN) return 'rest';
  if (column === TREASURE_COLUMN) return 'treasure';
  if (column <= 4) {
    const roll = rng();
    if (roll < 0.58) return 'monster';
    if (roll < 0.82) return 'event';
    if (roll < 0.93) return 'shop';
    return 'rest';
  }
  const roll = rng();
  if (roll < 0.36) return 'monster';
  if (roll < 0.56) return 'elite';
  if (roll < 0.76) return 'event';
  if (roll < 0.88) return 'shop';
  return 'rest';
}

const CENTER_ROW = Math.floor(ROWS / 2);

function centeredRows(count: number): number[] {
  if (count <= 1) return [CENTER_ROW];
  const span = Math.min(ROWS, count + (count >= 4 ? 1 : 2));
  const start = Math.max(0, CENTER_ROW - Math.floor((span - 1) / 2));
  const candidates = Array.from({ length: span }, (_, i) => start + i).filter((row) => row < ROWS);
  const rows: number[] = [];
  const step = (candidates.length - 1) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    const row = candidates[Math.round(i * step)]!;
    if (!rows.includes(row)) rows.push(row);
  }
  for (const row of candidates) {
    if (rows.length >= count) break;
    if (!rows.includes(row)) rows.push(row);
  }
  return rows.sort((a, b) => a - b);
}

export function generateActMap(act: 1 | 2 | 3, biomeId: string, rng: Rng, bossPool: string[] = []): ActMap {
  const nodes: MapNode[] = [];
  const byColumn: MapNode[][] = [];

  for (let col = 0; col < COLUMNS; col += 1) {
    const count = col === 0 || col === BOSS_COLUMN ? 1 : col === REST_COLUMN || col === TREASURE_COLUMN ? 2 : intBetween(rng, 3, 4);
    const rows = centeredRows(count);
    const colNodes: MapNode[] = rows.map((row, i) => ({
      id: `n-${act}-${col}-${i}`,
      column: col,
      row,
      kind: kindFor(col, rng),
      nextIds: [],
    }));
    byColumn.push(colNodes);
    nodes.push(...colNodes);
  }

  for (let col = 0; col < COLUMNS - 1; col += 1) {
    const here = byColumn[col]!;
    const next = byColumn[col + 1]!;
    for (const node of here) {
      const nearby = next.filter((n) => Math.abs(n.row - node.row) <= 2);
      const pool = nearby.length > 0 ? nearby : next;
      const sorted = [...pool].sort((a, b) => Math.abs(a.row - node.row) - Math.abs(b.row - node.row));
      const extraChance = col === 0 ? 0.85 : 0.28;
      const extra = sorted[1] && Math.abs(sorted[1].row - node.row) <= 2 && rng() < extraChance;
      const third = col === 0 && sorted[2] && rng() < 0.45;
      const links = 1 + (extra ? 1 : 0) + (third ? 1 : 0);
      for (let i = 0; i < links; i += 1) {
        const target = sorted[i]!;
        if (!node.nextIds.includes(target.id)) node.nextIds.push(target.id);
      }
    }
    for (const target of next) {
      const hasIncoming = here.some((n) => n.nextIds.includes(target.id));
      if (!hasIncoming) {
        const closest = [...here].sort((a, b) => Math.abs(a.row - target.row) - Math.abs(b.row - target.row))[0]!;
        closest.nextIds.push(target.id);
      }
    }
  }

  const start = byColumn[0]![0]!;
  const boss = byColumn[BOSS_COLUMN]![0]!;
  return { act, biomeId, nodes, startId: start.id, bossId: boss.id, bossPool };
}

export function getNode(map: ActMap, id: string): MapNode | undefined {
  return map.nodes.find((n) => n.id === id);
}

export function bossReachable(map: ActMap): boolean {
  const seen = new Set<string>();
  const stack = [map.startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (id === map.bossId) return true;
    const node = getNode(map, id);
    if (node) stack.push(...node.nextIds);
  }
  return false;
}

export function restBeforeBoss(map: ActMap): boolean {
  const boss = getNode(map, map.bossId);
  if (!boss) return false;
  return map.nodes.some((n) => n.column === boss.column - 1 && n.kind === 'rest');
}
