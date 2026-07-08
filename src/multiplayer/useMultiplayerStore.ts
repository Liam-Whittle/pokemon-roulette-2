import { create } from 'zustand';
import type { BattleMove } from '../types/game';
import { pickGuestPokemon } from './guestMon';
import {
  type AwaitingGuest,
  type ChaosEffectId,
  type ConnectionStatus,
  type MpMessage,
  type MpRole,
  type SpectateActivityEvent,
  type SpectateBattle,
  type SpectateState,
  type SpectateWheelEvent,
} from './protocol';
import { mpSession } from './session';

export type BattleMoveHandler = (move: BattleMove) => void;
export type BattleSwitchHandler = (caughtAt: number) => void;
export type ChaosApplyHandler = (effect: ChaosEffectId) => void;
export type ShinyApplyHandler = (shiny: boolean) => void;

interface MultiplayerState {
  role: MpRole;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  hostOfferCode: string;
  guestAnswerCode: string;
  joinOfferInput: string;
  hostAnswerInput: string;
  awaitingGuest: AwaitingGuest;
  outcome: string | null;
  spectate: SpectateState | null;
  /** Host-side battle snapshot pushed to the guest. */
  hostBattleSnapshot: SpectateBattle | null;
  /** Host-side wheel spin for guest replay. */
  spectateWheel: SpectateWheelEvent | null;
  /** Host-side minigame / notice outcome for guest. */
  spectateActivity: SpectateActivityEvent | null;
  guestMonCaughtAt: number | null;
  guestMonInjected: boolean;
  /** Guest is choosing a move (host waits without full pause overlay). */
  guestBattlePending: boolean;
  /** Host should skip their next choose phase (chaos skip_turn). */
  skipNextPlayerTurn: boolean;
  /** Chaos: buff all active moves this battle. */
  xAttackAllActive: boolean;

  battleMoveHandler: BattleMoveHandler | null;
  battleSwitchHandler: BattleSwitchHandler | null;
  chaosApplyHandler: ChaosApplyHandler | null;
  shinyApplyHandler: ShinyApplyHandler | null;

  setJoinOfferInput: (value: string) => void;
  setHostAnswerInput: (value: string) => void;
  setBattleHandlers: (move: BattleMoveHandler | null, swap: BattleSwitchHandler | null) => void;
  setChaosApplyHandler: (handler: ChaosApplyHandler | null) => void;
  setShinyApplyHandler: (handler: ShinyApplyHandler | null) => void;
  setAwaitingGuest: (value: AwaitingGuest) => void;
  setOutcome: (value: string | null) => void;
  setGuestBattlePending: (value: boolean) => void;
  setSkipNextPlayerTurn: (value: boolean) => void;
  setXAttackAllActive: (value: boolean) => void;
  setGuestMonCaughtAt: (caughtAt: number | null) => void;
  setGuestMonInjected: (value: boolean) => void;
  setHostBattleSnapshot: (battle: SpectateBattle | null) => void;
  setSpectateWheel: (wheel: SpectateWheelEvent | null) => void;
  setSpectateActivity: (event: SpectateActivityEvent | null) => void;

  startHost: () => Promise<void>;
  acceptAnswer: () => Promise<void>;
  startJoin: () => Promise<void>;
  send: (message: MpMessage) => boolean;
  broadcastState: (state: SpectateState) => void;
  requestShinyRoll: (hasShinyCharm: boolean, caughtAt: number | null, caughtId: number | null) => void;
  requestChaosWheel: () => void;
  submitShinyResult: (shiny: boolean) => void;
  submitChaosResult: (effect: ChaosEffectId) => void;
  submitBattleMove: (move: BattleMove) => void;
  submitBattleSwitch: (caughtAt: number) => void;
  clearOutcome: () => void;
  ensureGuestMon: () => Promise<void>;
  resetMultiplayer: () => void;
  handleIncoming: (message: MpMessage) => void;
}

let sessionWired = false;

function wireSession(get: () => MultiplayerState, set: (partial: Partial<MultiplayerState>) => void) {
  if (sessionWired) return;
  sessionWired = true;

  mpSession.onStatus((status, error) => {
    const map: Record<string, ConnectionStatus> = {
      idle: 'idle',
      'creating-offer': 'creating-offer',
      'waiting-answer': 'waiting-answer',
      'creating-answer': 'connecting',
      connecting: 'connecting',
      connected: 'connected',
      disconnected: 'disconnected',
      error: 'error',
    };
    set({
      connectionStatus: map[status] ?? 'error',
      connectionError: error ?? null,
    });
  });

  mpSession.onMessage((message) => {
    get().handleIncoming(message);
  });
}

