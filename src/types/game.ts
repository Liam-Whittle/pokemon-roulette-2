export type Screen =
  | 'title'
  | 'setup'
  | 'starter'
  | 'hub'
  | 'catch'
  | 'fishing'
  | 'fossil'
  | 'cave'
  | 'gym'
  | 'elite'
  | 'item'
  | 'pokedex'
  | 'party'
  | 'bag'
  | 'results'
  | 'champion'
  | 'chadpion'
  | 'gameover'
  | 'hall'
  | 'coming-soon'
  | 'shop';

export type ActivityType =
  | 'wild'
  | 'tallgrass'
  | 'fishing'
  | 'item'
  | 'gym'
  | 'fossil'
  | 'cave'
  | 'coming-soon'
  | 'legendary'
  | 'shop'
  | 'uber'
  | 'evolve'
  | 'potion'
  | 'battlegym';

export interface WheelSegment {
  id: string;
  label: string;
  activity: ActivityType;
  color: string;
  icon: string;
  comingSoon?: boolean;
  weight?: number;
}

export interface PokemonData {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  sprite: string;
  artwork: string;
  shinySprite?: string;
  shinyArtwork?: string;
  catchRate: number;
  isLegendary: boolean;
  powerLevel: number;
  baseStatTotal: number;
  /** First in-region evolution target (kept for save/back-compat). */
  evolvesToId?: number | null;
  /** All in-region evolution branches; a random one is chosen on evolve. */
  evolvesToIds?: number[];
  /** Modern cry audio URL. */
  cryLatest?: string;
  /** Retro Game Boy ("legacy") cry audio URL — used for Gen 1 / Kanto. */
  cryLegacy?: string;
  /** Gen 1 learnable move slugs (from cached /pokemon response). */
  moves?: string[];
}

/** A battle move derived from a Pokemon's type(s) and movepool. */
export interface BattleMove {
  slug: string;
  name: string;
  type: string;
  /** Fraction of the owner's power level (0–1). Dual-type splits power. */
  power: number;
  /** Party member that owns this move (caughtAt timestamp). */
  ownerCaughtAt: number;
  ownerDisplayName: string;
  /** True when this move belongs to the active (slot-0) Pokemon. */
  fromActive: boolean;
  /** Max PP (uses) for this move. */
  maxPp: number;
  /** Remaining PP (uses) for this move. */
  currentPp: number;
  /** Magikarp's Splash easter egg: does nothing, plays a gag, never costs a turn. */
  splashGag?: boolean;
  /** Shiny Magikarp's "Hollow Purple": triggers the win cinematic, never costs a turn. */
  hollowPurple?: boolean;
}

export interface CaughtPokemon {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  sprite: string;
  shinySprite?: string;
  caughtAt: number;
  nickname?: string;
  powerLevel: number;
  evolvesToId?: number | null;
  shiny?: boolean;
  /** Current HP; <= 0 means fainted. Defaults to max when unset (legacy saves). */
  hp?: number;
  /** Remaining PP per move slug. Missing slug = full PP. */
  pp?: Record<string, number>;
}

export interface BagItem {
  id: string;
  name: string;
  quantity: number;
  icon: string;
}

export interface Badge {
  id: string;
  name: string;
  type: string;
  earnedAt: number;
  image?: string;
}

export interface Trainer {
  name: string;
  avatar: string;
  gender: 'boy' | 'girl';
  region: string;
}

export interface TrainerPreset {
  id: 'boy' | 'girl';
  label: string;
  sprite: string;
}

export interface ActivityResult {
  type: ActivityType;
  success: boolean;
  pokemon?: CaughtPokemon;
  item?: BagItem;
  badge?: Badge;
  message: string;
}

export interface EvolutionInfo {
  fromName: string;
  fromArtwork: string;
  fromTypes: string[];
  toName: string;
  toArtwork: string;
  toTypes: string[];
}

export interface EvolveResult {
  message: string;
  evolution: EvolutionInfo | null;
}

export interface GymLeader {
  id: string;
  name: string;
  type: string;
  badgeName: string;
  sprite?: string;
  badgeImage?: string;
  pokemon: { id: number; name: string; level: number }[];
}

export interface ChampionRecord {
  id: string;
  trainerName: string;
  trainerAvatar: string;
  region: string;
  party: CaughtPokemon[];
  avgPower: number;
  date: number;
}

export interface PokedexEntry {
  seen: boolean;
  caught: boolean;
  name: string;
  sprite: string;
  types: string[];
  powerLevel: number;
  shiny?: boolean;
  shinySprite?: string;
}

export interface BattleWheelSegment {
  id: string;
  label: string;
  outcome: 'hit' | 'miss';
  color: string;
  icon: string;
}
