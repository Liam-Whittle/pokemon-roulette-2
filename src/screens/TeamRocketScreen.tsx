import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { ItemIcon } from '../components/ItemIcon';
import { PokeDollarAmount } from '../components/PokeDollar';
import {
  TEAM_ROCKET_LEADER,
  getRegionRocketPool,
} from '../data/pools';
import { getCachedSpecies } from '../data/speciesCache';
import { useGameStore } from '../store/useGameStore';
import { asset } from '../utils/asset';
import { playClip } from '../utils/music';
import { playSfx } from '../utils/sound';
import { currentHp } from '../utils/stats';
import type { GymLeader } from '../types/game';
import type { RegionId } from '../data/pools';

function buildRocketLeader(region: RegionId, partySize: number): GymLeader {
  const shuffled = [...getRegionRocketPool(region)].sort(() => Math.random() - 0.5);
  const count = Math.max(1, partySize + 1);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  while (picked.length < count && shuffled.length > 0) {
    picked.push(shuffled[picked.length % shuffled.length]!);
  }

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

  const [leader] = useState(() => buildRocketLeader(region, party.length));
  const luckyEggActive = useGameStore((s) => s.luckyEggActive);
  const setLuckyEggActive = useGameStore((s) => s.setLuckyEggActive);
  const grantXpAllPartyAndPc = useGameStore((s) => s.grantXpAllPartyAndPc);
  const hasSecretKey = useGameStore(
    (s) => (s.bag.find((i) => i.id === 'secretkey')?.quantity ?? 0) > 0,
  );
  const [victoryOpen, setVictoryOpen] = useState(false);
  const [doorwayOpen, setDoorwayOpen] = useState(false);
  const [fadingToGiovanni, setFadingToGiovanni] = useState(false);
  // Freeze HP at fight start so mid-battle faints do not overwrite the restore map.
  const hpSnapshotRef = useRef<Record<number, number> | null>(null);
  if (hpSnapshotRef.current === null) {
    hpSnapshotRef.current = Object.fromEntries(
      party.map((member) => [member.caughtAt, currentHp(member)]),
    );
  }
  const stolenNameRef = useRef<string | null>(null);
  const fledRef = useRef(false);

  const hasParty = party.length > 1;

  useEffect(() => {
    if (party.length <= 1) setScreen('hub');
  }, [party.length, setScreen]);

  useEffect(() => {
    if (!victoryOpen || muted) return;
    playClip(asset('sounds/gym_victory.mp3'), 0.4);
  }, [victoryOpen, muted]);

  useEffect(() => {
    if (!fadingToGiovanni) return;
    const id = window.setTimeout(() => {
      setScreen('giovanni');
    }, 1100);
    return () => window.clearTimeout(id);
  }, [fadingToGiovanni, setScreen]);

  const handleDefeat = useMemo(
    () => () => {
      restorePartyHpSnapshot(hpSnapshotRef.current ?? {});
      stolenNameRef.current = stealRandomPartyPokemon();
    },
    [restorePartyHpSnapshot, stealRandomPartyPokemon],
  );

  const handleFlee = useMemo(
    () => () => {
      fledRef.current = true;
      restorePartyHpSnapshot(hpSnapshotRef.current ?? {});
    },
    [restorePartyHpSnapshot],
  );

  function dismissVictory() {
    setVictoryOpen(false);
    setScreen('hub');
  }

  function leaveDoorway() {
    playSfx('click', muted);
    setDoorwayOpen(false);
    setScreen('hub');
  }

  function useSecretKey() {
    playSfx('click', muted);
    setDoorwayOpen(false);
    setFadingToGiovanni(true);
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
        onFlee={handleFlee}
        onWin={() => {
          addMoney(150);
          reviveHealAllParty();
          if (luckyEggActive) {
            grantXpAllPartyAndPc(150);
            setLuckyEggActive(false);
          }
          if (hasSecretKey) {
            setDoorwayOpen(true);
            return;
          }
          setVictoryOpen(true);
        }}
        onLose={() => {
          if (fledRef.current) {
            setPendingHubNotice('You paid ¥50 and ran away from Team Rocket!');
            setScreen('hub');
            return;
          }
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

      {doorwayOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal rocket-doorway-modal">
            <div className="rocket-doorway-modal__icon" aria-hidden>
              <ItemIcon id="secretkey" icon="🔑" name="Secret Key" className="rocket-doorway-modal__key" />
            </div>
            <p className="gym-victory__eyebrow">Team Rocket defeated!</p>
            <h3 className="battle-modal__title">A hidden doorway…</h3>
            <p className="rocket-doorway-modal__text">
              There&apos;s a doorway with a keyhole that is suspiciously shaped like the Secret Key.
            </p>
            <div className="battle-modal__actions">
              <button type="button" className="btn btn--primary" onClick={useSecretKey}>
                Use Secret Key?
              </button>
              <button type="button" className="btn btn--ghost" onClick={leaveDoorway}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {fadingToGiovanni && (
          <motion.div
            className="rocket-giovanni-fade"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}
            aria-hidden
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
