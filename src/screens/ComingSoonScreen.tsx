import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

export function ComingSoonScreen() {
  const currentSegment = useGameStore((s) => s.currentSegment);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  return (
    <motion.div
      className="screen coming-soon-screen"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <span className="coming-soon__icon">{currentSegment?.icon ?? '🔮'}</span>
      <h2 className="screen-title">{currentSegment?.label ?? 'Coming Soon'}</h2>
      <p className="coming-soon__msg">
        This adventure mode is coming in a future update. Stay tuned, Trainer!
      </p>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          playSfx('click', muted);
          setScreen('hub');
        }}
      >
        Back to Hub
      </button>
    </motion.div>
  );
}
