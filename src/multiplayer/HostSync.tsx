import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { buildSpectateState } from './buildSpectateState';
import { useMultiplayerStore } from './useMultiplayerStore';

/**
 * Host-only: keep the guest's spectate view in sync and inject the guest mon
 * once the starter is claimed and the peer is connected.
 */
export function HostSync() {
  const role = useMultiplayerStore((s) => s.role);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const awaitingGuest = useMultiplayerStore((s) => s.awaitingGuest);
  const outcome = useMultiplayerStore((s) => s.outcome);
  const guestMonInjected = useMultiplayerStore((s) => s.guestMonInjected);
  const hostBattleSnapshot = useMultiplayerStore((s) => s.hostBattleSnapshot);
  const spectateWheel = useMultiplayerStore((s) => s.spectateWheel);
  const spectateActivity = useMultiplayerStore((s) => s.spectateActivity);
  const ensureGuestMon = useMultiplayerStore((s) => s.ensureGuestMon);
  const broadcastState = useMultiplayerStore((s) => s.broadcastState);

  const party = useGameStore((s) => s.party);
  const badges = useGameStore((s) => s.badges);
  const screen = useGameStore((s) => s.screen);
  const starterClaimed = useGameStore((s) => s.starterClaimed);
  const lives = useGameStore((s) => s.lives);
  const money = useGameStore((s) => s.money);
  const bag = useGameStore((s) => s.bag);
  const trainer = useGameStore((s) => s.trainer);
  const lastCaughtAt = useGameStore((s) => s.lastCaughtAt);

  useEffect(() => {
    if (role !== 'host' || connectionStatus !== 'connected') return;
    void ensureGuestMon();
  }, [role, connectionStatus, starterClaimed, guestMonInjected, ensureGuestMon]);

  useEffect(() => {
    if (role !== 'host' || connectionStatus !== 'connected') return;
    broadcastState(buildSpectateState(hostBattleSnapshot));
  }, [
    role,
    connectionStatus,
    party,
    badges,
    screen,
    lives,
    money,
    bag,
    trainer,
    lastCaughtAt,
    awaitingGuest,
    outcome,
    hostBattleSnapshot,
    spectateWheel,
    spectateActivity,
    broadcastState,
  ]);

  return null;
}
