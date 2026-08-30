import type { MusicTrack } from '../utils/music';
import { isSpireBossNode } from './backgrounds';
import type { SpireRun } from './types';

const HALLWAY: Record<1 | 2 | 3, MusicTrack> = {
  1: 'spireHallway1',
  2: 'spireHallway2',
  3: 'spireHallway3',
};

export function spireMusicTrack(run: SpireRun | null | undefined): MusicTrack {
  const view = run?.view ?? 'select';
  if (view === 'combat') {
    if (isSpireBossNode(run?.currentNodeId ?? null, run?.map?.nodes)) return 'spireBoss';
    return HALLWAY[run?.hallwayTheme ?? 1];
  }
  if (view === 'shop' || view === 'event' || view === 'treasure' || view === 'rest') {
    return 'spireShop';
  }
  if (view === 'victory') return 'gamewin';
  if (view === 'defeat') return 'gamelose';
  if (run?.act === 2) return 'spireAct2';
  if (run?.act === 3) return 'spireAct3';
  return 'spireAct1';
}
