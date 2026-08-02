import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { TitleAmbient } from '../components/TitleAmbient';
import { useGameStore } from '../store/useGameStore';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { playSfx } from '../utils/sound';
import { asset } from '../utils/asset';

const DEFAULT_SUBTITLE = 'Pokemon Roulette but actually good';
const SECRET_SUBTITLE = 'Johnson is a Jew';
const SECRET_CLICKS = 5;
const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED === 'true';

const fabContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const fabItem = {
  hidden: { opacity: 0, y: -10, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const trainer = useGameStore((s) => s.trainer);
  const starterClaimed = useGameStore((s) => s.starterClaimed);
  const battleSnapshot = useGameStore((s) => s.battleSnapshot);
  const resetGame = useGameStore((s) => s.resetGame);
  const muted = useGameStore((s) => s.muted);
  const hasChampions = useGameStore((s) => s.hallOfChampions.length > 0);
  const hasHundredPercenter = useGameStore(
    (s) => s.ownedUnlocks.includes('hundredPercenter') && s.hundredPercenterEnabled,
  );
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
      <div className="title-screen__veil" aria-hidden="true" />
      <TitleAmbient />

      <motion.div
        className="title-fabs"
        variants={fabContainer}
        initial="hidden"
        animate="show"
      >
        {hasChampions && (
          <motion.button
            type="button"
            className="hall-fab"
            variants={fabItem}
            onClick={() => {
              playSfx('click', muted);
              setScreen('hall');
            }}
          >
            <GameIcon ui="hall" alt="" className="game-icon-img game-icon-img--inline" /> Hall of Fame
          </motion.button>
        )}
        <motion.button
          type="button"
          className="hall-fab"
          variants={fabItem}
          onClick={() => {
            playSfx('click', muted);
            setScreen('prestige');
          }}
        >
          Prestige Shop
        </motion.button>
        <motion.button
          type="button"
          className="hall-fab"
          variants={fabItem}
          onClick={() => {
            playSfx('click', muted);
            setScreen('global-pokedex');
          }}
        >
          Global Pokédex
        </motion.button>
        {hasHundredPercenter && (
          <motion.button
            type="button"
            className="hall-fab"
            variants={fabItem}
            onClick={() => {
              playSfx('click', muted);
              setScreen('daily');
            }}
          >
            Daily Encounter
          </motion.button>
        )}
      </motion.div>

      <motion.div
        className="title-screen__content"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="title-screen__panel">
          <motion.div
            className="title-screen__logo"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
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

          <motion.h1
            className="title-screen__title"
            aria-label="Pokéspin Nuzlocke"
            initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.32, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="title-screen__title-stroke" aria-hidden="true">
              Pokéspin Nuzlocke
            </span>
            <span className="title-screen__title-fill" aria-hidden="true">
              Pokéspin Nuzlocke
            </span>
          </motion.h1>

          <motion.p
            className="title-screen__subtitle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.5 }}
          >
            {secretUnlocked ? SECRET_SUBTITLE : DEFAULT_SUBTITLE}
          </motion.p>

          <motion.div
            className="title-screen__actions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.58, duration: 0.5 }}
          >
            {!pickingMode ? (
              <>
                <button
                  type="button"
                  className="btn btn--primary btn--lg title-screen__cta"
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
                  <button type="button" className="btn btn--ghost title-screen__secondary" onClick={beginNewGame}>
                    New Game
                  </button>
                )}
              </>
            ) : MULTIPLAYER_ENABLED ? (
              <>
                <p className="title-screen__mode-label">How do you want to play?</p>
                <button
                  type="button"
                  className="btn btn--primary btn--lg title-screen__cta"
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
                  className="btn btn--primary btn--lg title-screen__cta"
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
                  className="btn btn--primary btn--lg title-screen__cta"
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
                  className="btn btn--ghost title-screen__secondary"
                  onClick={() => {
                    playSfx('click', muted);
                    setPickingMode(false);
                  }}
                >
                  Back
                </button>
              </>
            ) : null}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
