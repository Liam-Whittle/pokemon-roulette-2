import type { BattleMove, CaughtPokemon, Screen } from '../types/game';

export type MpRole = 'solo' | 'host' | 'guest';

export type ConnectionStatus =
  | 'idle'
  | 'creating-offer'
  | 'waiting-answer'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type AwaitingGuest = 'shinyRoll' | 'chaosWheel' | null;

export type ChaosEffectId =
  | 'rarecandy'
  | 'lose_potion'
  | 'xattack_both'
  | 'skip_turn'
  | 'random_swap'
  | 'elixir';

export interface SpectateBattleMove {
  slug: string;
  name: string;
  type: string;
  power: number;
  ownerCaughtAt: number;
  ownerDisplayName: string;
  fromActive: boolean;
  maxPp: number;
  currentPp: number;
  splashGag?: boolean;
  hollowPurple?: boolean;
}

export interface SpectateBattle {
  title: string;
  phase: string;
  message: string;
  enemyName: string;
  enemyId: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPower: number;
  enemyTypes: string[];
  guestControlsActive: boolean;
  moves: SpectateBattleMove[];
  processing: boolean;
}

/** Serializable wheel segment for guest replay. */
export interface SpectateWheelSegment {
  id: string;
  label: string;
  color: string;
  icon: string;
  image?: string;
  comingSoon?: boolean;
  weight?: number;
}

/** Host wheel spin the guest should animate and display. */
export interface SpectateWheelEvent {
  id: number;
  kind: 'hub' | 'uber' | 'shiny' | 'encounter' | 'chaos' | 'catch' | 'items' | 'mystery' | 'explore' | 'mischief';
  title: string;
  segments: SpectateWheelSegment[];
  resultSegmentId: string;
  resultLabel: string;
}

/** Minigame / activity outcome for the guest (catch, item find, notices). */
export interface SpectateActivityEvent {
  id: number;
  kind: 'catch' | 'notice' | 'item' | 'shiny';
  title: string;
  message: string;
  success?: boolean;
  pokemonName?: string;
  pokemonSprite?: string;
  shiny?: boolean;
  itemId?: string;
  itemIcon?: string;
}

export interface SpectateState {
  screen: Screen;
  trainerName: string;
  party: CaughtPokemon[];
  badges: number;
  lives: number;
  money: number;
  bagSummary: { id: string; quantity: number }[];
  awaitingGuest: AwaitingGuest;
  hasShinyCharm: boolean;
  lastCaughtAt: number | null;
  lastCaughtId: number | null;
  outcome: string | null;
  battle: SpectateBattle | null;
  guestMonCaughtAt: number | null;
  activeWheel: SpectateWheelEvent | null;
  activityEvent: SpectateActivityEvent | null;
}

export type MpMessage =
  | { type: 'hello'; role: 'host' | 'guest' }
  | { type: 'state'; state: SpectateState }
  | { type: 'requestShinyRoll'; hasShinyCharm: boolean; caughtAt: number | null; caughtId: number | null }
  | { type: 'shinyResult'; shiny: boolean }
  | { type: 'requestChaosWheel' }
  | { type: 'chaosResult'; effect: ChaosEffectId }
  | { type: 'battleMove'; move: Pick<BattleMove, 'slug' | 'ownerCaughtAt' | 'fromActive' | 'name' | 'type' | 'power' | 'maxPp' | 'currentPp' | 'splashGag' | 'hollowPurple' | 'ownerDisplayName'> }
  | { type: 'battleSwitch'; caughtAt: number }
  | { type: 'outcomeAck' }
  | { type: 'ping' }
  | { type: 'pong' };

export function isMpMessage(value: unknown): value is MpMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string';
}