const initial = {
  role: 'solo' as MpRole,
  connectionStatus: 'idle' as ConnectionStatus,
  connectionError: null as string | null,
  hostOfferCode: '',
  guestAnswerCode: '',
  joinOfferInput: '',
  hostAnswerInput: '',
  awaitingGuest: null as AwaitingGuest,
  outcome: null as string | null,
  spectate: null as SpectateState | null,
  hostBattleSnapshot: null as SpectateBattle | null,
  spectateWheel: null as SpectateWheelEvent | null,
  spectateActivity: null as SpectateActivityEvent | null,
  guestMonCaughtAt: null as number | null,
  guestMonInjected: false,
  guestBattlePending: false,
  skipNextPlayerTurn: false,
  xAttackAllActive: false,
  battleMoveHandler: null as BattleMoveHandler | null,
  battleSwitchHandler: null as BattleSwitchHandler | null,
  chaosApplyHandler: null as ChaosApplyHandler | null,
  shinyApplyHandler: null as ShinyApplyHandler | null,
};

export const useMultiplayerStore = create<MultiplayerState>((set, get) => {
  wireSession(get, set);

  return {
    ...initial,

    setJoinOfferInput: (joinOfferInput) => set({ joinOfferInput }),
    setHostAnswerInput: (hostAnswerInput) => set({ hostAnswerInput }),
    setBattleHandlers: (battleMoveHandler, battleSwitchHandler) =>
      set({ battleMoveHandler, battleSwitchHandler }),
    setChaosApplyHandler: (chaosApplyHandler) => set({ chaosApplyHandler }),
    setShinyApplyHandler: (shinyApplyHandler) => set({ shinyApplyHandler }),
    setAwaitingGuest: (awaitingGuest) => set({ awaitingGuest }),
    setOutcome: (outcome) => set({ outcome }),
    setGuestBattlePending: (guestBattlePending) => set({ guestBattlePending }),
    setSkipNextPlayerTurn: (skipNextPlayerTurn) => set({ skipNextPlayerTurn }),
    setXAttackAllActive: (xAttackAllActive) => set({ xAttackAllActive }),
    setGuestMonCaughtAt: (guestMonCaughtAt) => set({ guestMonCaughtAt }),
    setGuestMonInjected: (guestMonInjected) => set({ guestMonInjected }),
    setHostBattleSnapshot: (hostBattleSnapshot) => set({ hostBattleSnapshot }),
    setSpectateWheel: (spectateWheel) => set({ spectateWheel }),
    setSpectateActivity: (spectateActivity) => set({ spectateActivity }),

    startHost: async () => {
      set({
        role: 'host',
        connectionError: null,
        hostOfferCode: '',
        guestAnswerCode: '',
        guestMonInjected: false,
        guestMonCaughtAt: null,
      });
      try {
        const code = await mpSession.createHostOffer();
        set({ hostOfferCode: code, connectionStatus: 'waiting-answer' });
      } catch (err) {
        set({
          connectionStatus: 'error',
          connectionError: err instanceof Error ? err.message : 'Failed to create offer',
        });
      }
    },

    acceptAnswer: async () => {
      const code = get().hostAnswerInput.trim();
      if (!code) {
        set({ connectionError: 'Paste your friend\'s answer code first.' });
        return;
      }
      try {
        await mpSession.acceptGuestAnswer(code);
        set({ connectionError: null });
      } catch (err) {
        set({
          connectionStatus: 'error',
          connectionError: err instanceof Error ? err.message : 'Invalid answer code',
        });
      }
    },

    startJoin: async () => {
      const offer = get().joinOfferInput.trim();
      if (!offer) {
        set({ connectionError: 'Paste the host code first.' });
        return;
      }
      set({
        role: 'guest',
        connectionError: null,
        guestAnswerCode: '',
        spectate: null,
      });
      try {
        const answer = await mpSession.createGuestAnswer(offer);
        set({ guestAnswerCode: answer });
      } catch (err) {
        set({
          connectionStatus: 'error',
          connectionError: err instanceof Error ? err.message : 'Invalid host code',
        });
      }
    },

    send: (message) => mpSession.send(message),

    broadcastState: (state) => {
      if (get().role !== 'host') return;
      mpSession.send({ type: 'state', state });
    },

    requestShinyRoll: (hasShinyCharm, caughtAt, caughtId) => {
      set({ awaitingGuest: 'shinyRoll', outcome: null });
      mpSession.send({ type: 'requestShinyRoll', hasShinyCharm, caughtAt, caughtId });
    },

    requestChaosWheel: () => {
      set({ awaitingGuest: 'chaosWheel', outcome: null });
      mpSession.send({ type: 'requestChaosWheel' });
    },

    submitShinyResult: (shiny) => {
      mpSession.send({ type: 'shinyResult', shiny });
      set({
        awaitingGuest: null,
        outcome: shiny ? 'Shiny! Your friend rolled a shiny!' : 'Not shiny this time.',
      });
    },

    submitChaosResult: (effect) => {
      mpSession.send({ type: 'chaosResult', effect });
    },

    submitBattleMove: (move) => {
      mpSession.send({
        type: 'battleMove',
        move: {
          slug: move.slug,
          name: move.name,
          type: move.type,
          power: move.power,
          ownerCaughtAt: move.ownerCaughtAt,
          ownerDisplayName: move.ownerDisplayName,
          fromActive: move.fromActive,
          maxPp: move.maxPp,
          currentPp: move.currentPp,
          splashGag: move.splashGag,
          hollowPurple: move.hollowPurple,
        },
      });
    },

    submitBattleSwitch: (caughtAt) => {
      mpSession.send({ type: 'battleSwitch', caughtAt });
    },

    clearOutcome: () => {
      set({ outcome: null });
      if (get().role === 'guest') {
        mpSession.send({ type: 'outcomeAck' });
      }
    },

    ensureGuestMon: async () => {
      const state = get();
      if (state.role !== 'host' || state.connectionStatus !== 'connected' || state.guestMonInjected) {
        return;
      }
      // Lazy import to avoid circular deps at module load.
      const { useGameStore } = await import('../store/useGameStore');
      const game = useGameStore.getState();
      if (!game.starterClaimed) return;
      if (game.party.some((m) => m.guestOwned)) {
        const existing = game.party.find((m) => m.guestOwned)!;
        set({ guestMonInjected: true, guestMonCaughtAt: existing.caughtAt });
        return;
      }
      try {
        const pokemon = await pickGuestPokemon();
        const caughtAt = useGameStore.getState().addGuestPokemon(pokemon);
        if (caughtAt != null) {
          set({ guestMonInjected: true, guestMonCaughtAt: caughtAt });
        }
      } catch {
        // retry later
      }
    },

    resetMultiplayer: () => {
      mpSession.close();
      set({ ...initial });
    },

    handleIncoming: (message) => {
      const role = get().role;

      if (message.type === 'state' && role === 'guest') {
        set({
          spectate: message.state,
          awaitingGuest: message.state.awaitingGuest,
          outcome: message.state.outcome,
          guestMonCaughtAt: message.state.guestMonCaughtAt,
        });
        return;
      }

      if (role !== 'host') return;

      if (message.type === 'shinyResult') {
        const handler = get().shinyApplyHandler;
        handler?.(message.shiny);
        return;
      }

      if (message.type === 'chaosResult') {
        const handler = get().chaosApplyHandler;
        handler?.(message.effect);
        return;
      }

      if (message.type === 'battleMove') {
        const handler = get().battleMoveHandler;
        if (handler) {
          set({ guestBattlePending: false });
          handler(message.move as BattleMove);
        }
        return;
      }

      if (message.type === 'battleSwitch') {
        const handler = get().battleSwitchHandler;
        if (handler) {
          set({ guestBattlePending: false });
          handler(message.caughtAt);
        }
        return;
      }

      if (message.type === 'outcomeAck') {
        set({ outcome: null, awaitingGuest: null });
      }
    },
  };
});

export function isHostConnected(): boolean {
  const s = useMultiplayerStore.getState();
  return s.role === 'host' && s.connectionStatus === 'connected';
}

export function isGuestConnected(): boolean {
  const s = useMultiplayerStore.getState();
  return s.role === 'guest' && s.connectionStatus === 'connected';
}
