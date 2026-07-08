import type { CaughtPokemon, StatusAilment, StatusCondition } from '../types/game';
import { maxHpForMon } from './stats';

export function createStatus(kind: StatusAilment): StatusCondition {
  if (kind === 'sleep') {
    return { kind, turnsLeft: 1 + Math.floor(Math.random() * 3) };
  }
  if (kind === 'toxic') {
    return { kind, toxicCounter: 1 };
  }
  return { kind };
}

export function isStatusImmune(types: string[], kind: StatusAilment): boolean {
  if (kind === 'burn' && types.includes('fire')) return true;
  if (kind === 'freeze' && types.includes('ice')) return true;
  if (kind === 'paralysis' && types.includes('electric')) return true;
  if ((kind === 'poison' || kind === 'toxic') && types.includes('poison')) return true;
  return false;
}

export function canApplyStatus(
  defender: Pick<CaughtPokemon, 'types' | 'status'>,
  kind: StatusAilment,
): boolean {
  if (defender.status) return false;
  return !isStatusImmune(defender.types, kind);
}

export function tickStatusDamage(
  mon: CaughtPokemon,
): { mon: CaughtPokemon; damage: number; message: string } {
  if (!mon.status) return { mon, damage: 0, message: '' };
  const maxHp = maxHpForMon(mon);
  let damage = 0;
  let message = '';
  switch (mon.status.kind) {
    case 'burn':
      damage = Math.max(1, Math.floor(maxHp / 16));
      message = `${mon.displayName} is hurt by its burn!`;
      break;
    case 'poison':
      damage = Math.max(1, Math.floor(maxHp / 8));
      message = `${mon.displayName} is hurt by poison!`;
      break;
    case 'toxic': {
      const counter = mon.status.toxicCounter ?? 1;
      damage = Math.max(1, Math.floor((maxHp * counter) / 16));
      message = `${mon.displayName} is hurt by poison!`;
      return {
        mon: {
          ...mon,
          status: { kind: 'toxic', toxicCounter: counter + 1 },
          hp: Math.max(0, (mon.hp ?? maxHp) - damage),
        },
        damage,
        message,
      };
    }
    default:
      break;
  }
  const hp = Math.max(0, (mon.hp ?? maxHp) - damage);
  return { mon: { ...mon, hp }, damage, message };
}

export function tryThaw(status: StatusCondition | undefined): StatusCondition | undefined {
  if (status?.kind !== 'freeze') return status;
  if (Math.random() < 0.2) return undefined;
  return status;
}

export function thawFromFireMove(status: StatusCondition | undefined): StatusCondition | undefined {
  if (status?.kind === 'freeze') return undefined;
  return status;
}

export function isFullyParalyzed(status: StatusCondition | undefined): boolean {
  return status?.kind === 'paralysis' && Math.random() < 0.25;
}

export function isAsleep(status: StatusCondition | undefined): boolean {
  return status?.kind === 'sleep' && (status.turnsLeft ?? 1) > 0;
}

export function tickSleep(status: StatusCondition): StatusCondition | undefined {
  if (status.kind !== 'sleep') return status;
  const left = (status.turnsLeft ?? 1) - 1;
  return left <= 0 ? undefined : { kind: 'sleep', turnsLeft: left };
}

export function isFrozen(status: StatusCondition | undefined): boolean {
  return status?.kind === 'freeze';
}

export function clearAllStatuses(party: CaughtPokemon[]): CaughtPokemon[] {
  return party.map((m) => {
    const { status: _, ...rest } = m;
    return rest as CaughtPokemon;
  });
}

export function statusLabel(status: StatusCondition): string {
  switch (status.kind) {
    case 'burn':
      return 'BRN';
    case 'freeze':
      return 'FRZ';
    case 'paralysis':
      return 'PAR';
    case 'poison':
      return 'PSN';
    case 'toxic':
      return 'TOX';
    case 'sleep':
      return 'SLP';
    default:
      return '';
  }
}

export function physicalDamageMultiplier(status: StatusCondition | undefined): number {
  return status?.kind === 'burn' ? 0.5 : 1;
}
