import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { GameIcon } from './GameIcon';
import { GlitchText } from './GlitchText';
import { PokeDollarAmount } from './PokeDollar';
import { useGameStore } from '../store/useGameStore';
import {
  getRegionAllPokemonPool,
  getRegionGymLeaders,
  getRegionTotalGyms,
  resolveBadgeImage,
  resolveRegionId,
} from '../data/pools';
import {
  PRESTIGE_UNLOCK_ICONS,
  PRESTIGE_UNLOCKS,
  type PrestigeUnlockDef,
} from '../data/prestige';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { formatRunTime } from '../utils/hallOfFame';
import { imgFallback, remoteBadge } from '../utils/localAssets';
import { playSfx } from '../utils/sound';

const CHARACTER_BY_REGION: Record<string, { boy: string; girl: string }> = {
  Kanto: { boy: 'Red', girl: 'Leaf' },
  Johto: { boy: 'Ethan', girl: 'Lyra' },
  Hoenn: { boy: 'Brendan', girl: 'May' },
};

interface TrainerProfileModalProps {
  onClose: () => void;
}

function ModifierChip({ unlock }: { unlock: PrestigeUnlockDef }) {
  const chipRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const goldIcon = unlock.id === 'shinyCharmPlus';
  const glitch = unlock.id === 'missingNo';
  const icon = PRESTIGE_UNLOCK_ICONS[unlock.id];

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const chip = chipRef.current;
      const tip = tipRef.current;
      if (!chip || !tip) return;
      const cr = chip.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const gap = 10;
      const pad = 10;
      let left = cr.left;
      if (left + tw > window.innerWidth - pad) left = cr.right - tw;
      if (left < pad) left = pad;
      let top = cr.bottom + gap;
      if (top + th > window.innerHeight - pad) top = cr.top - th - gap;
      if (top < pad) top = pad;
      setTipStyle({ top, left, visibility: 'visible' });
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
    <button
      ref={chipRef}
      type="button"
      className={`trainer-profile__mod${goldIcon ? ' trainer-profile__mod--gold' : ''}${
        glitch ? ' trainer-profile__mod--glitch' : ''
      }`}
      aria-describedby={open ? `trainer-mod-tip-${unlock.id}` : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className="trainer-profile__mod-icon-wrap" aria-hidden>
        <img
          src={icon}
          alt=""
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
          }}
        />
      </span>
      <span className="trainer-profile__mod-name">
        {glitch ? <GlitchText text={unlock.name} /> : unlock.name}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={`trainer-mod-tip-${unlock.id}`}
            className={`trainer-profile__mod-tip${glitch ? ' trainer-profile__mod-tip--glitch' : ''}`}
            role="tooltip"
            style={tipStyle}
          >
            <strong className="trainer-profile__mod-tip-name">
              {glitch ? <GlitchText text={unlock.name} /> : unlock.name}
            </strong>
            <span className="trainer-profile__mod-tip-desc">{unlock.description}</span>
          </div>,
          document.body,
        )}
    </button>
  );
}

function useLiveRunMs(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt == null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (startedAt == null) return 0;
  return Math.max(0, now - startedAt);
}

