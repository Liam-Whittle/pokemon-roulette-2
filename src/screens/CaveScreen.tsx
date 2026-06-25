import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { ITEMS, pickRandom } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import type { BagItem } from '../types/game';

const PATHS = [
  { id: 'left', label: 'Echoing Tunnel' },
  { id: 'center', label: 'Crystal Passage' },
  { id: 'right', label: 'Deep Hollow' },
];

export function CaveScreen() {
  const getEncounterId = useGameStore((state) => state.getEncounterId);
  const setCurrentPokemon = useGameStore((state) => state.setCurrentPokemon);
  const addItem = useGameStore((state) => state.addItem);
  const setLastResult = useGameStore((state) => state.setLastResult);
  const setScreen = useGameStore((state) => state.setScreen);
  const muted = useGameStore((state) => state.muted);

  // One of the three paths secretly leads to an item instead of a Pokemon.
  const itemPathIndex = useMemo(() => Math.floor(Math.random() * PATHS.length), []);
  const [busy, setBusy] = useState(false);
  const [foundItem, setFoundItem] = useState<BagItem | null>(null);

  async function choosePath(index: number) {
    if (busy) return;
    setBusy(true);
    playSfx('click', muted);

    if (index === itemPathIndex) {
      const item = pickRandom(ITEMS);
      addItem(item.id);
      playSfx('item', muted);
      const bagItem: BagItem = { id: item.id, name: item.name, quantity: 1, icon: item.icon };
      setLastResult({
        type: 'cave',
        success: true,
        item: bagItem,
        message: `You found a ${item.name} in the cave!`,
      });
      setFoundItem(bagItem);
      return;
    }

    const pokemon = await fetchPokemon(getEncounterId('cave'));
    setCurrentPokemon(pokemon);
    setScreen('catch');
  }

  if (foundItem) {
    return (
      <motion.div className="screen cave-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <h2 className="screen-title">Explore Cave</h2>
        <motion.div
          className="cave-item-found"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <span className="cave-item-found__icon">{foundItem.icon}</span>
          <h3>You found a {foundItem.name}!</h3>
          <p className="cave-item-found__msg">Added to your bag.</p>
        </motion.div>
        <button type="button" className="btn btn--primary" onClick={() => setScreen('hub')}>
          Back to Hub
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div className="screen cave-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="screen-title">Explore Cave</h2>
      <p className="fossil-screen__subtitle">Choose a path. One hides treasure, the others stir something in the dark.</p>
      <div className="cave-screen__paths">
        {PATHS.map((path, index) => (
          <button
            key={path.id}
            type="button"
            className="cave-screen__path"
            onClick={() => choosePath(index)}
            disabled={busy}
          >
            <span>🕳️</span>
            <strong>{path.label}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--ghost" onClick={() => setScreen('hub')}>
        Back to Hub
      </button>
    </motion.div>
  );
}
