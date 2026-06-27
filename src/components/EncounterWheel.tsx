import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { Wheel, type SpinnerSegment } from './Wheel';
import { GameIcon } from './GameIcon';
import { useGameStore } from '../store/useGameStore';
import { TYPE_COLORS } from '../data/typeChart';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { UISpriteKey } from '../data/icons';
import type { PokemonData } from '../types/game';

interface EncounterWheelProps {
  title: string;
  uiKey: UISpriteKey;
  subtitle: string;
  /** Pool of National Dex IDs that can appear on the wheel. */
  pool: number[];
  /** Maximum number of wedges to show (a random sample of the pool). */
  maxWedges?: number;
}

/** Fisher–Yates sample of up to `n` distinct entries. */
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export function EncounterWheel({ title, uiKey, subtitle, pool, maxWedges = 8 }: EncounterWheelProps) {
  const setScreen = useGameStore((s) => s.setScreen);
  const setCurrentPokemon = useGameStore((s) => s.setCurrentPokemon);

  const ids = useMemo(() => sample(Array.from(new Set(pool)), maxWedges), [pool, maxWedges]);
  const [mons, setMons] = useState<PokemonData[] | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null))).then((results) => {
      if (cancelled) return;
      setMons(results.filter((p): p is PokemonData => p !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const segments: SpinnerSegment[] = useMemo(
    () =>
      (mons ?? []).map((p) => ({
        id: String(p.id),
        label: p.displayName,
        color: TYPE_COLORS[p.types[0]] ?? '#6b7280',
        icon: '',
        image: p.sprite || PLACEHOLDER_SPRITE,
      })),
    [mons],
  );

  function handleLand(seg: SpinnerSegment) {
    if (locked) return;
    const chosen = (mons ?? []).find((p) => String(p.id) === seg.id);
    if (!chosen) return;
    setLocked(true);
    setCurrentPokemon(chosen);
    window.setTimeout(() => setScreen('catch'), 700);
  }

  return (
    <motion.div
      className="screen encounter-wheel-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="screen-title">
        <GameIcon ui={uiKey} alt="" className="game-icon-img game-icon-img--title" /> {title}
      </h2>
      <p className="encounter-wheel__subtitle">{subtitle}</p>

      {mons === null ? (
        <p className="loading">Preparing the wheel…</p>
      ) : segments.length === 0 ? (
        <p className="loading">Nothing turned up. Head back and try again.</p>
      ) : (
        <Wheel segments={segments} onLand={handleLand} disabled={locked} />
      )}

      <button type="button" className="btn btn--ghost" onClick={() => setScreen('hub')}>
        Back to Hub
      </button>
    </motion.div>
  );
}
