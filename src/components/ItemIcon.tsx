import { getItemSprite } from '../data/icons';

interface ItemIconProps {
  id: string;
  icon: string;
  name?: string;
  className?: string;
}

/** Renders an official PokeAPI item sprite when available, otherwise the emoji icon. */
export function ItemIcon({ id, icon, name, className = '' }: ItemIconProps) {
  const sprite = getItemSprite(id);
  if (sprite) {
    return (
      <img
        src={sprite}
        alt={name ?? id}
        className={`item-icon-img ${className}`.trim()}
      />
    );
  }
  return <span className={className}>{icon}</span>;
}
