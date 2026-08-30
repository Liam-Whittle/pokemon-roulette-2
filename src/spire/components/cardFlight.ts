import { resolveCard } from '../data/cards';
import type { CardInstance } from '../types';
import { handFanPose } from '../views/handFan';

export const HAND_CARD_W = 152;
export const HAND_CARD_H = 184;
export const DRAW_MS = 360;
export const DISCARD_MS = 380;
export const EXHAUST_MS = 640;
export const STAGGER_MS = 52;

export type PileKind = 'draw' | 'discard' | 'exhaust';
export type FlightMotion = 'draw' | 'discard' | 'exhaust';

export interface CardPose {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotate: number;
}

export interface ZoneSnap {
  hand: CardInstance[];
  discard: CardInstance[];
  exhaust: CardInstance[];
  draw: CardInstance[];
  powers?: CardInstance[];
}

export interface ZoneDiff {
  arriving: CardInstance[];
  departing: {
    card: CardInstance;
    motion: Exclude<FlightMotion, 'draw'>;
    dest: PileKind;
  }[];
}

export interface CardFlight {
  id: string;
  card: CardInstance;
  motion: FlightMotion;
  from: CardPose;
  to: CardPose;
  delay: number;
}

export function poseFromEl(el: Element | null | undefined): CardPose | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  const fanRaw = (el as HTMLElement).style?.getPropertyValue('--fan')
    || getComputedStyle(el).getPropertyValue('--fan');
  const rotate = Number.parseFloat(fanRaw) || 0;
  return {
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    w: r.width,
    h: r.height,
    rotate,
  };
}

export function pilePose(kind: PileKind): CardPose {
  const el = document.querySelector(`[data-spire-pile="${kind}"]`);
  const measured = poseFromEl(el);
  if (measured) return { ...measured, rotate: kind === 'draw' ? -10 : kind === 'exhaust' ? 8 : 12 };
  return fallbackPilePose(kind);
}

export function fallbackPilePose(kind: PileKind): CardPose {
  const w = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const h = typeof window === 'undefined' ? 800 : window.innerHeight;
  const y = h - 52;
  if (kind === 'draw') return { cx: 48, cy: y, w: 66, h: 86, rotate: -10 };
  if (kind === 'exhaust') return { cx: w - 48, cy: y - 96, w: 66, h: 86, rotate: 8 };
  return { cx: w - 48, cy: y, w: 66, h: 86, rotate: 12 };
}

export function fallbackHandPose(index: number, total: number): CardPose {
  const w = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const h = typeof window === 'undefined' ? 800 : window.innerHeight;
  const n = Math.max(1, total);
  const mid = (n - 1) / 2;
  const offset = index - mid;
  const { fan, lift } = handFanPose(index, n);
  return {
    cx: w / 2 + offset * 72,
    cy: h - 120 + lift,
    w: HAND_CARD_W,
    h: HAND_CARD_H,
    rotate: fan,
  };
}

export function wouldExhaust(card: CardInstance): boolean {
  const def = resolveCard(card);
  return !!def.exhaust || def.kind === 'power' || def.effects.some((effect) => effect.op === 'exhaust');
}

function idsOf(cards: CardInstance[]): Set<string> {
  return new Set(cards.map((card) => card.instanceId));
}

export function diffCardZones(prev: ZoneSnap | null, next: ZoneSnap): ZoneDiff {
  if (!prev) {
    return { arriving: [...next.hand], departing: [] };
  }
  const prevHand = idsOf(prev.hand);
  const nextHand = idsOf(next.hand);
  const nextDiscard = idsOf(next.discard);
  const nextExhaust = idsOf(next.exhaust);
  const nextDraw = idsOf(next.draw);

  const arriving = next.hand.filter((card) => !prevHand.has(card.instanceId));
  const nextPowers = idsOf(next.powers ?? []);
  const departing = prev.hand
    .filter((card) => !nextHand.has(card.instanceId) && !nextPowers.has(card.instanceId))
    .map((card) => {
      const exhaustVisual = nextExhaust.has(card.instanceId);
      let dest: PileKind = 'discard';
      if (nextExhaust.has(card.instanceId)) dest = 'exhaust';
      else if (nextDiscard.has(card.instanceId)) dest = 'discard';
      else if (nextDraw.has(card.instanceId)) dest = 'draw';
      else dest = 'discard';
      return {
        card,
        motion: (exhaustVisual ? 'exhaust' : 'discard') as Exclude<FlightMotion, 'draw'>,
        dest,
      };
    });

  return { arriving, departing };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
