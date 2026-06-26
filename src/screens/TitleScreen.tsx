import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { asset } from '../utils/asset';

const DEFAULT_SUBTITLE = 'Pokemon Roulette but actually good';
const SECRET_SUBTITLE = 'Johnson is a Jew';
const SECRET_CLICKS = 5;

export function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const trainer = useGameStore((s) => s.trainer);
  const starterClaimed = useGameStore((s) => s.starterClaimed);
  const resetGame = useGameStore((s) => s.resetGame);
  const muted = useGameStore((s) => s.muted);
  const hasChampions = useGameStore((s) => s.hallOfChampions.length > 0);
  const ballControls = useAnimationControls();
  const [ballClicks, setBallClicks] = useState(0);

  const secretUnlocked = ballClicks >= SECRET_CLICKS;

  const spinBall = async () => {
    playSfx('click', muted);
    setBallClicks((count) => count + 1);
    await ballControls.start({ rotate: 360, transition: { duration: 0.6, ease: 'easeOut' } });
    ballControls.set({ rotate: 0 });
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
          <GameIcon ui="hall" alt="" className="game-icon-img game-icon-img--inline" /> Hall of Champions
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
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => {
              playSfx('click', muted);
              setScreen(trainer && starterClaimed ? 'hub' : 'setup');
            }}
          >
            {trainer && starterClaimed ? 'Continue Game' : 'New Game'}
          </button>

          {trainer && starterClaimed && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                playSfx('click', muted);
                resetGame();
              }}
            >
              New Game
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
