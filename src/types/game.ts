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
  | 'shop'
  | 'teamrocket'
  | 'mp-host-lobby'
  | 'mp-join'
  | 'mp-guest';

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
  | 'battlegym'
  | 'elixir'
  | 'pokecenter'
  | 'teamrocket'
  | 'fullheal'
  | 'money100'
  | 'rarecandy'
  | 'healpowder'
  | 'xattack'
  | 'stone';

export type PathwayId = 'catch' | 'items' | 'mystery';

export interface WheelSegment {
  id: string;
  label: string;
  activity: ActivityType;
  color: string;
  icon: string;
  comingSoon?: boolean;
  weight?: number;
}

export type StatKey = 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';
export type MoveCategory = 'physical' | 'special' | 'status';
export type StatusAilment = 'burn' | 'freeze' | 'paralysis' | 'poison' | 'toxic' | 'sleep';

export type NatureId =
  | 'hardy' | 'lonely' | 'brave' | 'adamant' | 'naughty'
  | 'bold' | 'docile' | 'relaxed' | 'impish' | 'lax'
  | 'timid' | 'hasty' | 'serious' | 'jolly' | 'naive'
  | 'modest' | 'mild' | 'quiet' | 'bashful' | 'rash'
  | 'calm' | 'gentle' | 'sassy' | 'careful' | 'quirky';

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface IVs extends BaseStats {}
export interface EVs extends BaseStats {}

export interface StatusCondition {
  kind: StatusAilment;
  /** Sleep turns remaining */
  turnsLeft?: number;
  /** Toxic damage counter */
  toxicCounter?: number;
}

export interface StoredMove {
  slug: string;
  name: string;
  type: string;
  power: number;
  accuracy: number;
  category: MoveCategory;
  maxPp: number;
  statusEffect?: StatusAilment | null;
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
  baseStats: BaseStats;
  baseStatTotal: number;
  evolvesToId?: number | null;
  evolvesToIds?: number[];
  cryLatest?: string;
  cryLegacy?: string;
  moves?: string[];
}

/** A battle move from a Pokemon's stored moveset. */
export interface BattleMove {
  slug: string;
  name: string;
  type: string;
  power: number;
  accuracy: number;
  category: MoveCategory;
  statusEffect?: StatusAilment | null;
  ownerCaughtAt: number;
  ownerDisplayName: string;
  fromActive: boolean;
  maxPp: number;
  currentPp: number;
  splashGag?: boolean;
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
  level: number;
  xp: number;
  ivs: IVs;
  evs: EVs;
  nature: NatureId;
  moves: StoredMove[];
  status?: StatusCondition;
  evolvesToId?: number | null;
  shiny?: boolean;
  caughtWithBall?: CatchBallId;
  hp?: number;
  pp?: Record<string, number>;
  guestOwned?: boolean;
  guestLocked?: boolean;
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

export type CatchGamemode = 'skill' | 'chance';

export type CatchBallId = 'pokeball' | 'greatball' | 'ultraball' | 'masterball';

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
  date: number;
  /** Wall-clock clear time in ms (lower is better). */
  timeMs: number;
  itemsUsed: number;
  livesUsed: number;
  revivesUsed: number;
  faints: number;
  /** Display-only; does not affect rank. */
  shiniesCaught: number;
}

export interface PokedexEntry {
  seen: boolean;
  caught: boolean;
  name: string;
  sprite: string;
  types: string[];
  level: number;
  shiny?: boolean;
  shinySprite?: string;
  caughtWithBall?: CatchBallId;
}

/** HP (and PP) retained for Pokémon currently sitting in the PC (out of party). */
export interface PcStat {
  hp: number;
  pp?: Record<string, number>;
  status?: StatusCondition;
}

/** Persisted mid-battle progress so a refresh/exit can resume the same fight. */
export interface BattleSnapshot {
  context: 'gym' | 'elite' | 'teamrocket';
  leaderId: string;
  eliteStage: number;
  enemyIndex: number;
  enemyHp: number;
  fullHealUsed: boolean;
  xAttackPhysical?: boolean;
  xAttackSpecial?: boolean;
  log: string[];
  phase?: 'prep' | 'choose' | 'between' | 'forcedSwap' | 'victory' | 'result';
  battleField?: import('../data/battleField').BattleField;
  playerVolatiles?: import('../data/battleVolatiles').BattleVolatiles;
  enemyVolatiles?: import('../data/battleVolatiles').BattleVolatiles;
  playerStages?: { atk: number; def: number; spa: number; spd: number; spe: number; acc: number; eva: number };
  enemyStages?: { atk: number; def: number; spa: number; spd: number; spe: number; acc: number; eva: number };
  transformSnapshot?: import('../data/moveEffects').TransformSnapshot | null;
  playerPendingTurn?: { kind: 'solar-charge' | 'hyper-recharge' | 'charge'; slug: string } | null;
  enemyPendingTurn?: { kind: 'solar-charge' | 'hyper-recharge' | 'charge'; slug: string } | null;
  playerLastMoveSlug?: string | null;
  enemyLastMoveSlug?: string | null;
  message?: string;
}

export interface BattleWheelSegment {
  id: string;
  label: string;
  outcome: 'hit' | 'miss';
  color: string;
  icon: string;
}
