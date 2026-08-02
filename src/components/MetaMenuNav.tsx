import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import type { Screen } from '../types/game';

const TABS: { screen: Screen; label: string; dailyOnly?: boolean }[] = [
  { screen: 'prestige', label: 'Prestige Shop' },
  { screen: 'global-pokedex', label: 'Global Pokédex' },
  { screen: 'daily', label: 'Daily Encounter', dailyOnly: true },
];

interface MetaMenuNavProps {
  current: 'prestige' | 'global-pokedex' | 'daily';
}

export function MetaMenuNav({ current }: MetaMenuNavProps) {
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const hasDaily = useGameStore(
    (s) => s.ownedUnlocks.includes('hundredPercenter') && s.hundredPercenterEnabled,
  );

  return (
    <nav className="meta-menu-nav" aria-label="Meta menus">
      {TABS.filter((tab) => !tab.dailyOnly || hasDaily).map((tab) => {
        const active = tab.screen === current;
        return (
          <button
            key={tab.screen}
            type="button"
            className={`meta-menu-nav__tab ${active ? 'meta-menu-nav__tab--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            disabled={active}
            onClick={() => {
              if (active) return;
              playSfx('click', muted);
              setScreen(tab.screen);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
