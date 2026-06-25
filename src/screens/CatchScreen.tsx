import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CatchCombo } from '../components/CatchCombo';
import { SpriteCard } from '../components/SpriteCard';
import { Confetti } from '../components/Confetti';
import { useGameStore } from '../store/useGameStore';
import { resolveEncounterPokemon, resetEncounterSession } from '../utils/encounterSession';
import { playSfx } from '../utils/sound';
import type { ActivityType, PokemonData } from '../types/game';

function encounterFlavor(activity: ActivityType | null, isLegendary: boolean): string {
  if (activity === 'fishing') return 'You hooked something from the water!';
  if (activity === 'tallgrass' && isLegendary) return 'A legendary Pokémon appeared in the tall grass!';
  if (activity === 'tallgrass') return 'A strong Pokémon appeared in the tall grass!';
  return 'A wild Pokémon appeared!';
}

export function CatchScreen() {
  const currentActivity = useGameStore((s) => s.currentActivity);
  const catchPokemon = useGameStore((s) => s.catchPokemon);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveEncounterPokemon().then((data) => {
      if (!cancelled) {
        setPokemon(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && pokemon) {
      useGameStore.getState().markSeen(pokemon);
      playSfx('battle', muted);
    }
  }, [loading, pokemon, muted]);

  function resultActivityType(): ActivityType {
    if (currentActivity === 'fishing') return 'fishing';
    if (currentActivity === 'tallgrass') return 'tallgrass';
    return 'wild';
  }

  function goHub() {
    resetEncounterSession();
    setScreen('hub');
  }

  function handleComboResult(success: boolean) {
    if (!pokemon) return;
    setResolved(success);
    if (success) {
      playSfx('catch', muted);
      catchPokemon(pokemon);
      setShowConfetti(true);
    } else {
      playSfx('fail', muted);
      setLastResult({
        type: resultActivityType(),
        success: false,
        message: `${pokemon.displayName} ran away!`,
      });
    }
  }

  if (loading) {
    return (
      <div className="screen catch-screen">
        <div className="loading">A wild Pokémon appeared...</div>
      </div>
    );
  }

  if (!pokemon) {
    return (
      <div className="screen catch-screen">
        <p>Failed to load Pokémon.</p>
        <button type="button" className="btn btn--primary" onClick={goHub}>
          Back to Hub
        </button>
      </div>
    );
  }

  const safePower = Number.isFinite(pokemon.powerLevel) ? pokemon.powerLevel : 0.3;

  return (
    <motion.div
      className="screen catch-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active={showConfetti} />

      <div className="catch-scene">
        <div className="catch-scene__grass" />
        <motion.div className="catch-scene__content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className={`catch-flavor ${pokemon.isLegendary ? 'catch-flavor--legendary' : ''}`}>
            {encounterFlavor(currentActivity, pokemon.isLegendary)}
          </p>
          <SpriteCard pokemon={pokemon} size="lg" />
          <p className="catch-power">
            Catch difficulty scales with Power {Math.round(safePower * 100)}
            {pokemon.isLegendary ? ' — Legendary!' : ''}.
          </p>

          {resolved === null ? (
            <CatchCombo
              powerLevel={safePower}
              isLegendary={pokemon.isLegendary}
              onResult={handleComboResult}
            />
          ) : (
            <div className="catch-result-panel">
              <h2 className="catch-result__title">{resolved ? 'Caught!' : 'Escaped!'}</h2>
              <p className="catch-result__msg">
                {resolved ? `${pokemon.displayName} joined your party.` : `${pokemon.displayName} got away.`}
              </p>
              <button type="button" className="btn btn--primary" onClick={goHub}>
                Back to Hub
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
