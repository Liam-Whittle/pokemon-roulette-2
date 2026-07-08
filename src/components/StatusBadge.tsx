import type { StatusCondition } from '../types/game';
import type { BattleVolatiles } from '../data/battleVolatiles';
import { statusLabel } from '../utils/status';

const STATUS_TITLES: Record<StatusCondition['kind'], string> = {
  burn: 'Burned',
  freeze: 'Frozen',
  paralysis: 'Paralyzed',
  poison: 'Poisoned',
  toxic: 'Badly poisoned',
  sleep: 'Asleep',
};

export type EffectBadgePlacement = 'party' | 'battle' | 'battle-row';

interface StatusBadgeProps {
  status: StatusCondition;
  placement?: EffectBadgePlacement;
}

export function StatusBadge({ status, placement = 'party' }: StatusBadgeProps) {
  const label = statusLabel(status);
  if (!label) return null;

  return (
    <span
      className={`status-badge status-badge--${status.kind} status-badge--${placement}`}
      title={STATUS_TITLES[status.kind]}
      aria-label={STATUS_TITLES[status.kind]}
    >
      {label}
    </span>
  );
}

export type VolatileBadgeKind = 'confusion' | 'trapped' | 'leech-seed';

const VOLATILE_LABELS: Record<VolatileBadgeKind, string> = {
  confusion: 'CON',
  trapped: 'TRP',
  'leech-seed': 'SED',
};

const VOLATILE_TITLES: Record<VolatileBadgeKind, string> = {
  confusion: 'Confused',
  trapped: 'Trapped',
  'leech-seed': 'Leech Seed',
};

interface VolatileBadgeProps {
  kind: VolatileBadgeKind;
  placement?: EffectBadgePlacement;
}

export function VolatileBadge({ kind, placement = 'party' }: VolatileBadgeProps) {
  return (
    <span
      className={`status-badge status-badge--volatile-${kind} status-badge--${placement}`}
      title={VOLATILE_TITLES[kind]}
      aria-label={VOLATILE_TITLES[kind]}
    >
      {VOLATILE_LABELS[kind]}
    </span>
  );
}

interface BattleEffectBadgesProps {
  status?: StatusCondition;
  volatiles?: BattleVolatiles | null;
  placement?: EffectBadgePlacement;
}

export function hasVisibleBattleEffects(
  status?: StatusCondition,
  volatiles?: BattleVolatiles | null,
): boolean {
  if (status) return true;
  if (!volatiles) return false;
  return (
    volatiles.confusionTurns > 0 ||
    volatiles.trappedTurns > 0 ||
    volatiles.leechSeeded
  );
}

export function BattleEffectBadges({
  status,
  volatiles,
  placement = 'battle-row',
}: BattleEffectBadgesProps) {
  if (!hasVisibleBattleEffects(status, volatiles)) return null;

  return (
    <div className={`battle-effect-badges battle-effect-badges--${placement}`}>
      {status && <StatusBadge status={status} placement={placement} />}
      {(volatiles?.confusionTurns ?? 0) > 0 && (
        <VolatileBadge kind="confusion" placement={placement} />
      )}
      {(volatiles?.trappedTurns ?? 0) > 0 && (
        <VolatileBadge kind="trapped" placement={placement} />
      )}
      {volatiles?.leechSeeded && <VolatileBadge kind="leech-seed" placement={placement} />}
    </div>
  );
}
