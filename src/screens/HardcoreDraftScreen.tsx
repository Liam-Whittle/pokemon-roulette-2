import { useEffect, useMemo, useRef, useState } from 'react';
import { EncounterWheel } from '../components/EncounterWheel';
import { NEW_POKEMON_WHEEL_WEDGES } from '../data/prestige';
import { getRegionAllPokemonPool } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import type { RegionId } from '../data/pools';

/** Hardcore: spin until party is full — each land instantly adds that Pokémon (no catch minigame). */
export function HardcoreDraftScreen() {
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto')) as RegionId;
  const partyLen = useGameStore((s) => s.party.length);
  const draftSize = useGameStore((s) => s.getMaxParty());
  const setScreen = useGameStore((s) => s.setScreen);
  const setHardcoreDraftSpinsLeft = useGameStore((s) => s.setHardcoreDraftSpinsLeft);
  const pool = useMemo(() => getRegionAllPokemonPool(region), [region]);
  const prevLen = useRef(partyLen);
  const [wheelKey, setWheelKey] = useState(0);
  const [lastGranted, setLastGranted] = useState<string | null>(null);

  useEffect(() => {
    if (partyLen > prevLen.current) {
      const remaining = Math.max(0, draftSize - partyLen);
      setHardcoreDraftSpinsLeft(remaining);
      prevLen.current = partyLen;
    }
    if (partyLen >= draftSize) {
      useGameStore.setState({ starterClaimed: true, hardcoreDraftSpinsLeft: 0 });
      setScreen('hub');
    }
  }, [partyLen, draftSize, setHardcoreDraftSpinsLeft, setScreen]);

  if (partyLen >= draftSize) return null;

  return (
    <EncounterWheel
      key={`draft-${wheelKey}`}
      title={`Hardcore Draft — ${partyLen}/${draftSize}`}
      uiKey="life"
      subtitle={
        lastGranted
          ? `${lastGranted} joined the team!`
          : 'Spin to claim each teammate instantly — no catching required.'
      }
      pool={pool}
      maxWedges={NEW_POKEMON_WHEEL_WEDGES}
      hideWedgeLabels
      instantGrant
      onGranted={(pokemon) => {
        setLastGranted(pokemon.displayName);
        setWheelKey((k) => k + 1);
      }}
    />
  );
}
