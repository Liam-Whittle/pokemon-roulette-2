import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useGameStore } from '../store/useGameStore';
import { TypeBadge } from './TypeBadge';
import { PokeDollarAmount } from './PokeDollar';
import { ItemIcon } from './ItemIcon';
import { EvolutionModal } from './EvolutionModal';
import { EvolutionPickerModal, type EvolutionPickerOption } from './EvolutionPickerModal';
import { PokemonDetailModal } from './PokemonDetailModal';
import { ItemDetailModal } from './ItemDetailModal';
import { BattleEffectBadges, StageBadges, type StatStageValues } from './StatusBadge';
import type { BattleVolatiles } from '../data/battleVolatiles';
import { TYPE_COLORS } from '../data/typeChart';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { currentHp, maxHpForMon, isFainted, MAX_LEVEL } from '../utils/stats';
import { canEvolveNow, getAvailableEvolutions } from '../utils/evolution';
import { hasReducedPp } from '../data/moves';
import { getRegionTotalGyms, resolveBadgeImage, resolveRegionId } from '../data/pools';
import { MISSINGNO_ID, MISSINGNO_SPRITE } from '../data/missingno';
import { playSfx } from '../utils/sound';
import { imgFallback, remoteBadge } from '../utils/localAssets';
import type { BagItem, CatchBallId, EvolutionInfo, IVs, NatureId, StoredMove } from '../types/game';

export type ActiveHitFx = {
  mode: 'damage' | 'status' | 'buff';
  type: string;
  id: number;
};

const BALL_LABELS: Record<CatchBallId, string> = {
  pokeball: 'Poké Ball',
  greatball: 'Great Ball',
  ultraball: 'Ultra Ball',
  masterball: 'Master Ball',
};

