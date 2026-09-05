import { getCardDef } from '../data/cards';
import { findRelicDef, pickupGoldFor } from '../data/relics';
import { addPotion } from './rewards';
import type { AcquireItem, CardInstance, SpireRun } from '../types';

export function queueAcquire(run: SpireRun, items: AcquireItem | AcquireItem[]): void {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return;
  run.pendingAcquire = [...(run.pendingAcquire ?? []), ...list];
}

export function grantRelic(run: SpireRun, id: string): boolean {
  if (!findRelicDef(id) || run.relics.includes(id)) return false;
  run.relics.push(id);
  run.gold += pickupGoldFor(id);
  queueAcquire(run, { type: 'relic', id });
  return true;
}

export function grantPotion(run: SpireRun, id: string): boolean {
  if (!run.potions.includes(null)) return false;
  run.potions = addPotion(run.potions, id);
  queueAcquire(run, { type: 'potion', id });
  return true;
}

export function grantCard(run: SpireRun, card: CardInstance): void {
  run.deck.push(card);
  if (getCardDef(card.defId).rarity === 'rare') run.actRareTaken = true;
  queueAcquire(run, { type: 'card', card });
}
