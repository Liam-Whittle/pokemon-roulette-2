import { getUISprite, type UISpriteKey } from '../data/icons';

interface GameIconProps {
  ui: UISpriteKey;
  alt?: string;
  className?: string;
}

/** Renders a UI chrome sprite from the central icon registry. */
export function GameIcon({ ui, alt = '', className = 'game-icon-img' }: GameIconProps) {
  return <img src={getUISprite(ui)} alt={alt} className={className} />;
}
