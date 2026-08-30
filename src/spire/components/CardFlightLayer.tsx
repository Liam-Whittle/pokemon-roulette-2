import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { CombatEnemy, CombatState } from '../types';
import {
  DISCARD_MS,
  DRAW_MS,
  EXHAUST_MS,
  HAND_CARD_H,
  HAND_CARD_W,
  type CardFlight,
} from './cardFlight';
import { SpireCard } from './SpireCard';

export function CardFlightLayer({
  flights,
  combat,
  target,
  onComplete,
}: {
  flights: CardFlight[];
  combat?: CombatState;
  target?: CombatEnemy;
  onComplete: (id: string) => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="spire-fly-layer" aria-hidden="true">
      <AnimatePresence>
        {flights.map((flight) => (
          <FlightClone
            key={flight.id}
            flight={flight}
            combat={combat}
            target={target}
            onComplete={onComplete}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function FlightClone({
  flight,
  combat,
  target,
  onComplete,
}: {
  flight: CardFlight;
  combat?: CombatState;
  target?: CombatEnemy;
  onComplete: (id: string) => void;
}) {
  const pileScale = Math.max(0.28, Math.min(flight.to.w / HAND_CARD_W, flight.to.h / HAND_CARD_H, 0.48));
  const fromPileScale = Math.max(0.28, Math.min(flight.from.w / HAND_CARD_W, flight.from.h / HAND_CARD_H, 0.48));
  const exhaust = flight.motion === 'exhaust';
  const draw = flight.motion === 'draw';
  const duration = (exhaust ? EXHAUST_MS : draw ? DRAW_MS : DISCARD_MS) / 1000;
  const finished = useRef(false);

  useEffect(() => {
    const ms = (flight.delay + duration) * 1000 + 160;
    const timer = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onComplete(flight.id);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [duration, flight.delay, flight.id, onComplete]);

  const done = () => {
    if (finished.current) return;
    finished.current = true;
    onComplete(flight.id);
  };

  return (
    <motion.div
      className={`spire-fly-card${exhaust ? ' spire-fly-card--exhaust' : ''}${draw ? ' spire-fly-card--draw' : ''}`}
      initial={
        draw
          ? {
              x: flight.from.cx,
              y: flight.from.cy,
              rotate: flight.from.rotate,
              scale: fromPileScale,
              opacity: 0.92,
              filter: 'brightness(1)',
            }
          : {
              x: flight.from.cx,
              y: flight.from.cy,
              rotate: flight.from.rotate,
              scale: 1,
              opacity: 1,
              filter: 'brightness(1) sepia(0) saturate(1)',
            }
      }
      animate={
        exhaust
          ? {
              x: [flight.from.cx, flight.from.cx, flight.to.cx],
              y: [flight.from.cy, flight.from.cy - 10, flight.to.cy],
              rotate: [flight.from.rotate, flight.from.rotate + 8, flight.to.rotate],
              scale: [1, 0.84, pileScale],
              opacity: [1, 0.82, 0.18],
              filter: [
                'brightness(1) sepia(0) saturate(1)',
                'brightness(0.48) sepia(1) saturate(7) hue-rotate(-18deg)',
                'brightness(0.3) sepia(1) saturate(3) hue-rotate(-10deg)',
              ],
            }
          : {
              x: flight.to.cx,
              y: flight.to.cy,
              rotate: flight.to.rotate,
              scale: draw ? 1 : pileScale,
              opacity: draw ? 1 : 0.28,
              filter: 'brightness(1)',
            }
      }
      transition={
        exhaust
          ? {
              duration,
              delay: flight.delay,
              times: [0, 0.5, 1],
              ease: ['easeIn', 'easeInOut'],
            }
          : {
              duration,
              delay: flight.delay,
              ease: [0.2, 0.78, 0.22, 1],
            }
      }
      onAnimationComplete={done}
    >
      <SpireCard card={flight.card} combat={combat} target={target} inert />
      {exhaust && (
        <span className="spire-fly-embers">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
    </motion.div>
  );
}
