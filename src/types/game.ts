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
  | 'gameover'
  | 'hall'
  | 'coming-soon';

export type ActivityType =
  | 'wild'
  | 'tallgrass'
  | 'fishing'
  | 'item'
  | 'gym'
  | 'fossil'
  | 'cave'
  | 'coming-soon';

export interface WheelSegment {
  id: string;
  label: string;
  activity: ActivityType;
  color: string;
  icon: string;
  comingSoon?: boolean;
}

export interface PokemonData {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  sprite: string;
  artwork: string;
  catchRate: number;
  isLegendary: boolean;
  powerLevel: number;
  baseStatTotal: number;
  evolvesToId?: number | null;
}

export interface CaughtPokemon {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  sprite: string;
  caughtAt: number;
  nickname?: string;
  powerLevel: number;
  evolvesToId?: number | null;
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
}

export interface BattleWheelSegment {
  id: string;
  label: string;
  outcome: 'hit' | 'miss';
  color: string;
  icon: string;
}
