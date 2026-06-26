import { getSegmentSprite } from '../data/icons';

interface SegmentIconProps {
  id: string;
  fallbackIcon?: string;
  className?: string;
  alt?: string;
}

/** Renders a wheel-segment sprite when available, otherwise the fallback emoji. */
export function SegmentIcon({
  id,
  fallbackIcon = '',
  className = 'game-icon-img',
  alt = '',
}: SegmentIconProps) {
  const sprite = getSegmentSprite(id);
  if (sprite) {
    return <img src={sprite} alt={alt} className={className} />;
  }
  return fallbackIcon ? <span className={className}>{fallbackIcon}</span> : null;
}
