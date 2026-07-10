import { EncounterWheel } from '../components/EncounterWheel';
import { getRegionFishingPool } from '../data/pools';
import { useGameStore } from '../store/useGameStore';

export function FishingScreen() {
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  return (
    <EncounterWheel
      title="Fishing"
      uiKey="fishing"
      subtitle="Cast out and spin the wheel — land on a Pokémon to reel it in!"
      pool={getRegionFishingPool(region)}
      maxWedges={8}
    />
  );
}
