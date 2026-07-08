import type { GymLeader, WheelSegment } from '../types/game';
import { localBadge, localTrainerSprite } from '../utils/localAssets';

/** Small slice weight for rare wheel outcomes (Legendary, Uber Spin). */
export const RARE_WHEEL_WEIGHT = 0.35;

/** Small slice weight for Mystery pathway wedges (Uber Spin, Full Heal). */
export const MYSTERY_SMALL_WEDGE_WEIGHT = 0.2;

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: 'wild', label: 'Wild Grass', activity: 'wild', color: '#4ade80', icon: '🌿' },
  { id: 'fishing', label: 'Fishing', activity: 'fishing', color: '#38bdf8', icon: '🎣' },
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'wild2', label: 'Tall Grass', activity: 'tallgrass', color: '#22c55e', icon: '🍃' },
  { id: 'cave', label: 'Explore Cave', activity: 'cave', color: '#a78bfa', icon: '🕳️' },
  { id: 'fossil', label: 'Fossil Revive', activity: 'fossil', color: '#fb923c', icon: '🦴' },
];

/** Catch Pokémon pathway wheel segments. */
export const PATH_CATCH_SEGMENTS: WheelSegment[] = [
  { id: 'wild', label: 'Grass', activity: 'wild', color: '#4ade80', icon: '🌿' },
  { id: 'fishing', label: 'Fishing', activity: 'fishing', color: '#38bdf8', icon: '🎣' },
  { id: 'cave', label: 'Cave', activity: 'cave', color: '#a78bfa', icon: '🕳️' },
  { id: 'fossil', label: 'Fossil', activity: 'fossil', color: '#fb923c', icon: '🦴' },
  {
    id: 'legendary',
    label: 'Legendary',
    activity: 'legendary',
    color: '#fde047',
    icon: '✨',
    weight: RARE_WHEEL_WEIGHT,
  },
];

/** Hunt Items pathway wheel segments. */
export const PATH_ITEMS_SEGMENTS: WheelSegment[] = [
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'stone', label: 'Stone', activity: 'stone', color: '#a78bfa', icon: '🪨' },
  { id: 'elixir', label: 'Elixir', activity: 'elixir', color: '#38bdf8', icon: '🧪' },
  { id: 'potion', label: 'Potion', activity: 'potion', color: '#fb923c', icon: '💊' },
  { id: 'rarecandy', label: 'Rare Candy', activity: 'rarecandy', color: '#f472b6', icon: '🍬' },
  { id: 'healpowder', label: 'Heal Powder', activity: 'healpowder', color: '#86efac', icon: '🌿' },
  { id: 'xattack', label: 'X-Attack', activity: 'xattack', color: '#ef4444', icon: '⚔️' },
];

/** Mystery pathway wheel segments. */
export const PATH_MYSTERY_SEGMENTS: WheelSegment[] = [
  {
    id: 'uberspin',
    label: 'Uber Spin',
    activity: 'uber',
    color: '#c084fc',
    icon: '🌀',
    weight: MYSTERY_SMALL_WEDGE_WEIGHT,
  },
  { id: 'teamrocket', label: 'Team Rocket', activity: 'teamrocket', color: '#1e293b', icon: '🚀' },
  {
    id: 'fullheal',
    label: 'Full Heal',
    activity: 'fullheal',
    color: '#f472b6',
    icon: '💗',
    weight: MYSTERY_SMALL_WEDGE_WEIGHT,
  },
  { id: 'money100', label: '+¥100', activity: 'money100', color: '#fde047', icon: '💰' },
];

export const PATHWAY_SEGMENTS: Record<'catch' | 'items' | 'mystery', WheelSegment[]> = {
  catch: PATH_CATCH_SEGMENTS,
  items: PATH_ITEMS_SEGMENTS,
  mystery: PATH_MYSTERY_SEGMENTS,
};

/** Team Rocket encounter Pokémon pool (Ekans through Machop). */
export const TEAM_ROCKET_POOL = [23, 24, 41, 42, 109, 110, 19, 20, 96, 97, 66];

export const TEAM_ROCKET_LEADER: GymLeader = {
  id: 'team-rocket-grunt',
  name: 'Team Rocket Grunt',
  type: 'poison',
  badgeName: '',
  sprite: localTrainerSprite('rocketgrunt.png'),
  pokemon: [],
};

