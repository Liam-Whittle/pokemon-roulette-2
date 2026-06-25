import clsx from 'clsx';
import { TYPE_COLORS } from '../data/typeChart';

interface TypeBadgeProps {
  type: string;
  size?: 'sm' | 'md';
}

export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  const color = TYPE_COLORS[type.toLowerCase()] ?? '#A8A878';
  return (
    <span
      className={clsx('type-badge', size === 'sm' && 'type-badge--sm')}
      style={{ backgroundColor: color }}
    >
      {type}
    </span>
  );
}
