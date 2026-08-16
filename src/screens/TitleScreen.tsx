import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { TitleAmbient } from '../components/TitleAmbient';
import { useGameStore } from '../store/useGameStore';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { playSfx } from '../utils/sound';
import { asset } from '../utils/asset';

const DEFAULT_SUBTITLE = 'Pls don\'t sue me Gamefreak';
const SECRET_SUBTITLES = [
  'You thought something was gonna happen?',
  'Fine, here\'s a little animation on click, you happy?',
  'The ball is just a ball. Go play the game.',
] as const;
const SECRET_CLICKS_PER_STAGE = 5;
const SCREEN_SPIN_STAGE = SECRET_SUBTITLES.length; // last stage of 5 presses
const MULTIPLAYER_ENABLED = import.meta.env.VITE_MULTIPLAYER_ENABLED === 'true';

function subtitleForClicks(clicks: number): string {
  if (clicks < SECRET_CLICKS_PER_STAGE) return DEFAULT_SUBTITLE;
  const stage = Math.min(
    Math.floor(clicks / SECRET_CLICKS_PER_STAGE),
    SECRET_SUBTITLES.length,
  );
  return SECRET_SUBTITLES[stage - 1];
}

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
  const heroControls = useAnimationControls();
  const [ballClicks, setBallClicks] = useState(0);
  const [pickingMode, setPickingMode] = useState(false);

  const subtitle = subtitleForClicks(ballClicks);
  const canContinue = !!(trainer && starterClaimed);

  const playSecretHeroGag = async (pressInFinale: number) => {
    const reset = { rotate: 0, x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0 };

    // Escalating gags for the last 5 presses (1–5)
    switch (pressInFinale) {
      case 1:
        // Nervous shake
        await heroControls.start({
          x: [0, -14, 14, -10, 10, -4, 0],
          transition: { duration: 0.45, ease: 'easeInOut' },
        });
        break;
      case 2:
        // Upside-down peek
        await heroControls.start({
          rotate: 180,
          transition: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] },
        });
        await heroControls.start({
          rotate: 360,
          transition: { duration: 0.5, ease: 'easeInOut' },
        });
        break;
      case 3:
        // Squash & stretch
        await heroControls.start({
          scaleX: [1, 1.18, 0.82, 1.08, 0.96, 1],
          scaleY: [1, 0.82, 1.18, 0.92, 1.04, 1],
          transition: { duration: 0.7, ease: 'easeInOut' },
        });
        break;
      case 4:
        // Dizzy wobble
        await heroControls.start({
          rotate: [0, -8, 10, -12, 8, -4, 0],
          skewX: [0, 8, -10, 6, -4, 0],
          x: [0, 18, -22, 16, -10, 0],
          transition: { duration: 0.85, ease: 'easeInOut' },
        });
        break;
      default:
        // Finale: yeet off-screen, bounce back big
        await heroControls.start({
          y: [0, -40, 1200],
          rotate: [0, -15, 25],
          scale: [1, 1.05, 0.4],
          transition: { duration: 0.55, ease: [0.55, 0.05, 0.8, 0.4] },
        });
        heroControls.set({ y: -900, rotate: -20, scale: 0.5 });
        await heroControls.start({
          y: 0,
          rotate: 0,
          scale: [0.5, 1.12, 0.96, 1],
          transition: { duration: 0.75, ease: [0.22, 1.2, 0.36, 1] },
        });
        break;
    }

    heroControls.set(reset);
  };

  const spinBall = async () => {
    playSfx('click', muted);
    const nextClicks = ballClicks + 1;
    setBallClicks(nextClicks);

    const finaleStart = (SCREEN_SPIN_STAGE - 1) * SECRET_CLICKS_PER_STAGE;
    const isLastFivePresses =
      nextClicks > finaleStart && nextClicks <= SCREEN_SPIN_STAGE * SECRET_CLICKS_PER_STAGE;

    const ballSpin = ballControls
      .start({ rotate: 360, transition: { duration: 0.6, ease: 'easeOut' } })
      .then(() => ballControls.set({ rotate: 0 }));

    if (isLastFivePresses) {
      await Promise.all([ballSpin, playSecretHeroGag(nextClicks - finaleStart)]);
      return;
    }

    await ballSpin;
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
        <motion.div
          className="title-screen__panel"
          animate={heroControls}
          style={{ transformOrigin: 'center center' }}
        >
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
              {subtitle}
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
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
