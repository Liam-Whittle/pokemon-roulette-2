import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { ItemIcon } from '../components/ItemIcon';
import { GameIcon } from '../components/GameIcon';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { playSfx } from '../utils/sound';
import type { BagItem } from '../types/game';

export function BagScreen() {
  const bag = useGameStore((s) => s.bag);
  const badges = useGameStore((s) => s.badges);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const [selectedItem, setSelectedItem] = useState<BagItem | null>(null);

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
        <h2 className="screen-title">
          <GameIcon ui="bag" alt="" className="game-icon-img game-icon-img--title" /> Bag
        </h2>
      </header>

      <section className="bag-section">
        <h3>Items</h3>
        {bag.length === 0 ? (
          <p className="collection-empty">Your bag is empty.</p>
        ) : (
          <div className="bag-grid">
            {bag.map((item) => (
              <button
                key={item.id}
                type="button"
                className="bag-item bag-item--clickable"
                onClick={() => {
                  playSfx('click', muted);
                  setSelectedItem(item);
                }}
              >
                <ItemIcon id={item.id} icon={item.icon} name={item.name} className="bag-item__icon" />
                <span className="bag-item__name">{item.name}</span>
                <span className="bag-item__qty">×{item.quantity}</span>
              </button>
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

      {selectedItem && (
        <ItemDetailModal
          id={selectedItem.id}
          name={selectedItem.name}
          icon={selectedItem.icon}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </motion.div>
  );
}
