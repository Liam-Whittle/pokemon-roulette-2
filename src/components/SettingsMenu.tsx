import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const muted = useGameStore((s) => s.muted);
  const setScreen = useGameStore((s) => s.setScreen);
  const showTypeEffectiveness = useGameStore((s) => s.showTypeEffectiveness);
  const setShowTypeEffectiveness = useGameStore((s) => s.setShowTypeEffectiveness);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleExit = () => {
    playSfx('click', muted);
    setOpen(false);
    setScreen('title');
  };

  const handleToggleTags = () => {
    playSfx('click', muted);
    setShowTypeEffectiveness(!showTypeEffectiveness);
  };

  return (
    <div className="settings-menu" ref={containerRef}>
      <button
        type="button"
        className="settings-menu__toggle"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => {
          playSfx('click', muted);
          setOpen((v) => !v);
        }}
      >
        ⚙️
      </button>

      {open && (
        <div className="settings-menu__panel" role="menu">
          <button type="button" className="settings-menu__item" role="menuitem" onClick={handleExit}>
            Exit
          </button>
          <button
            type="button"
            className="settings-menu__item"
            role="menuitemcheckbox"
            aria-checked={!showTypeEffectiveness}
            onClick={handleToggleTags}
          >
            {showTypeEffectiveness ? 'Turn off type effective tags' : 'Turn on type effective tags'}
          </button>
        </div>
      )}
    </div>
  );
}
