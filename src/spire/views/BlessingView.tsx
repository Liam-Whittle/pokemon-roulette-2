import { BLESSINGS } from '../data/characters';
import { playSfx } from '../../utils/sound';
import { useGameStore } from '../../store/useGameStore';
import { useSpireStore } from '../store/useSpireStore';
import { SpireCard } from '../components/SpireCard';

export function BlessingView() {
  const blessingIds = useSpireStore((s) => s.run?.blessingIds ?? []);
  const follow = useSpireStore((s) => s.run?.blessingFollowup ?? null);
  const deck = useSpireStore((s) => s.run?.deck ?? []);
  const chooseBlessing = useSpireStore((s) => s.chooseBlessing);
  const blessingPickCard = useSpireStore((s) => s.blessingPickCard);
  const muted = useGameStore((s) => s.muted);

  if (follow?.kind === 'train') {
    const upgradeStep = follow.step === 'upgrade';
    return (
      <div className="spire-view spire-view--story">
        <article className="spire-panel spire-story">
          <p className="spire-kicker">Intense Training</p>
          <header className="spire-view__header">
            <h2>{upgradeStep ? 'Upgrade a card' : 'Remove a card'}</h2>
            <p>
              {upgradeStep
                ? 'Choose one starter card to upgrade.'
                : 'Choose one card to remove from your deck.'}
            </p>
          </header>
          <div className="spire-card-row spire-card-row--pick">
            {deck
              .filter((card) => (upgradeStep ? !card.upgraded : true))
              .map((card) => (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  compact
                  onClick={() => {
                    playSfx('item', muted);
                    blessingPickCard(card.instanceId);
                  }}
                />
              ))}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="spire-view spire-view--story">
      <article className="spire-panel spire-story">
        <p className="spire-kicker">Lobby gift</p>
        <header className="spire-view__header">
          <h2>Professor Oak&apos;s Blessing</h2>
          <p>The tower attendant slides a tray across the desk — pick one gift before you ascend.</p>
        </header>
        <div className="spire-story__choices">
          {blessingIds.map((id, index) => {
            const def = BLESSINGS.find((b) => b.id === id);
            if (!def) return null;
            return (
              <button
                key={id}
                type="button"
                className="spire-story__choice"
                onClick={() => {
                  playSfx('item', muted);
                  chooseBlessing(id);
                }}
              >
                <span className="spire-story__num">{index + 1}</span>
                <span className="spire-story__copy">
                  <strong>{def.name}</strong>
                  <span>{def.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </article>
    </div>
  );
}
