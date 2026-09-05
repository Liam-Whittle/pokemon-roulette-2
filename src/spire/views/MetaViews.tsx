import { useState } from 'react';
import { getCardDef } from '../data/cards';
import { getEventDef } from '../data/events';
import { getPotionDef } from '../data/potions';
import { findRelicDef, getRelicDef, relicHasHook } from '../data/relics';
import { DeckModal } from '../components/DeckModal';
import { RelicIcon } from '../components/SpireHud';
import { SpireCard } from '../components/SpireCard';
import { cardPrice, relicPrice, restHealBonus } from '../engine/rewards';
import { rewardsReady, useSpireStore } from '../store/useSpireStore';
import type { CardInstance } from '../types';
import { playSfx } from '../../utils/sound';
import { useGameStore } from '../../store/useGameStore';

function RelicOfferButton({
  id,
  action,
  onClick,
}: {
  id: string;
  action?: string;
  onClick: () => void;
}) {
  const def = findRelicDef(id);
  if (!def) return null;
  return (
    <button type="button" className="spire-relic-offer" onClick={onClick}>
      <span className="spire-relic-offer__icon" aria-hidden="true">
        <RelicIcon id={id} name={def.name} />
      </span>
      <span className="spire-relic-offer__copy">
        <strong>
          {action ? `${action} ${def.name}` : def.name}
        </strong>
        <span>{def.description}</span>
      </span>
    </button>
  );
}

