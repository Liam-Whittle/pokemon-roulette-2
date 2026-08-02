import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveCatchShakes, type CatchShakeResult } from '../utils/catchChance';
import type { CatchBallId } from '../types/game';
import { playSfx } from '../utils/sound';

type AnimPhase = 'throw' | 'wiggle' | 'caught' | 'broke';

interface CatchChanceProps {
  ballId: CatchBallId;
  ballSprite: string;
  catchRate: number;
  muted: boolean;
  /** Absolute catch-chance bonus (0–1), e.g. throw-chain +1% per prior fail. */
  chanceBonus?: number;
  /** Called when the Pokémon should vanish into the ball. */
  onAbsorb: () => void;
  onResult: (success: boolean) => void;
  onStatusChange?: (status: string) => void;
  /** Override shake resolution (e.g. flat daily catch). Defaults to Gen catch math. */
  resolveResult?: () => CatchShakeResult;
}

const STAR_COLORS = ['#ff6b6b', '#ffd93d', '#6bcbff'];
const THROW_MS = 620;
const WIGGLE_MS = 700;
const LAST_WIGGLE_PAUSE_MS = 1000;
const RESOLVE_PAUSE_MS = 950;
const WIGGLE_ANIM_S = 0.55;
const CAUGHT_MS = 950;
const BROKE_MS = 750;

function statusForPhase(phase: AnimPhase): string {
  if (phase === 'throw') return 'Throwing...';
  if (phase === 'wiggle') return '...';
  if (phase === 'caught') return 'Gotcha!';
  return 'Oh no! It broke free!';
}

function pauseAfterWiggle(wiggleIndex: number, wiggleCount: number): number {
  const next = wiggleIndex + 1;
  if (next >= wiggleCount) return RESOLVE_PAUSE_MS;
  if (next === wiggleCount - 1) return LAST_WIGGLE_PAUSE_MS;
  return WIGGLE_MS;
}

export function CatchChance({
  ballId,
  ballSprite,
  catchRate,
  muted,
  chanceBonus = 0,
  onAbsorb,
  onResult,
  onStatusChange,
  resolveResult,
}: CatchChanceProps) {
  const [phase, setPhase] = useState<AnimPhase>('throw');
  const [wiggleIndex, setWiggleIndex] = useState(0);
  const [wiggleCount, setWiggleCount] = useState(3);
  const [success, setSuccess] = useState(false);
  const finished = useRef(false);
  const onAbsorbRef = useRef(onAbsorb);
  const onResultRef = useRef(onResult);
  const onStatusRef = useRef(onStatusChange);
  const resolveRef = useRef(resolveResult);
  const chanceBonusRef = useRef(chanceBonus);
  onAbsorbRef.current = onAbsorb;
  onResultRef.current = onResult;
  onStatusRef.current = onStatusChange;
  resolveRef.current = resolveResult;
  chanceBonusRef.current = chanceBonus;

  useEffect(() => {
    onStatusRef.current?.(statusForPhase(phase));
  }, [phase]);

  useEffect(() => {
    playSfx('throw', muted);

    const throwTimer = window.setTimeout(() => {
      onAbsorbRef.current();
      const result = resolveRef.current
        ? resolveRef.current()
        : resolveCatchShakes(catchRate, ballId, Math.random, chanceBonusRef.current);
      setSuccess(result.caught);
      setWiggleCount(result.shakes);
      setWiggleIndex(0);
      setPhase('wiggle');
      playSfx('shake', muted);
    }, THROW_MS);

    return () => window.clearTimeout(throwTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'wiggle') return;

    const timer = window.setTimeout(() => {
      const next = wiggleIndex + 1;
      if (next < wiggleCount) {
        setWiggleIndex(next);
        playSfx('shake', muted);
        return;
      }

      if (success) {
        setPhase('caught');
        playSfx('ballClick', muted);
        window.setTimeout(() => playSfx('sparkle', muted), 80);
      } else {
        setPhase('broke');
        playSfx('fail', muted);
      }
    }, pauseAfterWiggle(wiggleIndex, wiggleCount));

    return () => window.clearTimeout(timer);
  }, [phase, wiggleIndex, wiggleCount, success, muted]);

  useEffect(() => {
    if (phase !== 'caught' && phase !== 'broke') return;
    if (finished.current) return;

    const delay = phase === 'caught' ? CAUGHT_MS : BROKE_MS;
    const timer = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onResultRef.current(success);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [phase, success]);

  return (
    <div className="catch-chance">
      <div className="catch-chance__stage">
        <AnimatePresence mode="wait">
          {phase === 'throw' && (
            <motion.img
              key="throw"
              src={ballSprite}
              alt="Ball"
              className="catch-chance__ball"
              initial={{ y: 140, x: -70, scale: 0.55, opacity: 1, rotate: -40 }}
              animate={{ y: 0, x: 0, scale: 1, opacity: 1, rotate: 360 }}
              transition={{ duration: THROW_MS / 1000, ease: 'easeOut' }}
            />
          )}

          {phase === 'wiggle' && (
            <motion.img
              key={`wiggle-${wiggleIndex}`}
              src={ballSprite}
              alt="Ball"
              className="catch-chance__ball"
              initial={{ y: 0, rotate: 0 }}
              animate={{ y: [0, -5, 0], rotate: [0, -20, 20, -14, 14, 0] }}
              transition={{ duration: WIGGLE_ANIM_S, ease: 'easeInOut' }}
            />
          )}

          {phase === 'caught' && (
            <motion.img
              key="caught"
              src={ballSprite}
              alt="Ball"
              className="catch-chance__ball"
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 0.35 }}
            />
          )}
        </AnimatePresence>

        {phase === 'broke' && (
          <motion.div
            className="catch-chance__broke"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.2, opacity: [1, 0] }}
            transition={{ duration: 0.5 }}
          />
        )}

        {phase === 'caught' &&
          STAR_COLORS.map((color, i) => (
            <motion.span
              key={color}
              className="catch-chance__star"
              style={{ color }}
              initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
              animate={{
                opacity: 0,
                scale: 1.4,
                x: (i - 1) * 36,
                y: -28 - (i === 1 ? 12 : 0),
              }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
            >
              ★
            </motion.span>
          ))}
      </div>
    </div>
  );
}
