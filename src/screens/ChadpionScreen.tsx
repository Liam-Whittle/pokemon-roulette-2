import { motion } from 'framer-motion';
import { Confetti } from '../components/Confetti';
import { useGameStore } from '../store/useGameStore';

/**
 * Easter-egg end screen reached via shiny Magikarp's "Hollow Purple". Identical to
 * the normal Champion screen, but crowns the player the "Chadpion" with a moyai.
 */
export function ChadpionScreen() {
  const resetGame = useGameStore((s) => s.resetGame);

  return (
    <motion.div
      className="screen champion-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active continuous />

      <div className="champion-screen__content">
        <motion.div
          className="champion-screen__crown"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
        >
          🗿
        </motion.div>

        <motion.h1
          className="champion-screen__title"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          New Chadpion of Kanto??
        </motion.h1>

        <motion.p
          className="champion-screen__subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          New regions coming soon
        </motion.p>

        <motion.button
          type="button"
          className="btn btn--primary btn--lg champion-screen__restart"
          onClick={resetGame}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          Restart
        </motion.button>
      </div>
    </motion.div>
  );
}
