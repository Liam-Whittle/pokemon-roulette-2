import { createPortal } from 'react-dom';
import { getPotionDef } from '../data/potions';
import { findRelicDef } from '../data/relics';
import { playSfx } from '../../utils/sound';
import { useGameStore } from '../../store/useGameStore';
import { useSpireStore } from '../store/useSpireStore';
import type { AcquireItem } from '../types';
import { RelicIcon } from './SpireHud';
import { SpireCard } from './SpireCard';

function itemKey(item: AcquireItem, index: number): string {
  if (item.type === 'card') return `card-${item.card.instanceId}`;
  return `${item.type}-${item.id}-${index}`;
}

function AcquireRelic({ id }: { id: string }) {
  const def = findRelicDef(id);
  if (!def) return null;
  return (
    <div className="spire-acquire-item spire-acquire-item--relic">
      <span className="spire-acquire-item__icon" aria-hidden="true">
        <RelicIcon id={id} name={def.name} />
      </span>
      <p className="spire-kicker">Relic</p>
      <h3>{def.name}</h3>
      <p>{def.description}</p>
    </div>
  );
}

function AcquirePotion({ id }: { id: string }) {
  const def = getPotionDef(id);
  return (
    <div className="spire-acquire-item spire-acquire-item--potion">
      <p className="spire-kicker">Potion</p>
      <h3>{def.name}</h3>
      <p>{def.description}</p>
    </div>
  );
}

export function AcquireModal() {
  const items = useSpireStore((s) => s.run?.pendingAcquire ?? null);
  const ackAcquire = useSpireStore((s) => s.ackAcquire);
  const muted = useGameStore((s) => s.muted);

  if (!items?.length) return null;

  return createPortal(
    <div
      className="spire-pile-modal spire-acquire-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spire-acquire-title"
    >
      <div className="spire-pile-modal__panel spire-acquire-modal__panel">
        <header className="spire-acquire-modal__head">
          <p className="spire-kicker">Obtained</p>
          <h2 id="spire-acquire-title">{items.length === 1 ? 'You acquired' : 'You acquired these'}</h2>
        </header>
        <div className="spire-acquire-modal__items">
          {items.map((item, index) => {
            if (item.type === 'card') {
              return <SpireCard key={itemKey(item, index)} card={item.card} />;
            }
            if (item.type === 'relic') {
              return <AcquireRelic key={itemKey(item, index)} id={item.id} />;
            }
            return <AcquirePotion key={itemKey(item, index)} id={item.id} />;
          })}
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            playSfx('click', muted);
            ackAcquire();
          }}
        >
          Continue
        </button>
      </div>
    </div>,
    document.body,
  );
}
