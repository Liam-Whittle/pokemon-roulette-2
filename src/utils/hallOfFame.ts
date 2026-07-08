import type { ChampionRecord } from '../types/game';

/** Compare champions for ranking: Time → Items → Lives → Revives → Faints (lower better). */
export function compareChampions(a: ChampionRecord, b: ChampionRecord): number {
  return (
    a.timeMs - b.timeMs ||
    a.itemsUsed - b.itemsUsed ||
    a.livesUsed - b.livesUsed ||
    a.revivesUsed - b.revivesUsed ||
    a.faints - b.faints
  );
}

export function sortChampions(records: ChampionRecord[]): ChampionRecord[] {
  return [...records].sort(compareChampions);
}

/** Format a run duration, e.g. `1h 23m 45s`, `12m 05s`, or `42s`. */
export function formatRunTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}
