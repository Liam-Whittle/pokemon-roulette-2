import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useSpring } from 'framer-motion';
import { fetchPokemon, fetchPokemonDetail, type PokemonDetail } from '../api/pokeapi';
import type { CatchBallId, IVs, NatureId, PokemonData, StatKey, StoredMove } from '../types/game';
import { TypeBadge } from './TypeBadge';
import { ItemIcon } from './ItemIcon';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import { useGameStore } from '../store/useGameStore';
import { playClip, stopClip } from '../utils/music';
import { getCryStyleForRegion } from '../data/pools';
import { applyRegionMoveType } from '../data/gen2MoveTypes';
import { MAGIKARP_ID, describeMove, formatMoveCategory, formatMovePowerDisplay } from '../data/moves';
import {
  getBaseStatsForSpecies,
  getComputedStats,
  getNatureLabel,
  statDeltasFromBase,
  zeroEVs,
} from '../utils/stats';
import { getSpeciesCatchRate } from '../utils/xp';

const BALL_LABELS: Record<CatchBallId, string> = {
  pokeball: 'Poké Ball',
  greatball: 'Great Ball',
  ultraball: 'Ultra Ball',
  masterball: 'Master Ball',
};

const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  specialAttack: 'SpA',
  specialDefense: 'SpD',
  speed: 'Spe',
};

const STAT_ORDER: StatKey[] = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];

interface PokemonDetailModalProps {
  id: number;
  name: string;
  types: string[];
  shiny?: boolean;
  caughtWithBall?: CatchBallId;
  level?: number;
  ivs?: IVs;
  evs?: IVs;
  nature?: NatureId;
  moves?: StoredMove[];
  pp?: Record<string, number>;
  onClose: () => void;
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return '0';
}

function statBarWidth(value: number): string {
  return `${Math.min(100, Math.round((value / 200) * 100))}%`;
}

