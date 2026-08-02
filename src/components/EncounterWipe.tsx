import { useEffect, useRef } from 'react';

/** Low-res buffer — scaled up with image-rendering:pixelated for a GB-style edge. */
const BUF_W = 80;
const BUF_H = 72;
const FLASH_MS = 280;
const WIPE_MS = 900;
const HOLD_MS = 120;

interface EncounterWipeProps {
  onDone: () => void;
}

/**
 * Classic wild-encounter black iris: quick flashes, then a pixelated black circle
 * grows from the center until the screen is covered.
 */
export function EncounterWipe({ onDone }: EncounterWipeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = BUF_W;
    canvas.height = BUF_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const cx = (BUF_W - 1) / 2;
    const cy = (BUF_H - 1) / 2;
    const maxR = Math.hypot(cx, cy) + 2;
    const totalMs = FLASH_MS + WIPE_MS + HOLD_MS;
    const start = performance.now();
    let raf = 0;
    let finished = false;

    const paintCircle = (radius: number) => {
      ctx.fillStyle = '#000000';
      // Nearest-neighbour circle (no antialias) so the scaled edge looks chunky.
      for (let y = 0; y < BUF_H; y += 1) {
        for (let x = 0; x < BUF_W; x += 1) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= radius * radius) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    };

    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, BUF_W, BUF_H);

      if (t < FLASH_MS) {
        // Two hard black blinks before the sweep.
        const beat = Math.floor(t / 70);
        if (beat % 2 === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, BUF_W, BUF_H);
        }
      } else if (t < FLASH_MS + WIPE_MS) {
        const p = (t - FLASH_MS) / WIPE_MS;
        // Ease slightly so the last stretch covers corners cleanly.
        const eased = p * p;
        paintCircle(eased * maxR);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, BUF_W, BUF_H);
      }

      if (t >= totalMs) {
        if (!finished) {
          finished = true;
          onDoneRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="encounter-wipe"
      aria-hidden
    />
  );
}
