import { useCallback, useEffect, useRef, useState } from 'react';

interface WheelPhysicsOptions {
  friction: number;
  minVelocity: number;
  onSpinStart?: () => void;
  onSpinEnd?: (finalAngle: number) => void;
  onWeakFlick?: () => void;
}

interface PointerSample {
  angle: number;
  time: number;
}

// Tuning: a valid flick must clear WEAK_FLICK (rad/s). Launch velocity is the
// per-frame angular speed, clamped so every real spin does several full
// rotations — you can't lightly nudge the wheel to a chosen segment.
const WEAK_FLICK = 4.0; // rad/s minimum to count as a spin
const MIN_LAUNCH = 0.24; // per-frame -> ~4 rotations at friction 0.99
const MAX_LAUNCH = 0.9;
// Quick spin uses a heavier decay so the wheel settles noticeably faster.
const QUICK_FRICTION = 0.965;

function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a;
}

function getPointerAngle(clientX: number, clientY: number, cx: number, cy: number): number {
  return Math.atan2(clientY - cy, clientX - cx);
}

export function useWheelPhysics(
  wheelRef: React.RefObject<HTMLElement | null>,
  options: WheelPhysicsOptions,
) {
  const { friction, minVelocity, onSpinStart, onSpinEnd, onWeakFlick } = options;
  const [angle, setAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPower, setDragPower] = useState(0);

  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number>(0);
  const samplesRef = useRef<PointerSample[]>([]);
  const lastPointerAngleRef = useRef(0);
  const peakSpeedRef = useRef(0);
  const fastRef = useRef(false);

  const animate = useCallback(() => {
    let v = velocityRef.current;
    v *= fastRef.current ? QUICK_FRICTION : friction;
    if (Math.abs(v) < minVelocity) {
      velocityRef.current = 0;
      fastRef.current = false;
      setIsSpinning(false);
      onSpinEnd?.(normalizeAngle(angleRef.current));
      return;
    }
    velocityRef.current = v;
    angleRef.current += v;
    setAngle(angleRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [friction, minVelocity, onSpinEnd]);

  const startSpin = useCallback(
    (launchVelocity: number) => {
      cancelAnimationFrame(rafRef.current);
      velocityRef.current = launchVelocity;
      setIsSpinning(true);
      onSpinStart?.();
      rafRef.current = requestAnimationFrame(animate);
    },
    [animate, onSpinStart],
  );

  // Auto-spin at a random speed with a faster decay so the result resolves quickly.
  const quickSpin = useCallback(() => {
    if (isSpinning || isDragging) return;
    fastRef.current = true;
    const magnitude = MAX_LAUNCH * (0.6 + Math.random() * 0.4);
    const direction = Math.random() < 0.5 ? -1 : 1;
    startSpin(direction * magnitude);
  }, [isSpinning, isDragging, startSpin]);

  // Returns angular speed in rad/s (signed) based on the most recent motion.
  const computeFlickSpeed = useCallback((): number => {
    const samples = samplesRef.current;
    if (samples.length < 2) return 0;

    const now = performance.now();
    // Only consider samples from the last 90ms so a pause-then-release reads as slow.
    const recent = samples.filter((s) => now - s.time <= 90);
    const window = recent.length >= 2 ? recent : samples.slice(-2);

    const first = window[0];
    const last = window[window.length - 1];
    const dt = (last.time - first.time) / 1000;
    if (dt <= 0) return 0;

    let delta = last.angle - first.angle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    return delta / dt;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isSpinning) return;
      const el = wheelRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const pointerAngle = getPointerAngle(e.clientX, e.clientY, cx, cy);

      setIsDragging(true);
      peakSpeedRef.current = 0;
      lastPointerAngleRef.current = pointerAngle;
      samplesRef.current = [{ angle: pointerAngle, time: performance.now() }];
      el.setPointerCapture(e.pointerId);
    },
    [isSpinning, wheelRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || isSpinning) return;
      const el = wheelRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const pointerAngle = getPointerAngle(e.clientX, e.clientY, cx, cy);

      let delta = pointerAngle - lastPointerAngleRef.current;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;

      angleRef.current += delta;
      setAngle(angleRef.current);
      lastPointerAngleRef.current = pointerAngle;

      const now = performance.now();
      samplesRef.current.push({ angle: pointerAngle, time: now });
      if (samplesRef.current.length > 16) samplesRef.current.shift();

      // Track the strongest instantaneous flick for live power feedback.
      const speed = Math.abs(computeFlickSpeed());
      peakSpeedRef.current = Math.max(peakSpeedRef.current, speed);
      setDragPower(Math.min(speed / 14, 1));
    },
    [isDragging, isSpinning, wheelRef, computeFlickSpeed],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      setDragPower(0);
      wheelRef.current?.releasePointerCapture(e.pointerId);

      const speed = computeFlickSpeed();
      if (Math.abs(speed) < WEAK_FLICK) {
        onWeakFlick?.();
        return;
      }

      const direction = Math.sign(speed) || 1;
      const magnitude = Math.min(MAX_LAUNCH, Math.max(MIN_LAUNCH, Math.abs(speed) / 60));
      startSpin(direction * magnitude);
    },
    [isDragging, computeFlickSpeed, startSpin, wheelRef, onWeakFlick],
  );

  /**
   * Animate the wheel to a known final angle (for remote spectate replay).
   * Travels several full rotations with an ease-out curve.
   */
  const spinToAngle = useCallback(
    (targetAngle: number, durationMs = 2200) => {
      cancelAnimationFrame(rafRef.current);
      velocityRef.current = 0;
      fastRef.current = false;
      setIsDragging(false);
      setDragPower(0);

      const start = angleRef.current;
      const startNorm = normalizeAngle(start);
      const targetNorm = normalizeAngle(targetAngle);
      let travel = targetNorm - startNorm;
      if (travel <= 0.05) travel += 2 * Math.PI;
      travel += 5 * 2 * Math.PI;

      const t0 = performance.now();
      setIsSpinning(true);
      onSpinStart?.();

      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - (1 - t) ** 3;
        angleRef.current = start + travel * eased;
        setAngle(angleRef.current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        angleRef.current = start + travel;
        setAngle(angleRef.current);
        velocityRef.current = 0;
        setIsSpinning(false);
        onSpinEnd?.(normalizeAngle(angleRef.current));
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [onSpinStart, onSpinEnd],
  );

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    angle,
    isSpinning,
    isDragging,
    dragPower,
    quickSpin,
    spinToAngle,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

/** Angle that lands the pointer on the midpoint of a weighted segment. */
export function angleForWeightedSegment(index: number, weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || index < 0 || index >= weights.length) return 0;
  let start = 0;
  for (let i = 0; i < index; i++) start += (weights[i]! / total) * 2 * Math.PI;
  const span = (weights[index]! / total) * 2 * Math.PI;
  const mid = start + span / 2;
  // getWeightedSegmentIndex uses normalizeAngle(-angle).
  return -mid;
}

export function getSegmentIndex(angle: number, segmentCount: number, pointerOffset = 0): number {
  const normalized = normalizeAngle(-angle + pointerOffset);
  const segmentAngle = (2 * Math.PI) / segmentCount;
  return Math.floor(normalized / segmentAngle) % segmentCount;
}

export function getSegmentWeights(segments: { weight?: number }[]): number[] {
  return segments.map((segment) => segment.weight ?? 1);
}

export function getWeightedSegmentIndex(angle: number, weights: number[], pointerOffset = 0): number {
  const normalized = normalizeAngle(-angle + pointerOffset);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;

  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += (weights[i] / total) * (2 * Math.PI);
    if (normalized < cumulative) return i;
  }
  return weights.length - 1;
}
