import { useRef, useCallback, useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { getItemSprite, getSegmentSprite } from '../data/icons';
import {
  useWheelPhysics,
  getSegmentWeights,
  getWeightedSegmentIndex,
  angleForWeightedSegment,
} from '../hooks/useWheelPhysics';
import { playSfx } from '../utils/sound';
import { useGameStore } from '../store/useGameStore';
import { asset } from '../utils/asset';

const WHEEL_HUB_BALL = asset('img/ball.png');
/** Hub radius in SVG units (matches the old center disc). */
const WHEEL_HUB_R = 34;
/**
 * ball.png has ~14% transparent padding around the ball. Scale the image so the
 * opaque ball reaches the hub edge and covers the center disc completely.
 */
const WHEEL_HUB_BALL_SCALE = 1.2;
const WHEEL_HUB_BALL_SIZE = WHEEL_HUB_R * 2 * WHEEL_HUB_BALL_SCALE;

export interface SpinnerSegment {
  id: string;
  label: string;
  color: string;
  icon: string;
  /** Explicit image URL for the wedge (e.g. a Pokémon sprite). Takes priority over id-based sprites. */
  image?: string;
  comingSoon?: boolean;
  weight?: number;
}

/** Drive a non-interactive replay that lands on a known segment (guest spectate). */
export interface WheelReplay {
  key: number;
  segmentId: string;
}

interface WheelProps {
  segments: SpinnerSegment[];
  onLand: (segment: SpinnerSegment) => void;
  disabled?: boolean;
  /** When set, the wheel is view-only and animates to the given result. */
  replay?: WheelReplay | null;
  /** Hide text labels on wedges (sprites/icons still show). */
  hideLabels?: boolean;
  /** Fires when the pointer passes onto a new wedge while spinning. */
  onPassSegment?: (segment: SpinnerSegment) => void;
}

function normalize(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a;
}

function buildSegmentArcs(weights: number[]): { startDeg: number; endDeg: number; midDeg: number }[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  return weights.map((weight) => {
    const startDeg = (cumulative / total) * 360;
    cumulative += weight;
    const endDeg = (cumulative / total) * 360;
    return { startDeg, endDeg, midDeg: (startDeg + endDeg) / 2 };
  });
}

export function Wheel({
  segments,
  onLand,
  disabled,
  replay = null,
  hideLabels = false,
  onPassSegment,
}: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const muted = useGameStore((s) => s.muted);
  const landedRef = useRef(false);
  const prevIdxRef = useRef(-1);
  const segmentsRef = useRef(segments);
  const lastReplayKey = useRef<number | null>(null);
  const [weakFlick, setWeakFlick] = useState(false);
  const isReplay = replay != null;
  const hubClipId = `wheel-hub-clip-${useId().replace(/:/g, '')}`;

  segmentsRef.current = segments;

  const weights = useMemo(() => getSegmentWeights(segments), [segments]);
  const arcs = useMemo(() => buildSegmentArcs(weights), [weights]);

  const resolveIndex = useCallback(
    (angle: number) => getWeightedSegmentIndex(angle, weights),
    [weights],
  );

  const handleSpinEnd = useCallback(
    (finalAngle: number) => {
      if (landedRef.current) return;
      landedRef.current = true;
      playSfx('spinStop', muted);
      const current = segmentsRef.current;
      if (replay) {
        const match = current.find((s) => s.id === replay.segmentId) ?? current[resolveIndex(finalAngle)];
        if (match) onLand(match);
        return;
      }
      const idx = resolveIndex(finalAngle);
      onLand(current[idx]!);
    },
    [onLand, muted, resolveIndex, replay],
  );

  const { angle, isSpinning, isDragging, dragPower, quickSpin, spinToAngle, handlePointerDown, handlePointerMove, handlePointerUp } =
    useWheelPhysics(wheelRef, {
      friction: 0.99,
      minVelocity: 0.0025,
      onSpinStart: () => {
        landedRef.current = false;
        setWeakFlick(false);
      },
      onSpinEnd: handleSpinEnd,
      onWeakFlick: () => {
        setWeakFlick(true);
        window.setTimeout(() => setWeakFlick(false), 1400);
      },
    });

  useEffect(() => {
    if (!replay || segments.length === 0) return;
    if (lastReplayKey.current === replay.key) return;
    lastReplayKey.current = replay.key;
    const idx = segments.findIndex((s) => s.id === replay.segmentId);
    if (idx < 0) return;
    playSfx('spin', muted);
    landedRef.current = false;
    spinToAngle(angleForWeightedSegment(idx, weights));
  }, [replay, segments, weights, spinToAngle, muted]);

  useEffect(() => {
    if (!isSpinning) return;
    const idx = resolveIndex(normalize(angle));
    if (idx !== prevIdxRef.current) {
      prevIdxRef.current = idx;
      playSfx('tick', muted);
      const seg = segmentsRef.current[idx];
      if (seg) onPassSegment?.(seg);
    }
  }, [angle, isSpinning, resolveIndex, muted, onPassSegment]);

  return (
    <div className="wheel-wrapper">
      <div className="wheel-pointer" aria-hidden="true">▼</div>
      <div
        ref={wheelRef}
        className={clsx(
          'wheel',
          isDragging && 'wheel--dragging',
          isSpinning && 'wheel--spinning',
          (disabled || isReplay) && 'wheel--disabled',
        )}
        style={{ transform: `rotate(${angle}rad)` }}
        onPointerDown={disabled || isReplay ? undefined : handlePointerDown}
        onPointerMove={isReplay ? undefined : handlePointerMove}
        onPointerUp={isReplay ? undefined : handlePointerUp}
        onPointerLeave={isReplay ? undefined : handlePointerUp}
        role="img"
        aria-label={isReplay ? 'Spectating wheel spin' : 'Adventure wheel — drag and flick hard to spin'}
      >
        <svg viewBox="0 0 400 400" className="wheel__svg">
          <defs>
            <radialGradient id="wheelShinyGrad" cx="50%" cy="50%" r="78%">
              <stop offset="0%" stopColor="#fffef5" />
              <stop offset="42%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <radialGradient id="wheelNormalGrad" cx="200" cy="200" r="195" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c2ccdc" />
              <stop offset="68%" stopColor="#8b97a8" />
              <stop offset="100%" stopColor="#586273" />
            </radialGradient>
            <clipPath id={hubClipId}>
              <circle cx="200" cy="200" r={WHEEL_HUB_R} />
            </clipPath>
          </defs>
          {segments.map((seg, i) => {
            const { startDeg, endDeg, midDeg } = arcs[i];
            const spanDeg = endDeg - startDeg;
            const startAngle = (startDeg - 90) * (Math.PI / 180);
            const endAngle = (endDeg - 90) * (Math.PI / 180);
            const x1 = 200 + 195 * Math.cos(startAngle);
            const y1 = 200 + 195 * Math.sin(startAngle);
            const x2 = 200 + 195 * Math.cos(endAngle);
            const y2 = 200 + 195 * Math.sin(endAngle);
            const largeArc = spanDeg > 180 ? 1 : 0;
            const midAngle = (midDeg - 90) * (Math.PI / 180);
            const iconX = 200 + 128 * Math.cos(midAngle);
            const iconY = 200 + 128 * Math.sin(midAngle);
            const labelX = 200 + 172 * Math.cos(midAngle);
            const labelY = 200 + 172 * Math.sin(midAngle);
            const rotation = midDeg;
            const labelFontSize = spanDeg < 30 ? 10 : spanDeg < 45 ? 11 : 13;
            const spriteSrc = seg.image ?? getSegmentSprite(seg.id) ?? getItemSprite(seg.id);
            const ICON_SIZE = 40;
            const isShinyWedge = seg.id === 'shiny';
            const isNormalWedge = seg.id === 'normal';
            const wedgeFill = isShinyWedge
              ? 'url(#wheelShinyGrad)'
              : isNormalWedge
                ? 'url(#wheelNormalGrad)'
                : seg.color;
            const wedgePath = `M 200 200 L ${x1} ${y1} A 195 195 0 ${largeArc} 1 ${x2} ${y2} Z`;

            return (
              <g key={`${i}-${seg.label}-${seg.color}`}>
                <path
                  d={wedgePath}
                  fill={wedgeFill}
                  stroke="#0f0f1a"
                  strokeWidth="3"
                  opacity={seg.comingSoon ? 0.55 : 1}
                  className="wheel__wedge"
                />
                {isShinyWedge && (
                  <path
                    d={wedgePath}
                    fill="#fff3b0"
                    stroke="none"
                    className="wheel__shiny-shimmer"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {spriteSrc ? (
                  <image
                    href={spriteSrc}
                    x={iconX - ICON_SIZE / 2}
                    y={iconY - ICON_SIZE / 2}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    transform={`rotate(${rotation}, ${iconX}, ${iconY})`}
                    style={{ pointerEvents: 'none' }}
                  />
                ) : seg.icon ? (
                  <text
                    x={iconX}
                    y={iconY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ICON_SIZE}
                    transform={`rotate(${rotation}, ${iconX}, ${iconY})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {seg.icon}
                  </text>
                ) : null}
                {!hideLabels && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#0f0f1a"
                    fontSize={labelFontSize}
                    fontWeight="800"
                    transform={`rotate(${rotation}, ${labelX}, ${labelY})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {seg.comingSoon ? 'Soon' : seg.label}
                  </text>
                )}
              </g>
            );
          })}
          <circle cx="200" cy="200" r={WHEEL_HUB_R} fill="#0f0f1a" />
          <image
            href={WHEEL_HUB_BALL}
            x={200 - WHEEL_HUB_BALL_SIZE / 2}
            y={200 - WHEEL_HUB_BALL_SIZE / 2}
            width={WHEEL_HUB_BALL_SIZE}
            height={WHEEL_HUB_BALL_SIZE}
            clipPath={`url(#${hubClipId})`}
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none' }}
          />
        </svg>
      </div>

      {!isReplay && (
        <div className="wheel-footer">
          {isDragging ? (
            <div className="wheel-power">
              <div className="wheel-power__bar">
                <div className="wheel-power__fill" style={{ width: `${dragPower * 100}%` }} />
              </div>
              <span className="wheel-power__label">Flick hard to launch!</span>
            </div>
          ) : weakFlick ? (
            <p className="wheel-hint wheel-hint--warn">Too soft! Flick the wheel harder.</p>
          ) : (
            <p className="wheel-hint">Grab the wheel and flick it hard to spin</p>
          )}

          <button
            type="button"
            className="btn btn--ghost btn--sm wheel-quick-btn"
            onClick={quickSpin}
            disabled={isSpinning || isDragging || disabled}
          >
            ⚡ Quick Spin
          </button>
        </div>
      )}
      {isReplay && (
        <p className="wheel-hint">
          {isSpinning ? 'Watching the spin…' : 'Spin result'}
        </p>
      )}
    </div>
  );
}
