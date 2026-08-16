import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, useSpring } from 'framer-motion';
import { fetchPokemon, fetchPokemonDetail, type PokemonDetail } from '../api/pokeapi';
import type { CatchBallId, IVs, NatureId, PokemonData, StatKey, StoredMove } from '../types/game';
import { TypeBadge } from './TypeBadge';
import { ItemIcon } from './ItemIcon';
import { GlitchText } from './GlitchText';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import { useGameStore } from '../store/useGameStore';
import { CRY_VOLUME_SCALE, MISSINGNO_CRY_VOLUME_SCALE, playClip, stopClip } from '../utils/music';
import { getCryStyleForRegion, resolveRegionId } from '../data/pools';
import { applyRegionMoveType } from '../data/gen2MoveTypes';
import { MAGIKARP_ID, describeMove, formatMoveCategory, formatMovePowerDisplay } from '../data/moves';
import { getAbilityInfo, getMonAbility, isHiddenAbilityForSpecies } from '../data/abilities';
import { rollGenderForSpecies, type PokemonGender } from '../data/speciesGender';
import { MISSINGNO_DATA, MISSINGNO_ID, MISSINGNO_SPRITE } from '../data/missingno';
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
  ability?: string;
  gender?: PokemonGender | null;
  /** When false, hide the left battle-stats / moveset panels. */
  showSidePanel?: boolean;
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

interface AbilityChipRow {
  slug: string;
  name: string;
  shortEffect: string;
  kind: 'standard' | 'hidden';
  active: boolean;
}

function AbilityChip({ row }: { row: AbilityChipRow }) {
  const chipRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const chip = chipRef.current;
      const tip = tipRef.current;
      if (!chip || !tip) return;
      const cr = chip.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const gap = 8;
      const pad = 10;
      let left = cr.left;
      if (left + tw > window.innerWidth - pad) left = cr.right - tw;
      if (left < pad) left = pad;
      let top = cr.bottom + gap;
      if (top + th > window.innerHeight - pad) top = cr.top - th - gap;
      if (top < pad) top = pad;
      setTipStyle({ top, left });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <span
      ref={chipRef}
      className={`mon-detail__ability-chip mon-detail__ability-chip--${row.kind}${
        row.active ? ' mon-detail__ability-chip--active' : ''
      }`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className="mon-detail__ability-kind">
        {row.kind === 'hidden' ? 'Hidden' : 'Ability'}
      </span>
      <span className="mon-detail__ability-name">{row.name}</span>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            className={`mon-detail__ability-tip mon-detail__ability-tip--${row.kind}`}
            role="tooltip"
            style={tipStyle}
          >
            <strong className="mon-detail__ability-tip-name">{row.name}</strong>
            <span className="mon-detail__ability-tip-desc">{row.shortEffect}</span>
          </span>,
          document.body,
        )}
    </span>
  );
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