function deltaClass(value: number): string {
  if (value > 0) return 'mon-detail-side__delta--pos';
  if (value < 0) return 'mon-detail-side__delta--neg';
  return 'mon-detail-side__delta--neutral';
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
  shiny = false,
  caughtWithBall,
  level,
  ivs,
  evs,
  nature,
  moves,
  pp,
  onClose,
}: PokemonDetailModalProps) {
  const [data, setData] = useState<PokemonData | null>(null);
  const [detail, setDetail] = useState<PokemonDetail | null>(null);
  const muted = useGameStore((s) => s.muted);
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  const cryStyle = useGameStore((s) => getCryStyleForRegion(s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  const isMagichad = shiny && id === MAGIKARP_ID;
  const [introDone, setIntroDone] = useState(!shiny);
  const cryPlayedRef = useRef(false);

  const rotateX = useSpring(0, { stiffness: 160, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 160, damping: 18 });
  const spriteX = useSpring(0, { stiffness: 150, damping: 18 });
  const spriteY = useSpring(0, { stiffness: 150, damping: 18 });
  const spriteScale = useSpring(1, { stiffness: 150, damping: 18 });

  const displayLevel = level ?? 5;
  const displayNature = nature ?? 'hardy';
  const displayIvs = ivs ?? { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  const displayEvs = evs ?? zeroEVs();
  const catchRate = getSpeciesCatchRate(id);

  const computedStats = isMagichad
    ? null
    : getComputedStats({
        id,
        level: displayLevel,
        ivs: displayIvs,
        evs: displayEvs,
        nature: displayNature,
      });
  const baseStats = isMagichad ? null : getBaseStatsForSpecies(id);
  const deltas = isMagichad
    ? null
    : statDeltasFromBase(id, displayLevel, displayIvs, displayEvs, displayNature);
  const displayMoves = moves?.slice(0, 4) ?? [];

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

  useEffect(() => {
    if (!shiny) return;
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

  useEffect(() => {
    if (muted || cryPlayedRef.current || !introDone) return;

    let clip: HTMLAudioElement | null = null;

    if (isMagichad) {
      cryPlayedRef.current = true;
      clip = playClip(asset('sounds/magikarp_detail.mp3'));
    } else if (data) {
      const crySrc =
        (cryStyle === 'legacy' ? data.cryLegacy : data.cryLatest) ??
        data.cryLatest ??
        data.cryLegacy;
      if (crySrc) {
        cryPlayedRef.current = true;
        clip = playClip(crySrc);
      }
    }

    return () => stopClip(clip);
  }, [muted, introDone, data, isMagichad, cryStyle]);

  const art = isMagichad
    ? asset('img/magikarp_shiny.png')
    : data
      ? shiny && data.shinyArtwork
        ? data.shinyArtwork
        : data.artwork || data.sprite
      : '';

  const displayName = isMagichad ? 'Magichad' : name;
  const displayGenus = isMagichad ? 'Chad Pokémon' : detail?.genus;
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
        className={`mon-detail-layout${shiny ? ' mon-detail-layout--shiny' : ''}`}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className={`mon-detail${shiny ? ' mon-detail--shiny' : ''}${isMagichad ? ' mon-detail--magichad' : ''}`}
          style={shiny ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
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
              {caughtWithBall && (
                <ItemIcon
                  id={caughtWithBall}
                  icon="🔴"
                  name={BALL_LABELS[caughtWithBall]}
                  className="mon-detail__caught-ball"
                />
              )}
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
              <span className="mon-detail__stat-label">LVL</span>
              <span className="mon-detail__stat-value">{isMagichad ? '∞' : displayLevel}</span>
            </div>
            <div className="mon-detail__stat">
              <span className="mon-detail__stat-label">Nature</span>
              <span className="mon-detail__stat-value">
                {isMagichad ? 'Chad' : getNatureLabel(displayNature)}
              </span>
            </div>
            <div className="mon-detail__stat">
              <span className="mon-detail__stat-label">Catch Rate</span>
              <span className="mon-detail__stat-value">{isMagichad ? '∞' : catchRate}</span>
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

        {!isMagichad && computedStats && baseStats && deltas && (
          <motion.div
            className="mon-detail-side"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.25 }}
          >
            <section className="mon-detail-side__panel mon-detail-side__panel--stats">
              <h4 className="mon-detail-side__title">Battle Stats</h4>
              <div className="mon-detail-side__stat-list">
                {STAT_ORDER.map((key) => (
                  <div key={key} className={`mon-detail-side__stat-row mon-detail-side__stat-row--${key}`}>
                    <span className="mon-detail-side__stat-label">{STAT_LABELS[key]}</span>
                    <div className="mon-detail-side__stat-bar">
                      <div
                        className="mon-detail-side__stat-fill"
                        style={{ width: statBarWidth(computedStats[key]) }}
                      />
                    </div>
                    <span className="mon-detail-side__stat-value">{computedStats[key]}</span>
                    <span className={`mon-detail-side__delta ${deltaClass(deltas[key])}`}>
                      {formatDelta(deltas[key])}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mon-detail-side__iv-ev">
                <div className="mon-detail-side__iv-ev-row">
                  <span className="mon-detail-side__iv-ev-label">IV</span>
                  <span className="mon-detail-side__iv-ev-values">
                    {STAT_ORDER.map((key) => displayIvs[key]).join(' · ')}
                  </span>
                </div>
              </div>
            </section>

            {displayMoves.length > 0 && (
              <section className="mon-detail-side__panel mon-detail-side__panel--moves">
                <h4 className="mon-detail-side__title">Moveset</h4>
                <div className="mon-detail-side__move-list">
                  {displayMoves.map((move) => {
                    const currentPp = pp?.[move.slug] ?? move.maxPp;
                    const accuracyLabel = move.accuracy > 0 ? `${move.accuracy}%` : '—';
                    const powerLabel = formatMovePowerDisplay(move, level ?? 5);
                    return (
                      <article key={move.slug} className="mon-detail-side__move-card">
                        <div className="mon-detail-side__move-head">
                          <h5 className="mon-detail-side__move-name">{move.name}</h5>
                          <TypeBadge type={applyRegionMoveType(move.slug, move.type, region)} size="sm" />
                        </div>
                        <div className="mon-detail-side__move-meta">
                          <span className="mon-detail-side__move-tag">{formatMoveCategory(move.category)}</span>
                          <span className="mon-detail-side__move-tag">Pow {powerLabel}</span>
                          <span className="mon-detail-side__move-tag">Acc {accuracyLabel}</span>
                          <span className="mon-detail-side__move-tag mon-detail-side__move-tag--pp">
                            PP {currentPp}/{move.maxPp}
                          </span>
                        </div>
                        <p className="mon-detail-side__move-desc">{describeMove(move, { level: level ?? 5 })}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
