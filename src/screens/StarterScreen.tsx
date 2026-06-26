import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { Confetti } from '../components/Confetti';
import { SpriteCard } from '../components/SpriteCard';
import { STARTER_IDS, pickRandom } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { asset } from '../utils/asset';
import type { PokemonData } from '../types/game';

export function StarterScreen() {
  const addStarterPokemon = useGameStore((state) => state.addStarterPokemon);
  const setScreen = useGameStore((state) => state.setScreen);
  const muted = useGameStore((state) => state.muted);
  const [starter, setStarter] = useState<PokemonData | null>(null);
  const [revealed, setRevealed] = useState(false);

  const starterId = useMemo(() => pickRandom(STARTER_IDS), []);
  const isShiny = useMemo(() => Math.random() < 1 / 40, []);

  useEffect(() => {
    fetchPokemon(starterId).then(setStarter);
  }, [starterId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRevealed(true);
      playSfx('catch', muted);
    }, 1800);
    return () => clearTimeout(timer);
  }, [muted]);

  if (!starter) {
    return <div className="screen starter-screen"><div className="loading">Choosing your starter...</div></div>;
  }

  return (
    <motion.div className="screen starter-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Confetti active={revealed} />
      <h2 className="screen-title">A Kanto Starter Appears!</h2>
      <p className="starter-screen__subtitle">Professor Oak hands you a random partner.</p>

      {!revealed ? (
        <motion.img
          src={asset('pokeball.svg')}
          alt="Starter Pokeball"
          className="starter-screen__ball"
          animate={{ x: [-10, 10, -8, 8, 0], rotate: [-8, 8, -8, 8, 0] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      ) : (
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <SpriteCard pokemon={starter} size="lg" shiny={isShiny} />
          <p className="starter-screen__subtitle">
            Your starter is {starter.displayName}
            {isShiny ? ' — and it\'s shiny!' : '.'}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              addStarterPokemon(starter, isShiny);
              setScreen('hub');
            }}
          >
            Start Journey
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
