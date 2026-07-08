import { useEffect, useMemo, useRef, useState } from 'react';
import { asset } from '../utils/asset';
import { computeCatchA, comboDifficulty } from '../utils/catchChance';
import type { CatchBallId } from '../types/game';

interface CatchComboProps {
  catchRate: number;
  ballId: CatchBallId;
  level: number;
  isLegendary?: boolean;
  ballSprite?: string;
  onResult: (success: boolean) => void;
  disabled?: boolean;
}

const ZONE_SHRINK = 0.82;
const SPEED_BOOST = 1.18;
const LEGENDARY_ZONE_SHRINK = 0.92;

export function CatchCombo({
  catchRate,
  ballId,
  level,
  isLegendary = false,
  ballSprite,
  onResult,
  disabled,
}: CatchComboProps) {
  const catchA = useMemo(() => computeCatchA(catchRate, ballId), [catchRate, ballId]);
  const difficulty = useMemo(
    () => comboDifficulty(catchA, level, isLegendary),
    [catchA, level, isLegendary],
  );
  const requiredHits = difficulty.requiredHits;
  const baseZone = difficulty.zoneSize;
  const baseSpeed = 0.01 * difficulty.speedMult;

  const [hits, setHits] = useState(0);
  const [position, setPosition] = useState(0.5);
  const [direction, setDirection] = useState(1);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const shrink = isLegendary ? LEGENDARY_ZONE_SHRINK : ZONE_SHRINK;
  const zoneSize = Math.min(0.9, baseZone * Math.pow(shrink, hits));
  const zoneStart = 0.5 - zoneSize / 2;
  const speed = baseSpeed * Math.pow(SPEED_BOOST, hits);

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
        <span className="catch-combo__power">Lv. {level} · Catch rate {catchRate}</span>
      </button>
    </div>
  );
}
