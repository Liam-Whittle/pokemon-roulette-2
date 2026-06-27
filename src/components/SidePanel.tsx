import { useState, type ReactNode } from 'react';
import { useGameStore } from '../store/useGameStore';
import { TypeBadge } from './TypeBadge';
import { PokeDollarAmount } from './PokeDollar';
import { ItemIcon } from './ItemIcon';
import { EvolutionModal } from './EvolutionModal';
import { PokemonDetailModal } from './PokemonDetailModal';
import { ItemDetailModal } from './ItemDetailModal';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { currentHp, maxHpFor, isFainted } from '../utils/battle';
import { hasReducedPp } from '../data/moves';
import { playSfx } from '../utils/sound';
import type { BagItem, EvolutionInfo } from '../types/game';

interface SelectedMon {
  id: number;
  name: string;
  types: string[];
  powerLevel: number;
  shiny: boolean;
}

interface SidePanelProps {
  compact?: boolean;
  extra?: ReactNode;
  allowSwap?: boolean;
  allowItems?: boolean;
  /** Highlight the first party slot as the active battler. */
  highlightActive?: boolean;
  /** Called after a Potion is successfully used (battle uses this to spend the turn). */
  onPotionUsed?: () => void;
  /** Called after a Max Elixir is successfully used (battle uses this to spend the turn). */
  onElixirUsed?: () => void;
}

