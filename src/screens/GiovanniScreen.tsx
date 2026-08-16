import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { GIOVANNI_LEADER, getRegionLegendaryPool, pickRandom, resolveRegionId } from '../data/pools';
import { fetchPokemon } from '../api/pokeapi';
import { useGameStore } from '../store/useGameStore';
import { createCaughtAtLevel } from '../utils/pokemonInstance';
import { currentHp, maxHpForMon } from '../utils/stats';
import { asset } from '../utils/asset';
import { playClip, stopClips, stopMusic } from '../utils/music';
import type { GymLeader } from '../types/game';

function buildGiovanniCloneTeam(partyLevels: number[]): GymLeader {
  const levels = partyLevels.length > 0 ? partyLevels : [10];
  // 4 Dittos that Transform mid-fight, then Mewtwo as the closer
  const dittos = Array.from({ length: 4 }, (_, i) => ({
    id: 132,
    name: 'ditto',
    level: (levels[i % levels.length] ?? 10) + 1,
  }));
  const mewtwoLevel = Math.max(...levels) + 3;
  return {
    ...GIOVANNI_LEADER,
    pokemon: [...dittos, { id: 150, name: 'mewtwo', level: mewtwoLevel }],
  };
}

export function GiovanniScreen() {
  const party = useGameStore((s) => s.party);
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const addMoney = useGameStore((s) => s.addMoney);
  const spendMoney = useGameStore((s) => s.spendMoney);
  const money = useGameStore((s) => s.money);
  const addItem = useGameStore((s) => s.addItem);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const restorePartyHpSnapshot = useGameStore((s) => s.restorePartyHpSnapshot);
  const debugAddToParty = useGameStore((s) => s.debugAddToParty);
  const setPendingHubNotice = useGameStore((s) => s.setPendingHubNotice);
  const biggerBetter = useGameStore((s) => s.isUnlockActive('biggerBetter'));

  const [leader] = useState(() =>
    buildGiovanniCloneTeam(party.map((m) => m.level)),
  );
  const [done, setDone] = useState<'win' | 'lose' | null>(null);

  const hpSnapshotRef = useRef<Record<number, number> | null>(null);
  if (hpSnapshotRef.current === null) {
    hpSnapshotRef.current = Object.fromEntries(
      party.map((member) => [member.caughtAt, currentHp(member)]),
    );
  }

  useEffect(() => {
    if (done !== 'win') return;
    stopMusic();
    if (!muted) playClip(asset('sounds/giovanni_defeated.mp3'));
    return () => stopClips();
  }, [done, muted]);

  const onBeforeDefeat = useMemo(
    () => () => {
      restorePartyHpSnapshot(hpSnapshotRef.current ?? {});
    },
    [restorePartyHpSnapshot],
  );

  if (done === 'win') {
    return (
      <motion.div className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="battle-modal__backdrop">
          <div className="battle-modal">
            <h3 className="battle-modal__title">Giovanni defeated!</h3>
            <p className="battle-modal__subtitle">
              Master Ball, ¥300, and a legendary Pokémon!
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                stopClips();
                setScreen('hub');
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="screen gym-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <BattleArena
        title="Giovanni!"
        battleContext="giovanni"
        leader={leader}
        levelBonus={1}
        appendExtraEnemy={biggerBetter}
        loseLifeOnDefeat={false}
        healAllOnDefeat={false}
        onBeforeDefeatExit={onBeforeDefeat}
        onWin={async () => {
          addItem('masterball', 1);
          addMoney(300);
          reviveHealAllParty();
          const legendId = pickRandom(getRegionLegendaryPool(region));
          try {
            const mon = await fetchPokemon(legendId);
            const avg =
              party.length > 0
                ? Math.round(party.reduce((s, m) => s + m.level, 0) / party.length)
                : 20;
            const caught = createCaughtAtLevel(mon, 0);
            caught.level = avg;
            caught.hp = maxHpForMon(caught);
            debugAddToParty(mon);
            // ensure level roughly matches — debugAddToParty uses lv5; patch after
            useGameStore.setState((state) => ({
              party: state.party.map((m) =>
                m.id === mon.id && m.caughtAt === state.lastCaughtAt
                  ? { ...m, level: avg, hp: maxHpForMon({ ...m, level: avg }) }
                  : m,
              ),
            }));
            void caught;
          } catch {
            /* ignore */
          }
          setPendingHubNotice('Giovanni rewarded you handsomely!');
          setDone('win');
        }}
        onLose={() => {
          const half = Math.floor(money / 2);
          if (half > 0) spendMoney(half);
          reviveHealAllParty();
          setPendingHubNotice(
            `Giovanni took ¥${half}. Your Pokémon were restored. Try again after another Team Rocket fight.`,
          );
          setScreen('hub');
        }}
      />
    </motion.div>
  );
}
