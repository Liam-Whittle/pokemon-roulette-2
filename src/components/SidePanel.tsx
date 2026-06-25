import { useState, type ReactNode } from 'react';
import { useGameStore } from '../store/useGameStore';
import { TypeBadge } from './TypeBadge';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

interface SidePanelProps {
  compact?: boolean;
  extra?: ReactNode;
}

export function SidePanel({ compact = false, extra }: SidePanelProps) {
  const party = useGameStore((state) => state.party);
  const pokedex = useGameStore((state) => state.pokedex);
  const bag = useGameStore((state) => state.bag);
  const badges = useGameStore((state) => state.badges);
  const activePanel = useGameStore((state) => state.activePanel);
  const setActivePanel = useGameStore((state) => state.setActivePanel);
  const triggerRareCandy = useGameStore((state) => state.useRareCandy);
  const swapPartyMember = useGameStore((state) => state.swapPartyMember);
  const setLastResult = useGameStore((state) => state.setLastResult);

  const [swappingFor, setSwappingFor] = useState<number | null>(null);

  const entries = Object.values(pokedex).sort((a, b) => a.name.localeCompare(b.name));

  const partyIds = new Set(party.map((member) => member.id));
  const caughtBox = Object.entries(pokedex)
    .filter(([id, entry]) => entry.caught && !partyIds.has(Number(id)))
    .map(([id, entry]) => ({ id: Number(id), ...entry }))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleUseRareCandy() {
    const message = await triggerRareCandy();
    setLastResult({ type: 'item', success: true, message });
  }

  function handleSwap(pokemonId: number) {
    if (swappingFor === null) return;
    swapPartyMember(swappingFor, pokemonId);
    setSwappingFor(null);
  }

  return (
    <aside className={`side-panel ${compact ? 'side-panel--compact' : ''}`}>
      <div className="side-panel__tabs">
        {(['party', 'pokedex', 'bag'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`side-panel__tab ${activePanel === tab ? 'side-panel__tab--active' : ''}`}
            onClick={() => setActivePanel(tab)}
          >
            {tab === 'party' ? 'Party' : tab === 'pokedex' ? 'Pokedex' : 'Bag'}
          </button>
        ))}
      </div>

      <div className="side-panel__content">
        {activePanel === 'party' && (
          <div className="side-panel__list">
            {party.length === 0 ? (
              <p className="side-panel__empty">No party Pokemon yet.</p>
            ) : (
              party.map((pokemon) => (
                <div key={`${pokemon.id}-${pokemon.caughtAt}`} className="side-panel__card">
                  <img
                    src={pokemon.sprite}
                    alt={pokemon.displayName}
                    className="side-panel__sprite"
                    onError={(event) => {
                      (event.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                    }}
                  />
                  <div className="side-panel__card-body">
                    <strong>{pokemon.nickname ?? pokemon.displayName}</strong>
                    <span>Power {Math.round((Number.isFinite(pokemon.powerLevel) ? pokemon.powerLevel : 0.3) * 100)}</span>
                    <div className="side-panel__types">
                      {pokemon.types.map((type) => (
                        <TypeBadge key={type} type={type} size="sm" />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm side-panel__swap-btn"
                    onClick={() => setSwappingFor((current) => (current === pokemon.caughtAt ? null : pokemon.caughtAt))}
                  >
                    {swappingFor === pokemon.caughtAt ? 'Cancel' : 'Swap'}
                  </button>
                </div>
              ))
            )}

            {swappingFor !== null && (
              <div className="side-panel__swap">
                <p className="side-panel__swap-title">Choose a Pokémon to swap in</p>
                {caughtBox.length === 0 ? (
                  <p className="side-panel__empty">No other caught Pokémon available.</p>
                ) : (
                  <div className="side-panel__swap-grid">
                    {caughtBox.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="side-panel__swap-option"
                        onClick={() => handleSwap(entry.id)}
                      >
                        <img
                          src={entry.sprite}
                          alt={entry.name}
                          onError={(event) => {
                            (event.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                          }}
                        />
                        <span>{entry.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activePanel === 'pokedex' && (
          <div className="side-panel__dex">
            {entries.length === 0 ? (
              <p className="side-panel__empty">Nothing registered yet.</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.name} className="side-panel__dex-entry">
                  <img
                    src={entry.sprite}
                    alt={entry.name}
                    className="side-panel__sprite side-panel__sprite--small"
                  />
                  <strong className="side-panel__dex-name">{entry.name}</strong>
                  <span className="side-panel__dex-power">
                    Pwr {Math.round((Number.isFinite(entry.powerLevel) ? entry.powerLevel : 0.3) * 100)}
                  </span>
                  <span className={`side-panel__dex-status ${entry.caught ? 'side-panel__dex-status--caught' : ''}`}>
                    {entry.caught ? 'Caught' : 'Seen'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activePanel === 'bag' && (
          <div className="side-panel__list">
            {bag.map((item) => (
              <div key={item.id} className="side-panel__card">
                <span className="side-panel__icon">{item.icon}</span>
                <div className="side-panel__card-body">
                  <strong>{item.name}</strong>
                  <span>x{item.quantity}</span>
                </div>
                {item.id === 'rarecandy' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={handleUseRareCandy}>
                    Use
                  </button>
                )}
              </div>
            ))}
            <div className="side-panel__badges">
              <div className="side-panel__badges-head">
                <strong>Badges</strong>
                <span>{badges.length}/8</span>
              </div>
              {badges.length === 0 ? (
                <p className="side-panel__empty">No badges yet.</p>
              ) : (
                <div className="side-panel__badge-grid">
                  {badges.map((badge) =>
                    badge.image ? (
                      <img
                        key={badge.id}
                        src={badge.image}
                        alt={badge.name}
                        title={badge.name}
                        className="side-panel__badge-img"
                      />
                    ) : (
                      <span key={badge.id} className="side-panel__badge-emoji" title={badge.name}>
                        🏅
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {extra ? <div className="side-panel__extra">{extra}</div> : null}
    </aside>
  );
}
