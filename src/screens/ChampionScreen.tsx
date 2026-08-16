import { motion } from 'framer-motion';
import { Confetti } from '../components/Confetti';
import { useGameStore } from '../store/useGameStore';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { playSfx } from '../utils/sound';
import { resolveRegionId } from '../data/pools';

export function ChampionScreen() {
  const resetGame = useGameStore((s) => s.resetGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const trainer = useGameStore((s) => s.trainer);
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const avatar = trainer?.avatar;
  const avatarIsSprite = !!avatar && /[/.]/.test(avatar);
  const title = `New Champion of ${region}!!`;

  function goToPrestigeShop() {
    playSfx('click', muted);
    resetGame();
    setScreen('prestige');
  }

  return (
    <motion.div
      className="screen champion-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active continuous />

      <div className="champion-screen__content">
        <motion.div
          className="champion-screen__crown"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
        >
          {avatarIsSprite ? (
            <img
              src={avatar}
              alt={trainer?.name ?? 'Trainer'}
              className="champion-screen__trainer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
              }}
            />
          ) : (
            <span className="champion-screen__trainer-emoji" aria-hidden>
              {avatar || '👑'}
            </span>
          )}
        </motion.div>

        <motion.h1
          className="champion-screen__title"
          aria-label={title}
          animate={{ y: [0, -6, 0] }}
          transition={{ delay: 1.4, duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {title.split('').map((char, i) => (
            <motion.span
              key={`${char}-${i}`}
              className="champion-screen__title-char"
              initial={{ opacity: 0, y: 48, rotateX: 80, scale: 0.4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              transition={{
                delay: 0.35 + i * 0.04,
                type: 'spring',
                stiffness: 420,
                damping: 16,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="champion-screen__subtitle champion-screen__subtitle--prestige"
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.95, type: 'spring', stiffness: 260, damping: 18 }}
        >
          +1 Prestige Point earned
        </motion.p>

        <motion.div
          className="champion-screen__actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25 }}
        >
          <button
            type="button"
            className="btn btn--primary btn--lg champion-screen__restart"
            onClick={() => {
              playSfx('click', muted);
              resetGame();
            }}
          >
            Restart
          </button>
          <button
            type="button"
            className="btn btn--accent btn--lg"
            onClick={goToPrestigeShop}
          >
            Prestige Shop
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
