import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { FOSSIL_POKEMON, pickRandom } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

const TARGET_HITS = 6;
const MAX_STRIKES = 3;

type Phase = 'ready' | 'digging' | 'failed' | 'loading';

/** Reaction window per successful chip — gets tighter as you progress. */
function windowForHit(hit: number): number {
  return Math.max(560, 1150 - hit * 110);
}

export function FossilScreen() {
  const setCurrentPokemon = useGameStore((s) => s.setCurrentPokemon);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const fossilId = useMemo(() => pickRandom(FOSSIL_POKEMON), []);

  const [phase, setPhase] = useState<Phase>('ready');
  const [hits, setHits] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  const hitsRef = useRef(0);
  const strikesRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finishSuccess = useCallback(async () => {
    clearTimer();
    setTarget(null);
    setPhase('loading');
    playSfx('catch', muted);
    const pokemon = await fetchPokemon(fossilId);
    setCurrentPokemon(pokemon);
    setScreen('catch');
  }, [clearTimer, fossilId, muted, setCurrentPokemon, setScreen]);

  const applyStrike = useCallback(() => {
    clearTimer();
    playSfx('fail', muted);
    const next = strikesRef.current + 1;
    strikesRef.current = next;
    setStrikes(next);
    setTarget(null);
    if (next >= MAX_STRIKES) {
      setPhase('failed');
    } else {
      setRound((r) => r + 1);
    }
  }, [clearTimer, muted]);

  // Spawn a fresh chip point each round while digging.
  useEffect(() => {
    if (phase !== 'digging') return;
    const x = 12 + Math.random() * 76;
    const y = 18 + Math.random() * 64;
    setTarget({ x, y });
    timeoutRef.current = window.setTimeout(applyStrike, windowForHit(hitsRef.current));
    return clearTimer;
  }, [phase, round, applyStrike, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  function startDig() {
    hitsRef.current = 0;
    strikesRef.current = 0;
    setHits(0);
    setStrikes(0);
    setRound(0);
    setPhase('digging');
  }

  function hitTarget(e: React.MouseEvent) {
    e.stopPropagation();
    if (phase !== 'digging') return;
    clearTimer();
    playSfx('item', muted);
    const next = hitsRef.current + 1;
    hitsRef.current = next;
    setHits(next);
    if (next >= TARGET_HITS) {
      finishSuccess();
    } else {
      setTarget(null);
      setRound((r) => r + 1);
    }
  }

  function missField() {
    if (phase !== 'digging') return;
    applyStrike();
  }

  const windowMs = windowForHit(hits);

  return (
    <motion.div className="screen fossil-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="screen-title">Fossil Revive</h2>

      {phase === 'ready' && (
        <>
          <p className="fossil-screen__subtitle">
            Chip the glowing cracks before they fade. Land {TARGET_HITS} clean strikes, but {MAX_STRIKES} slips
            and the fossil shatters.
          </p>
          <button type="button" className="btn btn--primary btn--lg" onClick={startDig}>
            Start Digging
          </button>
        </>
      )}

      {phase === 'loading' && <p className="fossil-screen__subtitle">The ancient Pokémon stirs...</p>}

      {phase === 'failed' && (
        <>
          <p className="fossil-screen__subtitle">The fossil crumbled to dust. Nothing could be revived.</p>
          <button type="button" className="btn btn--primary" onClick={startDig}>
            Try Again
          </button>
        </>
      )}

      {phase === 'digging' && (
        <>
          <div className="fossil-dig__hud">
            <span>
              Chips: <strong>{hits}/{TARGET_HITS}</strong>
            </span>
            <span className="fossil-dig__strikes">
              {Array.from({ length: MAX_STRIKES }, (_, i) => (
                <span key={i} className={`fossil-strike ${i < strikes ? 'fossil-strike--lost' : ''}`}>
                  {i < strikes ? '🪨' : '🦴'}
                </span>
              ))}
            </span>
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="fossil-dig" onClick={missField}>
            {target && (
              <button
                key={round}
                type="button"
                className="fossil-dig__target"
                style={{ left: `${target.x}%`, top: `${target.y}%` }}
                onClick={hitTarget}
              >
                <span className="fossil-dig__ring" style={{ animationDuration: `${windowMs}ms` }} />
                <span className="fossil-dig__pick">⛏️</span>
              </button>
            )}
          </div>
        </>
      )}

      {phase !== 'loading' && (
        <button type="button" className="btn btn--ghost" onClick={() => setScreen('hub')}>
          Back to Hub
        </button>
      )}
    </motion.div>
  );
}
