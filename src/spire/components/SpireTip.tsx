import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function SpireTip({
  title,
  body,
  side = 'top',
  children,
}: {
  title: string;
  body: string;
  side?: 'top' | 'bottom';
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    if (!open) {
      setPos({ top: 0, left: 0, ready: false });
      return undefined;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const tip = tipRef.current;
      if (!trigger || !tip) return;
      const r = trigger.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const pad = 10;
      let top = side === 'bottom' ? r.bottom + 8 : r.top - th - 8;
      if (top < pad) top = r.bottom + 8;
      if (top + th > window.innerHeight - pad) top = Math.max(pad, r.top - th - 8);
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.min(Math.max(pad, left), window.innerWidth - pad - tw);
      setPos({ top, left, ready: true });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [body, open, side, title]);

  return (
    <span
      ref={triggerRef}
      className="spire-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tipRef}
            className={`spire-tip__card spire-tip__card--float${pos.ready ? ' is-ready' : ''}`}
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            <strong>{title}</strong>
            <span>{body}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
