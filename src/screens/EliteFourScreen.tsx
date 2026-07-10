import { useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { getRegionEliteFour } from '../data/pools';
import { Confetti } from '../components/Confetti';
import { useGameStore } from '../store/useGameStore';

export function EliteFourScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setEliteCleared = useGameStore((s) => s.setEliteCleared);
  const recordChampion = useGameStore((s) => s.recordChampion);
  const eliteCleared = useGameStore((s) => s.eliteCleared);
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  const eliteFour = getRegionEliteFour(region);

  const [stage, setStage] = useState(() => {
    const { debugEliteStage, setDebugEliteStage, battleSnapshot } = useGameStore.getState();
    if (debugEliteStage !== null) {
      setDebugEliteStage(null);
      return debugEliteStage;
    }
    if (battleSnapshot?.context === 'elite') return battleSnapshot.eliteStage;
    return 0;
  });

  const member = eliteFour[stage];
  if (!member) {
    setScreen('hub');
    return null;
  }

  const isChampionStage = stage >= eliteFour.length - 1;

  return (
    <motion.div
      className="screen elite-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active={isChampionStage && eliteCleared} />

      <h2 className="screen-title">👑 Elite Four</h2>
      <div className="elite-progress">
        {eliteFour.map((entry, idx) => (
          <span
            key={entry.id}
            className={`elite-progress__dot${idx < stage ? ' elite-progress__dot--done' : ''}${idx === stage ? ' elite-progress__dot--active' : ''}`}
            title={entry.name}
          />
        ))}
      </div>

      <BattleArena
        key={`${member.id}-${stage}`}
        title={isChampionStage ? 'Champion Battle' : `Elite Four: ${member.name}`}
        battleContext="elite"
        eliteStage={stage}
        leader={member}
        finalVictory={isChampionStage}
        onWin={() => {
          if (!isChampionStage) {
            setStage((prev) => prev + 1);
            return;
          }
          setEliteCleared(true);
          recordChampion();
          setScreen('champion');
        }}
        onLose={() => {
          if (useGameStore.getState().lives <= 0) {
            setScreen('gameover');
          } else {
            setScreen('hub');
          }
        }}
      />
    </motion.div>
  );
}
