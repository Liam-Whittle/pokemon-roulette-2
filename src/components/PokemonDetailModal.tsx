import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useSpring } from 'framer-motion';
import { fetchPokemon, fetchPokemonDetail, type PokemonDetail } from '../api/pokeapi';
import type { PokemonData } from '../types/game';
import { TypeBadge } from './TypeBadge';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import { useGameStore } from '../store/useGameStore';
import { playClip, stopClip } from '../utils/music';
import { REGION_CRY_STYLE } from '../data/pools';
import { MAGIKARP_ID } from '../data/moves';

interface PokemonDetailModalProps {
  id: number;
  name: string;
  types: string[];
  powerLevel: number;
  shiny?: boolean;
  onClose: () => void;
}

function powerPct(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0.3) * 100);
}

/** Sparkle positions (percent within the art frame) for the shiny shimmer. */
const SHINY_PARTICLES = [
  { id: 0, left: '12%', top: '22%', delay: 0, duration: 1.8 },
  { id: 1, left: '82%', top: '18%', delay: 0.6, duration: 2.1 },
  { id: 2, left: '50%', top: '8%', delay: 1.1, duration: 1.6 },
  { id: 3, left: '22%', top: '64%', delay: 0.3, duration: 2.3 },
  { id: 4, left: '74%', top: '58%', delay: 0.9, duration: 1.9 },
  { id: 5, left: '88%', top: '40%', delay: 1.4, duration: 2.0 },
  { id: 6, left: '8%', top: '46%', delay: 0.5, duration: 1.7 },
  { id: 7, left: '40%', top: '80%', delay: 1.2, duration: 2.2 },
  { id: 8, left: '62%', top: '78%', delay: 0.2, duration: 1.8 },
  { id: 9, left: '32%', top: '14%', delay: 1.6, duration: 2.0 },
];

/** One-time celebratory burst radiating outward when a shiny card opens. */
const SHINY_BURST = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const distance = 90 + (i % 3) * 26;
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    delay: (i % 5) * 0.02,
  };
});

const MAX_TILT = 9;

