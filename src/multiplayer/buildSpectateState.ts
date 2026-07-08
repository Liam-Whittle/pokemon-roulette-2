import { useGameStore } from '../store/useGameStore';
import { useMultiplayerStore } from './useMultiplayerStore';
import type { SpectateBattle, SpectateState } from './protocol';

export function buildSpectateState(battle: SpectateBattle | null = null): SpectateState {
  const game = useGameStore.getState();
  const mp = useMultiplayerStore.getState();
  const guest = game.party.find((m) => m.guestOwned);

  return {
    screen: game.screen,
    trainerName: game.trainer?.name ?? 'Trainer',
    party: game.party,
    badges: game.badges.length,
    lives: game.lives,
    money: game.money,
    bagSummary: game.bag.map((item) => ({ id: item.id, quantity: item.quantity })),
    awaitingGuest: mp.awaitingGuest,
    hasShinyCharm: (game.bag.find((item) => item.id === 'shinycharm')?.quantity ?? 0) > 0,
    lastCaughtAt: game.lastCaughtAt,
    lastCaughtId: game.lastCaughtId,
    outcome: mp.outcome,
    battle,
    guestMonCaughtAt: guest?.caughtAt ?? mp.guestMonCaughtAt,
    activeWheel: mp.spectateWheel,
    activityEvent: mp.spectateActivity,
  };
}
