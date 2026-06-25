import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

export function BagScreen() {
  const bag = useGameStore((s) => s.bag);
  const badges = useGameStore((s) => s.badges);
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
        <h2 className="screen-title">🎒 Bag</h2>
      </header>

      <section className="bag-section">
        <h3>Items</h3>
        {bag.length === 0 ? (
          <p className="collection-empty">Your bag is empty.</p>
        ) : (
          <div className="bag-grid">
            {bag.map((item) => (
              <div key={item.id} className="bag-item">
                <span className="bag-item__icon">{item.icon}</span>
                <span className="bag-item__name">{item.name}</span>
                <span className="bag-item__qty">×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bag-section">
        <h3>Badges 🏅</h3>
        {badges.length === 0 ? (
          <p className="collection-empty">No badges yet. Challenge a Gym!</p>
        ) : (
          <div className="badges-row">
            {badges.map((badge) => (
              <div key={badge.id} className="badge-card">
                {badge.image ? (
                  <img src={badge.image} alt={badge.name} className="badge-card__img" />
                ) : (
                  <span className="badge-card__icon">🏅</span>
                )}
                <span className="badge-card__name">{badge.name}</span>
                <span className="badge-card__type">{badge.type}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
