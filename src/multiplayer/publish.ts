import type { SpinnerSegment } from '../components/Wheel';
import type { SpectateActivityEvent, SpectateWheelEvent } from './protocol';
import { isHostConnected, useMultiplayerStore } from './useMultiplayerStore';

function serializeSegments(segments: SpinnerSegment[]) {
  return segments.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    icon: s.icon,
    image: s.image,
    comingSoon: s.comingSoon,
    weight: s.weight,
  }));
}

/** Broadcast a wheel spin so the guest can replay the same animation/result. */
export function publishHostWheelSpin(opts: {
  kind: SpectateWheelEvent['kind'];
  title: string;
  segments: SpinnerSegment[];
  result: Pick<SpinnerSegment, 'id' | 'label'>;
}): void {
  if (!isHostConnected()) return;
  const event: SpectateWheelEvent = {
    id: Date.now(),
    kind: opts.kind,
    title: opts.title,
    segments: serializeSegments(opts.segments),
    resultSegmentId: opts.result.id,
    resultLabel: opts.result.label,
  };
  useMultiplayerStore.getState().setSpectateWheel(event);
}

/** Broadcast a minigame / activity outcome for the guest to read. */
export function publishHostActivity(opts: Omit<SpectateActivityEvent, 'id'>): void {
  if (!isHostConnected()) return;
  const event: SpectateActivityEvent = {
    id: Date.now(),
    ...opts,
  };
  useMultiplayerStore.getState().setSpectateActivity(event);
}

export function clearHostSpectateWheel(): void {
  if (!isHostConnected()) return;
  useMultiplayerStore.getState().setSpectateWheel(null);
}
