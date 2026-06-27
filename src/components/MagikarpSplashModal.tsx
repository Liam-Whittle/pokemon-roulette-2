import { useEffect, useRef, useState } from 'react';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import { playClip, stopClip } from '../utils/music';

interface SplashLine {
  text: string;
  /** ms per character while typing this line. */
  typeMs: number;
  /** ms to hold after the line finishes typing. */
  holdMs: number;
}

const LINES: SplashLine[] = [
  { text: 'Magikarp used Splash!', typeMs: 45, holdMs: 700 },
  { text: '...', typeMs: 550, holdMs: 700 },
  { text: 'It was… not very effective', typeMs: 45, holdMs: 1200 },
];

/** PokeAPI Gen-5 animated (flopping) Magikarp sprite. */
const MAGIKARP_ANIMATED =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/129.gif';

interface MagikarpSplashModalProps {
  /** Fallback sprite (the caught Magikarp's stored sprite) if the gif fails to load. */
  sprite: string;
  /** Display name of this Magikarp (nickname or "Magikarp"). */
  name: string;
  onDone: () => void;
}

export function MagikarpSplashModal({ sprite, name, onDone }: MagikarpSplashModalProps) {
  const [lineIdx, setLineIdx] = useState(0);
  const [shown, setShown] = useState('');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const clip = playClip(asset('sounds/magikarp_splash.mp3'));
    return () => stopClip(clip);
  }, []);

  useEffect(() => {
    const line = LINES[lineIdx];
    setShown('');
    let chars = 0;
    let holdTimer: number | undefined;

    const typer = window.setInterval(() => {
      chars += 1;
      setShown(line.text.slice(0, chars));
      if (chars >= line.text.length) {
        window.clearInterval(typer);
        holdTimer = window.setTimeout(() => {
          if (lineIdx < LINES.length - 1) {
            setLineIdx((idx) => idx + 1);
          } else {
            onDoneRef.current();
          }
        }, line.holdMs);
      }
    }, line.typeMs);

    return () => {
      window.clearInterval(typer);
      if (holdTimer) window.clearTimeout(holdTimer);
    };
  }, [lineIdx]);

  return (
    <div className="battle-modal__backdrop">
      <div className="battle-modal magikarp-splash-modal">
        <div className="magikarp-splash-modal__stage">
          <div className="magikarp-splash-modal__water" />
          <img
            src={MAGIKARP_ANIMATED}
            alt={name}
            className="magikarp-splash-modal__sprite"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = img.src === sprite ? PLACEHOLDER_SPRITE : sprite;
            }}
          />
        </div>
        <p className="magikarp-splash-modal__text">{shown}</p>
      </div>
    </div>
  );
}