function PartyHpBar({ current, max }: { current: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const tone = ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low';
  return (
    <div className="side-panel__hp">
      <div className={`hp-bar hp-bar--party hp-bar--${tone}${ratio <= 0.2 && ratio > 0 ? ' hp-bar--pulse' : ''}`}>
        <div className="hp-bar__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="side-panel__hp-text">
        HP {Math.max(0, current)}/{max}
      </span>
    </div>
  );
}

export function SidePanel({
  compact = false,
  extra,
  allowSwap = true,
  allowItems = true,
  highlightActive = false,
  onPotionUsed,
  onElixirUsed,
}: SidePanelProps) {
  const party = useGameStore((state) => state.party);
  const pokedex = useGameStore((state) => state.pokedex);
  const bag = useGameStore((state) => state.bag);
  const badges = useGameStore((state) => state.badges);
  const money = useGameStore((state) => state.money);
  const muted = useGameStore((state) => state.muted);
  const activePanel = useGameStore((state) => state.activePanel);
  const setActivePanel = useGameStore((state) => state.setActivePanel);
  const triggerRareCandy = useGameStore((state) => state.useRareCandy);
  const swapPartyMember = useGameStore((state) => state.swapPartyMember);
  const swapPartyOrder = useGameStore((state) => state.swapPartyOrder);
  const usePotionOnMember = useGameStore((state) => state.usePotionOnMember);
  const useMaxElixirOnMember = useGameStore((state) => state.useMaxElixirOnMember);
  const pcExcluded = useGameStore((state) => state.pcExcluded);

  const [swappingFor, setSwappingFor] = useState<number | null>(null);
  const [evolution, setEvolution] = useState<EvolutionInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingCandy, setUsingCandy] = useState(false);
  const [selectedMon, setSelectedMon] = useState<SelectedMon | null>(null);
  const [selectedItem, setSelectedItem] = useState<BagItem | null>(null);

  const entries = Object.entries(pokedex)
    .map(([id, entry]) => ({ id: Number(id), ...entry }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rareCandy = bag.find((item) => item.id === 'rarecandy');
  const potionItem = bag.find((item) => item.id === 'potion');
  const potionCount = potionItem?.quantity ?? 0;
  const elixirItem = bag.find((item) => item.id === 'maxelixer');
  const elixirCount = elixirItem?.quantity ?? 0;

  const partyIds = new Set(party.map((member) => member.id));
  const excludedIds = new Set(pcExcluded);
  const caughtBox = Object.entries(pokedex)
    .filter(([id, entry]) => entry.caught && !partyIds.has(Number(id)) && !excludedIds.has(Number(id)))
    .map(([id, entry]) => ({ id: Number(id), ...entry }))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleUseRareCandy() {
    if (usingCandy) return;
    setUsingCandy(true);
    try {
      const result = await triggerRareCandy();
      if (result.evolution) {
        setEvolution(result.evolution);
      } else {
        setNotice(result.message);
      }
    } finally {
      setUsingCandy(false);
    }
  }

  function handleSwap(pokemonId: number) {
    if (swappingFor === null) return;
    swapPartyMember(swappingFor, pokemonId);
    setSwappingFor(null);
  }

  function handlePartyReorder(caughtAt: number) {
    if (swappingFor === null) return;
    swapPartyOrder(swappingFor, caughtAt);
    setSwappingFor(null);
  }

  function handlePotionHeal(caughtAt: number) {
    if (usePotionOnMember(caughtAt)) {
      playSfx('item', muted);
      onPotionUsed?.();
    }
  }

  function handleMaxElixir(caughtAt: number) {
    if (useMaxElixirOnMember(caughtAt)) {
      playSfx('item', muted);
      onElixirUsed?.();
    }
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
              party.map((pokemon, index) => {
                const max = maxHpFor(pokemon.powerLevel);
                const hp = currentHp(pokemon);
                const fainted = isFainted(pokemon);
                const fullHp = hp >= max;
                const ppDrained = hasReducedPp(pokemon.pp);
                const isActive = highlightActive && index === 0;
                return (
                <div
                  key={`${pokemon.id}-${pokemon.caughtAt}`}
                  className={`side-panel__card${fainted ? ' side-panel__card--fainted' : ''}${isActive ? ' side-panel__card--active' : ''}`}
                >
                  <img
                    src={
                      pokemon.shiny && pokemon.shinySprite ? pokemon.shinySprite : pokemon.sprite
                    }
                    alt={pokemon.displayName}
                    className="side-panel__sprite side-panel__sprite--clickable"
                    onClick={() =>
                      setSelectedMon({
                        id: pokemon.id,
                        name: pokemon.nickname ?? pokemon.displayName,
                        types: pokemon.types,
                        powerLevel: pokemon.powerLevel,
                        shiny: pokemon.shiny ?? false,
                      })
                    }
                    onError={(event) => {
                      (event.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                    }}
                  />
                  <div className="side-panel__card-body">
                    <strong>
                      {pokemon.shiny ? '✨ ' : ''}
                      {pokemon.nickname ?? pokemon.displayName}
                      {isActive && <span className="side-panel__active-tag">Active</span>}
                      {fainted && <span className="side-panel__faint-tag">Fainted</span>}
                    </strong>
                    <PartyHpBar current={hp} max={max} />
                    <span>Power {Math.round((Number.isFinite(pokemon.powerLevel) ? pokemon.powerLevel : 0.3) * 100)}</span>
                    <div className="side-panel__types">
                      {pokemon.types.map((type) => (
                        <TypeBadge key={type} type={type} size="sm" />
                      ))}
                    </div>
                  </div>
                  <div className="side-panel__card-actions">
                    <div className="side-panel__item-actions">
                      {allowItems && potionCount > 0 && !fainted && !fullHp && (
                        <button
                          type="button"
                          className="side-panel__potion-btn"
                          title="Use Potion (heal 50% max HP)"
                          onClick={() => handlePotionHeal(pokemon.caughtAt)}
                        >
                          <ItemIcon
                            id="potion"
                            icon={potionItem?.icon ?? '💊'}
                            name="Potion"
                            className="side-panel__potion-icon"
                          />
                        </button>
                      )}
                      {allowItems && elixirCount > 0 && !fainted && ppDrained && (
                        <button
                          type="button"
                          className="side-panel__potion-btn"
                          title="Use Max Elixir (restore all move PP)"
                          onClick={() => handleMaxElixir(pokemon.caughtAt)}
                        >
                          <ItemIcon
                            id="maxelixer"
                            icon={elixirItem?.icon ?? '🧪'}
                            name="Max Elixir"
                            className="side-panel__potion-icon"
                          />
                        </button>
                      )}
                    </div>
                    {allowSwap ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm side-panel__swap-btn"
                        onClick={() => setSwappingFor((current) => (current === pokemon.caughtAt ? null : pokemon.caughtAt))}
                      >
                        {swappingFor === pokemon.caughtAt ? 'Cancel' : 'Swap'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
              })
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
                    src={entry.caught && entry.shiny && entry.shinySprite ? entry.shinySprite : entry.sprite}
                    alt={entry.name}
                    className={`side-panel__sprite side-panel__sprite--small${entry.caught ? ' side-panel__sprite--clickable' : ''}`}
                    onClick={
                      entry.caught
                        ? () =>
                            setSelectedMon({
                              id: entry.id,
                              name: entry.name,
                              types: entry.types,
                              powerLevel: entry.powerLevel,
                              shiny: entry.shiny ?? false,
                            })
                        : undefined
                    }
                  />
                  <div className="side-panel__dex-info">
                    <strong className="side-panel__dex-name" title={entry.name}>
                      {entry.shiny ? '✨ ' : ''}
                      {entry.name}
                    </strong>
                    <span className="side-panel__dex-power">
                      Pwr {Math.round((Number.isFinite(entry.powerLevel) ? entry.powerLevel : 0.3) * 100)}
                    </span>
                  </div>
                  <span className={`side-panel__dex-status ${entry.caught ? 'side-panel__dex-status--caught' : ''}`}>
                    {entry.caught ? 'Caught' : 'Seen'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activePanel === 'bag' && (
          <div className="side-panel__list side-panel__list--bag">
            {bag.map((item) => (
              <div key={item.id} className="side-panel__card">
                <button
                  type="button"
                  className="side-panel__icon-btn"
                  onClick={() => setSelectedItem(item)}
                  title={`What does ${item.name} do?`}
                >
                  <ItemIcon id={item.id} icon={item.icon} name={item.name} className="side-panel__icon" />
                </button>
                <div className="side-panel__card-body">
                  <strong>{item.name}</strong>
                  <span>x{item.quantity}</span>
                </div>
                {item.id === 'rarecandy' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={handleUseRareCandy}
                    disabled={!allowItems || usingCandy}
                    title={allowItems ? undefined : "You can't use Rare Candy during battle."}
                  >
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

      <div className="side-panel__footer">
        <div className="side-panel__money">
          <PokeDollarAmount amount={money} />
        </div>
        {activePanel === 'party' && allowItems && rareCandy && rareCandy.quantity > 0 && (
          <button
            type="button"
            className="side-panel__quick-candy"
            onClick={handleUseRareCandy}
            disabled={usingCandy}
            title="Use Rare Candy"
          >
            <ItemIcon
              id={rareCandy.id}
              icon={rareCandy.icon}
              name={rareCandy.name}
              className="side-panel__quick-candy-icon"
            />
            <span className="side-panel__quick-candy-qty">x{rareCandy.quantity}</span>
          </button>
        )}
      </div>

      {evolution && <EvolutionModal evolution={evolution} onClose={() => setEvolution(null)} />}

      {selectedMon && (
        <PokemonDetailModal
          id={selectedMon.id}
          name={selectedMon.name}
          types={selectedMon.types}
          powerLevel={selectedMon.powerLevel}
          shiny={selectedMon.shiny}
          onClose={() => setSelectedMon(null)}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          id={selectedItem.id}
          name={selectedItem.name}
          icon={selectedItem.icon}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {notice && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            <p className="hub-notice-modal__text">{notice}</p>
            <button type="button" className="btn btn--primary" onClick={() => setNotice(null)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {allowSwap && swappingFor !== null && (() => {
        const target = party.find((m) => m.caughtAt === swappingFor);
        const otherParty = party.filter(
          (m) => m.caughtAt !== swappingFor && !isFainted(m),
        );
        return (
          <div className="battle-modal__backdrop" onClick={() => setSwappingFor(null)}>
            <div
              className="battle-modal side-panel__swap-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="battle-modal__title">
                Swap {target ? (target.nickname ?? target.displayName) : 'Pokémon'}
              </h3>

              <div className="side-panel__swap side-panel__swap--modal">
                {otherParty.length > 0 && (
                  <>
                    <p className="side-panel__swap-title">Reorder with party</p>
                    <div className="side-panel__swap-grid">
                      {otherParty.map((member) => (
                        <button
                          key={`party-${member.caughtAt}`}
                          type="button"
                          className="side-panel__swap-option"
                          onClick={() => handlePartyReorder(member.caughtAt)}
                        >
                          <img
                            src={member.shiny && member.shinySprite ? member.shinySprite : member.sprite}
                            alt={member.displayName}
                            onError={(event) => {
                              (event.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                            }}
                          />
                          <span>
                            {member.shiny ? '✨ ' : ''}
                            {member.nickname ?? member.displayName}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="side-panel__swap-title">Swap in from PC</p>
                {caughtBox.length === 0 ? (
                  <p className="side-panel__empty">No Pokémon stored in the PC.</p>
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
                          src={entry.shiny && entry.shinySprite ? entry.shinySprite : entry.sprite}
                          alt={entry.name}
                          onError={(event) => {
                            (event.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                          }}
                        />
                        <span>
                          {entry.shiny ? '✨ ' : ''}
                          {entry.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn btn--ghost side-panel__swap-cancel"
                onClick={() => setSwappingFor(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
    </aside>
  );
}
