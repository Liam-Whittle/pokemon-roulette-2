import { EncounterWheel } from '../components/EncounterWheel';
import { GEN1_FISHING } from '../data/pools';

export function FishingScreen() {
  return (
    <EncounterWheel
      title="Fishing"
      uiKey="fishing"
      subtitle="Cast out and spin the wheel — land on a Pokémon to reel it in!"
      pool={GEN1_FISHING}
      maxWedges={8}
    />
  );
}
