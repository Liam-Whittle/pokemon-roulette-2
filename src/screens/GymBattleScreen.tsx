import { useState } from 'react';
import { motion } from 'framer-motion';
import { BattleArena } from '../components/BattleArena';
import { getRegionGymLeaders, pickRandom } from '../data/pools';
import { useGameStore } from '../store/useGameStore';

export function GymBattleScreen() {
  const badges = useGameStore((s) => s.badges);
  const setScreen = useGameStore((s) => s.setScreen);
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));

  const [leader] = useState(() => {
    const { debugGymId, setDebugGym } = useGameStore.getState();
    const gymLeaders = getRegionGymLeaders(region);
    if (debugGymId) {
      const forced = gymLeaders.find((g) => g.id === debugGymId);
      setDebugGym(null);
      if (forced) return forced;
    }
    const unearned = gymLeaders.filter((g) => !badges.some((b) => b.id === g.id));
    return unearned.length > 0 ? unearned[0] : pickRandom(gymLeaders);
  });

  return (
    <motion.div
      className="screen gym-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <BattleArena
        title="Gym Battle"
        battleContext="gym"
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
