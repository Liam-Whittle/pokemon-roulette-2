import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { TypeBadge } from '../components/TypeBadge';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

export function PartyScreen() {
  const party = useGameStore((s) => s.party);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  return (
    <motion.div
      className="screen collection-screen"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <header className="collection-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { playSfx('click', muted); setScreen('hub'); }}>
          ← Back
        </button>
        <h2 className="screen-title">👥 Party</h2>
        <p className="collection-count">{party.length}/5</p>
      </header>

      {party.length === 0 ? (
        <p className="collection-empty">Your party is empty. Catch some Pokémon!</p>
      ) : (
        <div className="party-list">
          {party.map((mon, i) => (
            <motion.div
              key={`${mon.id}-${mon.caughtAt}`}
              className="party-slot"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <span className="party-slot__num">{i + 1}</span>
              <img
                src={mon.sprite}
                alt={mon.displayName}
                className="party-slot__sprite"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE; }}
              />
              <div className="party-slot__info">
                <span className="party-slot__name">{mon.nickname ?? mon.displayName}</span>
                <div className="party-slot__types">
                  {mon.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                </div>
              </div>
            </motion.div>
          ))}
          {Array.from({ length: Math.max(0, 5 - party.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="party-slot party-slot--empty">
              <span className="party-slot__num">{party.length + i + 1}</span>
              <span className="party-slot__empty-label">Empty</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
