import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { hasActiveSpireRun, useSpireStore } from '../spire/store/useSpireStore';
import { playSfx } from '../utils/sound';
import { registerSettingsDebugClick } from '../utils/debugUnlock';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const muted = useGameStore((s) => s.muted);
  const setScreen = useGameStore((s) => s.setScreen);
  const showTypeEffectiveness = useGameStore((s) => s.showTypeEffectiveness);
  const setShowTypeEffectiveness = useGameStore((s) => s.setShowTypeEffectiveness);
  const screen = useGameStore((s) => s.screen);
  const abandonRun = useSpireStore((s) => s.abandonRun);
  const spireRun = useSpireStore((s) => s.run);
  const inSpire = screen === 'spire' && hasActiveSpireRun(spireRun);

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
          registerSettingsDebugClick();
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
          {inSpire && (
            <button
              type="button"
              className="settings-menu__item"
              role="menuitem"
              onClick={() => {
                playSfx('click', muted);
                setAbandonOpen(true);
              }}
            >
              Abandon run
            </button>
          )}
        </div>
      )}
      {abandonOpen && (
        <div className="spire-confirm" role="dialog" aria-label="Abandon run">
          <div className="spire-confirm__card">
            <h3>Abandon this climb?</h3>
            <p>The run will end. This cannot be undone.</p>
            <div className="spire-confirm__actions">
              <button type="button" className="btn" onClick={() => setAbandonOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  playSfx('click', muted);
                  abandonRun();
                  setAbandonOpen(false);
                  setOpen(false);
                }}
              >
                Abandon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
