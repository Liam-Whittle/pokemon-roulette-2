import { useEffect, useState } from 'react';
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
  const [failed, setFailed] = useState(false);

  // Reset the error state if the icon source changes.
  useEffect(() => {
    setFailed(false);
  }, [sprite]);

  if (sprite && !failed) {
    return (
      <img
        src={sprite}
        alt={name ?? id}
        className={`item-icon-img ${className}`.trim()}
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className={className}>{icon}</span>;
}
