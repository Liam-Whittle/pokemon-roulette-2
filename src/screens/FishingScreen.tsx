import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import type { PokemonData } from '../types/game';

type FishPhase = 'cast' | 'waiting' | 'bite' | 'missed' | 'done';

export function FishingScreen() {
  const getEncounterId = useGameStore((s) => s.getEncounterId);
  const setScreen = useGameStore((s) => s.setScreen);
  const setCurrentPokemon = useGameStore((s) => s.setCurrentPokemon);
  const muted = useGameStore((s) => s.muted);

  const [phase, setPhase] = useState<FishPhase>('cast');
  const [biteWindow, setBiteWindow] = useState(false);
  const [pokemon, setPokemon] = useState<PokemonData | null>(null);

  const startFishing = useCallback(() => {
    playSfx('click', muted);
    setPhase('waiting');
    const waitTime = 1500 + Math.random() * 2500;
    setTimeout(() => {
      setPhase('bite');
      setBiteWindow(true);
      playSfx('spin', muted);
      setTimeout(() => {
        setBiteWindow(false);
        setPhase((current) => (current === 'done' ? current : 'missed'));
      }, 800);
    }, waitTime);
  }, [muted]);

  const handleReel = useCallback(async () => {
    if (!biteWindow) return;
    setBiteWindow(false);
    setPhase('done');
    playSfx('throw', muted);

    const id = getEncounterId('fishing');
    const data = await fetchPokemon(id);
    setPokemon(data);
  }, [biteWindow, getEncounterId, muted]);

  useEffect(() => {
    if (phase === 'done' && pokemon) {
      setCurrentPokemon(pokemon);
      const t = setTimeout(() => setScreen('catch'), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, pokemon, setCurrentPokemon, setScreen]);

  return (
    <motion.div
      className="screen fishing-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="screen-title">🎣 Fishing</h2>

      <div className="fishing-scene">
        <div className="fishing-water" />

        {phase === 'cast' && (
          <button type="button" className="btn btn--primary btn--lg" onClick={startFishing}>
            Cast Line
          </button>
        )}

        {phase === 'waiting' && (
          <motion.p className="fishing-status" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            Waiting for a bite...
          </motion.p>
        )}

        {phase === 'bite' && (
          <motion.button
            type="button"
            className="btn btn--accent btn--lg fishing-reel-btn"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 0.3 }}
            onClick={handleReel}
          >
            REEL IN!
          </motion.button>
        )}

        {phase === 'done' && pokemon && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <p className="fishing-caught">You hooked a {pokemon.displayName}!</p>
          </motion.div>
        )}

        {phase === 'missed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fishing-missed">
            <p>The fish got away. You missed the reel-in window.</p>
            <button type="button" className="btn btn--primary" onClick={startFishing}>
              Cast Again
            </button>
          </motion.div>
        )}
      </div>

      {phase !== 'done' && (
        <button type="button" className="btn btn--ghost" onClick={() => setScreen('hub')}>
          Leave
        </button>
      )}
    </motion.div>
  );
}
