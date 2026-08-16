import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { asset } from '../utils/asset';
import { CRY_VOLUME_SCALE, playClip, stopClip } from '../utils/music';

export type HealModalVariant = 'pokecenter' | 'picnic';

interface PokeCenterModalProps {
  onClose: () => void;
  variant?: HealModalVariant;
}

const VARIANT_CONFIG: Record<
  HealModalVariant,
  { lines: string[]; healSound: string | null; exitCry: string | null }
> = {
  pokecenter: {
    lines: ['Your Pokémon are fully healed', 'We hope to see you again.'],
    healSound: asset('sounds/pokecenter_heal.mp3'),
    exitCry: null,
  },
  picnic: {
    lines: [
      'Mew generously heals your Pokémon to full health',
      'Mew cheerily flies away',
    ],
    healSound: asset('sounds/pokecenter_heal.mp3'),
    exitCry: asset('sounds/mew_cry.ogg'),
  },
};

const CHAR_DELAY_MS = 38;
const LINE_PAUSE_MS = 600;

export function PokeCenterModal({ onClose, variant = 'pokecenter' }: PokeCenterModalProps) {
  const config = VARIANT_CONFIG[variant];
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);
  const healClipRef = useRef<HTMLAudioElement | null>(null);
  const cryClipRef = useRef<HTMLAudioElement | null>(null);
  const cryPlayedRef = useRef(false);

  useEffect(() => {
    if (config.healSound) {
      healClipRef.current = playClip(config.healSound);
    }
    return () => {
      stopClip(healClipRef.current);
      stopClip(cryClipRef.current);
    };
  }, [config.healSound]);

  // Play Mew's cry when the "flies away" line starts.
  useEffect(() => {
    if (variant !== 'picnic' || lineIndex < 1 || cryPlayedRef.current || !config.exitCry) return;
    cryPlayedRef.current = true;
    cryClipRef.current = playClip(config.exitCry, CRY_VOLUME_SCALE);
  }, [variant, lineIndex, config.exitCry]);

  const currentLine = config.lines[lineIndex] ?? '';

  useEffect(() => {
    if (done) return;

    if (charIndex < currentLine.length) {
      const timer = window.setTimeout(() => setCharIndex((c) => c + 1), CHAR_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    if (lineIndex < config.lines.length - 1) {
      const timer = window.setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, LINE_PAUSE_MS);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setDone(true), LINE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [charIndex, currentLine.length, config.lines.length, done, lineIndex]);

  const displayed = config.lines.slice(0, lineIndex + 1).map((line, i) =>
    i < lineIndex ? line : line.slice(0, charIndex),
  );

  return createPortal(
    <div className="battle-modal__backdrop">
      <div className={`battle-modal pokecenter-modal${variant === 'picnic' ? ' pokecenter-modal--picnic' : ''}`}>
        <div className="pokecenter-modal__prompt" aria-live="polite">
          {displayed.map((text, i) => (
            <p
              key={`${variant}-${i}`}
              className={`pokecenter-modal__line${i === 1 && variant === 'picnic' ? ' pokecenter-modal__line--exit' : ''}`}
            >
              {text}
            </p>
          ))}
        </div>
        {done && (
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Continue
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
