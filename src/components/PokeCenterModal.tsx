import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { asset } from '../utils/asset';
import { playClip, stopClip } from '../utils/music';

interface PokeCenterModalProps {
  onClose: () => void;
}

const LINES = ['Your Pokémon are fully healed', 'We hope to see you again.'];
const CHAR_DELAY_MS = 38;
const LINE_PAUSE_MS = 600;

export function PokeCenterModal({ onClose }: PokeCenterModalProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);
  const clipRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    clipRef.current = playClip(asset('sounds/pokecenter_heal.mp3'));
    return () => stopClip(clipRef.current);
  }, []);

  const currentLine = LINES[lineIndex] ?? '';

  useEffect(() => {
    if (done) return;

    if (charIndex < currentLine.length) {
      const timer = window.setTimeout(() => setCharIndex((c) => c + 1), CHAR_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    if (lineIndex < LINES.length - 1) {
      const timer = window.setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, LINE_PAUSE_MS);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setDone(true), LINE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [charIndex, currentLine.length, done, lineIndex]);

  const displayed = LINES.slice(0, lineIndex + 1).map((line, i) =>
    i < lineIndex ? line : line.slice(0, charIndex),
  );

  return createPortal(
    <div className="battle-modal__backdrop">
      <div className="battle-modal pokecenter-modal">
        <div className="pokecenter-modal__prompt" aria-live="polite">
          {displayed.map((text, i) => (
            <p key={i} className="pokecenter-modal__line">
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
