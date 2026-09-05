import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { TypeBadge } from '../../components/TypeBadge';
import { resolveCard } from '../data/cards';
import { CARD_KEYWORD_HOVER_MS, cardKeywordTips, extraKeywordKindsForCard } from '../data/keywordTips';
import { cardCostLabel, combatPunishesPowers, energyCostToPlay, liveCardDescription } from '../engine/combat';
import type { CardInstance, CombatEnemy, CombatState } from '../types';
import { CardKeywordTips } from './CardKeywordTips';
import { formatCardText } from './cardText';

interface SpireCardProps {
  card: CardInstance;
  disabled?: boolean;
  selected?: boolean;
  compact?: boolean;
  dragging?: boolean;
  playable?: boolean;
  fan?: number;
  lift?: number;
  stack?: number;
  price?: number;
  description?: string;
  combat?: CombatState;
  target?: CombatEnemy;
  upgradePreview?: boolean;
  arriving?: boolean;
  inert?: boolean;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function SpireCard({
  card,
  disabled,
  selected,
  compact,
  dragging,
  playable,
  fan,
  lift,
  stack,
  price,
  description,
  combat,
  target,
  upgradePreview,
  arriving,
  inert,
  onClick,
  onPointerDown,
}: SpireCardProps) {
  const viewCard = upgradePreview && !card.upgraded ? { ...card, upgraded: true } : card;
  const def = resolveCard(viewCard);
  const free =
    !!combat &&
    !def.xCost &&
    def.cost > 0 &&
    energyCostToPlay(combat, viewCard, def) === 0;
  const printed = description ?? def.description;
  const live = combat ? liveCardDescription(viewCard, combat, target) : printed;
  const previewing = !!upgradePreview && !card.upgraded;
  const powerWarn = !!combat && def.kind === 'power' && combatPunishesPowers(combat);
  const tips = cardKeywordTips(live, extraKeywordKindsForCard(def.id, card.replay ?? 0));
  const cardRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<number>(0);
  const [showTips, setShowTips] = useState(false);
  const locked = !!disabled && !inert;

  const hideTips = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = 0;
    setShowTips(false);
  };

  const armTips = () => {
    if (inert || dragging || arriving || tips.length === 0) return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setShowTips(true), CARD_KEYWORD_HOVER_MS);
  };

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (dragging || inert || arriving) hideTips();
  }, [arriving, dragging, inert]);

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        className={clsx(
          'spire-card',
          `spire-card--${def.type}`,
          `spire-card--${def.kind}`,
          compact && 'spire-card--compact',
          selected && 'spire-card--selected',
          disabled && 'spire-card--disabled',
          dragging && 'spire-card--dragging',
          playable && 'spire-card--playable',
          free && 'spire-card--free',
          previewing && 'spire-card--preview',
          arriving && 'is-arriving',
          inert && 'spire-card--inert',
          (card.replay ?? 0) > 0 && 'spire-card--replay',
          powerWarn && 'spire-card--power-warn',
        )}
        style={
          fan != null || lift != null || stack != null
            ? ({ '--fan': fan ?? 0, '--lift': lift ?? 0, '--z': stack ?? 1 } as CSSProperties)
            : undefined
        }
        data-hand-id={fan != null || lift != null ? card.instanceId : undefined}
        tabIndex={inert || arriving || locked ? -1 : undefined}
        aria-disabled={locked || undefined}
        onClick={inert || locked ? undefined : onClick}
        onPointerDown={(event) => {
          hideTips();
          if (inert || locked) return;
          onPointerDown?.(event);
        }}
        onPointerEnter={armTips}
        onPointerLeave={hideTips}
        onMouseEnter={armTips}
        onMouseLeave={hideTips}
        onFocus={armTips}
        onBlur={hideTips}
      >
        <span
          className={clsx(
            'spire-card__cost',
            free ? 'spire-card__cost--free' : def.xCost ? 'spire-card__cost--x' : `spire-card__cost--${Math.min(3, Math.max(0, def.cost))}`,
          )}
        >
          {cardCostLabel(def, free)}
        </span>
        <span className="spire-card__kind">{def.kind}</span>
        <span className={`spire-card__rarity spire-card__rarity--${def.rarity}`}>
          {def.rarity}
        </span>
        <strong className="spire-card__name">{def.name}</strong>
        {previewing && <span className="spire-card__preview">Preview</span>}
        {(card.replay ?? 0) > 0 && <span className="spire-card__replay">Replay</span>}
        <TypeBadge type={def.type === 'colorless' ? 'normal' : def.type} size="sm" />
        <p className="spire-card__desc">{formatCardText(live, def.description)}</p>
        {price != null && <span className="spire-card__price">¥{price}</span>}
      </button>
      {showTips && <CardKeywordTips anchor={cardRef} tips={tips} />}
    </>
  );
}
