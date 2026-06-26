import { BALL_SPRITES } from '../data/pools';

interface ItemIconProps {
  id: string;
  icon: string;
  name?: string;
  className?: string;
}

/** Renders a real ball sprite for Poké Ball items, otherwise the emoji icon. */
export function ItemIcon({ id, icon, name, className = '' }: ItemIconProps) {
  const ballSprite = BALL_SPRITES[id];
  if (ballSprite) {
    return (
      <img
        src={ballSprite}
        alt={name ?? id}
        className={`item-icon-img ${className}`.trim()}
      />
    );
  }
  return <span className={className}>{icon}</span>;
}
