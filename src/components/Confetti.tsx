import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  color: string;
  rotation: number;
  duration: number;
  delay: number;
  size: number;
}

const COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];

function makeParticles(count: number, continuous: boolean): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    duration: 2 + Math.random() * 2.5,
    delay: continuous ? Math.random() * 4 : Math.random() * 0.6,
    size: 8 + Math.random() * 8,
  }));
}

export function Confetti({ active, continuous = false }: { active: boolean; continuous?: boolean }) {
  const [oneShot, setOneShot] = useState<Particle[]>([]);

  const continuousParticles = useMemo(
    () => (continuous ? makeParticles(120, true) : []),
    [continuous],
  );

  useEffect(() => {
    if (continuous) return;
    if (!active) return;
    setOneShot(makeParticles(40, false));
    const t = setTimeout(() => setOneShot([]), 2500);
    return () => clearTimeout(t);
  }, [active, continuous]);

  if (!active) return null;

  if (continuous) {
    return (
      <div className="confetti-container" aria-hidden="true">
        {continuousParticles.map((p) => (
          <motion.div
            key={p.id}
            className="confetti-particle"
            style={{ backgroundColor: p.color, left: `${p.x}%`, width: p.size, height: p.size * 1.4 }}
            initial={{ y: '-10vh', rotate: p.rotation, opacity: 1 }}
            animate={{ y: '110vh', rotate: p.rotation + 720, opacity: [1, 1, 0.9] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>
    );
  }

  if (oneShot.length === 0) return null;

  return (
    <div className="confetti-container" aria-hidden="true">
      {oneShot.map((p) => (
        <motion.div
          key={p.id}
          className="confetti-particle"
          style={{ backgroundColor: p.color, left: `${p.x}%` }}
          initial={{ y: '-10vh', rotate: p.rotation, opacity: 1 }}
          animate={{ y: '110vh', rotate: p.rotation + 720, opacity: 0 }}
          transition={{ duration: p.duration, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
