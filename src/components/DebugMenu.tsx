import { useState } from 'react';
import { ELITE_FOUR, GYM_LEADERS, ITEMS, WHEEL_SEGMENTS } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import type { WheelSegment } from '../types/game';

const MINI_GAMES: WheelSegment[] = WHEEL_SEGMENTS;

interface DebugMenuProps {
  onUberSpin?: () => void;
}

export function DebugMenu({ onUberSpin }: DebugMenuProps) {
  const startActivity = useGameStore((s) => s.startActivity);
  const startDebugLegendary = useGameStore((s) => s.startDebugLegendary);
  const setScreen = useGameStore((s) => s.setScreen);
  const setDebugGym = useGameStore((s) => s.setDebugGym);
  const setDebugEliteStage = useGameStore((s) => s.setDebugEliteStage);
  const addItem = useGameStore((s) => s.addItem);
  const addMoney = useGameStore((s) => s.addMoney);

  const [open, setOpen] = useState(false);

  function launchGym(id: string) {
    setDebugGym(id);
    setScreen('gym');
    setOpen(false);
  }

  function launchElite(stage: number) {
    setDebugEliteStage(stage);
    setScreen('elite');
    setOpen(false);
  }

  function launchMiniGame(segment: WheelSegment) {
    startActivity(segment);
    setOpen(false);
  }

  function launchLegendary() {
    startDebugLegendary();
    setOpen(false);
  }

  function launchUberSpin() {
    onUberSpin?.();
    setOpen(false);
  }

  function launchChampionScreen() {
    const store = useGameStore.getState();
    store.setEliteCleared(true);
    store.recordChampion();
    setScreen('champion');
    setOpen(false);
  }

  function launchGameOverScreen() {
    setScreen('gameover');
    setOpen(false);
  }

  function launchShop() {
    setScreen('shop');
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="debug-fab" onClick={() => setOpen((v) => !v)}>
        🐞 Debug
      </button>

      {open && (
        <div className="debug-panel">
          <div className="debug-panel__header">
            <strong>Debug Menu</strong>
            <button type="button" className="debug-panel__close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Mini-games</p>
            <div className="debug-panel__grid">
              {MINI_GAMES.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => launchMiniGame(segment)}
                >
                  {segment.icon} {segment.label}
                </button>
              ))}
              <button type="button" className="debug-panel__btn" onClick={launchLegendary}>
                ✨ Legendary Encounter
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchUberSpin}>
                🌀 Uber Spin
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Shop & Money</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={launchShop}>
                🏪 Visit Shop
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => addMoney(100)}>
                ¥ +100 Dollars
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Add Items</p>
            <div className="debug-panel__grid">
              {ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => addItem(item.id, 1)}
                >
                  {item.icon} +1 {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Gym Battles</p>
            <div className="debug-panel__grid">
              {GYM_LEADERS.map((leader) => (
                <button
                  key={leader.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => launchGym(leader.id)}
                >
                  {leader.name}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Elite Four / Champion</p>
            <div className="debug-panel__grid">
              {ELITE_FOUR.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => launchElite(index)}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">End Game</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={launchChampionScreen}>
                🏆 Champion Victory Screen
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchGameOverScreen}>
                💀 Game Over Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
