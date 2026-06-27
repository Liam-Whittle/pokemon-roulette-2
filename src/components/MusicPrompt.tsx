import { motion } from 'framer-motion';

interface MusicPromptProps {
  onEnable: () => void;
  onDecline: () => void;
}

export function MusicPrompt({ onEnable, onDecline }: MusicPromptProps) {
  return (
    <motion.div
      className="music-prompt__backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="music-prompt"
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <motion.div
          className="music-prompt__icon"
          animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          🎵
        </motion.div>
        <h2 className="music-prompt__title">Enable Music?</h2>
        <p className="music-prompt__text">Pokéspin Nuzlocke has background music and sound effects.</p>
        <div className="music-prompt__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={onEnable}>
            Enable Music
          </button>
          <button type="button" className="btn btn--ghost" onClick={onDecline}>
            No Thanks
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
