import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { PokeDollarAmount } from '../components/PokeDollar';
import { getRegionRivalLeader, resolveRegionId } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { asset } from '../utils/asset';
import { playClip } from '../utils/music';
import { buildRandomRegionalTeam } from '../utils/randomTeam';
import { currentHp } from '../utils/stats';
import type { RegionId } from '../data/pools';

const RIVAL_REWARD = 120;

export function RivalBattleScreen() {
  const muted = useGameStore((s) => s.muted);
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region)) as RegionId;
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
    buildRandomRegionalTeam(region, teamSize, getRegionRivalLeader(region)),
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
    playClip(asset('sounds/gym_victory.mp3'));
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
        title={`Rival Battle — ${leader.name}!`}
        battleContext="rival"
        leader={leader}
        appendExtraEnemy={biggerBetter}
        loseLifeOnDefeat={false}
        healAllOnDefeat={false}
        onBeforeDefeatExit={restoreHp}
        onFlee={restoreHp}
        onWin={() => {
          addMoney(RIVAL_REWARD);
          reviveHealAllParty();
          if (luckyEggActive) {
            grantXpAllPartyAndPc(200);
            setLuckyEggActive(false);
          }
          setVictoryOpen(true);
        }}
        onLose={() => setScreen('hub')}
      />

      {victoryOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal gym-victory">
            <p className="gym-victory__eyebrow">Rival {leader.name} defeated!</p>
            <h3 className="gym-victory__title">You earned ¥{RIVAL_REWARD}!</h3>
            <div className="gym-victory__subtitle">
              <PokeDollarAmount amount={RIVAL_REWARD} />
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