export const UBER_SPIN_SEGMENTS = [
  { id: 'masterball', label: 'Master Ball', color: '#a855f7', icon: '🔮', weight: 1 },
  { id: 'bonus-all-items', label: '+1 All Items', color: '#fbbf24', icon: '🎁', weight: 1 },
  { id: 'bonus-xp', label: '+200xp', color: '#4ade80', icon: '⭐', weight: 1 },
  { id: 'bonus-money', label: '+¥250', color: '#fde047', icon: '💰', weight: 1 },
];

export const SHINY_WHEEL_SEGMENTS = [
  { id: 'shiny', label: 'Shiny', color: '#fde047', icon: '', weight: 1 },
  { id: 'normal', label: 'Normal', color: '#94a3b8', icon: '', weight: 39 },
];

export const SHINY_WHEEL_CHARM_SEGMENTS = [
  { id: 'shiny', label: 'Shiny', color: '#fde047', icon: '', weight: 1 },
  { id: 'normal', label: 'Normal', color: '#94a3b8', icon: '', weight: 14 },
];

export const ITEMS = [
  { id: 'potion', name: 'Potion', icon: '💊' },
  { id: 'fullheal', name: 'Full Heal', icon: '💚' },
  { id: 'healpowder', name: 'Heal Powder', icon: '🌿' },
  { id: 'rarecandy', name: 'Rare Candy', icon: '🍬' },
  { id: 'xattack', name: 'X-Attack', icon: '⚔️' },
  { id: 'maxelixer', name: 'Max Elixir', icon: '🧪' },
  { id: 'maxrevive', name: 'Max Revive', icon: '💉' },
  { id: 'pokeball', name: 'Poké Ball', icon: '🔴' },
  { id: 'greatball', name: 'Great Ball', icon: '🔵' },
  { id: 'ultraball', name: 'Ultra Ball', icon: '🟡' },
  { id: 'masterball', name: 'Master Ball', icon: '🟣' },
  { id: 'shinycharm', name: 'Shiny Charm', icon: '✨' },
  { id: 'firestone', name: 'Fire Stone', icon: '🔥' },
  { id: 'waterstone', name: 'Water Stone', icon: '💧' },
  { id: 'thunderstone', name: 'Thunder Stone', icon: '⚡' },
  { id: 'leafstone', name: 'Leaf Stone', icon: '🍃' },
  { id: 'moonstone', name: 'Moon Stone', icon: '🌙' },
  { id: 'tradestone', name: 'Trade Stone', icon: '🔁' },
];

export const STONE_ITEM_IDS = [
  'firestone',
  'waterstone',
  'thunderstone',
  'leafstone',
  'moonstone',
  'tradestone',
] as const;
export type StoneItemId = (typeof STONE_ITEM_IDS)[number];

/** What each item actually does in THIS game (not the mainline Pokémon games). */
export const ITEM_DESCRIPTIONS: Record<string, string> = {
  potion:
    'Use in battle (bag or party icon): heal one non-fainted Pokémon by half its max HP. Cannot revive fainted Pokémon.',
  fullheal:
    'Fully restores HP for every Pokémon in your party. In battle you can only use one per fight (one for the entire Elite Four run).',
  healpowder:
    'Cures all status conditions on every Pokémon in your party. Only usable when at least one party Pokémon has a status.',
  rarecandy:
    'Level up one Pokémon by 1. Use on a party member from the bag or party tab.',
  xattack:
    'Use in battle on a move: boosts Physical or Special damage by +40% of that move\u2019s power for the rest of the current enemy fight.',
  maxelixer:
    'Use on one Pokémon (bag or party icon) to fully restore the PP of all of that Pokémon\u2019s moves. Only affects the Pokémon you use it on.',
  maxrevive:
    'If you run out of lives, use a Max Revive on the Game Over screen to revive with one more life and keep your run going.',
  pokeball:
    'The basic ball for catching wild Pokémon. 1× catch-rate multiplier (assumes wild Pokémon at 30% HP).',
  greatball:
    'A better ball: 1.5× catch-rate multiplier (assumes wild Pokémon at 30% HP).',
  ultraball:
    'A premium ball: 2× catch-rate multiplier (assumes wild Pokémon at 30% HP).',
  masterball:
    'Instantly catches any Pokémon with no mini-game — a guaranteed catch. Best saved for Legendaries.',
  shinycharm:
    'While in your bag, it improves the post-catch Shiny Check, boosting the shiny chance from 1 in 40 to 1 in 15.',
  firestone: 'Use on compatible Pokémon from your Party to trigger Fire Stone evolution.',
  waterstone: 'Use on compatible Pokémon from your Party to trigger Water Stone evolution.',
  thunderstone: 'Use on compatible Pokémon from your Party to trigger Thunder Stone evolution.',
  leafstone: 'Use on compatible Pokémon from your Party to trigger Leaf Stone evolution.',
  moonstone: 'Use on compatible Pokémon from your Party to trigger Moon Stone evolution.',
  tradestone: 'Use on trade-evolution Pokémon from your Party to evolve without trading.',
};

