import { asset } from '../utils/asset';
import type { SpireView } from './types';

export function isSpireBossNode(currentNodeId: string | null, mapNodes: { id: string; kind: string }[] | undefined): boolean {
  if (!currentNodeId || !mapNodes) return false;
  return mapNodes.some((node) => node.id === currentNodeId && node.kind === 'boss');
}

export function spireBackgroundUrl(view: SpireView | undefined, bossFight: boolean): string {
  if (view === 'combat') return asset(bossFight ? 'img/spire-boss.png' : 'img/spire-battle.png');
  if (view === 'map') return asset('img/spire-map.png');
  if (view === 'shop') return asset('img/spire-shop.png');
  if (view === 'rewards') return asset('img/spire-rewards.png');
  if (view === 'event' || view === 'treasure' || view === 'rest') {
    return asset('img/spire-event.png');
  }
  return asset('img/spire-lobby.png');
}
