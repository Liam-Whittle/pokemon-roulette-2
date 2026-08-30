import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveCard } from '../data/cards';
import type { CardInstance, CardKind } from '../types';
import { SpireCard } from './SpireCard';

const KIND_ORDER: Record<CardKind, number> = { attack: 0, skill: 1, power: 2 };
export const KIND_LABEL: Record<CardKind, string> = { attack: 'Attacks', skill: 'Skills', power: 'Powers' };

function sortDeck(cards: CardInstance[]): CardInstance[] {
  return [...cards].sort((a, b) => {
    const da = resolveCard(a);
    const db = resolveCard(b);
    if (KIND_ORDER[da.kind] !== KIND_ORDER[db.kind]) return KIND_ORDER[da.kind] - KIND_ORDER[db.kind];
    const ca = da.xCost ? 100 : da.cost;
    const cb = db.xCost ? 100 : db.cost;
    if (ca !== cb) return ca - cb;
    return da.name.localeCompare(db.name);
  });
}

export function groupDeck(cards: CardInstance[]): { kind: CardKind; cards: CardInstance[] }[] {
  const groups: Record<CardKind, CardInstance[]> = { attack: [], skill: [], power: [] };
  for (const card of sortDeck(cards)) {
    groups[resolveCard(card).kind].push(card);
  }
  return (['attack', 'skill', 'power'] as CardKind[])
    .map((kind) => ({ kind, cards: groups[kind] }))
    .filter((group) => group.cards.length > 0);
}

export function DeckModal({ cards, onClose }: { cards: CardInstance[]; onClose: () => void }) {
  const [previewUpgrades, setPreviewUpgrades] = useState(false);
  const groups = groupDeck(cards);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="spire-pile-modal spire-pile-modal--deck" role="presentation" onClick={onClose}>
      <div
        className="spire-pile-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spire-deck-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="spire-pile-modal__head">
          <div>
            <p className="spire-kicker">Deck</p>
            <h2 id="spire-deck-modal-title">
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </h2>
            <p className="spire-pile-modal__note">
              {previewUpgrades
                ? 'Showing upgraded versions. Cards already upgraded stay as they are.'
                : 'Your current climb deck.'}
            </p>
          </div>
          <div className="spire-pile-modal__actions">
            <button
              type="button"
              className={previewUpgrades ? 'btn btn--primary' : 'btn'}
              aria-pressed={previewUpgrades}
              onClick={() => setPreviewUpgrades((on) => !on)}
            >
              {previewUpgrades ? 'Show current' : 'Preview upgrades'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        {groups.length === 0 ? (
          <p className="spire-pile-modal__empty">Your deck is empty.</p>
        ) : (
          <div className="spire-deck-groups">
            {groups.map((group) => (
              <section key={group.kind} className="spire-deck-group">
                <h3 className="spire-deck-group__title">
                  {KIND_LABEL[group.kind]}
                  <span>{group.cards.length}</span>
                </h3>
                <div className="spire-card-grid">
                  {group.cards.map((card) => (
                    <SpireCard
                      key={card.instanceId}
                      card={card}
                      upgradePreview={previewUpgrades && !card.upgraded}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
