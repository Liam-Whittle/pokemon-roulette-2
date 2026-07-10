import { useEffect } from 'react';
import { EncounterWheel } from '../components/EncounterWheel';
import { FOSSIL_POKEMON } from '../data/pools';
import { useGameStore } from '../store/useGameStore';

export function FossilScreen() {
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    if (region === 'Johto') setScreen('hub');
  }, [region, setScreen]);

  if (region === 'Johto') return null;

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
