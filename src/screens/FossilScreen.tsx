import { useEffect } from 'react';
import { EncounterWheel } from '../components/EncounterWheel';
import { FOSSIL_POKEMON, resolveRegionId } from '../data/pools';
import { useGameStore } from '../store/useGameStore';

export function FossilScreen() {
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    if (region !== 'Kanto') setScreen('hub');
  }, [region, setScreen]);

  if (region !== 'Kanto') return null;

  return (
    <EncounterWheel
      title="Fossil Revive"
      uiKey="fossil"
      subtitle="Spin to revive an ancient Pokémon — land on a fossil to bring it back to life!"
      pool={FOSSIL_POKEMON}
      maxWedges={6}
    />
  );
}
