import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

export function GameOverScreen() {
  const resetGame = useGameStore((s) => s.resetGame);

  return (
    <motion.div
      className="screen gameover-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="gameover-card"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <div className="gameover-card__icon">💀</div>
        <h1 className="gameover-card__title">Better luck next time</h1>
        <p className="gameover-card__subtitle">You ran out of lives and your journey ends here.</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={resetGame}>
          Back to Title
        </button>
      </motion.div>
    </motion.div>
  );
}
