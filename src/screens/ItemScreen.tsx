import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ITEMS, pickFindItemId } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { ItemIcon } from '../components/ItemIcon';
import { SegmentIcon } from '../components/SegmentIcon';
import { playSfx } from '../utils/sound';

export function ItemScreen() {
  const addItem = useGameStore((s) => s.addItem);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const [phase, setPhase] = useState<'search' | 'found'>('search');
  const [foundItem, setFoundItem] = useState<(typeof ITEMS)[0] | null>(null);

  useEffect(() => {
    playSfx('click', muted);
    const t = setTimeout(() => {
      const itemId = pickFindItemId();
      const item = ITEMS.find((entry) => entry.id === itemId) ?? ITEMS[0];
      setFoundItem(item);
      addItem(item.id);
      playSfx('item', muted);
      setLastResult({
        type: 'item',
        success: true,
        item: { id: item.id, name: item.name, quantity: 1, icon: item.icon },
        message: `You found a ${item.name}!`,
      });
      setPhase('found');
    }, 2000);
    return () => clearTimeout(t);
  }, [addItem, setLastResult, muted]);

  return (
    <motion.div
      className="screen item-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="screen-title">
        <SegmentIcon id="item" alt="" className="game-icon-img game-icon-img--title" /> Searching...
      </h2>

      <div className="item-scene">
        {phase === 'search' && (
          <div className="item-search" role="img" aria-label="Scanning for items">
            <div className="radar">
              <span className="radar__ring radar__ring--outer" />
              <span className="radar__ring radar__ring--inner" />
              <span className="radar__grid radar__grid--h" />
              <span className="radar__grid radar__grid--v" />
              <div className="radar__sweep" />
              <span className="radar__blip" />
            </div>
          </div>
        )}

        {phase === 'found' && foundItem && (
          <motion.div
            className="item-found"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <ItemIcon id={foundItem.id} icon={foundItem.icon} name={foundItem.name} className="item-found__icon" />
            <h3>You found a {foundItem.name}!</h3>
            <p className="item-found__msg">Added to your bag.</p>
            <button type="button" className="btn btn--primary" onClick={() => setScreen('hub')}>
              Back to Hub
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
