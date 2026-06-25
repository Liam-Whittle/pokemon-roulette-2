import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SidePanel } from '../components/SidePanel';
import { DebugMenu } from '../components/DebugMenu';
import { Wheel, type SpinnerSegment } from '../components/Wheel';
import { WHEEL_SEGMENTS, TOTAL_GYMS } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { WheelSegment } from '../types/game';

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
  const incrementSpins = useGameStore((s) => s.incrementSpins);
  const setLastGymSpin = useGameStore((s) => s.setLastGymSpin);

  const [wheelLocked, setWheelLocked] = useState(false);

  const gymBadges = badges.length;
  const allGymsDone = gymBadges >= TOTAL_GYMS;
  const spinsUntilNext = Math.max(0, 2 - (spinsCount - lastGymSpin));

  // Progression: a Gym Leader challenges you after every 2 spins until all 8
  // badges are won. Once every gym is cleared, you get 2 more spins before the
  // Elite Four challenge begins automatically. Checked once when the Hub
  // (re)mounts after an activity so you always finish the spin's activity first.
  useEffect(() => {
    const state = useGameStore.getState();
    const gymsDone = state.badges.length >= TOTAL_GYMS;
    if (state.spinsCount - state.lastGymSpin >= 2) {
      if (!gymsDone) {
        setLastGymSpin(state.spinsCount);
        setScreen('gym');
      } else if (!state.eliteCleared) {
        setLastGymSpin(state.spinsCount);
        setScreen('elite');
      }
    }
    // Mount-only: relies on fresh remount when returning to the hub.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLand = useCallback(
    (segment: SpinnerSegment) => {
      incrementSpins();
      setWheelLocked(true);
      setTimeout(() => {
        startActivity(segment as WheelSegment);
        setWheelLocked(false);
      }, 800);
    },
    [incrementSpins, startActivity],
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
              Party: {party.length}/5 · Badges: {gymBadges}/{TOTAL_GYMS} · Spins: {spinsCount} · Lives: {lives}
            </p>
          </div>
        </div>
        <nav className="hub-nav" />
      </header>

      {eliteCleared && <div className="hub-champion-banner">🏆 Kanto Champion!</div>}

      <div className="hub-layout">
        <div className="hub-wheel-area">
          <h3 className="hub-wheel-title">Which Path Will You Take?</h3>
          <Wheel segments={WHEEL_SEGMENTS} onLand={handleLand} disabled={wheelLocked} />
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

      {trainer?.name.toLowerCase() === 'debug' && <DebugMenu />}
    </motion.div>
  );
}