export const CHANCE_BALL_DESCRIPTIONS: Record<string, string> = {
  pokeball: '1× catch-rate multiplier. Odds use Gen 3–7 shake checks at assumed 30% HP.',
  greatball: '1.5× catch-rate multiplier. Better odds than a Poké Ball on the same species.',
  ultraball: '2× catch-rate multiplier. Best standard ball for rare Pokémon.',
  masterball: '100% catch chance — always catches.',
};

export function getItemDescription(id: string, catchGamemode: 'skill' | 'chance' = 'chance'): string {
  if (catchGamemode === 'chance' && id in CHANCE_BALL_DESCRIPTIONS) {
    return CHANCE_BALL_DESCRIPTIONS[id];
  }
  return ITEM_DESCRIPTIONS[id] ?? 'No description available for this item yet.';
}

export const BALL_ITEM_IDS = ['pokeball', 'greatball', 'ultraball', 'masterball'] as const;
export type BallItemId = (typeof BALL_ITEM_IDS)[number];

import { localItemSprite } from '../utils/localAssets';

export const BALL_SPRITES: Record<string, string> = {
  pokeball: localItemSprite('poke-ball.png'),
  greatball: localItemSprite('great-ball.png'),
  ultraball: localItemSprite('ultra-ball.png'),
  masterball: localItemSprite('master-ball.png'),
};

export const SHOP_CATALOG = [
  { id: 'potion', name: 'Potion', icon: '💊', price: 50 },
  { id: 'healpowder', name: 'Heal Powder', icon: '🌿', price: 50 },
  { id: 'xattack', name: 'X-Attack', icon: '⚔️', price: 50 },
  { id: 'maxelixer', name: 'Max Elixir', icon: '🧪', price: 50 },
  { id: 'fullheal', name: 'Full Heal', icon: '💚', price: 200 },
  { id: 'shinycharm', name: 'Shiny Charm', icon: '✨', price: 300 },
  { id: 'pokeball', name: 'Poké Ball', icon: '🔴', price: 20 },
  { id: 'greatball', name: 'Great Ball', icon: '🔵', price: 30 },
  { id: 'ultraball', name: 'Ultra Ball', icon: '🟡', price: 50 },
];

interface WeightedLootEntry {
  id: string;
  weight: number;
}

const FIND_ITEM_LOOT: WeightedLootEntry[] = [
  { id: 'maxrevive', weight: 10 },
  { id: 'pokeball', weight: 8 },
  { id: 'greatball', weight: 5 },
  { id: 'ultraball', weight: 3 },
  { id: 'potion', weight: 20 },
  { id: 'healpowder', weight: 15 },
  { id: 'rarecandy', weight: 20 },
  { id: 'xattack', weight: 20 },
];

/** Items granted when Uber Spin "+1 All Items" hits an empty bag. */
export const UBER_EMPTY_BAG_ITEMS = [
  'potion', 'healpowder', 'xattack', 'rarecandy', 'fullheal', 'maxelixer',
  'pokeball', 'greatball', 'ultraball',
];

export function pickWeightedItemId(entries: WeightedLootEntry[]): string {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return entries[entries.length - 1].id;
}

export function pickFindItemId(): string {
  if (Math.random() < 0.05) return pickRandom(STONE_ITEM_IDS);
  if (Math.random() < 0.15) return 'fullheal';
  if (Math.random() < 0.15) return 'maxelixer';
  if (Math.random() < 0.12) return 'healpowder';
  return pickWeightedItemId(FIND_ITEM_LOOT);
}

