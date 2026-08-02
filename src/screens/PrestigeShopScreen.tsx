import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlitchText } from '../components/GlitchText';
import { MetaMenuNav } from '../components/MetaMenuNav';
import { PRESTIGE_UNLOCK_ICONS, PRESTIGE_UNLOCKS, clearedRegionsFromHall } from '../data/prestige';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' },
  }),
};

export function PrestigeShopScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const prestigePoints = useGameStore((s) => s.prestigePoints);
  const ownedUnlocks = useGameStore((s) => s.ownedUnlocks);
  const hundredPercenterEnabled = useGameStore((s) => s.hundredPercenterEnabled);
  const hallOfChampions = useGameStore((s) => s.hallOfChampions);
  const visitPrestigeShop = useGameStore((s) => s.visitPrestigeShop);
  const buyUnlock = useGameStore((s) => s.buyUnlock);
  const setHundredPercenterEnabled = useGameStore((s) => s.setHundredPercenterEnabled);

  useEffect(() => {
    visitPrestigeShop();
  }, [visitPrestigeShop]);

  const cleared = clearedRegionsFromHall(hallOfChampions);

  return (
    <motion.div
      className="screen prestige-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="collection-header">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            playSfx('click', muted);
            setScreen('title');
          }}
        >
          ← Back
        </button>
        <h2 className="screen-title">Prestige Shop</h2>
        <span className="glass-chip glass-chip--gold">{prestigePoints} PP</span>
      </header>

      <MetaMenuNav current="prestige" />

      <p className="glass-banner">
        Buy unlocks here. Most can be toggled on New Game — Hundred Percenter is toggled here only.
      </p>

      <div className="prestige-grid">
        {PRESTIGE_UNLOCKS.map((unlock, index) => {
          const owned = ownedUnlocks.includes(unlock.id);
          const regionOk = !unlock.requiresRegionClear || cleared.length > 0;
          const canBuy =
            !owned && regionOk && (unlock.cost === 0 || prestigePoints >= unlock.cost);
          const isHundred = unlock.id === 'hundredPercenter';

          let badgeLabel: string;
          let badgeClass = 'prestige-card__badge';
          if (owned) {
            badgeLabel = 'Owned';
            badgeClass += ' prestige-card__badge--owned';
          } else if (unlock.cost === 0) {
            badgeLabel = 'Free';
          } else if (!regionOk) {
            badgeLabel = 'Locked';
            badgeClass += ' prestige-card__badge--locked';
          } else {
            badgeLabel = `${unlock.cost} PP`;
          }

          let statusText = '';
          if (owned) {
            statusText = isHundred
              ? hundredPercenterEnabled
                ? 'Enabled for Daily Encounter'
                : 'Disabled — toggle below'
              : 'Unlocked permanently';
          } else if (!regionOk) {
            statusText = 'Beat a region first';
          } else if (unlock.cost > 0 && prestigePoints < unlock.cost) {
            statusText = 'Not enough Prestige Points';
          }

          return (
            <motion.div
              key={unlock.id}
              className={`prestige-card ${owned ? 'prestige-card--owned' : ''} ${canBuy ? 'prestige-card--affordable' : ''}`}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="show"
            >
              <div className="prestige-card__top">
                <div className="prestige-card__title-row">
                  <img
                    src={PRESTIGE_UNLOCK_ICONS[unlock.id]}
                    alt=""
                    className={`prestige-card__icon${unlock.id === 'shinyCharmPlus' ? ' prestige-card__icon--gold' : ''}${unlock.id === 'arceusBlessing' ? ' prestige-card__icon--pokemon' : ''}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                    }}
                  />
                  <h3 className="prestige-card__name">
                    {unlock.id === 'missingNo' ? (
                      <GlitchText text={unlock.name} className="prestige-card__name--glitch" />
                    ) : (
                      unlock.name
                    )}
                  </h3>
                </div>
                <span className={badgeClass}>{badgeLabel}</span>
              </div>
              <p className="prestige-card__desc">{unlock.description}</p>
              <div className="prestige-card__footer">
                {statusText && <p className="prestige-card__status">{statusText}</p>}
                {!owned && (
                  <button
                    type="button"
                    className={`btn btn--primary btn--sm ${canBuy ? 'prestige-card__buy' : ''}`}
                    disabled={!canBuy}
                    onClick={() => {
                      playSfx('click', muted);
                      buyUnlock(unlock.id);
                    }}
                  >
                    {!regionOk ? 'Beat a region first' : unlock.cost === 0 ? 'Claim' : 'Buy'}
                  </button>
                )}
                {owned && isHundred && (
                  <button
                    type="button"
                    className={`btn btn--sm ${hundredPercenterEnabled ? 'btn--ghost' : 'btn--primary'}`}
                    onClick={() => {
                      playSfx('click', muted);
                      setHundredPercenterEnabled(!hundredPercenterEnabled);
                    }}
                  >
                    {hundredPercenterEnabled ? 'Disable Daily Encounter' : 'Enable Daily Encounter'}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
