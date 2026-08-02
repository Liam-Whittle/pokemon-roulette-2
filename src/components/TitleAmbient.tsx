import type { CSSProperties } from 'react';

const SPARKLE_COUNT = 14;

/** Holy cone of light on the title hero — decorative only. */
export function TitleAmbient() {
  return (
    <div className="title-ambient" aria-hidden="true">
      <div className="title-ambient__cone" />
      <div className="title-ambient__bloom" />
      <div className="title-ambient__sparkles">
        {Array.from({ length: SPARKLE_COUNT }, (_, i) => {
          const row = i % 7;
          const col = Math.floor(i / 7);
          /* Spread across the cone: wider X bands lower down. */
          const y = 8 + row * 12 + ((i * 7) % 5);
          const spread = 18 + y * 0.35;
          const x = 50 + (((i * 37) % 100) / 100 - 0.5) * spread * 2 + (col - 1.5) * 4;
          return (
            <span
              key={i}
              className="title-ambient__sparkle"
              style={
                {
                  '--sx': `${Math.min(88, Math.max(12, x))}%`,
                  '--sy': `${y}%`,
                  '--ssize': `${2 + (i % 5) * 1.5}px`,
                  '--sd': `${3 + (i % 6) * 0.65}s`,
                  '--sdelay': `${(i * 0.31) % 5.2}s`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
