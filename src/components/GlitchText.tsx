import { useEffect, useState } from 'react';

const GLITCH_CHARS = '█▓▒░╬╫╪╩╦╠═║╔╗╚╝■□▪▫◆#@$%&*!?/\\|~^ΞΨΩµ±×÷';

function scramble(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  }
  return out;
}

interface GlitchTextProps {
  text: string;
  className?: string;
  /** How often to reshuffle characters (ms). */
  intervalMs?: number;
  /** Chance each tick shows the real text briefly (0–1). */
  revealChance?: number;
}

/** Quickly cycles random symbols, occasionally flashing the real label. */
export function GlitchText({
  text,
  className,
  intervalMs = 55,
  revealChance = 0.18,
}: GlitchTextProps) {
  const [display, setDisplay] = useState(() => scramble(text.length));

  useEffect(() => {
    const id = window.setInterval(() => {
      setDisplay(Math.random() < revealChance ? text : scramble(text.length));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text, intervalMs, revealChance]);

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  );
}
