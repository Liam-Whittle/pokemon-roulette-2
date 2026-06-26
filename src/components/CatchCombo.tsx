import { useEffect, useMemo, useRef, useState } from 'react';
import { asset } from '../utils/asset';

interface CatchComboProps {
  powerLevel: number;
  isLegendary?: boolean;
  zoneBonus?: number;
  speedMult?: number;
  ballSprite?: string;
  onResult: (success: boolean) => void;
  disabled?: boolean;
}

const MAX_HITS = 5;
const ZONE_SHRINK = 0.82;
const SPEED_BOOST = 1.18;
// Legendaries get a bigger starting zone and a gentler per-hit shrink so the
// 5-combo is challenging but fair (speed is intentionally left untouched).
const LEGENDARY_ZONE_MULT = 1.15;
const LEGENDARY_ZONE_SHRINK = 0.92;
const LEGENDARY_SPEED_MULT = 1.25;

function safePower(power: number): number {
  return Number.isFinite(power) ? power : 0.3;
}

function computeRequiredHits(power: number, isLegendary: boolean): number {
  if (isLegendary) return MAX_HITS;
  return Math.min(MAX_HITS, Math.max(2, 2 + Math.round(safePower(power) * 3)));
}

function computeBaseZone(power: number, isLegendary: boolean): number {
  const zone = 0.3 - safePower(power) * 0.16;
  return isLegendary ? zone * LEGENDARY_ZONE_MULT : zone;
}

function computeBaseSpeed(power: number, isLegendary: boolean): number {
  const speed = 0.01 + safePower(power) * 0.018;
  return isLegendary ? speed * LEGENDARY_SPEED_MULT : speed;
}

export function CatchCombo({
  powerLevel,
  isLegendary = false,
  zoneBonus = 0,
  speedMult = 1,
  ballSprite,
  onResult,
  disabled,
}: CatchComboProps) {
  const power = safePower(powerLevel);
  const requiredHits = useMemo(() => computeRequiredHits(power, isLegendary), [power, isLegendary]);
  const baseZone = useMemo(() => computeBaseZone(power, isLegendary), [power, isLegendary]);
  const baseSpeed = useMemo(() => computeBaseSpeed(power, isLegendary), [power, isLegendary]);

  const [hits, setHits] = useState(0);
  const [position, setPosition] = useState(0.5);
  const [direction, setDirection] = useState(1);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const shrink = isLegendary ? LEGENDARY_ZONE_SHRINK : ZONE_SHRINK;
  const zoneSize = Math.min(0.9, baseZone * (1 + zoneBonus) * Math.pow(shrink, hits));
  const zoneStart = 0.5 - zoneSize / 2;
  const speed = baseSpeed * speedMult * Math.pow(SPEED_BOOST, hits);

  useEffect(() => {
    if (locked || disabled || failed) return;
    const id = window.setInterval(() => {
      setPosition((current) => {
        const next = current + direction * speed;
        if (next >= 1) {
          setDirection(-1);
          return 1;
        }
        if (next <= 0) {
          setDirection(1);
          return 0;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(id);
  }, [direction, speed, locked, disabled, failed]);

  function handleLock() {
    if (locked || disabled || failed) return;
    setLocked(true);

    const inZone = position >= zoneStart && position <= zoneStart + zoneSize;

    window.setTimeout(() => {
      if (!inZone) {
        setFailed(true);
        onResult(false);
        return;
      }

      const nextHits = hits + 1;
      if (nextHits >= requiredHits) {
        onResult(true);
        return;
      }

      setHits(nextHits);
      setLocked(false);
    }, 180);
  }

  // Keep a ref to the latest handler so a single stable window listener can
  // lock the ball from a click anywhere on the screen without re-binding.
  const handleLockRef = useRef(handleLock);
  handleLockRef.current = handleLock;

  useEffect(() => {
    const onPointerDown = () => handleLockRef.current();
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className={`catch-combo ${isLegendary ? 'catch-combo--legendary' : ''}`}>
      <div className="catch-combo__progress">
        {Array.from({ length: requiredHits }, (_, i) => (
          <span
            key={i}
            className={`catch-combo__pip ${i < hits ? 'catch-combo__pip--done' : ''} ${failed ? 'catch-combo__pip--fail' : ''}`}
          />
        ))}
      </div>
      <p className="catch-combo__status">
        {failed
          ? 'Missed! The Pokémon fled.'
          : `Hits ${hits}/${requiredHits} — click anywhere when the ball is in the green zone`}
      </p>

      <button type="button" className="catch-combo__track-btn" onClick={handleLock} disabled={disabled || locked || failed}>
        <div className="catch-combo__track">
          <div
            className="catch-combo__zone"
            style={{ left: `${zoneStart * 100}%`, width: `${zoneSize * 100}%` }}
          />
          <img
            src={ballSprite ?? asset('pokeball.svg')}
            alt="Pokeball"
            className="catch-combo__ball"
            style={{ left: `${position * 100}%` }}
          />
        </div>
        <span className="catch-combo__power">Power {Math.round(power * 100)}</span>
      </button>
    </div>
  );
}
