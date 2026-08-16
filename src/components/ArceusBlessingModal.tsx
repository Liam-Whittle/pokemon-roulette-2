import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PokemonData } from '../types/game';
import { TypeBadge } from './TypeBadge';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import {
  imgFallback,
  localPokemonArtwork,
  remotePokemonArtwork,
} from '../utils/localAssets';
import { CRY_VOLUME_SCALE, playClip } from '../utils/music';
import { useGameStore } from '../store/useGameStore';

const ARCEUS_ID = 493;
const ARCEUS_ART = localPokemonArtwork(ARCEUS_ID);
const ARCEUS_CRY = asset('sounds/arceus_cry.mp3');

/** Debounce so React Strict Mode remounts don't cut off / double-trigger the cry. */
let lastArceusCryAt = 0;

/** Play Arceus's cry (safe to call from a click handler or modal mount). */
export function playArceusCry(): void {
  const now = Date.now();
  if (now - lastArceusCryAt < 900) return;
  lastArceusCryAt = now;
  playClip(ARCEUS_CRY, CRY_VOLUME_SCALE);
}

interface ArceusBlessingModalProps {
  choices: PokemonData[];
  onChoose: (mon: PokemonData) => void;
  onSkip: () => void;
}

export function ArceusBlessingModal({ choices, onChoose, onSkip }: ArceusBlessingModalProps) {
  const muted = useGameStore((s) => s.muted);
  const [introDone, setIntroDone] = useState(false);
  const [pickedId, setPickedId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setIntroDone(true), 480);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (muted) return;
    // Don't stop on cleanup — Strict Mode remount was cutting the cry off immediately.
    playArceusCry();
  }, [muted]);

  function handleChoose(mon: PokemonData) {
    if (pickedId != null) return;
    setPickedId(mon.id);
    window.setTimeout(() => onChoose(mon), 320);
  }

  return (
    <motion.div
      className="arceus-blessing__backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="arceus-blessing__aura" aria-hidden />
      <div className="arceus-blessing__stars" aria-hidden />

      <motion.div
        className="arceus-blessing"
        role="dialog"
        aria-labelledby="arceus-blessing-title"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.05 }}
      >
        <button
          type="button"
          className="arceus-blessing__close"
          aria-label="Skip Arceus's Blessing"
          onClick={() => {
            if (pickedId != null) return;
            onSkip();
          }}
        >
          ×
        </button>

        <div className="arceus-blessing__hero">
          <motion.div
            className="arceus-blessing__arceus-wrap"
            initial={{ opacity: 0, scale: 0.7, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.12 }}
          >
            <span className="arceus-blessing__halo" aria-hidden />
            <motion.img
              src={ARCEUS_ART}
              alt="Arceus"
              className="arceus-blessing__arceus"
              draggable={false}
              onError={(e) => imgFallback(e, remotePokemonArtwork(ARCEUS_ID), PLACEHOLDER_SPRITE)}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

          <motion.div
            className="arceus-blessing__copy"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4 }}
          >
            <p className="arceus-blessing__eyebrow">A presence stirs…</p>
            <h3 id="arceus-blessing-title" className="arceus-blessing__title">
              Arceus&apos;s Blessing
            </h3>
            <p className="arceus-blessing__subtitle">Choose one Pokémon to join your team</p>
          </motion.div>
        </div>

        <motion.div
          className="arceus-blessing__row"
          initial="hidden"
          animate={introDone ? 'show' : 'hidden'}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
          }}
        >
          {choices.map((mon) => {
            const selected = pickedId === mon.id;
            const dimmed = pickedId != null && !selected;
            return (
              <motion.button
                key={mon.id}
                type="button"
                className={`arceus-pick${selected ? ' arceus-pick--selected' : ''}${dimmed ? ' arceus-pick--dimmed' : ''}`}
                onClick={() => handleChoose(mon)}
                disabled={pickedId != null}
                variants={{
                  hidden: { opacity: 0, y: 22, scale: 0.92 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', stiffness: 320, damping: 22 },
                  },
                }}
                whileHover={pickedId == null ? { y: -6, scale: 1.02 } : undefined}
                whileTap={pickedId == null ? { scale: 0.98 } : undefined}
                style={{ transformOrigin: 'center bottom' }}
              >
                <div className="arceus-pick__art-wrap">
                  <motion.img
                    src={mon.artwork || mon.sprite || PLACEHOLDER_SPRITE}
                    alt=""
                    className="arceus-pick__art"
                    draggable={false}
                    onError={(e) =>
                      imgFallback(e, remotePokemonArtwork(mon.id), mon.sprite || PLACEHOLDER_SPRITE)
                    }
                    animate={pickedId == null ? { y: [0, -5, 0] } : undefined}
                    transition={
                      pickedId == null
                        ? { duration: 2.4 + (mon.id % 5) * 0.12, repeat: Infinity, ease: 'easeInOut' }
                        : undefined
                    }
                  />
                </div>
                <div className="arceus-pick__body">
                  <span className="arceus-pick__dex">#{String(mon.id).padStart(3, '0')}</span>
                  <span className="arceus-pick__name">{mon.displayName}</span>
                  <div className="arceus-pick__types">
                    {mon.types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </div>
                  <span className="arceus-pick__bst">BST {mon.baseStatTotal}</span>
                </div>
                <span className="arceus-pick__cta">Choose</span>
              </motion.button>
            );
          })}
        </motion.div>

        <AnimatePresence>
          {pickedId != null && (
            <motion.p
              className="arceus-blessing__chosen"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              The blessing is given…
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
