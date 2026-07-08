import { motion } from 'framer-motion';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { playSfx } from '../utils/sound';
import { useGameStore } from '../store/useGameStore';

/** Full-screen pause / outcome overlay for host (and shared outcome dismiss). */
export function MpOverlay() {
  const role = useMultiplayerStore((s) => s.role);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const awaitingGuest = useMultiplayerStore((s) => s.awaitingGuest);
  const outcome = useMultiplayerStore((s) => s.outcome);
  const clearOutcome = useMultiplayerStore((s) => s.clearOutcome);
  const muted = useGameStore((s) => s.muted);

  if (role !== 'host' || connectionStatus !== 'connected') return null;

  if (outcome) {
    return (
      <motion.div
        className="mp-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mp-overlay__card">
          <h3 className="mp-overlay__title">Friend&apos;s action</h3>
          <p className="mp-overlay__body">{outcome}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              playSfx('click', muted);
              clearOutcome();
              useMultiplayerStore.setState({ awaitingGuest: null });
            }}
          >
            Continue
          </button>
        </div>
      </motion.div>
    );
  }

  if (awaitingGuest === 'shinyRoll' || awaitingGuest === 'chaosWheel') {
    const label =
      awaitingGuest === 'shinyRoll'
        ? 'Waiting for your friend to roll for shiny…'
        : 'Waiting for your friend to spin the chaos wheel…';
    return (
      <motion.div
        className="mp-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mp-overlay__card">
          <h3 className="mp-overlay__title">Paused</h3>
          <p className="mp-overlay__body">{label}</p>
          <div className="mp-overlay__spinner" aria-hidden />
        </div>
      </motion.div>
    );
  }

  return null;
}
