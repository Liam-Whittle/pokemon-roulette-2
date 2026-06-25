import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CatchTimingRingProps {
  difficulty: number;
  onResult: (success: boolean) => void;
}

export function CatchTimingRing({ difficulty, onResult }: CatchTimingRingProps) {
  const [phase, setPhase] = useState<'waiting' | 'active' | 'done'>('waiting');
  const [ringSize, setRingSize] = useState(100);
  const [targetSize] = useState(() => 25 + difficulty * 20);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const shrinking = useRef(true);

  const windowMs = 800 + difficulty * 400;

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('active');
      startTimeRef.current = performance.now();
      setRingSize(100);

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / windowMs, 1);

        if (shrinking.current) {
          const size = 100 - progress * (100 - targetSize);
          setRingSize(size);
          if (progress >= 1) {
            shrinking.current = false;
            startTimeRef.current = now;
          }
        } else {
          const size = targetSize + ((now - startTimeRef.current) / windowMs) * (100 - targetSize);
          setRingSize(Math.min(size, 100));
        }

        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    }, 600);

    return () => {
      clearTimeout(t);
      cancelAnimationFrame(animRef.current);
    };
  }, [difficulty, targetSize, windowMs]);

  const handleTap = useCallback(() => {
    if (phase !== 'active') return;
    setPhase('done');
    cancelAnimationFrame(animRef.current);

    const tolerance = 12 + difficulty * 8;
    const success = Math.abs(ringSize - targetSize) <= tolerance;
    onResult(success);
  }, [phase, ringSize, targetSize, difficulty, onResult]);

  return (
    <div className="catch-timing" onClick={handleTap} role="button" aria-label="Tap when rings align">
      <motion.div
        className="catch-timing__outer"
        animate={{ scale: ringSize / 100 }}
        transition={{ duration: 0.05 }}
      />
      <div
        className={clsx('catch-timing__target', phase === 'active' && 'catch-timing__target--active')}
        style={{ width: targetSize, height: targetSize }}
      />
      {phase === 'waiting' && <p className="catch-timing__label">Get ready...</p>}
      {phase === 'active' && <p className="catch-timing__label">TAP NOW!</p>}
      {phase === 'done' && <p className="catch-timing__label">...</p>}
    </div>
  );
}
