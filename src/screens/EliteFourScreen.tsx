import { useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { ELITE_FOUR } from '../data/pools';
import { Confetti } from '../components/Confetti';
import { useGameStore } from '../store/useGameStore';

export function EliteFourScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setEliteCleared = useGameStore((s) => s.setEliteCleared);

  const [stage, setStage] = useState(() => {
    const { debugEliteStage, setDebugEliteStage } = useGameStore.getState();
    if (debugEliteStage !== null) {
      setDebugEliteStage(null);
      return debugEliteStage;
    }
    return 0;
  });

  const member = ELITE_FOUR[stage];

  return (
    <motion.div className="screen elite-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Confetti active={stage >= ELITE_FOUR.length - 1 && useGameStore.getState().eliteCleared} />

      <h2 className="screen-title">👑 Elite Four</h2>
      <div className="elite-progress">
        {ELITE_FOUR.map((m, i) => (
          <span
            key={m.id}
            className={`elite-pip ${i < stage || useGameStore.getState().eliteCleared ? 'elite-pip--done' : ''} ${i === stage && !useGameStore.getState().eliteCleared ? 'elite-pip--current' : ''}`}
          />
        ))}
      </div>
      <BattleArena
        key={member.id}
        title={`Elite Four - ${member.name}`}
        leader={member}
        finalVictory={stage === ELITE_FOUR.length - 1}
        onWin={() => {
          if (stage === ELITE_FOUR.length - 1) {
            setEliteCleared(true);
            useGameStore.getState().recordChampion();
            setScreen('champion');
          } else {
            setStage((value) => value + 1);
          }
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
