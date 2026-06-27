import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { getItemSprite, getSegmentSprite } from '../data/icons';
import { useWheelPhysics, getSegmentWeights, getWeightedSegmentIndex } from '../hooks/useWheelPhysics';
import { playSfx } from '../utils/sound';
import { useGameStore } from '../store/useGameStore';

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

interface WheelProps {
  segments: SpinnerSegment[];
  onLand: (segment: SpinnerSegment) => void;
  disabled?: boolean;
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

export function Wheel({ segments, onLand, disabled }: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const muted = useGameStore((s) => s.muted);
  const landedRef = useRef(false);
  const prevIdxRef = useRef(-1);
  const segmentsRef = useRef(segments);
  const [weakFlick, setWeakFlick] = useState(false);

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
      const idx = resolveIndex(finalAngle);
      onLand(current[idx]);
    },
    [onLand, muted, resolveIndex],
  );

  const { angle, isSpinning, isDragging, dragPower, quickSpin, handlePointerDown, handlePointerMove, handlePointerUp } =
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
    if (!isSpinning) return;
    const idx = resolveIndex(normalize(angle));
    if (idx !== prevIdxRef.current) {
      prevIdxRef.current = idx;
      playSfx('tick', muted);
    }
  }, [angle, isSpinning, resolveIndex, muted]);

  return (
    <div className="wheel-wrapper">
      <div className="wheel-pointer" aria-hidden="true">▼</div>
      <div
        ref={wheelRef}
        className={clsx('wheel', isDragging && 'wheel--dragging', isSpinning && 'wheel--spinning', disabled && 'wheel--disabled')}
        style={{ transform: `rotate(${angle}rad)` }}
        onPointerDown={disabled ? undefined : handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        role="img"
        aria-label="Adventure wheel — drag and flick hard to spin"
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
              </g>
            );
          })}
          <circle cx="200" cy="200" r="34" fill="#0f0f1a" stroke="#fff" strokeWidth="4" />
          <text x="200" y="200" textAnchor="middle" dominantBaseline="central" fontSize="30">
            ⚡
          </text>
        </svg>
      </div>

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
    </div>
  );
}