interface SelectedMon {
  id: number;
  name: string;
  types: string[];
  shiny: boolean;
  caughtWithBall?: CatchBallId;
  level?: number;
  ivs?: IVs;
  evs?: IVs;
  nature?: NatureId;
  moves?: StoredMove[];
  pp?: Record<string, number>;
  ability?: string;
  gender?: import('../data/speciesGender').PokemonGender | null;
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
  /** When true, Full Heal is subject to the once-per-battle limit. */
  inBattle?: boolean;
  /** Called after a Full Heal is successfully used in battle (spends the turn). */
  onFullHealUsed?: () => void;
  /** Pickup/Harvest: first item used on this mon is not consumed. */
  shouldSkipItemConsume?: (caughtAt: number) => boolean;
  /** Unburden / pickup bookkeeping after an item is used on a mon. */
  onItemUsedOnMon?: (caughtAt: number) => void;
  /** Unnerve: Potion does not skip the turn. */
  shouldSkipPotionTurn?: (caughtAt: number) => boolean;
  /** Called after Honey is used (battle spends the turn unless Unnerve). */
  onHoneyUsed?: () => void;
  /** During battle: Swap only sends a bench Pokémon to the active slot (no PC). */
  battleSendOutOnly?: boolean;
  /** Called when the player confirms sending out a bench Pokémon during battle. */
  onBattleSendOut?: (caughtAt: number) => void;
  /** Battle-only volatiles on the active battler (confusion, trap, etc.). */
  activeBattlerVolatiles?: BattleVolatiles;
  /** Battle-only stat stage changes on the active battler (Atk/Def/etc.). */
  activeBattlerStages?: StatStageValues;
  /** Brief hit / buff FX overlaid on the active battler's sprite. */
  activeHitFx?: ActiveHitFx | null;
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
  inBattle = false,
  onFullHealUsed,
  shouldSkipItemConsume,
  onItemUsedOnMon,
  shouldSkipPotionTurn,
  onHoneyUsed,
  battleSendOutOnly = false,
  onBattleSendOut,
  activeBattlerVolatiles,
  activeBattlerStages,
  activeHitFx = null,
}: SidePanelProps) {
  const party = useGameStore((state) => state.party);
  const pokedex = useGameStore((state) => state.pokedex);
  const bag = useGameStore((state) => state.bag);
  const badges = useGameStore((state) => state.badges);
  const money = useGameStore((state) => state.money);
  const muted = useGameStore((state) => state.muted);
  const activePanel = useGameStore((state) => state.activePanel);
  const setActivePanel = useGameStore((state) => state.setActivePanel);
  const useRareCandyOnMember = useGameStore((state) => state.useRareCandyOnMember);
  const evolvePartyMember = useGameStore((state) => state.evolvePartyMember);
  const swapPartyMember = useGameStore((state) => state.swapPartyMember);
  const swapPartyOrder = useGameStore((state) => state.swapPartyOrder);
  const usePotionOnMember = useGameStore((state) => state.usePotionOnMember);
  const useHoneyOnMember = useGameStore((state) => state.useHoneyOnMember);
  const useMaxElixirOnMember = useGameStore((state) => state.useMaxElixirOnMember);
  const useFullHealAllParty = useGameStore((state) => state.useFullHealAllParty);
  const useHealPowderAllParty = useGameStore((state) => state.useHealPowderAllParty);
  const fullHealUsedInBattle = useGameStore((state) => state.fullHealUsedInBattle);
  const pcExcluded = useGameStore((state) => state.pcExcluded);
  const region = useGameStore((state) => resolveRegionId(state.trainer?.region));
  const ensurePartyInstanceFields = useGameStore((state) => state.ensurePartyInstanceFields);

  const [swappingFor, setSwappingFor] = useState<number | null>(null);
  const [evolution, setEvolution] = useState<EvolutionInfo | null>(null);
  const [evolutionPicker, setEvolutionPicker] = useState<{
    caughtAt: number;
    options: EvolutionPickerOption[];
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [evolving, setEvolving] = useState(false);
  const [selectedMon, setSelectedMon] = useState<SelectedMon | null>(null);
  const [selectedItem, setSelectedItem] = useState<BagItem | null>(null);

  useEffect(() => {
    ensurePartyInstanceFields();
  }, [ensurePartyInstanceFields]);

  const entries = Object.entries(pokedex)
    .map(([id, entry]) => ({ id: Number(id), ...entry }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rareCandy = bag.find((item) => item.id === 'rarecandy');
  const rareCandyCount = rareCandy?.quantity ?? 0;
  const potionItem = bag.find((item) => item.id === 'potion');
  const potionCount = potionItem?.quantity ?? 0;
  const honeyItem = bag.find((item) => item.id === 'honey');
  const honeyCount = honeyItem?.quantity ?? 0;
  const elixirItem = bag.find((item) => item.id === 'maxelixer');
  const elixirCount = elixirItem?.quantity ?? 0;
  const fullHealItem = bag.find((item) => item.id === 'fullheal');
  const fullHealCount = fullHealItem?.quantity ?? 0;
  const healPowderItem = bag.find((item) => item.id === 'healpowder');
  const healPowderCount = healPowderItem?.quantity ?? 0;
  const partyNeedsHeal = party.some(
    (member) => currentHp(member) < maxHpForMon(member),
  );
  const partyHasStatus = party.some((member) => !!member.status);
  const fullHealBlocked = (inBattle && fullHealUsedInBattle) || !partyNeedsHeal;

  const partyIds = new Set(party.map((member) => member.id));
  const excludedIds = new Set(pcExcluded);
  const caughtBox = Object.entries(pokedex)
    .filter(([id, entry]) => entry.caught && !partyIds.has(Number(id)) && !excludedIds.has(Number(id)))
    .map(([id, entry]) => ({ id: Number(id), ...entry }))
    .sort((a, b) => a.name.localeCompare(b.name));

  function itemOpts(caughtAt: number) {
    return { skipConsume: shouldSkipItemConsume?.(caughtAt) ?? false };
  }

  function handleRareCandyOnMember(caughtAt: number) {
    if (useRareCandyOnMember(caughtAt, itemOpts(caughtAt))) {
      playSfx('item', muted);
      onItemUsedOnMon?.(caughtAt);
    }
  }

  async function performEvolution(caughtAt: number, toId: number) {
    if (evolving) return;
    setEvolving(true);
    try {
      const result = await evolvePartyMember(caughtAt, toId);
      if (result.evolution) {
        setEvolution(result.evolution);
      } else {
        setNotice(result.message);
      }
    } finally {
      setEvolving(false);
    }
  }

  function handleEvolve(caughtAt: number) {
    if (evolving) return;
    const member = party.find((m) => m.caughtAt === caughtAt);
    if (!member) return;

    const available = getAvailableEvolutions(member.id, member.level, bag, {
      region,
      caughtAt: member.caughtAt,
    });
    if (available.length === 0) {
      setNotice(`${member.displayName} cannot evolve yet.`);
      return;
    }
    if (available.length === 1) {
      void performEvolution(caughtAt, available[0]!.toId);
      return;
    }

    setEvolutionPicker({
      caughtAt,
      options: available.map((option) => ({
        ...option,
        caughtAt,
        fromSpeciesId: member.id,
        fromName: member.nickname ?? member.displayName,
      })),
    });
  }

  function handleEvolutionPick(toId: number) {
    if (!evolutionPicker) return;
    const { caughtAt } = evolutionPicker;
    setEvolutionPicker(null);
    void performEvolution(caughtAt, toId);
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
    if (usePotionOnMember(caughtAt, itemOpts(caughtAt))) {
      playSfx('item', muted);
      onItemUsedOnMon?.(caughtAt);
      if (!shouldSkipPotionTurn?.(caughtAt)) onPotionUsed?.();
    }
  }

  function handleHoneyHeal(caughtAt: number) {
    if (useHoneyOnMember(caughtAt, itemOpts(caughtAt))) {
      playSfx('item', muted);
      onItemUsedOnMon?.(caughtAt);
      if (!shouldSkipPotionTurn?.(caughtAt)) onHoneyUsed?.();
    }
  }

  function handleMaxElixir(caughtAt: number) {
    if (useMaxElixirOnMember(caughtAt, itemOpts(caughtAt))) {
      playSfx('item', muted);
      onItemUsedOnMon?.(caughtAt);
      onElixirUsed?.();
    }
  }

  function handleFullHeal() {
    if (useFullHealAllParty(inBattle)) {
      playSfx('item', muted);
      onFullHealUsed?.();
    }
  }

  function handleHealPowder() {
    if (useHealPowderAllParty()) {
      playSfx('item', muted);
    }
  }

  function handleBattleSendOutConfirm() {
    if (swappingFor === null) return;
    onBattleSendOut?.(swappingFor);
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
              party.map((pokemon, index) => {
                const max = maxHpForMon(pokemon);
                const hp = currentHp(pokemon);
                const fainted = isFainted(pokemon);
                const fullHp = hp >= max;
                const ppDrained = hasReducedPp(pokemon.pp, pokemon.moves);
                const isActive = highlightActive && index === 0;
                const canEvolve = !inBattle && canEvolveNow(pokemon.id, pokemon.level, bag, {
                  region,
                  caughtAt: pokemon.caughtAt,
                });
                const canUseCandy =
                  allowItems && rareCandyCount > 0 && !fainted && pokemon.level < MAX_LEVEL;
                const showPotion = allowItems && potionCount > 0 && !fainted && !fullHp;
                const showHoney = allowItems && honeyCount > 0 && !fainted && !fullHp;
                const showElixir = allowItems && elixirCount > 0 && !fainted && ppDrained;
                const showSwap =
                  allowSwap &&
                  !pokemon.guestOwned &&
                  (!battleSendOutOnly || (index !== 0 && !fainted && !pokemon.guestLocked));
                const swapLabel = swappingFor === pokemon.caughtAt ? 'Cancel swap' : 'Swap Pokémon';
                return (
                <div
                  key={`${pokemon.id}-${pokemon.caughtAt}`}
                  className={`side-panel__card side-panel__card--party${fainted ? ' side-panel__card--fainted' : ''}${isActive ? ' side-panel__card--active' : ''}`}
                >
                  <div className="side-panel__sprite-wrap">
                    <BattleEffectBadges
                      status={pokemon.status}
                      volatiles={inBattle && isActive ? activeBattlerVolatiles : undefined}
                      placement="party"
                    />
                    {inBattle && isActive && (
                      <StageBadges stages={activeBattlerStages} placement="party" />
                    )}
                    {inBattle && isActive && activeHitFx && (
                      <span
                        key={`party-hit-${activeHitFx.id}`}
                        className={`battle-hit-fx battle-hit-fx--party battle-hit-fx--${activeHitFx.mode} battle-hit-fx--type-${activeHitFx.type}`}
                        style={
                          {
                            '--hit-color':
                              activeHitFx.mode === 'buff'
                                ? '#fbbf24'
                                : (TYPE_COLORS[activeHitFx.type] ?? TYPE_COLORS.normal),
                          } as CSSProperties
                        }
                        aria-hidden
                      >
                        <span className="battle-hit-fx__burst" />
                        <span className="battle-hit-fx__ring" />
                        <span className="battle-hit-fx__spark battle-hit-fx__spark--1" />
                        <span className="battle-hit-fx__spark battle-hit-fx__spark--2" />
                        <span className="battle-hit-fx__spark battle-hit-fx__spark--3" />
                        <span className="battle-hit-fx__spark battle-hit-fx__spark--4" />
                      </span>
                    )}
                    <img
                      src={
                        pokemon.shiny && pokemon.shinySprite ? pokemon.shinySprite : pokemon.sprite
                      }
                      alt={pokemon.displayName}
                      className={`side-panel__sprite side-panel__sprite--clickable${
                        pokemon.id === MISSINGNO_ID ? ' side-panel__sprite--missingno' : ''
                      }${
                        pokemon.id === MISSINGNO_ID && pokemon.shiny
                          ? ' side-panel__sprite--missingno-shiny'
                          : ''
                      }${
                        inBattle && isActive && activeHitFx?.mode === 'damage'
                          ? ' side-panel__sprite--hit-damage'
                          : ''
                      }${
                        inBattle && isActive && activeHitFx?.mode === 'status'
                          ? ' side-panel__sprite--hit-status'
                          : ''
                      }${
                        inBattle && isActive && activeHitFx?.mode === 'buff'
                          ? ' side-panel__sprite--hit-buff'
                          : ''
                      }`}
                      onClick={() =>
                        setSelectedMon({
                          id: pokemon.id,
                          name: pokemon.nickname ?? pokemon.displayName,
                          types: pokemon.types,
                          shiny: pokemon.shiny ?? false,
                          caughtWithBall: pokemon.caughtWithBall,
                          level: pokemon.level,
                          ivs: pokemon.ivs,
                          evs: pokemon.evs,
                          nature: pokemon.nature,
                          moves: pokemon.moves,
                          ability: pokemon.ability,
                          gender: pokemon.gender,
                        })
                      }
                      onError={(event) => {
                        (event.target as HTMLImageElement).src =
                          pokemon.id === MISSINGNO_ID ? MISSINGNO_SPRITE : PLACEHOLDER_SPRITE;
                      }}
                    />
                  </div>
                  <div className="side-panel__card-body">
                    <span className="side-panel__level">Lv. {pokemon.level}</span>
                    <strong>
                      {pokemon.shiny ? '✨ ' : ''}
                      {pokemon.guestOwned ? '★ ' : ''}
                      {pokemon.nickname ?? pokemon.displayName}
                      {pokemon.guestLocked && <span className="side-panel__guest-tag">Locked</span>}
                      {pokemon.guestOwned && !pokemon.guestLocked && (
                        <span className="side-panel__guest-tag">Friend</span>
                      )}
                      {isActive && <span className="side-panel__active-tag">Active</span>}
                      {fainted && <span className="side-panel__faint-tag">Fainted</span>}
                    </strong>
                    <PartyHpBar current={hp} max={max} />
                    <div className="side-panel__types-row">
                      <div className="side-panel__types">
                        {pokemon.types.map((type) => (
                          <TypeBadge key={type} type={type} size="sm" />
                        ))}
                      </div>
                      <div className="side-panel__swap-slot">
                        {showSwap ? (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm side-panel__swap-btn"
                            title={swapLabel}
                            aria-label={swapLabel}
                            onClick={() =>
                              setSwappingFor((current) =>
                                current === pokemon.caughtAt ? null : pokemon.caughtAt,
                              )
                            }
                          >
                            {swappingFor === pokemon.caughtAt ? 'Cancel' : 'Swap'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="side-panel__action-chips">
                      {canEvolve ? (
                          <button
                            type="button"
                            className="side-panel__action-chip side-panel__action-chip--evolve side-panel__action-chip--label"
                            title="Evolve this Pokémon"
                            aria-label="Evolve this Pokémon"
                            disabled={evolving}
                            onClick={() => handleEvolve(pokemon.caughtAt)}
                          >
                            Evolve
                          </button>
                        ) : null}
                        {showPotion ? (
                          <button
                            type="button"
                            className="side-panel__action-chip side-panel__action-chip--item"
                            title="Use Potion (heal 50% max HP)"
                            aria-label="Use Potion"
                            onClick={() => handlePotionHeal(pokemon.caughtAt)}
                          >
                            <ItemIcon
                              id="potion"
                              icon={potionItem?.icon ?? '💊'}
                              name="Potion"
                              className="side-panel__action-chip-icon"
                            />
                          </button>
                        ) : null}
                        {showHoney ? (
                          <button
                            type="button"
                            className="side-panel__action-chip side-panel__action-chip--item"
                            title="Use Honey (heal to full HP)"
                            aria-label="Use Honey"
                            onClick={() => handleHoneyHeal(pokemon.caughtAt)}
                          >
                            <ItemIcon
                              id="honey"
                              icon={honeyItem?.icon ?? '🍯'}
                              name="Honey"
                              className="side-panel__action-chip-icon"
                            />
                          </button>
                        ) : null}
                        {showElixir ? (
                          <button
                            type="button"
                            className="side-panel__action-chip side-panel__action-chip--item"
                            title="Use Max Elixir (restore all move PP)"
                            aria-label="Use Max Elixir"
                            onClick={() => handleMaxElixir(pokemon.caughtAt)}
                          >
                            <ItemIcon
                              id="maxelixer"
                              icon={elixirItem?.icon ?? '🧪'}
                              name="Max Elixir"
                              className="side-panel__action-chip-icon"
                            />
                          </button>
                        ) : null}
                        {canUseCandy ? (
                          <button
                            type="button"
                            className="side-panel__action-chip side-panel__action-chip--item"
                            title="Use Rare Candy (+1 level)"
                            aria-label="Use Rare Candy"
                            onClick={() => handleRareCandyOnMember(pokemon.caughtAt)}
                          >
                            <ItemIcon
                              id="rarecandy"
                              icon={rareCandy?.icon ?? '🍬'}
                              name="Rare Candy"
                              className="side-panel__action-chip-icon"
                            />
                          </button>
                        ) : null}
                    </div>
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
                              shiny: entry.shiny ?? false,
                              caughtWithBall: entry.caughtWithBall,
                              level: entry.level,
                            })
                        : undefined
                    }
                  />
                  <div className="side-panel__dex-info">
                    <strong className="side-panel__dex-name" title={entry.name}>
                      {entry.shiny ? '✨ ' : ''}
                      {entry.name}
                      {entry.caught && entry.caughtWithBall && (
                        <ItemIcon
                          id={entry.caughtWithBall}
                          icon="🔴"
                          name={BALL_LABELS[entry.caughtWithBall]}
                          className="side-panel__dex-ball"
                        />
                      )}
                    </strong>
                    <span className="side-panel__dex-power">
                      Lv. {entry.level}
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
            <div
              className={`side-panel__bag-items${bag.length > 6 ? ' side-panel__bag-items--scroll' : ''}`}
            >
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
                    <span className="side-panel-margfix">x{item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="side-panel__badges">
              <div className="side-panel__badges-head">
                <strong>Badges</strong>
                <span>{badges.length}/{getRegionTotalGyms(region)}</span>
              </div>
              {badges.length === 0 ? (
                <p className="side-panel__empty">No badges yet.</p>
              ) : (
                <div className="side-panel__badge-grid">
                  {badges.map((badge) => {
                    const badgeSrc = resolveBadgeImage(badge, region);
                    return badgeSrc ? (
                      <img
                        key={badge.id}
                        src={badgeSrc}
                        alt={badge.name}
                        title={badge.name}
                        className="side-panel__badge-img"
                        onError={(e) => {
                          const match = badgeSrc.match(/badges\/(\d+)\.png/);
                          const badgeNum = match ? Number(match[1]) : 0;
                          imgFallback(
                            e,
                            badgeNum > 0 ? remoteBadge(badgeNum) : undefined,
                            PLACEHOLDER_SPRITE,
                          );
                        }}
                      />
                    ) : (
                      <span key={badge.id} className="side-panel__badge-emoji" title={badge.name}>
                        🏅
                      </span>
                    );
                  })}
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
        <div className="side-panel__quick-items">
        {activePanel === 'party' && allowItems && healPowderCount > 0 && (
          <button
            type="button"
            className="side-panel__quick-heal"
            onClick={handleHealPowder}
            disabled={!partyHasStatus}
            title={
              !partyHasStatus
                ? 'No party Pokémon have a status condition'
                : 'Use Heal Powder (cure all party status)'
            }
          >
            <ItemIcon
              id="healpowder"
              icon={healPowderItem?.icon ?? '🌿'}
              name="Heal Powder"
              className="side-panel__quick-heal-icon"
            />
            <span className="side-panel__quick-heal-qty">x{healPowderCount}</span>
          </button>
        )}
        {activePanel === 'party' && allowItems && fullHealCount > 0 && (
          <button
            type="button"
            className="side-panel__quick-heal"
            onClick={handleFullHeal}
            disabled={fullHealBlocked}
            title={
              inBattle && fullHealUsedInBattle
                ? 'Already used a Full Heal this battle'
                : !partyNeedsHeal
                  ? 'Your party is already at full HP'
                  : 'Use Full Heal (restore all party HP)'
            }
          >
            <ItemIcon
              id="fullheal"
              icon={fullHealItem?.icon ?? '💚'}
              name="Full Heal"
              className="side-panel__quick-heal-icon"
            />
            <span className="side-panel__quick-heal-qty">x{fullHealCount}</span>
          </button>
        )}
        </div>
      </div>

      {evolution && <EvolutionModal evolution={evolution} onClose={() => setEvolution(null)} />}
      {evolutionPicker && (
        <EvolutionPickerModal
          options={evolutionPicker.options}
          onSelect={handleEvolutionPick}
          onCancel={() => setEvolutionPicker(null)}
        />
      )}

      {selectedMon && (
        <PokemonDetailModal
          id={selectedMon.id}
          name={selectedMon.name}
          types={selectedMon.types}
          shiny={selectedMon.shiny}
          caughtWithBall={selectedMon.caughtWithBall}
          level={selectedMon.level}
          ivs={selectedMon.ivs}
          evs={selectedMon.evs}
          nature={selectedMon.nature}
          moves={selectedMon.moves}
          pp={selectedMon.pp}
          ability={selectedMon.ability}
          gender={selectedMon.gender}
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

      {allowSwap && swappingFor !== null && battleSendOutOnly && (() => {
        const target = party.find((m) => m.caughtAt === swappingFor);
        if (!target || isFainted(target) || target.guestLocked) return null;
        return (
          <div className="battle-modal__backdrop" onClick={() => setSwappingFor(null)}>
            <div
              className="battle-modal side-panel__swap-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="battle-modal__title">
                Send out {target.nickname ?? target.displayName}?
              </h3>
              <p className="battle-modal__subtitle">You will use your turn to switch Pokémon.</p>
              <div className="side-panel__swap side-panel__swap--modal">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleBattleSendOutConfirm}
                >
                  Send out
                </button>
                <button
                  type="button"
                  className="btn btn--ghost side-panel__swap-cancel"
                  onClick={() => setSwappingFor(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {allowSwap && swappingFor !== null && !battleSendOutOnly && (() => {
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