const MISSINGNO_SHINY_GLYPHS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${4 + ((i * 37) % 92)}%`,
  top: `${6 + ((i * 53) % 88)}%`,
  delay: (i % 7) * 0.18,
  duration: 1.4 + (i % 5) * 0.25,
  char: '█▓▒░╬╫■◆ΞΨΩµ'[i % 12]!,
}));

const MISSINGNO_SHINY_BLOCKS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  left: `${(i * 13) % 85}%`,
  top: `${(i * 21) % 80}%`,
  width: `${8 + (i % 4) * 6}%`,
  height: `${3 + (i % 3) * 4}%`,
  delay: i * 0.35,
}));

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
  ability,
  gender,
  showSidePanel = true,
  onClose,
}: PokemonDetailModalProps) {
  const isMissingNo = id === MISSINGNO_ID;
  const isShinyMissingNo = shiny && isMissingNo;
  const [data, setData] = useState<PokemonData | null>(() =>
    id === MISSINGNO_ID ? MISSINGNO_DATA : null,
  );
  const [detail, setDetail] = useState<PokemonDetail | null>(() =>
    id === MISSINGNO_ID
      ? {
          genus: 'Glitch Pokémon',
          heightM: 3.3,
          weightKg: 1590.8,
          flavorText:
            'A corrupted data form. Looking at it for too long makes the Pokédex text scramble.',
        }
      : null,
  );
  const partyGender = useGameStore((s) => s.party.find((m) => m.id === id)?.gender);
  const shownGender = gender !== undefined ? gender : partyGender !== undefined ? partyGender : rollGenderForSpecies(id);
  const muted = useGameStore((s) => s.muted);
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const cryStyle = useGameStore((s) => getCryStyleForRegion(resolveRegionId(s.trainer?.region)));
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

  const computedStats =
    isMagichad || !showSidePanel
      ? null
      : getComputedStats({
          id,
          level: displayLevel,
          ivs: displayIvs,
          evs: displayEvs,
          nature: displayNature,
        });
  const baseStats = isMagichad || !showSidePanel ? null : getBaseStatsForSpecies(id);
  const deltas =
    isMagichad || !showSidePanel
      ? null
      : statDeltasFromBase(id, displayLevel, displayIvs, displayEvs, displayNature);
  const displayMoves = showSidePanel ? (moves?.slice(0, 4) ?? []) : [];
  const activeAbilitySlug = ability ?? getMonAbility({ id, ability });
  const assignedInfo = activeAbilitySlug ? getAbilityInfo(activeAbilitySlug) : null;
  const abilityRows = isMissingNo
    ? [{ slug: 'glitch', name: 'Glitch', shortEffect: 'Corrupted data. Effects are unpredictable.', kind: 'standard' as const, active: true }]
    : isMagichad
      ? [{ slug: 'chad', name: 'Chad Energy', shortEffect: 'This Magikarp answers to no ability.', kind: 'standard' as const, active: true }]
      : assignedInfo
        ? [{
            ...assignedInfo,
            kind: (isHiddenAbilityForSpecies(id, assignedInfo.slug) ? 'hidden' : 'standard') as 'hidden' | 'standard',
            active: true,
          }]
        : [];

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
    if (isMissingNo) return;
    let active = true;
    fetchPokemon(id).then((d) => active && setData(d)).catch(() => {});
    fetchPokemonDetail(id).then((d) => active && setDetail(d)).catch(() => {});
    return () => {
      active = false;
    };
  }, [id, isMissingNo]);

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

  // MissingNo cry is its own effect so a later `data` update can't stopClip mid-play.
  useEffect(() => {
    if (!isMissingNo || muted || !introDone) return;
    const clip = playClip(asset('sounds/missingno_cry.mp3'), MISSINGNO_CRY_VOLUME_SCALE);
    return () => stopClip(clip);
  }, [isMissingNo, muted, introDone]);

  useEffect(() => {
    if (isMissingNo || muted || cryPlayedRef.current || !introDone) return;

    let clip: HTMLAudioElement | null = null;

    if (isMagichad) {
      cryPlayedRef.current = true;
      clip = playClip(asset('sounds/magikarp_detail.mp3'), CRY_VOLUME_SCALE);
    } else if (data) {
      const crySrc =
        (cryStyle === 'legacy' ? data.cryLegacy : data.cryLatest) ??
        data.cryLatest ??
        data.cryLegacy;
      if (crySrc) {
        cryPlayedRef.current = true;
        clip = playClip(crySrc, CRY_VOLUME_SCALE);
      }
    }

    return () => stopClip(clip);
  }, [muted, introDone, data, isMagichad, isMissingNo, cryStyle]);

  const art = isMissingNo
    ? MISSINGNO_SPRITE
    : isMagichad
      ? asset('img/magikarp_shiny.png')
      : data
        ? shiny && data.shinyArtwork
          ? data.shinyArtwork
          : data.artwork || data.sprite
        : '';

  const displayName = isMagichad ? 'Magichad' : name;
  const displayGenus = isMagichad ? 'Chad Pokémon' : detail?.genus;
  const displayBst = isMagichad ? '∞' : isMissingNo ? MISSINGNO_DATA.baseStatTotal : data?.baseStatTotal;
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
    <div
      className={`mon-detail-backdrop${isShinyMissingNo ? ' mon-detail-backdrop--missingno-shiny' : ''}`}
      onClick={onClose}
    >
      {isShinyMissingNo && (
        <div className="missingno-shiny-storm" aria-hidden>
          <div className="missingno-shiny-storm__noise" />
          <div className="missingno-shiny-storm__rgb" />
          <div className="missingno-shiny-storm__scan" />
          <div className="missingno-shiny-storm__tear missingno-shiny-storm__tear--a" />
          <div className="missingno-shiny-storm__tear missingno-shiny-storm__tear--b" />
          <div className="missingno-shiny-storm__tear missingno-shiny-storm__tear--c" />
          <div className="missingno-shiny-storm__flash" />
          {MISSINGNO_SHINY_BLOCKS.map((b) => (
            <span
              key={b.id}
              className="missingno-shiny-storm__block"
              style={
                {
                  left: b.left,
                  top: b.top,
                  width: b.width,
                  height: b.height,
                  animationDelay: `${b.delay}s`,
                } as CSSProperties
              }
            />
          ))}
          {MISSINGNO_SHINY_GLYPHS.map((g) => (
            <span
              key={g.id}
              className="missingno-shiny-storm__glyph"
              style={
                {
                  left: g.left,
                  top: g.top,
                  animationDelay: `${g.delay}s`,
                  animationDuration: `${g.duration}s`,
                } as CSSProperties
              }
            >
              {g.char}
            </span>
          ))}
          <div className="missingno-shiny-storm__vignette" />
        </div>
      )}
      <motion.div
        className={`mon-detail-layout${shiny ? ' mon-detail-layout--shiny' : ''}${isShinyMissingNo ? ' mon-detail-layout--missingno-shiny' : ''}`}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={
          isShinyMissingNo
            ? { scale: 1, opacity: 1, y: 0, x: [0, -3, 4, -2, 3, 0] }
            : { scale: 1, opacity: 1, y: 0 }
        }
        transition={
          isShinyMissingNo
            ? {
                scale: { type: 'spring', stiffness: 240, damping: 24 },
                opacity: { duration: 0.25 },
                x: { duration: 0.45, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' },
              }
            : { type: 'spring', stiffness: 240, damping: 24 }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className={`mon-detail${shiny ? ' mon-detail--shiny' : ''}${isMagichad ? ' mon-detail--magichad' : ''}${isMissingNo ? ' mon-detail--missingno' : ''}${isShinyMissingNo ? ' mon-detail--missingno-shiny' : ''}`}
          style={shiny ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
        {shiny && !isMissingNo && (
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

        {isMissingNo && (
          <>
            <div className="mon-detail__glitch-scan" aria-hidden />
            {isShinyMissingNo && <div className="mon-detail__glitch-scan mon-detail__glitch-scan--hot" aria-hidden />}
            <div className="mon-detail__ribbon-wrap" aria-hidden>
              <span className={`mon-detail__ribbon mon-detail__ribbon--glitch${isShinyMissingNo ? ' mon-detail__ribbon--glitch-shiny' : ''}`}>
                {isShinyMissingNo ? 'SHINY ███' : 'CORRUPT'}
              </span>
            </div>
            {isShinyMissingNo && (
              <div className="mon-detail__burst mon-detail__burst--glitch" aria-hidden>
                {SHINY_BURST.map((b) => (
                  <motion.span
                    key={b.id}
                    className="mon-detail__burst-star mon-detail__burst-star--glitch"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.3 }}
                    animate={{ x: b.x * 1.35, y: b.y * 1.35, opacity: 0, scale: 1.25 }}
                    transition={{ duration: 1.1, delay: b.delay, ease: 'easeOut' }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {(!shiny || isMissingNo) && (
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
                  className={`mon-detail__art${shiny && !isMissingNo ? ' mon-detail__art--shiny' : ''}${isMissingNo ? ' mon-detail__art--missingno' : ''}${isShinyMissingNo ? ' mon-detail__art--missingno-shiny' : ''}`}
                  animate={
                    isShinyMissingNo
                      ? {
                          x: [0, -6, 8, -4, 5, 0],
                          y: [0, 3, -4, 2, -2, 0],
                          scale: [1, 1.08, 0.96, 1.05, 1],
                          rotate: [0, -2, 3, -1, 0],
                        }
                      : isMissingNo
                        ? { x: [0, -2, 2, -1, 0], y: [0, 1, -1, 0] }
                        : shiny
                          ? { y: [0, -6, 0], scale: [1, 1.04, 1], rotate: [0, 0.6, -0.6, 0] }
                          : undefined
                  }
                  transition={
                    isShinyMissingNo
                      ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.35 }
                      : isMissingNo
                        ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }
                        : shiny
                          ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                          : undefined
                  }
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = isMissingNo
                      ? MISSINGNO_SPRITE
                      : PLACEHOLDER_SPRITE;
                  }}
                />
              </motion.div>
              {isMissingNo && <div className="mon-detail__glitch-bars" aria-hidden />}
              {isShinyMissingNo && <div className="mon-detail__glitch-bars mon-detail__glitch-bars--hot" aria-hidden />}
              {shiny && !isMissingNo && (
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
              {shiny && !isMissingNo && <span className="mon-detail__name-emoji">✨</span>}
              {isMissingNo ? (
                <GlitchText
                  text={displayName}
                  className={`mon-detail__name-text mon-detail__name-text--glitch${isShinyMissingNo ? ' mon-detail__name-text--glitch-shiny' : ''}`}
                  intervalMs={isShinyMissingNo ? 40 : 70}
                  revealChance={isShinyMissingNo ? 0.14 : 0.28}
                />
              ) : (
                <span className={`mon-detail__name-text${shiny ? ' mon-detail__name-text--shiny' : ''}`}>
                  {displayName}
                </span>
              )}
              {shownGender === 'male' && (
                <span className="mon-detail__gender mon-detail__gender--male" aria-label="Male">♂</span>
              )}
              {shownGender === 'female' && (
                <span className="mon-detail__gender mon-detail__gender--female" aria-label="Female">♀</span>
              )}
              {caughtWithBall && (
                <ItemIcon
                  id={caughtWithBall}
                  icon="🔴"
                  name={BALL_LABELS[caughtWithBall]}
                  className="mon-detail__caught-ball"
                />
              )}
            </h3>
            <span className={`mon-detail__id${isMissingNo ? ' mon-detail__id--glitch' : ''}${isShinyMissingNo ? ' mon-detail__id--glitch-shiny' : ''}`}>
              {isMagichad ? '#∞' : isMissingNo ? (
                <GlitchText
                  text={isShinyMissingNo ? '#???' : '#000'}
                  intervalMs={isShinyMissingNo ? 55 : 90}
                  revealChance={isShinyMissingNo ? 0.2 : 0.35}
                />
              ) : (
                `#${String(id).padStart(3, '0')}`
              )}
            </span>
          </div>

          {isMissingNo && (
            <p className={`mon-detail__rarity mon-detail__rarity--glitch${isShinyMissingNo ? ' mon-detail__rarity--glitch-shiny' : ''}`}>
              {isShinyMissingNo
                ? 'Shiny glitch · reality unstable'
                : 'Glitch form · data unstable'}
            </p>
          )}

          {shiny && !isMissingNo && (
            <p className="mon-detail__rarity">
              {isMagichad ? 'Chad variant · 1 in ∞ encounter' : 'Shiny variant · 1 in 40 encounter'}
            </p>
          )}

          {displayGenus && (
            <p className="mon-detail__genus">
              {isMissingNo ? (
                <GlitchText text={displayGenus} intervalMs={120} revealChance={0.4} />
              ) : (
                displayGenus
              )}
            </p>
          )}

          <div className="mon-detail__types">
            {isMagichad ? (
              <span className="type-badge type-badge--sm type-badge--god">GOD</span>
            ) : (
              types.map((t) => <TypeBadge key={t} type={t} size="sm" />)
            )}
          </div>

          {abilityRows.length > 0 && (
            <div className="mon-detail__abilities" aria-label="Abilities">
              {abilityRows.map((row) => (
                <AbilityChip key={`${row.kind}-${row.slug}`} row={row} />
              ))}
            </div>
          )}

          <div className="mon-detail__stats">
            <div className="mon-detail__stat">
              <span className="mon-detail__stat-label">LVL</span>
              <span className="mon-detail__stat-value">
                {isMagichad ? '∞' : displayLevel}
              </span>
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
            {(isMagichad || isMissingNo || data) && (
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

          {!isMagichad && !isMissingNo && data?.isLegendary && (
            <span className="mon-detail__legendary">Legendary</span>
          )}
          {isMissingNo && (
            <span
              className={`mon-detail__legendary mon-detail__legendary--glitch${isShinyMissingNo ? ' mon-detail__legendary--glitch-shiny' : ''}`}
            >
              {isShinyMissingNo ? 'Shiny Glitch' : 'Glitch'}
            </span>
          )}

          {displayFlavor && (
            <p
              className={`mon-detail__flavor${isMissingNo ? ' mon-detail__flavor--glitch' : ''}${isShinyMissingNo ? ' mon-detail__flavor--glitch-shiny' : ''}`}
            >
              {isShinyMissingNo
                ? 'A corrupted shiny. The Pokédex cannot render this entry without tearing the UI apart.'
                : displayFlavor}
            </p>
          )}
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