export function pickCaveItemId(): string {
  return pickRandom(ITEMS.filter((item) => !['masterball', 'shinycharm', 'maxrevive'].includes(item.id))).id;
}

// Gen 1 (Kanto) species obtainable with the Old/Good/Super Rod.
export const GEN1_FISHING: number[] = [
  54, 60, 61, 72, 73, 79, 90, 98, 99, 116, 117, 118, 119, 120, 129, 130, 147, 148,
];
export const GEN1_CAVE: number[] = [27, 41, 42, 50, 66, 74, 75, 81, 95, 104];
export const FOSSIL_POKEMON: number[] = [138, 140, 142];
export const STARTER_IDS = [1, 4, 7];
export const MAX_PARTY = 5;

export const GEN1_LEGENDARY: number[] = [144, 145, 146, 150, 151];

/**
 * National Pokédex ID ceiling for the currently-playable region.
 */
export const REGION_MAX_DEX_ID = 151;

const EXCLUSIVE_POOL = new Set([
  ...GEN1_FISHING,
  ...GEN1_CAVE,
  ...FOSSIL_POKEMON,
  ...GEN1_LEGENDARY,
]);

/** All Gen 1 grass encounters minus fishing, cave, fossil, and legendary exclusives. */
export const GEN1_GRASS: number[] = Array.from({ length: REGION_MAX_DEX_ID }, (_, i) => i + 1).filter(
  (id) => !EXCLUSIVE_POOL.has(id),
);

/** @deprecated Use GEN1_GRASS */
export const GEN1_WILD_LOW: number[] = GEN1_GRASS;
/** @deprecated Use GEN1_GRASS */
export const GEN1_WILD_HIGH: number[] = GEN1_GRASS;
export const GEN1_WILD: number[] = GEN1_GRASS;

/**
 * Which cry recording to play for the current region. Kanto uses the retro
 * Game Boy ("legacy") cries; later regions can switch to 'latest'.
 */
export const REGION_CRY_STYLE: 'legacy' | 'latest' = 'legacy';

export const GYM_LEADERS: GymLeader[] = [
  {
    id: 'brock',
    name: 'Brock',
    type: 'rock',
    badgeName: 'Boulder Badge',
    sprite: localTrainerSprite('brock.png'),
    badgeImage: localBadge(1),
    pokemon: [
      { id: 74, name: 'geodude', level: 5 },
      { id: 95, name: 'onix', level: 5 },
    ],
  },
  {
    id: 'misty',
    name: 'Misty',
    type: 'water',
    badgeName: 'Cascade Badge',
    sprite: localTrainerSprite('misty.png'),
    badgeImage: localBadge(2),
    pokemon: [
      { id: 120, name: 'staryu', level: 10 },
      { id: 121, name: 'starmie', level: 10 },
    ],
  },
  {
    id: 'surge',
    name: 'Lt. Surge',
    type: 'electric',
    badgeName: 'Thunder Badge',
    sprite: localTrainerSprite('ltsurge.png'),
    badgeImage: localBadge(3),
    pokemon: [
      { id: 100, name: 'voltorb', level: 15 },
      { id: 25, name: 'pikachu', level: 15 },
      { id: 26, name: 'raichu', level: 15 },
    ],
  },
  {
    id: 'erika',
    name: 'Erika',
    type: 'grass',
    badgeName: 'Rainbow Badge',
    sprite: localTrainerSprite('erika.png'),
    badgeImage: localBadge(4),
    pokemon: [
      { id: 114, name: 'tangela', level: 20 },
      { id: 70, name: 'weepinbell', level: 20 },
      { id: 45, name: 'vileplume', level: 20 },
    ],
  },
  {
    id: 'koga',
    name: 'Koga',
    type: 'poison',
    badgeName: 'Soul Badge',
    sprite: localTrainerSprite('koga.png'),
    badgeImage: localBadge(5),
    pokemon: [
      { id: 109, name: 'koffing', level: 25 },
      { id: 109, name: 'koffing', level: 25 },
      { id: 89, name: 'muk', level: 25 },
    ],
  },
  {
    id: 'sabrina',
    name: 'Sabrina',
    type: 'psychic',
    badgeName: 'Marsh Badge',
    sprite: localTrainerSprite('sabrina.png'),
    badgeImage: localBadge(6),
    pokemon: [
      { id: 64, name: 'kadabra', level: 30 },
      { id: 122, name: 'mr-mime', level: 30 },
      { id: 65, name: 'alakazam', level: 30 },
    ],
  },
  {
    id: 'blaine',
    name: 'Blaine',
    type: 'fire',
    badgeName: 'Volcano Badge',
    sprite: localTrainerSprite('blaine.png'),
    badgeImage: localBadge(7),
    pokemon: [
      { id: 58, name: 'growlithe', level: 35 },
      { id: 77, name: 'ponyta', level: 35 },
      { id: 59, name: 'arcanine', level: 35 },
    ],
  },
  {
    id: 'giovanni',
    name: 'Giovanni',
    type: 'ground',
    badgeName: 'Earth Badge',
    sprite: localTrainerSprite('giovanni.png'),
    badgeImage: localBadge(8),
    pokemon: [
      { id: 111, name: 'rhyhorn', level: 40 },
      { id: 51, name: 'dugtrio', level: 40 },
      { id: 31, name: 'nidoqueen', level: 40 },
    ],
  },
];

