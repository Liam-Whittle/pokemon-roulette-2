import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import { playClip, stopClip, stopMusic } from '../utils/music';

type Phase = 'black' | 'flash' | 'reveal';

/** Delay (ms) of pure darkness before the purple flash. */
const BLACK_MS = 7000;
/** How long the purple flash holds before Magikarp is revealed. */
const FLASH_MS = 650;
/** Fallback completion in case the audio "ended" event never fires (~26s clip). */
const CLIP_FALLBACK_MS = 30000;

interface HollowPurpleCinematicProps {
  onComplete: () => void;
}

/**
 * Shiny Magikarp's "Hollow Purple" win cinematic: cut the music, play
 * hollow_purple.mp3, fade to black, flash purple after 7s, reveal a giant
 * Magichad, then hand off to the Chadpion end screen when the audio finishes.
 */
export function HollowPurpleCinematic({ onComplete }: HollowPurpleCinematicProps) {
  const [phase, setPhase] = useState<Phase>('black');
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    stopMusic();
    const clip = playClip(asset('sounds/hollow_purple.mp3'));

    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase('flash'), BLACK_MS));
    timers.push(window.setTimeout(() => setPhase('reveal'), BLACK_MS + FLASH_MS));

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onCompleteRef.current();
    };

    if (clip) {
      clip.addEventListener('ended', finish, { once: true });
      timers.push(window.setTimeout(finish, CLIP_FALLBACK_MS));
    } else {
      timers.push(window.setTimeout(finish, CLIP_FALLBACK_MS));
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      stopClip(clip);
    };
  }, []);

  return createPortal(
    <motion.div
      className="hollow-cinematic"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <AnimatePresence>
        {phase === 'flash' && (
          <motion.div
            key="flash"
            className="hollow-cinematic__flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {phase === 'reveal' && (
        <>
          <div className="hollow-cinematic__aura" aria-hidden />
          <motion.img
            src={asset('img/magikarp_shiny.png')}
            alt="Magichad"
            className="hollow-cinematic__karp"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: [0.6, 1.05, 1],
              y: [0, -14, 0],
            }}
            transition={{
              opacity: { duration: 1.4 },
              scale: { duration: 1.4 },
              y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
            }}
          />
        </>
      )}
    </motion.div>,
    document.body,
  );
}
