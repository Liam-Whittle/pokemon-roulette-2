import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { PokeDollarAmount } from '../components/PokeDollar';
import {
  TEAM_ROCKET_LEADER,
  getRegionRocketPool,
} from '../data/pools';
import { getCachedSpecies } from '../data/speciesCache';
import { useGameStore } from '../store/useGameStore';
import { asset } from '../utils/asset';
import { playClip } from '../utils/music';
import { currentHp } from '../utils/stats';
import type { GymLeader } from '../types/game';
import type { RegionId } from '../data/pools';

function buildRocketLeader(region: RegionId): GymLeader {
  const shuffled = [...getRegionRocketPool(region)].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 3);

  return {
    ...TEAM_ROCKET_LEADER,
    pokemon: picked.map((id) => {
      const species = getCachedSpecies(id);
      return {
        id,
        name: species?.name ?? `pokemon-${id}`,
        level: 1,
      };
    }),
  };
}

export function TeamRocketScreen() {
  const muted = useGameStore((s) => s.muted);
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  const party = useGameStore((s) => s.party);
  const setScreen = useGameStore((s) => s.setScreen);
  const addMoney = useGameStore((s) => s.addMoney);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const restorePartyHpSnapshot = useGameStore((s) => s.restorePartyHpSnapshot);
  const stealRandomPartyPokemon = useGameStore((s) => s.stealRandomPartyPokemon);
  const setPendingHubNotice = useGameStore((s) => s.setPendingHubNotice);

  const [leader] = useState(() => buildRocketLeader(region));
  const [victoryOpen, setVictoryOpen] = useState(false);
  // Freeze HP at fight start so mid-battle faints do not overwrite the restore map.
  const hpSnapshotRef = useRef<Record<number, number> | null>(null);
  if (hpSnapshotRef.current === null) {
    hpSnapshotRef.current = Object.fromEntries(
      party.map((member) => [member.caughtAt, currentHp(member)]),
    );
  }
  const stolenNameRef = useRef<string | null>(null);

  const hasParty = party.length > 1;

  useEffect(() => {
    if (party.length <= 1) setScreen('hub');
  }, [party.length, setScreen]);

  useEffect(() => {
    if (!victoryOpen || muted) return;
    playClip(asset('sounds/gym_victory.mp3'));
  }, [victoryOpen, muted]);

  const handleDefeat = useMemo(
    () => () => {
      restorePartyHpSnapshot(hpSnapshotRef.current ?? {});
      stolenNameRef.current = stealRandomPartyPokemon();
    },
    [restorePartyHpSnapshot, stealRandomPartyPokemon],
  );

  function dismissVictory() {
    setVictoryOpen(false);
    setScreen('hub');
  }

  if (!hasParty) return null;

  return (
    <motion.div
      className="screen gym-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <BattleArena
        title="Team Rocket!"
        battleContext="teamrocket"
        leader={leader}
        loseLifeOnDefeat={false}
        healAllOnDefeat={false}
        onBeforeDefeatExit={handleDefeat}
        onWin={() => {
          addMoney(150);
          reviveHealAllParty();
          setVictoryOpen(true);
        }}
        onLose={() => {
          const stolen = stolenNameRef.current;
          setPendingHubNotice(
            stolen
              ? `Team Rocket stole ${stolen}!`
              : 'Team Rocket got away!',
          );
          setScreen('hub');
        }}
      />

      {victoryOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal gym-victory">
            <p className="gym-victory__eyebrow">Team Rocket defeated!</p>
            <h3 className="gym-victory__title">You earned ¥150!</h3>
            <div className="gym-victory__subtitle">
              <PokeDollarAmount amount={150} />
            </div>
            <p className="gym-victory__subtitle">
              Your party was fully healed. Prepare for the next path!
            </p>
            <button type="button" className="btn btn--primary btn--lg" onClick={dismissVictory}>
              Continue
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