export function TrainerProfileModal({ onClose }: TrainerProfileModalProps) {
  const trainer = useGameStore((s) => s.trainer);
  const region = resolveRegionId(trainer?.region);
  const party = useGameStore((s) => s.party);
  const badges = useGameStore((s) => s.badges);
  const spinsCount = useGameStore((s) => s.spinsCount);
  const lives = useGameStore((s) => s.lives);
  const money = useGameStore((s) => s.money);
  const eliteCleared = useGameStore((s) => s.eliteCleared);
  const runStartedAt = useGameStore((s) => s.runStartedAt);
  const itemsUsed = useGameStore((s) => s.itemsUsed);
  const livesUsed = useGameStore((s) => s.livesUsed);
  const revivesUsed = useGameStore((s) => s.revivesUsed);
  const faints = useGameStore((s) => s.faints);
  const shiniesCaught = useGameStore((s) => s.shiniesCaught);
  const pokedex = useGameStore((s) => s.pokedex);
  const activeUnlocks = useGameStore((s) => s.activeUnlocks);
  const getMaxParty = useGameStore((s) => s.getMaxParty);
  const muted = useGameStore((s) => s.muted);

  const runMs = useLiveRunMs(runStartedAt);
  const maxParty = getMaxParty();
  const totalGyms = getRegionTotalGyms(region);
  const gymLeaders = getRegionGymLeaders(region);
  const dexTotal = getRegionAllPokemonPool(region).length;
  const dexCaught = useMemo(
    () => Object.values(pokedex).filter((entry) => entry.caught).length,
    [pokedex],
  );
  const avgLevel =
    party.length > 0
      ? Math.round(party.reduce((sum, mon) => sum + mon.level, 0) / party.length)
      : 0;
  const character = CHARACTER_BY_REGION[region]?.[trainer?.gender === 'girl' ? 'girl' : 'boy'];
  const avatar = trainer?.avatar;
  const avatarIsSprite = !!avatar && /[/.]/.test(avatar);
  const partySlots = Array.from({ length: maxParty }, (_, i) => party[i] ?? null);
  const modifiers = activeUnlocks
    .map((id) => PRESTIGE_UNLOCKS.find((unlock) => unlock.id === id))
    .filter((unlock): unlock is NonNullable<typeof unlock> => !!unlock);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const close = () => {
    playSfx('click', muted);
    onClose();
  };

  return createPortal(
    <motion.div
      className="trainer-profile-backdrop"
      onClick={close}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className={`trainer-profile${eliteCleared ? ' trainer-profile--champion' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-profile-title"
        initial={{ scale: 0.92, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="trainer-profile__close" onClick={close} aria-label="Close">
          ✕
        </button>

        <div className="trainer-profile__hero">
          <div className="trainer-profile__sprite-wrap">
            {avatarIsSprite ? (
              <img
                src={avatar}
                alt=""
                className="trainer-profile__sprite"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                }}
              />
            ) : (
              <span className="trainer-profile__sprite-emoji" aria-hidden>
                {avatar || '🧢'}
              </span>
            )}
          </div>
          <div className="trainer-profile__identity">
            <p className="trainer-profile__kicker">Trainer Card</p>
            <h2 id="trainer-profile-title" className="trainer-profile__name">
              {trainer?.name ?? 'Trainer'}
            </h2>
            <p className="trainer-profile__meta">
              {region}
              {character ? ` · ${character}` : ''}
              {trainer?.gender ? ` · ${trainer.gender === 'girl' ? 'Girl' : 'Boy'}` : ''}
            </p>
            {eliteCleared ? (
              <span className="trainer-profile__champ">
                <GameIcon ui="champion" alt="" className="game-icon-img game-icon-img--inline" />
                {region} Champion
              </span>
            ) : (
              <span className="trainer-profile__progress-label">
                {badges.length}/{totalGyms} gyms · {spinsCount} path{spinsCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="trainer-profile__facts">
            <div className="trainer-profile__fact">
              <span className="trainer-profile__fact-label">Time</span>
              <strong>{formatRunTime(runMs)}</strong>
            </div>
            <div className="trainer-profile__fact">
              <span className="trainer-profile__fact-label">Money</span>
              <PokeDollarAmount amount={money} />
            </div>
            <div className="trainer-profile__fact">
              <span className="trainer-profile__fact-label">Lives</span>
              <strong title={`${lives} remaining`}>{lives > 0 ? '❤️'.repeat(lives) : '0'}</strong>
            </div>
            <div className="trainer-profile__fact">
              <span className="trainer-profile__fact-label">Pokédex</span>
              <strong>
                {dexCaught}/{dexTotal}
              </strong>
            </div>
          </div>
        </div>

        <section className="trainer-profile__section">
          <header className="trainer-profile__section-head">
            <h3>Party</h3>
            <span>
              {party.length}/{maxParty}
              {avgLevel > 0 ? ` · avg Lv.${avgLevel}` : ''}
            </span>
          </header>
          <div
            className="trainer-profile__party"
            style={{ ['--party-slots' as string]: String(maxParty) }}
          >
            {partySlots.map((mon, index) =>
              mon ? (
                <div
                  key={mon.caughtAt}
                  className={`trainer-profile__mon${mon.shiny ? ' trainer-profile__mon--shiny' : ''}`}
                  title={`${mon.nickname ?? mon.displayName} · Lv. ${mon.level}`}
                >
                  <img
                    src={mon.shiny && mon.shinySprite ? mon.shinySprite : mon.sprite}
                    alt={mon.nickname ?? mon.displayName}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                    }}
                  />
                  <span className="trainer-profile__mon-name">
                    {mon.shiny ? '✨ ' : ''}
                    {mon.nickname ?? mon.displayName}
                  </span>
                  <span className="trainer-profile__mon-level">Lv.{mon.level}</span>
                </div>
              ) : (
                <div key={`empty-${index}`} className="trainer-profile__mon trainer-profile__mon--empty">
                  <span className="trainer-profile__mon-slot">{index + 1}</span>
                </div>
              ),
            )}
          </div>
        </section>

        <div className="trainer-profile__split">
          <section className="trainer-profile__section">
            <header className="trainer-profile__section-head">
              <h3>Badge Case</h3>
              <span>
                {badges.length}/{totalGyms}
              </span>
            </header>
            <div className="trainer-profile__badges">
              {gymLeaders.map((leader) => {
                const earned = badges.find((badge) => badge.id === leader.id);
                const src = earned ? resolveBadgeImage(earned, region) : leader.badgeImage;
                return (
                  <div
                    key={leader.id}
                    className={`trainer-profile__badge${earned ? '' : ' trainer-profile__badge--locked'}`}
                    title={
                      earned
                        ? `${leader.badgeName || leader.name}`
                        : `${leader.badgeName || leader.name} — not earned`
                    }
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={earned ? leader.badgeName || leader.name : ''}
                        onError={(e) => {
                          const match = src.match(/badges\/(\d+)\.png/);
                          const badgeNum = match ? Number(match[1]) : 0;
                          imgFallback(
                            e,
                            badgeNum > 0 ? remoteBadge(badgeNum) : undefined,
                            PLACEHOLDER_SPRITE,
                          );
                        }}
                      />
                    ) : (
                      <span aria-hidden>🏅</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="trainer-profile__section">
            <header className="trainer-profile__section-head">
              <h3>Run record</h3>
            </header>
            <div className="trainer-profile__stats">
              <div className="trainer-profile__stat">
                <span className="trainer-profile__stat-value">{itemsUsed}</span>
                <span className="trainer-profile__stat-label">Items</span>
              </div>
              <div className="trainer-profile__stat">
                <span className="trainer-profile__stat-value">{livesUsed}</span>
                <span className="trainer-profile__stat-label">Lives used</span>
              </div>
              <div className="trainer-profile__stat">
                <span className="trainer-profile__stat-value">{revivesUsed}</span>
                <span className="trainer-profile__stat-label">Revives</span>
              </div>
              <div className="trainer-profile__stat">
                <span className="trainer-profile__stat-value">{faints}</span>
                <span className="trainer-profile__stat-label">Faints</span>
              </div>
              <div className="trainer-profile__stat trainer-profile__stat--shiny">
                <span className="trainer-profile__stat-value">{shiniesCaught}</span>
                <span className="trainer-profile__stat-label">Shinies</span>
              </div>
              <div className="trainer-profile__stat">
                <span className="trainer-profile__stat-value">{spinsCount}</span>
                <span className="trainer-profile__stat-label">Paths</span>
              </div>
            </div>
          </section>
        </div>

        <section className="trainer-profile__section">
          <header className="trainer-profile__section-head">
            <h3>Run modifiers</h3>
            <span>
              {modifiers.length} active
            </span>
          </header>
          {modifiers.length === 0 ? (
            <p className="trainer-profile__empty">Classic run — no challenge modifiers.</p>
          ) : (
            <div className="trainer-profile__mods">
              {modifiers.map((unlock) => (
                <ModifierChip key={unlock.id} unlock={unlock} />
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