export function PokemonDetailModal({
  id,
  name,
  types,
  powerLevel,
  shiny = false,
  onClose,
}: PokemonDetailModalProps) {
  const [data, setData] = useState<PokemonData | null>(null);
  const [detail, setDetail] = useState<PokemonDetail | null>(null);
  const muted = useGameStore((s) => s.muted);
  // Easter egg: a SHINY Magikarp becomes "Magichad" with a cosmic card and joke stats.
  const isMagichad = shiny && id === MAGIKARP_ID;
  // For shinies, the cry waits until the shiny chime has finished.
  const [introDone, setIntroDone] = useState(!shiny);
  const cryPlayedRef = useRef(false);

  const rotateX = useSpring(0, { stiffness: 160, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 160, damping: 18 });
  const spriteX = useSpring(0, { stiffness: 150, damping: 18 });
  const spriteY = useSpring(0, { stiffness: 150, damping: 18 });
  const spriteScale = useSpring(1, { stiffness: 150, damping: 18 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!shiny) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 2 * MAX_TILT);
    rotateX.set(-(py - 0.5) * 2 * MAX_TILT);
    spriteX.set((px - 0.5) * 16);
    spriteY.set((py - 0.5) * 11);
    spriteScale.set(1.03);
  };

  const handlePointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    spriteX.set(0);
    spriteY.set(0);
    spriteScale.set(1);
  };

  useEffect(() => {
    let active = true;
    fetchPokemon(id).then((d) => active && setData(d)).catch(() => {});
    fetchPokemonDetail(id).then((d) => active && setDetail(d)).catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  // Shiny chime intro: play it first, then unblock the cry once it ends.
  useEffect(() => {
    if (!shiny) return;
    // Magichad skips the shiny chime entirely and plays its own line immediately.
    if (isMagichad) {
      setIntroDone(true);
      return;
    }
    if (muted) {
      setIntroDone(true);
      return;
    }
    const clip = playClip(asset('sounds/shiny.mp3'));
    if (!clip) {
      setIntroDone(true);
      return;
    }
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        setIntroDone(true);
      }
    };
    clip.addEventListener('ended', finish, { once: true });
    const fallback = setTimeout(finish, 2500);
    return () => {
      clearTimeout(fallback);
      clip.removeEventListener('ended', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play the Pokémon's region-appropriate cry once data is loaded (and, for
  // shinies, after the chime has finished). Guarded so it only fires once.
  useEffect(() => {
    if (muted || cryPlayedRef.current || !introDone) return;

    let clip: HTMLAudioElement | null = null;

    if (isMagichad) {
      cryPlayedRef.current = true;
      clip = playClip(asset('sounds/magikarp_detail.mp3'));
    } else if (data) {
      const crySrc =
        (REGION_CRY_STYLE === 'legacy' ? data.cryLegacy : data.cryLatest) ??
        data.cryLatest ??
        data.cryLegacy;
      if (crySrc) {
        cryPlayedRef.current = true;
        clip = playClip(crySrc);
      }
    }

    return () => stopClip(clip);
  }, [muted, introDone, data, isMagichad]);

  const art = isMagichad
    ? asset('img/magikarp_shiny.png')
    : data
      ? shiny && data.shinyArtwork
        ? data.shinyArtwork
        : data.artwork || data.sprite
      : '';

  const displayName = isMagichad ? 'Magichad' : name;
  const displayGenus = isMagichad ? 'Chad Pokémon' : detail?.genus;
  const displayPower = isMagichad ? '∞' : powerPct(powerLevel);
  const displayBst = isMagichad ? '∞' : data?.baseStatTotal;
  const displayHeight = isMagichad
    ? '7 foot without shoes'
    : detail && detail.heightM > 0
      ? `${detail.heightM.toFixed(1)} m`
      : null;
  const displayWeight = isMagichad
    ? '100 kgs of pure muscle'
    : detail && detail.weightKg > 0
      ? `${detail.weightKg.toFixed(1)} kg`
      : null;
  const displayFlavor = isMagichad
    ? 'A truly chad fish, stronger than the horribly weak chinned pokémon that exist today.'
    : detail?.flavorText;

  return createPortal(
    <div className="mon-detail-backdrop" onClick={onClose}>
      <motion.div
        className={`mon-detail${shiny ? ' mon-detail--shiny' : ''}${isMagichad ? ' mon-detail--magichad' : ''}`}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        style={shiny ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => e.stopPropagation()}
      >
        {shiny && (
          <>
            <div className="mon-detail__foil" aria-hidden />
            <div className="mon-detail__ribbon-wrap" aria-hidden>
              <span className="mon-detail__ribbon">{isMagichad ? 'CHAD' : 'SHINY'}</span>
            </div>
            <div className="mon-detail__burst" aria-hidden>
              {SHINY_BURST.map((b) => (
                <motion.span
                  key={b.id}
                  className="mon-detail__burst-star"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.3 }}
                  animate={{ x: b.x, y: b.y, opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.95, delay: b.delay, ease: 'easeOut' }}
                />
              ))}
            </div>
          </>
        )}

        {!shiny && (
          <button type="button" className="mon-detail__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}

        <div className="mon-detail__art-wrap">
          {art ? (
            <>
              <motion.div
                className="mon-detail__art-parallax"
                style={shiny ? { x: spriteX, y: spriteY, scale: spriteScale } : undefined}
              >
                <motion.img
                  src={art}
                  alt={displayName}
                  className={`mon-detail__art${shiny ? ' mon-detail__art--shiny' : ''}`}
                  animate={
                    shiny
                      ? { y: [0, -6, 0], scale: [1, 1.04, 1], rotate: [0, 0.6, -0.6, 0] }
                      : undefined
                  }
                  transition={
                    shiny ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : undefined
                  }
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                  }}
                />
              </motion.div>
              {shiny && (
                <div className="mon-detail__particles" aria-hidden>
                  {SHINY_PARTICLES.map((p) => (
                    <motion.span
                      key={p.id}
                      className="mon-detail__particle"
                      style={{ left: p.left, top: p.top }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, 90] }}
                      transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        delay: p.delay,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mon-detail__art-loading">Loading…</div>
          )}
        </div>

        <div className="mon-detail__body">
          <div className="mon-detail__header">
            <h3 className="mon-detail__name">
              {shiny && <span className="mon-detail__name-emoji">✨</span>}
              <span className={`mon-detail__name-text${shiny ? ' mon-detail__name-text--shiny' : ''}`}>
                {displayName}
              </span>
            </h3>
            <span className="mon-detail__id">{isMagichad ? '#∞' : `#${String(id).padStart(3, '0')}`}</span>
          </div>

          {shiny && (
            <p className="mon-detail__rarity">
              {isMagichad ? 'Chad variant · 1 in ∞ encounter' : 'Shiny variant · 1 in 40 encounter'}
            </p>
          )}

          {displayGenus && <p className="mon-detail__genus">{displayGenus}</p>}

          <div className="mon-detail__types">
            {isMagichad ? (
              <span className="type-badge type-badge--sm type-badge--god">GOD</span>
            ) : (
              types.map((t) => <TypeBadge key={t} type={t} size="sm" />)
            )}
          </div>

          <div className="mon-detail__stats">
            <div className="mon-detail__stat">
              <span className="mon-detail__stat-label">Power</span>
              <span className="mon-detail__stat-value">{displayPower}</span>
            </div>
            {(isMagichad || data) && (
              <div className="mon-detail__stat">
                <span className="mon-detail__stat-label">Base Stat Total</span>
                <span className="mon-detail__stat-value">{displayBst}</span>
              </div>
            )}
            {displayHeight && (
              <div className="mon-detail__stat">
                <span className="mon-detail__stat-label">Height</span>
                <span className="mon-detail__stat-value">{displayHeight}</span>
              </div>
            )}
            {displayWeight && (
              <div className="mon-detail__stat">
                <span className="mon-detail__stat-label">Weight</span>
                <span className="mon-detail__stat-value">{displayWeight}</span>
              </div>
            )}
          </div>

          {!isMagichad && data?.isLegendary && <span className="mon-detail__legendary">Legendary</span>}

          {displayFlavor && <p className="mon-detail__flavor">{displayFlavor}</p>}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
