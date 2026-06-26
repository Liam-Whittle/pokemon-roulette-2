import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { EvolutionInfo } from '../types/game';
import { TypeBadge } from './TypeBadge';
import { playClip, stopClip } from '../utils/music';
import { asset } from '../utils/asset';

interface EvolutionModalProps {
  evolution: EvolutionInfo;
  onClose: () => void;
}

type Phase = 'intro' | 'evo-slow' | 'evo-fast' | 'flash' | 'done';

const PHASE_TIMINGS: Record<Exclude<Phase, 'done'>, number> = {
  intro: 1500,
  'evo-slow': 1400,
  'evo-fast': 1700,
  flash: 550,
};

/** Twelve sparkle particles bursting outward, positioned on a circle. */
const SPARKLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  return {
    id: i,
    x: Math.cos(angle) * 150,
    y: Math.sin(angle) * 150,
    delay: (i % 6) * 0.05,
  };
});

export function EvolutionModal({ evolution, onClose }: EvolutionModalProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const closingRef = useRef(false);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose();
  };

  useEffect(() => {
    const clip = playClip(asset('sounds/evolve.mp3'));
    return () => stopClip(clip);
  }, []);

  useEffect(() => {
    if (phase === 'done') return;
    const next: Record<Exclude<Phase, 'done'>, Phase> = {
      intro: 'evo-slow',
      'evo-slow': 'evo-fast',
      'evo-fast': 'flash',
      flash: 'done',
    };
    const timer = setTimeout(() => setPhase(next[phase]), PHASE_TIMINGS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  const isEvolving = phase === 'evo-slow' || phase === 'evo-fast';
  const showRays = phase !== 'intro';

  const caption = useMemo(() => {
    if (phase === 'intro') return `What? ${evolution.fromName} is evolving!`;
    if (phase === 'done') return `Congratulations! ${evolution.fromName} evolved into ${evolution.toName}!`;
    return '';
  }, [phase, evolution]);

  return createPortal(
    <div className="evo-backdrop">
      <motion.div
        className="evo-modal"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      >
        <div className={`evo-stage${showRays ? ' evo-stage--rays' : ''}`}>
          <div className="evo-rays" aria-hidden />
          <div className="evo-glow" aria-hidden />

          <div className={`evo-sprite-wrap${isEvolving ? ` evo-sprite-wrap--${phase}` : ''}`}>
            <img
              src={evolution.fromArtwork}
              alt={evolution.fromName}
              className={`evo-sprite evo-sprite--from${isEvolving ? ' evo-sprite--silhouette' : ''}`}
              style={{ opacity: phase === 'done' || phase === 'flash' ? 0 : undefined }}
            />
            <img
              src={evolution.toArtwork}
              alt={evolution.toName}
              className={`evo-sprite evo-sprite--to${isEvolving ? ' evo-sprite--silhouette' : ''}`}
              style={{ opacity: phase === 'done' ? 1 : undefined }}
            />
          </div>

          <AnimatePresence>
            {phase === 'flash' && (
              <motion.div
                className="evo-flash"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </AnimatePresence>

          {phase === 'done' && (
            <div className="evo-sparkles" aria-hidden>
              {SPARKLES.map((s) => (
                <motion.span
                  key={s.id}
                  className="evo-sparkle"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{ x: s.x, y: s.y, scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
                  transition={{ duration: 1, delay: s.delay, ease: 'easeOut' }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="evo-caption">
          {phase === 'done' ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="evo-result"
            >
              <h3 className="evo-result__title">
                {evolution.fromName} evolved into {evolution.toName}!
              </h3>
              <div className="evo-result__types">
                {evolution.toTypes.map((type) => (
                  <TypeBadge key={type} type={type} size="sm" />
                ))}
              </div>
            </motion.div>
          ) : (
            <p className="evo-caption__text">{caption}</p>
          )}
        </div>

        {phase === 'done' && (
          <button
            type="button"
            className="btn btn--primary evo-continue"
            onClick={handleClose}
          >
            Continue
          </button>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
