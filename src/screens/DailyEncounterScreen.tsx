import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { CatchChance } from '../components/CatchChance';
import { DAILY_BALL_FLAT_CATCH } from '../data/prestige';
import { ITEM_SPRITES } from '../data/icons';
import { MetaMenuNav } from '../components/MetaMenuNav';
import { TypeBadge } from '../components/TypeBadge';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { CatchShakeResult } from '../utils/catchChance';
import {
  battleGifOnError,
  localBattleGif,
  localPokemonShinySprite,
  remoteShinyBattleGif,
} from '../utils/localAssets';
import type { PokemonData } from '../types/game';

type Phase = 'idle' | 'catching' | 'result';

function resolveDailyCatch(): CatchShakeResult {
  const caught = Math.random() < DAILY_BALL_FLAT_CATCH;
  if (caught) return { caught: true, shakes: 4 };
  return { caught: false, shakes: 1 + Math.floor(Math.random() * 3) };
}

export function DailyEncounterScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const dailyBalls = useGameStore((s) => s.dailyBalls);
  const dailyBallCap = useGameStore((s) => s.dailyBallCap);
  const refreshDailyBalls = useGameStore((s) => s.refreshDailyBalls);
  const ensureDailyEncounter = useGameStore((s) => s.ensureDailyEncounter);
  const advanceDailyEncounter = useGameStore((s) => s.advanceDailyEncounter);
  const consumeDailyBall = useGameStore((s) => s.consumeDailyBall);
  const registerGlobalCatch = useGameStore((s) => s.registerGlobalCatch);
  const owned = useGameStore(
    (s) => s.ownedUnlocks.includes('hundredPercenter') && s.hundredPercenterEnabled,
  );

  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [shiny, setShiny] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [caught, setCaught] = useState(false);
  const [absorbed, setAbsorbed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dexComplete, setDexComplete] = useState(false);
  const [throwKey, setThrowKey] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshDailyBalls();
  }, [refreshDailyBalls]);

  useEffect(() => {
    void beginEncounter(ensureDailyEncounter());
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beginEncounter(next: { id: number; shiny: boolean } | null) {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }

    setLoading(true);
    setMessage(null);
    setStatus(null);
    setLoadError(null);
    setPhase('idle');
    setCaught(false);
    setAbsorbed(false);
    setPokemon(null);

    if (!next) {
      setDexComplete(true);
      setShiny(false);
      setLoading(false);
      return;
    }

    setDexComplete(false);
    setShiny(next.shiny);

    try {
      const data = await fetchPokemon(next.id);
      setPokemon(data);
    } catch {
      setLoadError('Could not load encounter.');
    } finally {
      setLoading(false);
    }
  }

  function throwBall() {
    const canThrow = phase === 'idle' || (phase === 'result' && !caught);
    if (!pokemon || dailyBalls <= 0 || !canThrow) return;
    if (!consumeDailyBall()) {
      setMessage('No Poké Balls left today.');
      return;
    }

    playSfx('click', muted);
    setMessage(null);
    setStatus(null);
    setCaught(false);
    setAbsorbed(false);
    setThrowKey((k) => k + 1);
    setPhase('catching');
  }

  const handleAbsorb = useCallback(() => {
    setAbsorbed(true);
  }, []);

  const handleCatchResult = useCallback(
    (success: boolean) => {
      if (!pokemon) return;
      setCaught(success);
      setPhase('result');
      setStatus(null);

      if (success) {
        registerGlobalCatch(pokemon, shiny);
        setMessage(
          shiny
            ? `Caught shiny ${pokemon.displayName}! Finding the next encounter…`
            : `Caught ${pokemon.displayName}! Finding the next encounter…`,
        );
        advanceTimer.current = setTimeout(() => {
          void beginEncounter(advanceDailyEncounter());
        }, 1600);
      } else {
        setAbsorbed(false);
        setMessage('Oh no! It broke free!');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pokemon, shiny, muted, registerGlobalCatch, advanceDailyEncounter],
  );

  const busy = phase === 'catching' || (phase === 'result' && caught);
  const spriteSrc = shiny
    ? remoteShinyBattleGif(pokemon?.id ?? 0)
    : localBattleGif(pokemon?.id ?? 0);

  if (!owned) {
    return (
      <motion.div
        className="screen daily-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <header className="collection-header">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              playSfx('click', muted);
              setScreen('title');
            }}
          >
            ← Back
          </button>
          <h2 className="screen-title">Daily Encounter</h2>
        </header>
        <MetaMenuNav current="daily" />
        <div className="glass-panel daily-locked">
          <p>Unlock Hundred Percenter in the Prestige Shop first, then enable it there.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              playSfx('click', muted);
              setScreen('prestige');
            }}
          >
            Open Prestige Shop
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="screen daily-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="collection-header">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            playSfx('click', muted);
            setScreen('title');
          }}
        >
          ← Back
        </button>
        <h2 className="screen-title">Daily Encounter</h2>
        <span className={`glass-chip ${dailyBalls > 0 ? 'glass-chip--gold' : ''}`}>
          Balls {dailyBalls}/{dailyBallCap}
        </span>
      </header>

      <MetaMenuNav current="daily" />

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="glass-panel daily-stage"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="daily-loading">
              <div className="daily-loading__orb" />
              <p>Searching the tall grass…</p>
            </div>
          </motion.div>
        ) : dexComplete ? (
          <motion.div
            key="complete"
            className="glass-panel daily-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="daily-encounter__name">Pokédex complete!</p>
            <p className="daily-encounter__meta">
              You’ve already caught every Kanto &amp; Johto Pokémon available here.
            </p>
          </motion.div>
        ) : loadError ? (
          <motion.div
            key="error"
            className="glass-panel daily-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="daily-encounter__meta">{loadError}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void beginEncounter(ensureDailyEncounter())}
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          pokemon && (
            <motion.div
              key={`${pokemon.id}-${shiny ? 'shiny' : 'normal'}`}
              className={`glass-panel daily-stage${shiny ? ' daily-stage--shiny' : ''}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35 }}
            >
              <div className="daily-stage__glow" />
              <div className="daily-stage__content">
                <div className="daily-stage__sprite-area">
                  <motion.div
                    className="daily-stage__sprite-wrap"
                    animate={{
                      opacity: absorbed ? 0 : 1,
                      scale: absorbed ? 0.2 : 1,
                    }}
                    transition={{ duration: 0.35 }}
                  >
                    <motion.img
                      src={spriteSrc}
                      alt={pokemon.displayName}
                      className={`daily-encounter__sprite${shiny ? ' daily-encounter__sprite--shiny' : ''}`}
                      animate={
                        phase === 'idle'
                          ? { y: [0, -10, 0] }
                          : phase === 'result' && !caught
                            ? { x: [0, -6, 6, -4, 4, 0] }
                            : { y: 0, x: 0 }
                      }
                      transition={
                        phase === 'idle'
                          ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                          : { duration: 0.45 }
                      }
                      onError={(e) =>
                        battleGifOnError(
                          e,
                          pokemon.id,
                          shiny
                            ? pokemon.shinySprite || localPokemonShinySprite(pokemon.id)
                            : pokemon.sprite || PLACEHOLDER_SPRITE,
                          shiny,
                        )
                      }
                    />
                  </motion.div>

                  {phase === 'catching' && (
                    <CatchChance
                      key={throwKey}
                      ballId="pokeball"
                      ballSprite={ITEM_SPRITES.pokeball}
                      catchRate={45}
                      muted={muted}
                      resolveResult={resolveDailyCatch}
                      onAbsorb={handleAbsorb}
                      onResult={handleCatchResult}
                      onStatusChange={setStatus}
                    />
                  )}

                  {phase === 'result' && caught && (
                    <img
                      src={ITEM_SPRITES.pokeball}
                      alt="Caught"
                      className="catch-chance__ball daily-stage__caught-ball"
                    />
                  )}
                </div>

                <h3 className="daily-encounter__name">
                  {shiny ? '✨ ' : ''}
                  {pokemon.displayName}
                </h3>
                {shiny && <p className="daily-encounter__shiny-tag">Shiny!</p>}
                <div className="daily-encounter__types">
                  {pokemon.types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
                <p className="daily-encounter__meta">Flat catch rate: 1 in 8</p>

                <div className="daily-stage__status" aria-live="polite">
                  {status && <p className="daily-stage__status-text">{status}</p>}
                  {message && (
                    <motion.p
                      className={`daily-result ${caught ? 'daily-result--success' : 'daily-result--fail'}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {message}
                    </motion.p>
                  )}
                </div>

                <div className="daily-encounter__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={dailyBalls <= 0 || busy}
                    onClick={throwBall}
                  >
                    {busy
                      ? caught
                        ? 'Caught!'
                        : 'Throwing…'
                      : phase === 'result' && !caught
                        ? 'Throw Again'
                        : 'Throw Poké Ball'}
                  </button>
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {dailyBalls <= 0 && !caught && !dexComplete && (
        <p className="daily-out glass-banner">
          Out of daily balls — come back tomorrow or clear a region!
        </p>
      )}
    </motion.div>
  );
}
