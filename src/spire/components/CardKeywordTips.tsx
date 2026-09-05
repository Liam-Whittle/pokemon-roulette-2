import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { KeywordTip } from '../data/keywordTips';

export function CardKeywordTips({
  anchor,
  tips,
}: {
  anchor: RefObject<HTMLElement | null>;
  tips: KeywordTip[];
}) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    const place = () => {
      const card = anchor.current;
      const stack = stackRef.current;
      if (!card || !stack) return;
      const r = card.getBoundingClientRect();
      const tw = stack.offsetWidth;
      const th = stack.offsetHeight;
      const pad = 10;
      const gap = 12;
      const roomRight = window.innerWidth - pad - (r.right + gap);
      const roomLeft = r.left - gap - pad;
      const onRight = roomRight >= tw || roomRight >= roomLeft;
      let left = onRight ? r.right + gap : r.left - gap - tw;
      left = Math.min(Math.max(pad, left), window.innerWidth - pad - tw);
      let top = r.top + r.height / 2 - th / 2;
      top = Math.min(Math.max(pad, top), window.innerHeight - pad - th);
      setPos({ top, left, ready: true });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, tips]);

  if (tips.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={stackRef}
      className={`spire-kwtips${pos.ready ? ' is-ready' : ''}`}
      style={{ top: pos.top, left: pos.left }}
      role="tooltip"
    >
      {tips.map((tip) => (
        <aside key={tip.kind} className={`spire-kwtip spire-kwtip--${tip.kind}`}>
          <strong>{tip.title}</strong>
          <p>{tip.body}</p>
        </aside>
      ))}
    </div>,
    document.body,
  );
}
