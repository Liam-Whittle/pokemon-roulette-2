import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { playSfx } from '../utils/sound';
import { asset } from '../utils/asset';

const DEFAULT_SUBTITLE = 'Pokemon Roulette but actually good';
const SECRET_SUBTITLE = 'Johnson is a Jew';
const SECRET_CLICKS = 5;
const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED === 'true';

export function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const trainer = useGameStore((s) => s.trainer);
  const starterClaimed = useGameStore((s) => s.starterClaimed);
  const battleSnapshot = useGameStore((s) => s.battleSnapshot);
  const resetGame = useGameStore((s) => s.resetGame);
  const muted = useGameStore((s) => s.muted);
  const hasChampions = useGameStore((s) => s.hallOfChampions.length > 0);
  const resetMultiplayer = useMultiplayerStore((s) => s.resetMultiplayer);
  const startHost = useMultiplayerStore((s) => s.startHost);
  const ballControls = useAnimationControls();
  const [ballClicks, setBallClicks] = useState(0);
  const [pickingMode, setPickingMode] = useState(false);

  const secretUnlocked = ballClicks >= SECRET_CLICKS;
  const canContinue = !!(trainer && starterClaimed);

  const spinBall = async () => {
    playSfx('click', muted);
    setBallClicks((count) => count + 1);
    await ballControls.start({ rotate: 360, transition: { duration: 0.6, ease: 'easeOut' } });
    ballControls.set({ rotate: 0 });
  };

  const beginNewGame = () => {
    playSfx('click', muted);
    resetMultiplayer();
    resetGame();
    if (MULTIPLAYER_ENABLED) {
      setPickingMode(true);
    } else {
      setScreen('setup');
    }
  };

  return (
    <motion.div
      className="screen title-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {hasChampions && (
        <button
          type="button"
          className="hall-fab"
          onClick={() => {
            playSfx('click', muted);
            setScreen('hall');
          }}
        >
          <GameIcon ui="hall" alt="" className="game-icon-img game-icon-img--inline" /> Hall of Fame
        </button>
      )}

      <motion.div
        className="title-screen__content"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <motion.div
          className="title-screen__logo"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.img
            src={asset('img/Pok%C3%A9_Ball_icon.svg')}
            alt="Poké Ball"
            className="title-screen__logo-img"
            animate={ballControls}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={spinBall}
          />
        </motion.div>
        <h1 className="title-screen__title">Pokéspin Nuzlocke</h1>
        <p className="title-screen__subtitle">
          {secretUnlocked ? SECRET_SUBTITLE : DEFAULT_SUBTITLE}
        </p>

        <div className="title-screen__actions">
          {!pickingMode ? (
            <>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  playSfx('click', muted);
                  if (canContinue) {
                    const savedScreen = useGameStore.getState().screen;
                    const ctx = battleSnapshot?.context;
                    const resumeScreen =
                      ctx === 'teamrocket'
                        ? 'teamrocket'
                        : ctx === 'gym' || ctx === 'elite'
                          ? ctx
                          : savedScreen && savedScreen !== 'title' && savedScreen !== 'setup'
                            ? savedScreen
                            : 'hub';
                    setScreen(resumeScreen);
                  } else {
                    beginNewGame();
                  }
                }}
              >
                {canContinue ? 'Continue Game' : 'New Game'}
              </button>

              {canContinue && (
                <button type="button" className="btn btn--ghost" onClick={beginNewGame}>
                  New Game
                </button>
              )}
            </>
          ) : MULTIPLAYER_ENABLED ? (
            <>
              <p className="title-screen__mode-label">How do you want to play?</p>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  playSfx('click', muted);
                  resetMultiplayer();
                  setScreen('setup');
                }}
              >
                Solo
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  playSfx('click', muted);
                  resetMultiplayer();
                  void startHost();
                  setScreen('mp-host-lobby');
                }}
              >
                Host Game
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={() => {
                  playSfx('click', muted);
                  resetMultiplayer();
                  setScreen('mp-join');
                }}
              >
                Join Game
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  playSfx('click', muted);
                  setPickingMode(false);
                }}
              >
                Back
              </button>
            </>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