export function RewardsView() {
  const run = useSpireStore((s) => s.run);
  const pickCardReward = useSpireStore((s) => s.pickCardReward);
  const skipCardReward = useSpireStore((s) => s.skipCardReward);
  const takeRelicReward = useSpireStore((s) => s.takeRelicReward);
  const skipRelicReward = useSpireStore((s) => s.skipRelicReward);
  const takePotionReward = useSpireStore((s) => s.takePotionReward);
  const skipPotionReward = useSpireStore((s) => s.skipPotionReward);
  const continueRewards = useSpireStore((s) => s.continueRewards);
  const muted = useGameStore((s) => s.muted);
  const offer = run?.pendingRewards;
  const [previewUpgrades, setPreviewUpgrades] = useState(false);

  if (!run || !offer) return null;

  const ready = rewardsReady(run);
  const showCards = !offer.cardPicked && offer.cards.length > 0;
  const showRelic = offer.cardPicked && !offer.relicTaken && !!offer.relicId;
  const showPotion = offer.cardPicked && offer.relicTaken && !offer.potionTaken && !!offer.potionId;

  return (
    <div className="spire-view spire-view--rewards">
      <div className="spire-rewards">
        <header className="spire-rewards__head">
          <p className="spire-kicker">Spoils of battle</p>
          <h2>Rewards</h2>
          <p className="spire-rewards-gold">
            You pocketed <span>¥{offer.gold}</span>
          </p>
        </header>

        {showCards && (
          <section className="spire-rewards__stage">
            <p className="spire-reward-stage__title">Choose 1 card to add to your deck</p>
            <div className="spire-card-row spire-card-row--pick">
              {offer.cards.map((card) => (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  upgradePreview={previewUpgrades && !card.upgraded}
                  onClick={() => {
                    playSfx('item', muted);
                    pickCardReward(card.instanceId);
                  }}
                />
              ))}
            </div>
            <div className="spire-rewards__actions">
              <button
                type="button"
                className={previewUpgrades ? 'btn btn--primary' : 'btn'}
                aria-pressed={previewUpgrades}
                onClick={() => {
                  playSfx('click', muted);
                  setPreviewUpgrades((on) => !on);
                }}
              >
                {previewUpgrades ? 'Show current' : 'Preview upgrades'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => skipCardReward()}>
                Skip card
              </button>
            </div>
          </section>
        )}

        {showRelic && offer.relicId && (
          <RewardTake
            kind="Relic"
            id={offer.relicId}
            takeLabel="Take relic"
            onTake={() => {
              playSfx('item', muted);
              takeRelicReward();
            }}
            onSkip={skipRelicReward}
          />
        )}

        {showPotion && offer.potionId && (
          <RewardTake
            kind="Potion"
            id={offer.potionId}
            takeLabel="Take potion"
            onTake={() => takePotionReward()}
            onSkip={skipPotionReward}
          />
        )}

        {ready && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              playSfx('click', muted);
              continueRewards();
            }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function RewardTake({
  kind,
  id,
  takeLabel,
  onTake,
  onSkip,
}: {
  kind: 'Relic' | 'Potion';
  id: string;
  takeLabel: string;
  onTake: () => void;
  onSkip: () => void;
}) {
  const relic = kind === 'Relic' ? getRelicDef(id) : null;
  const potion = kind === 'Potion' ? getPotionDef(id) : null;
  const name = relic?.name ?? potion?.name ?? '';
  const description = relic?.description ?? potion?.description ?? '';
  return (
    <section className="spire-rewards__stage spire-rewards__stage--item">
      <p className="spire-kicker">{kind}</p>
      {relic && (
        <span className="spire-rewards__icon" aria-hidden="true">
          <RelicIcon id={id} name={relic.name} />
        </span>
      )}
      <h3>{name}</h3>
      <p>{description}</p>
      <div className="spire-rewards__actions">
        <button type="button" className="btn btn--primary" onClick={onTake}>
          {takeLabel}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
    </section>
  );
}

function RelicChoice({ id, onTake, onSkip }: { id: string; onTake: () => void; onSkip: () => void }) {
  return <RewardTake kind="Relic" id={id} takeLabel="Take relic" onTake={onTake} onSkip={onSkip} />;
}

export function TreasureView() {
  const run = useSpireStore((s) => s.run);
  const takeTreasure = useSpireStore((s) => s.takeTreasure);
  const skipTreasure = useSpireStore((s) => s.skipTreasure);
  const muted = useGameStore((s) => s.muted);
  const relicId = run?.pendingRewards?.relicId;

  return (
    <div className="spire-view spire-view--story">
      <header className="spire-panel spire-panel--title">
        <p className="spire-kicker">Held item</p>
        <h2>Treasure chest</h2>
        <p>A held item glints inside a tower locker.</p>
      </header>
      {relicId ? (
        <RelicChoice
          id={relicId}
          onTake={() => {
            playSfx('item', muted);
            takeTreasure();
          }}
          onSkip={() => {
            playSfx('click', muted);
            skipTreasure();
          }}
        />
      ) : (
        <button type="button" className="btn btn--primary" onClick={() => skipTreasure()}>
          Empty… continue
        </button>
      )}
    </div>
  );
}

export function ShopView() {
  const run = useSpireStore((s) => s.run);
  const buyCard = useSpireStore((s) => s.buyCard);
  const buyRelic = useSpireStore((s) => s.buyRelic);
  const buyPotion = useSpireStore((s) => s.buyPotion);
  const removeCard = useSpireStore((s) => s.removeCard);
  const leaveShop = useSpireStore((s) => s.leaveShop);
  const muted = useGameStore((s) => s.muted);
  const stock = run?.shopStock;
  const [previewUpgrades, setPreviewUpgrades] = useState(false);
  if (!run || !stock) return null;

  return (
    <div className="spire-view spire-view--shop">
      <header className="spire-shop-hud">
        <div>
          <p className="spire-kicker">Tower shop</p>
          <h2>Poké Mart</h2>
        </div>
        <span className="spire-gold">¥{run.gold}</span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            playSfx('click', muted);
            leaveShop();
          }}
        >
          Leave
        </button>
      </header>

      <div className="spire-shop-grid">
        <section className="spire-shop-shelf">
          <div className="spire-shop-shelf__head">
            <h3>Moves</h3>
            <button
              type="button"
              className={previewUpgrades ? 'btn btn--primary btn--sm' : 'btn btn--sm'}
              aria-pressed={previewUpgrades}
              onClick={() => {
                playSfx('click', muted);
                setPreviewUpgrades((on) => !on);
              }}
            >
              {previewUpgrades ? 'Show current' : 'Preview upgrades'}
            </button>
          </div>
          <div className="spire-card-row spire-card-row--shop">
            {stock.cards.map((card) => {
              const price = cardPrice(getCardDef(card.defId).rarity);
              return (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  price={price}
                  upgradePreview={previewUpgrades && !card.upgraded}
                  disabled={run.gold < price}
                  onClick={() => {
                    playSfx('item', muted);
                    buyCard(card.instanceId);
                  }}
                />
              );
            })}
          </div>
        </section>

        <div className="spire-shop-side">
          <section className="spire-shop-shelf">
            <h3>Relics</h3>
            <div className="spire-shop-list">
              {stock.relics.map((id) => {
                const def = getRelicDef(id);
                const price = relicPrice(def.rarity);
                return (
                  <button
                    key={id}
                    type="button"
                    className="spire-shop-row"
                    disabled={run.gold < price}
                    onClick={() => {
                      playSfx('item', muted);
                      buyRelic(id);
                    }}
                  >
                    <span>
                      <strong>{def.name}</strong>
                      <span>{def.description}</span>
                    </span>
                    <em>¥{price}</em>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="spire-shop-shelf">
            <h3>Potions</h3>
            <div className="spire-shop-list">
              {stock.potions.map((id) => {
                const def = getPotionDef(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="spire-shop-row"
                    disabled={run.gold < 50 || !run.potions.includes(null)}
                    onClick={() => {
                      playSfx('item', muted);
                      buyPotion(id);
                    }}
                  >
                    <span>
                      <strong>{def.name}</strong>
                      <span>{def.description}</span>
                    </span>
                    <em>¥50</em>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {!stock.removed && (
        <section className="spire-shop-shelf spire-shop-shelf--remove">
          <h3>Card removal — ¥{stock.removalCost}</h3>
          <div className="spire-card-row">
            {run.deck.map((card) => (
              <SpireCard
                key={card.instanceId}
                card={card}
                compact
                disabled={run.gold < stock.removalCost || run.deck.length <= 5}
                onClick={() => removeCard(card.instanceId)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SmithCompare({ card }: { card: CardInstance }) {
  return (
    <div className="spire-smith-compare">
      <div className="spire-smith-compare__col">
        <p className="spire-kicker">Before</p>
        <SpireCard card={{ ...card, upgraded: false }} />
      </div>
      <span className="spire-smith-compare__arrow" aria-hidden="true">
        →
      </span>
      <div className="spire-smith-compare__col spire-smith-compare__col--after">
        <p className="spire-kicker">After</p>
        <SpireCard card={{ ...card, upgraded: true }} />
      </div>
    </div>
  );
}

export function RestView() {
  const run = useSpireStore((s) => s.run);
  const restHeal = useSpireStore((s) => s.restHeal);
  const restSmith = useSpireStore((s) => s.restSmith);
  const restTrainDex = useSpireStore((s) => s.restTrainDex);
  const restTrainStr = useSpireStore((s) => s.restTrainStr);
  const restBeginTrade = useSpireStore((s) => s.restBeginTrade);
  const restPickTrade = useSpireStore((s) => s.restPickTrade);
  const restCancelTrade = useSpireStore((s) => s.restCancelTrade);
  const leaveRest = useSpireStore((s) => s.leaveRest);
  const muted = useGameStore((s) => s.muted);
  const [previewUpgrades, setPreviewUpgrades] = useState(false);
  const [pendingSmithId, setPendingSmithId] = useState<string | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [tradePickerOpen, setTradePickerOpen] = useState(false);
  if (!run) return null;
  const healAmt = Math.floor(run.maxHp * 0.3) + restHealBonus(run.relics);
  const smithed = run.smithedCardId
    ? run.deck.find((card) => card.instanceId === run.smithedCardId)
    : undefined;
  const pending = pendingSmithId
    ? run.deck.find((card) => card.instanceId === pendingSmithId)
    : undefined;
  const many = relicHasHook(run.relics, 'restAny');
  const canTrainDex =
    relicHasHook(run.relics, 'restPermDex') && !run.restDexUsed && run.evioliteUses < 3;
  const canTrainStr =
    relicHasHook(run.relics, 'restPermStr') && !run.restStrUsed && run.megaStoneUses < 3;
  const canTrade = relicHasHook(run.relics, 'restTrade');
  const tradeable = run.relics.filter((id) => !findRelicDef(id)?.starter);

  if (smithed) {
    return (
      <div className="spire-view spire-view--story spire-view--rest">
        <header className="spire-panel spire-panel--title">
          <p className="spire-kicker">Smith</p>
          <h2>Move upgraded</h2>
          <p>The old version on the left, the polished move on the right.</p>
        </header>
        <SmithCompare card={smithed} />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            playSfx('click', muted);
            leaveRest();
          }}
        >
          {many ? 'Back' : 'Continue'}
        </button>
      </div>
    );
  }

  if (pending && !pending.upgraded) {
    return (
      <div className="spire-view spire-view--story spire-view--rest">
        <header className="spire-panel spire-panel--title">
          <p className="spire-kicker">Smith</p>
          <h2>Upgrade this move?</h2>
          <p>Preview the upgraded version on the right. Confirm to smith it, or cancel to pick another.</p>
        </header>
        <SmithCompare card={pending} />
        <div className="spire-smith-compare__actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              playSfx('click', muted);
              setPendingSmithId(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              playSfx('buff', muted);
              restSmith(pending.instanceId);
              setPendingSmithId(null);
            }}
          >
            Upgrade
          </button>
        </div>
      </div>
    );
  }

  if (run.restTrade) {
    return (
      <div className="spire-view spire-view--story spire-view--rest">
        <article className="spire-panel spire-story">
          <p className="spire-kicker">Pokémon Center</p>
          <header className="spire-view__header">
            <h2>Pick a relic</h2>
            <p>
              You offered {findRelicDef(run.restTrade.givingId)?.name ?? 'a relic'}. Choose one of
              these three.
            </p>
          </header>
          <div className="spire-event-followup">
            <div className="spire-relic-offers">
              {run.restTrade.choices.map((id) => (
                <RelicOfferButton
                  key={id}
                  id={id}
                  onClick={() => {
                    playSfx('item', muted);
                    restPickTrade(id);
                    setTradePickerOpen(false);
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                playSfx('click', muted);
                restCancelTrade();
                setTradePickerOpen(true);
              }}
            >
              Back
            </button>
          </div>
        </article>
      </div>
    );
  }

  if (tradePickerOpen) {
    return (
      <div className="spire-view spire-view--story spire-view--rest">
        <article className="spire-panel spire-story">
          <p className="spire-kicker">Pokémon Center</p>
          <header className="spire-view__header">
            <h2>Trade a relic</h2>
            <p>Give up one relic for a choice of 1 of 3. Starters cannot be traded.</p>
          </header>
          <div className="spire-event-followup">
            <div className="spire-relic-offers">
              {tradeable.map((id) => (
                <RelicOfferButton
                  key={id}
                  id={id}
                  action="Trade"
                  onClick={() => {
                    playSfx('click', muted);
                    restBeginTrade(id);
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                playSfx('click', muted);
                setTradePickerOpen(false);
              }}
            >
              Back
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="spire-view spire-view--pokecenter">
      <header className="spire-panel spire-panel--title spire-rest-hero">
        <p className="spire-kicker">Nurse</p>
        <h2>Pokémon Center</h2>
        <p>
          {many
            ? 'Choice Scarf: use as many options as you like, then leave.'
            : 'Rest and recover, or pick one other option.'}
        </p>
      </header>
      <div className="spire-rest-services">
        <button
          type="button"
          className="btn btn--primary"
          disabled={run.restHealUsed}
          onClick={() => {
            playSfx('item', muted);
            restHeal();
          }}
        >
          Heal {healAmt} HP
        </button>
        {canTrainDex && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              playSfx('buff', muted);
              restTrainDex();
            }}
          >
            +1 Dexterity forever ({3 - run.evioliteUses} left)
          </button>
        )}
        {canTrainStr && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              playSfx('buff', muted);
              restTrainStr();
            }}
          >
            +1 Strength forever ({3 - run.megaStoneUses} left)
          </button>
        )}
        {canTrade && tradeable.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              playSfx('click', muted);
              setTradePickerOpen(true);
            }}
          >
            Trade a relic
          </button>
        )}
      </div>
      <section className="spire-rest-smith">
        <div className="spire-rest-smith__bar">
          <div>
            <h3>Smith a card</h3>
            <p>
              {previewUpgrades
                ? 'Showing upgraded versions. Tap a card to confirm the smith.'
                : 'Tap a card to preview the upgrade before you smith it.'}
            </p>
          </div>
          <button
            type="button"
            className={previewUpgrades ? 'btn btn--primary' : 'btn'}
            aria-pressed={previewUpgrades}
            onClick={() => setPreviewUpgrades((on) => !on)}
          >
            {previewUpgrades ? 'Show current' : 'Preview upgrades'}
          </button>
        </div>
        {run.deck.filter((c) => !c.upgraded).length === 0 ? (
          <p className="spire-rest-smith__empty">Every card in your deck is already upgraded.</p>
        ) : (
          <div className="spire-card-grid">
            {run.deck
              .filter((c) => !c.upgraded)
              .map((card) => (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  disabled={run.smithUsed}
                  upgradePreview={previewUpgrades}
                  onClick={() => {
                    if (run.smithUsed) return;
                    playSfx('click', muted);
                    setPendingSmithId(card.instanceId);
                  }}
                />
              ))}
          </div>
        )}
      </section>
      <footer className="spire-rest-foot">
        <button
          type="button"
          className="btn"
          onClick={() => {
            playSfx('click', muted);
            setDeckOpen(true);
          }}
        >
          Deck ({run.deck.length})
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            playSfx('click', muted);
            leaveRest();
          }}
        >
          Leave
        </button>
      </footer>
      {deckOpen && <DeckModal cards={run.deck} onClose={() => setDeckOpen(false)} />}
    </div>
  );
}

export function EventView() {
  const run = useSpireStore((s) => s.run);
  const resolveEvent = useSpireStore((s) => s.resolveEvent);
  const eventSelectOfferCard = useSpireStore((s) => s.eventSelectOfferCard);
  const eventConfirmOffer = useSpireStore((s) => s.eventConfirmOffer);
  const eventSelectRemoveCard = useSpireStore((s) => s.eventSelectRemoveCard);
  const eventConfirmRemove = useSpireStore((s) => s.eventConfirmRemove);
  const eventTradeRelic = useSpireStore((s) => s.eventTradeRelic);
  const eventAck = useSpireStore((s) => s.eventAck);
  const muted = useGameStore((s) => s.muted);
  const [previewUpgrades, setPreviewUpgrades] = useState(false);
  if (!run?.currentEventId) return null;
  const event = getEventDef(run.currentEventId);
  const follow = run.eventFollowup;
  const tradeable = run.relics.filter((id) => !findRelicDef(id)?.starter);

  return (
    <div className="spire-view spire-view--story spire-view--event">
      <article className="spire-panel spire-story">
        <p className="spire-kicker">
          A fork in the path · {run.hp}/{run.maxHp} HP · ¥{run.gold}
        </p>
        <header className="spire-view__header">
          <h2>{event.name}</h2>
          <p>{event.text}</p>
        </header>

        {!follow && (
          <div className="spire-story__choices">
            {event.choices.map((choice, i) => (
              <button
                key={choice.label}
                type="button"
                className="spire-story__choice"
                onClick={() => {
                  playSfx('click', muted);
                  resolveEvent(i);
                }}
              >
                <span className="spire-story__num">{i + 1}</span>
                <span className="spire-story__copy">
                  <strong>{choice.label}</strong>
                  <span>{choice.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {follow?.kind === 'message' && (
          <div className="spire-event-followup">
            <h3>{follow.title}</h3>
            <p>{follow.body}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                playSfx('click', muted);
                eventAck();
              }}
            >
              Continue
            </button>
          </div>
        )}

        {follow?.kind === 'chooseCards' && (
          <div className="spire-event-followup">
            <h3>
              {follow.pick === 1
                ? 'Choose a card'
                : `Choose ${follow.pick} cards (${follow.selected.length}/${follow.pick})`}
            </h3>
            <div className="spire-card-row spire-card-row--pick">
              {follow.cards.map((card) => (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  compact={follow.cards.length > 5}
                  selected={follow.selected.includes(card.instanceId)}
                  upgradePreview={previewUpgrades && !card.upgraded}
                  onClick={() => {
                    playSfx('click', muted);
                    eventSelectOfferCard(card.instanceId);
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className={previewUpgrades ? 'btn btn--primary btn--sm' : 'btn btn--sm'}
              aria-pressed={previewUpgrades}
              onClick={() => {
                playSfx('click', muted);
                setPreviewUpgrades((on) => !on);
              }}
            >
              {previewUpgrades ? 'Show current' : 'Preview upgrades'}
            </button>
            {follow.pick > 1 && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={follow.selected.length !== follow.pick}
                onClick={() => {
                  playSfx('item', muted);
                  eventConfirmOffer();
                }}
              >
                Add selected
              </button>
            )}
          </div>
        )}

        {follow?.kind === 'removeCards' && (
          <div className="spire-event-followup">
            <h3>
              {follow.pick === 1
                ? 'Remove a card'
                : `Remove ${follow.pick} cards (${follow.selected.length}/${follow.pick})`}
            </h3>
            <div className="spire-card-row spire-card-row--pick">
              {run.deck.map((card) => (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  compact
                  selected={follow.selected.includes(card.instanceId)}
                  onClick={() => {
                    playSfx('click', muted);
                    eventSelectRemoveCard(card.instanceId);
                  }}
                />
              ))}
            </div>
            {follow.pick > 1 && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={follow.selected.length !== follow.pick}
                onClick={() => {
                  playSfx('item', muted);
                  eventConfirmRemove();
                }}
              >
                Remove selected
              </button>
            )}
          </div>
        )}

        {follow?.kind === 'lootReveal' && (
          <div className="spire-event-followup">
            <h3>You obtained</h3>
            <div className="spire-relic-offers">
              {follow.items.map((item) => (
                <div key={`${item.type}-${item.id}`} className="spire-relic-offer">
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                playSfx('click', muted);
                eventAck();
              }}
            >
              Continue
            </button>
          </div>
        )}

        {follow?.kind === 'tradeRelic' && (
          <div className="spire-event-followup">
            <h3>Trade a relic</h3>
            <p>Give up one relic for a random new one. Starters cannot be traded.</p>
            <div className="spire-relic-offers">
              {tradeable.map((id) => (
                <RelicOfferButton
                  key={id}
                  id={id}
                  action="Trade"
                  onClick={() => {
                    playSfx('item', muted);
                    eventTradeRelic(id);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

export function RunOverView({ victory }: { victory: boolean }) {
  const startNewRun = useSpireStore((s) => s.startNewRun);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  return (
    <div className="spire-view spire-view--story">
      <header className="spire-panel spire-panel--title">
        <p className="spire-kicker">{victory ? 'Summit' : 'Fainted'}</p>
        <h2>{victory ? 'Champion of the Tower' : 'Run over'}</h2>
        <p>
          {victory
            ? 'The top-floor elevator opens. You made it.'
            : 'Your partner faints. The climb resets.'}
        </p>
      </header>
      <div className="spire-choice-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            playSfx('click', muted);
            startNewRun();
          }}
        >
          New Run
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            playSfx('click', muted);
            setScreen('title');
          }}
        >
          Return to Title
        </button>
      </div>
    </div>
  );
}
