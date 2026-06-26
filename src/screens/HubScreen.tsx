import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SidePanel } from '../components/SidePanel';
import { DebugMenu } from '../components/DebugMenu';
import { Wheel } from '../components/Wheel';
import {
  getHubWheelSegments,
  ITEMS,
  pickUberBonusItemId,
  TOTAL_GYMS,
  UBER_SPIN_SEGMENTS,
} from '../data/pools';
import { PokeCenterVisits } from '../components/PokeDollar';
import { EvolutionModal } from '../components/EvolutionModal';
import { useGameStore } from '../store/useGameStore';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { EvolutionInfo, WheelSegment } from '../types/game';

export function HubScreen() {
  const trainer = useGameStore((s) => s.trainer);
  const party = useGameStore((s) => s.party);
  const badges = useGameStore((s) => s.badges);
  const spinsCount = useGameStore((s) => s.spinsCount);
  const lastGymSpin = useGameStore((s) => s.lastGymSpin);
  const eliteCleared = useGameStore((s) => s.eliteCleared);
  const lives = useGameStore((s) => s.lives);
  const setScreen = useGameStore((s) => s.setScreen);
  const startActivity = useGameStore((s) => s.startActivity);
  const startLegendaryEncounter = useGameStore((s) => s.startLegendaryEncounter);
  const incrementSpins = useGameStore((s) => s.incrementSpins);
  const setLastGymSpin = useGameStore((s) => s.setLastGymSpin);
  const addItem = useGameStore((s) => s.addItem);
  const evolveRandomPartyMember = useGameStore((s) => s.evolveRandomPartyMember);

  const [wheelLocked, setWheelLocked] = useState(false);
  const [uberSpinOpen, setUberSpinOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [evolution, setEvolution] = useState<EvolutionInfo | null>(null);

  const gymBadges = badges.length;
  const allGymsDone = gymBadges >= TOTAL_GYMS;
  const spinsSinceGym = spinsCount - lastGymSpin;
  const spinsUntilNext = Math.max(0, 2 - spinsSinceGym);
  // Freeze the displayed wheel layout for the current spin so it doesn't visibly
  // swap between Layout A/B the instant a spin resolves. It updates only after an
  // outcome completes (notice dismissed) or when the Hub remounts after activity.
  const [displaySpinsSinceGym, setDisplaySpinsSinceGym] = useState(spinsSinceGym);
  const wheelSegments = getHubWheelSegments(displaySpinsSinceGym);

  const maybeTriggerGym = useCallback(() => {
    const state = useGameStore.getState();
    const gymsDone = state.badges.length >= TOTAL_GYMS;
    if (state.spinsCount - state.lastGymSpin >= 2) {
      if (!gymsDone) {
        setLastGymSpin(state.spinsCount);
        setScreen('gym');
        return true;
      }
      if (!state.eliteCleared) {
        setLastGymSpin(state.spinsCount);
        setScreen('elite');
        return true;
      }
    }
    return false;
  }, [setLastGymSpin, setScreen]);

  useEffect(() => {
    maybeTriggerGym();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLand = useCallback(
    (segment: { activity?: string; id: string }) => {
      incrementSpins();
      setWheelLocked(true);

      setTimeout(async () => {
        if (segment.activity === 'legendary') {
          startLegendaryEncounter();
        } else if (segment.activity === 'shop') {
          setScreen('shop');
        } else if (segment.activity === 'uber') {
          setUberSpinOpen(true);
        } else if (segment.activity === 'battlegym') {
          const state = useGameStore.getState();
          setLastGymSpin(state.spinsCount);
          setScreen('gym');
        } else if (segment.activity === 'potion') {
          addItem('potion', 1);
          setNotice('You received a free Potion!');
        } else if (segment.activity === 'evolve') {
          const result = await evolveRandomPartyMember();
          if (result.evolution) {
            setEvolution(result.evolution);
          } else {
            setNotice(result.message);
          }
        } else {
          startActivity(segment as WheelSegment);
        }
        setWheelLocked(false);
      }, 800);
    },
    [
      incrementSpins,
      startActivity,
      startLegendaryEncounter,
      setScreen,
      setLastGymSpin,
      addItem,
      evolveRandomPartyMember,
    ],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
    const navigated = maybeTriggerGym();
    if (!navigated) {
      const s = useGameStore.getState();
      setDisplaySpinsSinceGym(s.spinsCount - s.lastGymSpin);
    }
  }, [maybeTriggerGym]);

  const dismissEvolution = useCallback(() => {
    setEvolution(null);
    const navigated = maybeTriggerGym();
    if (!navigated) {
      const s = useGameStore.getState();
      setDisplaySpinsSinceGym(s.spinsCount - s.lastGymSpin);
    }
  }, [maybeTriggerGym]);

  const handleUberLand = useCallback(
    (segment: { id: string; label: string }) => {
      setUberSpinOpen(false);
      if (segment.id === 'legendary') {
        startLegendaryEncounter();
        return;
      }
      if (segment.id === 'bonus-item') {
        const itemId = pickUberBonusItemId();
        const item = ITEMS.find((entry) => entry.id === itemId);
        addItem(itemId);
        setNotice(`Uber Spin awarded a ${item?.name ?? 'bonus item'}!`);
        return;
      }
      if (segment.id === 'shinycharm') {
        addItem('shinycharm');
        setNotice('Uber Spin awarded a Shiny Charm!');
        return;
      }
      if (segment.id === 'masterball') {
        addItem('masterball');
        setNotice('Uber Spin awarded a Master Ball!');
      }
    },
    [addItem, startLegendaryEncounter],
  );

  return (
    <motion.div
      className="screen hub-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="hub-header">
        <div className="hub-header__trainer">
          {trainer?.avatar?.startsWith('http') ? (
            <img
              src={trainer.avatar}
              alt={trainer.name}
              className="hub-header__avatar-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
              }}
            />
          ) : (
            <span className="hub-header__avatar">{trainer?.avatar}</span>
          )}
          <div>
            <h2 className="hub-header__name">{trainer?.name}</h2>
            <p className="hub-header__stats">
              Party: {party.length}/5 · Badges: {gymBadges}/{TOTAL_GYMS} · Spins: {spinsCount} ·{' '}
              <PokeCenterVisits lives={lives} />
            </p>
          </div>
        </div>
        <nav className="hub-nav" />
      </header>

      {eliteCleared && <div className="hub-champion-banner">🏆 Kanto Champion!</div>}

      <div className="hub-layout">
        <div className="hub-wheel-area">
          <h3 className="hub-wheel-title">Which Path Will You Take?</h3>
          <Wheel segments={wheelSegments} onLand={handleLand} disabled={wheelLocked} />
          {!eliteCleared && (
            <p className="hub-gym-counter">
              {allGymsDone ? (
                spinsUntilNext === 0 ? (
                  'The Elite Four await!'
                ) : (
                  <>
                    Elite Four battle in <span className="gym-counter-number">{spinsUntilNext}</span> spin
                    {spinsUntilNext === 1 ? '' : 's'}
                  </>
                )
              ) : spinsUntilNext === 0 ? (
                'A Gym Leader is ready to battle!'
              ) : (
                <>
                  Next Gym battle in <span className="gym-counter-number">{spinsUntilNext}</span> spin
                  {spinsUntilNext === 1 ? '' : 's'}
                </>
              )}
            </p>
          )}
        </div>
        <SidePanel />
      </div>

      {uberSpinOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal uber-spin-modal">
            <h3 className="battle-modal__title">Uber Spin</h3>
            <p className="battle-modal__subtitle">A secret wheel with rare rewards!</p>
            <Wheel segments={UBER_SPIN_SEGMENTS} onLand={handleUberLand} />
            <button type="button" className="btn btn--ghost" onClick={() => setUberSpinOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            <p className="hub-notice-modal__text">{notice}</p>
            <button type="button" className="btn btn--primary" onClick={dismissNotice}>
              Continue
            </button>
          </div>
        </div>
      )}

      {evolution && <EvolutionModal evolution={evolution} onClose={dismissEvolution} />}

      {trainer?.name.toLowerCase() === 'debug' && <DebugMenu onUberSpin={() => setUberSpinOpen(true)} />}
    </motion.div>
  );
}
