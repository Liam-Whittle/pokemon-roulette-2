import { useRef, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useWheelPhysics, getSegmentIndex } from '../hooks/useWheelPhysics';
import { playSfx } from '../utils/sound';
import { useGameStore } from '../store/useGameStore';
export interface SpinnerSegment {
  id: string;
  label: string;
  color: string;
  icon: string;
  comingSoon?: boolean;
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

export function Wheel({ segments, onLand, disabled }: WheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const muted = useGameStore((s) => s.muted);
  const landedRef = useRef(false);
  const prevIdxRef = useRef(-1);
  const segmentsRef = useRef(segments);
  const [weakFlick, setWeakFlick] = useState(false);

  segmentsRef.current = segments;

  const handleSpinEnd = useCallback(
    (finalAngle: number) => {
      if (landedRef.current) return;
      landedRef.current = true;
      playSfx('spinStop', muted);
      const current = segmentsRef.current;
      const idx = getSegmentIndex(finalAngle, current.length);
      onLand(current[idx]);
    },
    [onLand, muted],
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

  // Ratchet tick each time a segment boundary passes the pointer while spinning.
  useEffect(() => {
    if (!isSpinning) return;
    const idx = getSegmentIndex(normalize(angle), segments.length);
    if (idx !== prevIdxRef.current) {
      prevIdxRef.current = idx;
      playSfx('tick', muted);
    }
  }, [angle, isSpinning, segments.length, muted]);

  const segmentAngle = 360 / segments.length;

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
          {segments.map((seg, i) => {
            const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
            const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
            const x1 = 200 + 195 * Math.cos(startAngle);
            const y1 = 200 + 195 * Math.sin(startAngle);
            const x2 = 200 + 195 * Math.cos(endAngle);
            const y2 = 200 + 195 * Math.sin(endAngle);
            const largeArc = segmentAngle > 180 ? 1 : 0;
            const midAngle = ((i + 0.5) * segmentAngle - 90) * (Math.PI / 180);
            const iconX = 200 + 128 * Math.cos(midAngle);
            const iconY = 200 + 128 * Math.sin(midAngle);
            const labelX = 200 + 172 * Math.cos(midAngle);
            const labelY = 200 + 172 * Math.sin(midAngle);
            const rotation = (i + 0.5) * segmentAngle;

            return (
              <g key={`${i}-${seg.label}-${seg.color}`}>
                <path
                  d={`M 200 200 L ${x1} ${y1} A 195 195 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={seg.color}
                  stroke="#0f0f1a"
                  strokeWidth="3"
                  opacity={seg.comingSoon ? 0.55 : 1}
                />
                <text
                  x={iconX}
                  y={iconY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="48"
                  transform={`rotate(${rotation}, ${iconX}, ${iconY})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {seg.icon}
                </text>
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#0f0f1a"
                  fontSize="13"
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
