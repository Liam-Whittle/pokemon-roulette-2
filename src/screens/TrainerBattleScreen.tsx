import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { PokeDollarAmount } from '../components/PokeDollar';
import { TRAINER_BATTLE_LEADER } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { asset } from '../utils/asset';
import { playClip } from '../utils/music';
import { buildRandomRegionalTeam } from '../utils/randomTeam';
import { currentHp } from '../utils/stats';
import type { RegionId } from '../data/pools';

const TRAINER_REWARD = 80;

export function TrainerBattleScreen() {
  const muted = useGameStore((s) => s.muted);
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto')) as RegionId;
  const party = useGameStore((s) => s.party);
  const setScreen = useGameStore((s) => s.setScreen);
  const addMoney = useGameStore((s) => s.addMoney);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const restorePartyHpSnapshot = useGameStore((s) => s.restorePartyHpSnapshot);
  const biggerBetter = useGameStore((s) => s.isUnlockActive('biggerBetter'));
  const luckyEggActive = useGameStore((s) => s.luckyEggActive);
  const setLuckyEggActive = useGameStore((s) => s.setLuckyEggActive);
  const grantXpAllPartyAndPc = useGameStore((s) => s.grantXpAllPartyAndPc);

  const teamSize = Math.max(1, party.length);
  const [leader] = useState(() =>
    buildRandomRegionalTeam(region, teamSize, {
      ...TRAINER_BATTLE_LEADER,
      name: 'Ace Trainer',
    }),
  );
  const [victoryOpen, setVictoryOpen] = useState(false);

  const hpSnapshotRef = useRef<Record<number, number> | null>(null);
  if (hpSnapshotRef.current === null) {
    hpSnapshotRef.current = Object.fromEntries(
      party.map((member) => [member.caughtAt, currentHp(member)]),
    );
  }

  const restoreHp = useMemo(
    () => () => {
      restorePartyHpSnapshot(hpSnapshotRef.current ?? {});
    },
    [restorePartyHpSnapshot],
  );

  useEffect(() => {
    if (!victoryOpen || muted) return;
    playClip(asset('sounds/gym_victory.mp3'), 0.4);
  }, [victoryOpen, muted]);

  function dismissVictory() {
    setVictoryOpen(false);
    setScreen('hub');
  }

  return (
    <motion.div
      className="screen gym-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <BattleArena
        title="Trainer Battle!"
        battleContext="trainer"
        leader={leader}
        levelBonus={0}
        appendExtraEnemy={biggerBetter}
        loseLifeOnDefeat={false}
        healAllOnDefeat={false}
        onBeforeDefeatExit={restoreHp}
        onFlee={restoreHp}
        onWin={() => {
          addMoney(TRAINER_REWARD);
          reviveHealAllParty();
          if (luckyEggActive) {
            grantXpAllPartyAndPc(150);
            setLuckyEggActive(false);
          }
          setVictoryOpen(true);
        }}
        onLose={() => setScreen('hub')}
      />

      {victoryOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal gym-victory">
            <p className="gym-victory__eyebrow">Trainer defeated!</p>
            <h3 className="gym-victory__title">You earned ¥{TRAINER_REWARD}!</h3>
            <div className="gym-victory__subtitle">
              <PokeDollarAmount amount={TRAINER_REWARD} />
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
