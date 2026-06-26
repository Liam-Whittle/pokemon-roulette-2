import { motion } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';

export function GameOverScreen() {
  const bag = useGameStore((s) => s.bag);
  const resetGame = useGameStore((s) => s.resetGame);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const restoreOneLife = useGameStore((s) => s.restoreOneLife);
  const setScreen = useGameStore((s) => s.setScreen);

  const maxReviveCount = bag.find((item) => item.id === 'maxrevive')?.quantity ?? 0;

  function handleMaxRevive() {
    if (!consumeItem('maxrevive', 1)) return;
    restoreOneLife();
    setScreen('hub');
  }

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
        <div className="gameover-card__icon">
          <GameIcon ui="gameover" alt="" className="game-icon-img game-icon-img--xl" />
        </div>
        <h1 className="gameover-card__title">Better luck next time</h1>
        <p className="gameover-card__subtitle">
          You ran out of PokeCenter visits and your journey ends here.
        </p>
        {maxReviveCount > 0 && (
          <button type="button" className="btn btn--accent btn--lg" onClick={handleMaxRevive}>
            Use Max Revive (×{maxReviveCount})
          </button>
        )}
        <button type="button" className="btn btn--primary btn--lg" onClick={resetGame}>
          Back to Title
        </button>
      </motion.div>
    </motion.div>
  );
}
