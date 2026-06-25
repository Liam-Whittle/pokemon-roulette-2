import { useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { GYM_LEADERS, pickRandom } from '../data/pools';
import { useGameStore } from '../store/useGameStore';

export function GymBattleScreen() {
  const badges = useGameStore((s) => s.badges);
  const setScreen = useGameStore((s) => s.setScreen);

  const [leader] = useState(() => {
    const { debugGymId, setDebugGym } = useGameStore.getState();
    if (debugGymId) {
      const forced = GYM_LEADERS.find((g) => g.id === debugGymId);
      setDebugGym(null);
      if (forced) return forced;
    }
    const unearned = GYM_LEADERS.filter((g) => !badges.some((b) => b.id === g.id));
    return unearned.length > 0 ? unearned[0] : pickRandom(GYM_LEADERS);
  });

  return (
    <motion.div className="screen gym-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <BattleArena
        title="Gym Battle"
        leader={leader}
        winBadge={{
          id: leader.id,
          name: leader.badgeName,
          type: leader.type,
          earnedAt: Date.now(),
          image: leader.badgeImage,
        }}
        onWin={() => setScreen('hub')}
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