export const ELITE_FOUR: GymLeader[] = [
  {
    id: 'lorelei',
    name: 'Lorelei',
    type: 'ice',
    badgeName: 'Elite Four: Lorelei',
    sprite: localTrainerSprite('lorelei-gen1rb.png'),
    pokemon: [
      { id: 87, name: 'dewgong', level: 50 },
      { id: 91, name: 'cloyster', level: 50 },
      { id: 80, name: 'slowbro', level: 50 },
      { id: 124, name: 'jynx', level: 50 },
      { id: 131, name: 'lapras', level: 50 },
    ],
  },
  {
    id: 'bruno',
    name: 'Bruno',
    type: 'fighting',
    badgeName: 'Elite Four: Bruno',
    sprite: localTrainerSprite('bruno.png'),
    pokemon: [
      { id: 95, name: 'onix', level: 50 },
      { id: 107, name: 'hitmonchan', level: 50 },
      { id: 106, name: 'hitmonlee', level: 50 },
      { id: 95, name: 'onix', level: 50 },
      { id: 68, name: 'machamp', level: 50 },
    ],
  },
  {
    id: 'agatha',
    name: 'Agatha',
    type: 'ghost',
    badgeName: 'Elite Four: Agatha',
    sprite: localTrainerSprite('agatha-gen1rb.png'),
    pokemon: [
      { id: 94, name: 'gengar', level: 50 },
      { id: 42, name: 'golbat', level: 50 },
      { id: 93, name: 'haunter', level: 50 },
      { id: 24, name: 'arbok', level: 50 },
      { id: 94, name: 'gengar', level: 50 },
    ],
  },
  {
    id: 'lance',
    name: 'Lance',
    type: 'dragon',
    badgeName: 'Elite Four: Lance',
    sprite: localTrainerSprite('lance.png'),
    pokemon: [
      { id: 130, name: 'gyarados', level: 50 },
      { id: 148, name: 'dragonair', level: 50 },
      { id: 148, name: 'dragonair', level: 50 },
      { id: 142, name: 'aerodactyl', level: 50 },
      { id: 149, name: 'dragonite', level: 50 },
    ],
  },
  {
    id: 'champion',
    name: 'Champion Blue',
    type: 'mixed',
    badgeName: 'Champion',
    sprite: localTrainerSprite('blue.png'),
    pokemon: [
      { id: 18, name: 'pidgeot', level: 60 },
      { id: 65, name: 'alakazam', level: 60 },
      { id: 112, name: 'rhydon', level: 60 },
      { id: 103, name: 'exeggutor', level: 60 },
      { id: 59, name: 'arcanine', level: 60 },
      { id: 9, name: 'blastoise', level: 60 },
    ],
  },
];

export const TOTAL_GYMS = GYM_LEADERS.length;

/** Hub spins required between each Gym battle. */
export const SPINS_PER_GYM = 3;

/**
 * Extra prep spins granted after the 8th badge before the Elite Four gauntlet.
 * Gives the player a longer run-up to train/stock up since the Elite Four +
 * Champion is a tough, uninterrupted gauntlet.
 */
export const ELITE_PREP_SPINS = 8;

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomPokemonId(pool: number[]): number {
  return pickRandom(pool);
}
