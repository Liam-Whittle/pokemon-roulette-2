import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { BattleContext } from '../types/game';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { imgFallback, remoteTrainerSprite } from '../utils/localAssets';
import { playSfx } from '../utils/sound';

function contextLabel(ctx: BattleContext): string {
  switch (ctx) {
    case 'gym':
      return 'Gym Leader';
    case 'elite':
      return 'Elite Four';
    case 'rival':
      return 'Rival';
    case 'teamrocket':
      return 'Villain Team';
    case 'giovanni':
      return 'Boss';
    case 'trainer':
    default:
      return 'Trainer';
  }
}

export interface BattleVsIntroProps {
  playerName: string;
  playerSprite?: string | null;
  opponentName: string;
  opponentSprite?: string | null;
  battleContext: BattleContext;
  muted?: boolean;
  onDone: () => void;
}

export function BattleVsIntro({
  playerName,
  playerSprite,
  opponentName,
  opponentSprite,
  battleContext,
  muted = false,
  onDone,
}: BattleVsIntroProps) {
  const reduceMotion = useReducedMotion();
  const holdMs = reduceMotion ? 450 : 1300;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const shingDelay = reduceMotion ? 0 : 160;
    const shingId = window.setTimeout(() => playSfx('shing', muted), shingDelay);
    const id = window.setTimeout(() => onDoneRef.current(), holdMs);
    return () => {
      window.clearTimeout(shingId);
      window.clearTimeout(id);
    };
  }, [holdMs, muted, reduceMotion]);

  return (
    <motion.div
      className="battle-vs"
      role="dialog"
      aria-label="Versus"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.35 }}
    >
      <div className="battle-vs__backdrop" aria-hidden />
      <p className="battle-vs__context">{contextLabel(battleContext)}</p>
      <div className="battle-vs__row">
        <motion.div
          className="battle-vs__fighter battle-vs__fighter--player"
          initial={reduceMotion ? false : { x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: reduceMotion ? 0 : 0.05 }}
        >
          <div className="battle-vs__portrait-wrap">
            {playerSprite && /[/.]/.test(playerSprite) ? (
              <img
                src={playerSprite}
                alt=""
                className="battle-vs__portrait"
                onError={(e) => {
                  const filename = playerSprite.split('/').pop();
                  imgFallback(e, filename ? remoteTrainerSprite(filename) : undefined, PLACEHOLDER_SPRITE);
                }}
              />
            ) : (
              <span className="battle-vs__portrait battle-vs__portrait--emoji" aria-hidden>
                {playerSprite || '👤'}
              </span>
            )}
          </div>
          <p className="battle-vs__name">{playerName}</p>
        </motion.div>

        <motion.span
          className="battle-vs__vs"
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16, delay: reduceMotion ? 0 : 0.18 }}
        >
          VS
        </motion.span>

        <motion.div
          className="battle-vs__fighter battle-vs__fighter--opponent"
          initial={reduceMotion ? false : { x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: reduceMotion ? 0 : 0.05 }}
        >
          <div className="battle-vs__portrait-wrap">
            {opponentSprite ? (
              <img
                src={opponentSprite}
                alt=""
                className="battle-vs__portrait"
                onError={(e) => {
                  const filename = opponentSprite.split('/').pop();
                  imgFallback(e, filename ? remoteTrainerSprite(filename) : undefined, PLACEHOLDER_SPRITE);
                }}
              />
            ) : (
              <span className="battle-vs__portrait battle-vs__portrait--emoji" aria-hidden>
                ⚔️
              </span>
            )}
          </div>
          <p className="battle-vs__name">{opponentName}</p>
        </motion.div>
      </div>
      {!reduceMotion && <div className="battle-vs__wipe" aria-hidden />}
    </motion.div>
  );
}
