import { EncounterWheel } from '../components/EncounterWheel';
import { FOSSIL_POKEMON } from '../data/pools';

export function FossilScreen() {
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
