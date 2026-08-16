import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { Wheel, type SpinnerSegment } from './Wheel';
import { GameIcon } from './GameIcon';
import { useGameStore } from '../store/useGameStore';
import { publishHostActivity, publishHostWheelSpin } from '../multiplayer/publish';
import { TYPE_COLORS } from '../data/typeChart';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { encounterLevelForBadges } from '../utils/xp';
import { filterEncounterPoolByEvolutionLevel } from '../utils/encounterPool';
import type { UISpriteKey } from '../data/icons';
import type { PokemonData } from '../types/game';
import { filterPoolForIlluminate, partyHasAbility } from '../data/abilities';

interface EncounterWheelProps {
  title: string;
  uiKey: UISpriteKey;
  subtitle: string;
  /** Pool of National Dex IDs that can appear on the wheel. */
  pool: number[];
  /** Maximum number of wedges to show (a random sample of the pool). */
  maxWedges?: number;
  hideWedgeLabels?: boolean;
  /**
   * When true, landing grants the Pokémon straight to the party (no catch minigame).
   * Used by Hardcore draft.
   */
  instantGrant?: boolean;
  /** Called after an instant grant (e.g. remount draft for the next spin). */
  onGranted?: (pokemon: PokemonData) => void;
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

export function EncounterWheel({
  title,
  uiKey,
  subtitle,
  pool,
  maxWedges = 8,
  hideWedgeLabels = false,
  instantGrant = false,
  onGranted,
}: EncounterWheelProps) {
  const setScreen = useGameStore((s) => s.setScreen);
  const setCurrentPokemon = useGameStore((s) => s.setCurrentPokemon);
  const debugAddToParty = useGameStore((s) => s.debugAddToParty);
  const badges = useGameStore((s) => s.badges);
  const maxRepelSpinsLeft = useGameStore((s) => s.maxRepelSpinsLeft);
  const setMaxRepelSpins = useGameStore((s) => s.setMaxRepelSpins);
  const hardcoreDrafting = useGameStore(
    (s) => s.activeUnlocks.includes('hardcore') && !s.starterClaimed,
  );

  const ids = useMemo(() => {
    const encounterLevel = encounterLevelForBadges(badges.length);
    let filtered = filterEncounterPoolByEvolutionLevel(pool, encounterLevel);
    // Max Repel BST filtering happens after species fetch below.
    return sample(Array.from(new Set(filtered)), maxWedges);
  }, [pool, maxWedges, badges.length, maxRepelSpinsLeft]);
  const [mons, setMons] = useState<PokemonData[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [passName, setPassName] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null))).then((results) => {
      if (cancelled) return;
      let list = results.filter((p): p is PokemonData => p !== null);
      if (maxRepelSpinsLeft > 0) {
        const high = list.filter((p) => p.baseStatTotal > 400);
        if (high.length >= 3) list = high;
      }
      if (partyHasAbility(useGameStore.getState().party, 'illuminate')) {
        list = filterPoolForIlluminate(list, (p) => p.baseStatTotal, 3);
      }
      setMons(list);
    });
    return () => {
      cancelled = true;
    };
  }, [ids, maxRepelSpinsLeft]);

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
    if (maxRepelSpinsLeft > 0) setMaxRepelSpins(maxRepelSpinsLeft - 1);
    publishHostWheelSpin({
      kind: 'encounter',
      title,
      segments,
      result: seg,
    });

    if (instantGrant) {
      publishHostActivity({
        kind: 'notice',
        title: 'Draft pick!',
        message: `${chosen.displayName} joined your team!`,
        success: true,
        pokemonName: chosen.displayName,
        pokemonSprite: chosen.sprite,
      });
      debugAddToParty(chosen);
      window.setTimeout(() => {
        onGranted?.(chosen);
      }, 500);
      return;
    }

    publishHostActivity({
      kind: 'notice',
      title: 'Encounter!',
      message: `A wild ${chosen.displayName} appeared!`,
      success: true,
      pokemonName: chosen.displayName,
      pokemonSprite: chosen.sprite,
    });
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
      {hideWedgeLabels && (
        <p className="wheel-pass-name" aria-live="polite">
          {passName || '—'}
        </p>
      )}

      {mons === null ? (
        <p className="loading">Preparing the wheel…</p>
      ) : segments.length === 0 ? (
        <p className="loading">Nothing turned up. Head back and try again.</p>
      ) : (
        <Wheel
          segments={segments}
          onLand={handleLand}
          disabled={locked}
          hideLabels={hideWedgeLabels}
          onPassSegment={(seg) => setPassName(seg.label)}
        />
      )}

      {!instantGrant && (
        <button
          type="button"
          className="wheel-back-btn"
          onClick={() => setScreen(hardcoreDrafting ? 'hardcore-draft' : 'hub')}
        >
          ← Back
        </button>
      )}
    </motion.div>
  );
}
