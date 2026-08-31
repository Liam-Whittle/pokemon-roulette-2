import type { MusicTrack } from '../utils/music';
import { spireCurrentNodeKind } from './backgrounds';
import type { SpireRun } from './types';

const HALLWAY: Record<1 | 2 | 3, MusicTrack> = {
  1: 'spireHallway1',
  2: 'spireHallway2',
  3: 'spireHallway3',
};
const ELITE: Record<1 | 2, MusicTrack> = {
  1: 'spireElite1',
  2: 'spireElite2',
};
const BOSS: Record<1 | 2 | 3, MusicTrack> = {
  1: 'spireBoss1',
  2: 'spireBoss2',
  3: 'spireBoss3',
};

function hallwayTheme(run: SpireRun | null | undefined): 1 | 2 | 3 {
  return run?.hallwayTheme === 2 || run?.hallwayTheme === 3 ? run.hallwayTheme : 1;
}

export function spireMusicTrack(run: SpireRun | null | undefined): MusicTrack {
  const view = run?.view ?? 'select';
  if (view === 'combat') {
    const kind = spireCurrentNodeKind(run?.currentNodeId ?? null, run?.map?.nodes);
    if (kind === 'boss') return BOSS[run?.act === 2 || run?.act === 3 ? run.act : 1];
    if (kind === 'elite') return ELITE[run?.hallwayTheme === 2 ? 2 : 1];
    return HALLWAY[hallwayTheme(run)];
  }
  if (view === 'shop') return 'spireShop';
  if (view === 'event' || view === 'treasure') return 'spireEvent';
  if (view === 'rest') return 'spirePokecenter';
  if (view === 'victory') return 'gamewin';
  if (view === 'defeat') return 'gamelose';
  if (run?.act === 2) return 'spireAct2';
  if (run?.act === 3) return 'spireAct3';
  return 'spireAct1';
}
