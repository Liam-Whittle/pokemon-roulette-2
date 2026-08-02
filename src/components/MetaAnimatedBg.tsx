import type { CSSProperties } from 'react';

type MetaBgVariant = 'prestige' | 'pokedex' | 'daily' | 'hall' | 'giovanni';

const SPARK_COUNT = 18;
const LASER_COUNT = 8;
const FLOOR_TILE_COUNT = 18;

interface MetaAnimatedBgProps {
  variant: MetaBgVariant;
}

/** Extra motion layers for Prestige / Global Pokédex / Daily / Hall / Giovanni backgrounds. */
export function MetaAnimatedBg({ variant }: MetaAnimatedBgProps) {
  return (
    <div className={`meta-fx meta-fx--${variant}`} aria-hidden="true">
      <div className="meta-fx__aurora meta-fx__aurora--a" />
      <div className="meta-fx__aurora meta-fx__aurora--b" />
      <div className="meta-fx__grid" />

      {variant === 'giovanni' && (
        <div className="meta-fx__club">
          <div className="meta-fx__club-haze" />
          <div className="meta-fx__club-stage">
            <div className="meta-fx__club-stage-surface">
              <div className="meta-fx__club-stage-grid" />
              <div className="meta-fx__club-stage-tiles">
                {Array.from({ length: FLOOR_TILE_COUNT }, (_, i) => (
                  <span
                    key={i}
                    className="meta-fx__club-tile"
                    style={
                      {
                        '--tile-col': i % 6,
                        '--tile-row': Math.floor(i / 6),
                        '--tile-delay': `${(i % 6) * 0.18 + Math.floor(i / 6) * 0.35}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <div className="meta-fx__club-stage-shine" />
            </div>
            <div className="meta-fx__club-horizon" />
            <div className="meta-fx__club-fog meta-fx__club-fog--a" />
            <div className="meta-fx__club-fog meta-fx__club-fog--b" />
            <div className="meta-fx__club-rim" />
          </div>
          {Array.from({ length: LASER_COUNT }, (_, i) => {
            const dur = 9 + (i % 4) * 1.8;
            // Negative delay = already mid-cycle on mount (no rest-pose startup)
            const delay = -((i / LASER_COUNT) * dur + (i % 3) * 0.8);
            return (
              <span
                key={i}
                className={`meta-fx__laser meta-fx__laser--${(i % 4) + 1}`}
                style={
                  {
                    '--laser-delay': `${delay}s`,
                    '--laser-dur': `${dur}s`,
                    '--laser-origin-x': `${4 + (i / (LASER_COUNT - 1)) * 92}%`,
                  } as CSSProperties
                }
              />
            );
          })}
          <div className="meta-fx__club-strobe" />
        </div>
      )}

      <div className="meta-fx__sparkles">
        {Array.from({ length: SPARK_COUNT }, (_, i) => (
          <span
            key={i}
            className="meta-fx__spark"
            style={
              {
                '--sx': `${(i * 37) % 100}%`,
                '--sy': `${(i * 53) % 100}%`,
                '--sd': `${1.8 + (i % 7) * 0.45}s`,
                '--sdelay': `${(i * 0.27) % 4}s`,
                '--ssize': `${3 + (i % 4)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="meta-fx__vignette" />
    </div>
  );
}
