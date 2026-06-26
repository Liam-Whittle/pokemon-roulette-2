import type { GymLeader, WheelSegment } from '../types/game';

/** Small slice weight for rare wheel outcomes (Legendary, Uber Spin). */
export const RARE_WHEEL_WEIGHT = 0.35;

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: 'wild', label: 'Wild Grass', activity: 'wild', color: '#4ade80', icon: '🌿' },
  { id: 'fishing', label: 'Fishing', activity: 'fishing', color: '#38bdf8', icon: '🎣' },
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'wild2', label: 'Tall Grass', activity: 'tallgrass', color: '#22c55e', icon: '🍃' },
  { id: 'cave', label: 'Explore Cave', activity: 'cave', color: '#a78bfa', icon: '🕳️' },
  { id: 'fossil', label: 'Fossil Revive', activity: 'fossil', color: '#fb923c', icon: '🦴' },
];

const HUB_WHEEL_BASE: WheelSegment[] = [
  { id: 'wild', label: 'Wild Grass', activity: 'wild', color: '#4ade80', icon: '🌿' },
  { id: 'fishing', label: 'Fishing', activity: 'fishing', color: '#38bdf8', icon: '🎣', weight: 0.6 },
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'wild2', label: 'Tall Grass', activity: 'tallgrass', color: '#22c55e', icon: '🍃' },
  { id: 'cave', label: 'Explore Cave', activity: 'cave', color: '#a78bfa', icon: '🕳️' },
  { id: 'fossil', label: 'Fossil Revive', activity: 'fossil', color: '#fb923c', icon: '🦴', weight: 0.6 },
  { id: 'shop', label: 'Visit Shop', activity: 'shop', color: '#f472b6', icon: '🏪' },
];

export const HUB_WHEEL_LAYOUT_A: WheelSegment[] = [
  ...HUB_WHEEL_BASE,
  {
    id: 'legendary',
    label: 'Legendary',
    activity: 'legendary',
    color: '#fde047',
    icon: '✨',
    weight: RARE_WHEEL_WEIGHT,
  },
];

export const HUB_WHEEL_LAYOUT_B: WheelSegment[] = [
  { id: 'wild', label: 'Wild Grass', activity: 'wild', color: '#4ade80', icon: '🌿' },
  { id: 'battlegym', label: 'Battle Gym', activity: 'battlegym', color: '#ef4444', icon: '🏆', weight: 0.6 },
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'wild2', label: 'Tall Grass', activity: 'tallgrass', color: '#22c55e', icon: '🍃' },
  { id: 'evolve', label: 'Evolve', activity: 'evolve', color: '#a78bfa', icon: '🧬' },
  { id: 'potion', label: 'Potion', activity: 'potion', color: '#fb923c', icon: '💊', weight: 0.6 },
  { id: 'shop', label: 'Visit Shop', activity: 'shop', color: '#f472b6', icon: '🏪' },
  {
    id: 'uber',
    label: 'Uber Spin',
    activity: 'uber',
    color: '#c084fc',
    icon: '🌀',
    weight: RARE_WHEEL_WEIGHT,
  },
];

export const UBER_SPIN_SEGMENTS = [
  { id: 'legendary', label: 'Legendary', color: '#fde047', icon: '✨', weight: 1 },
  { id: 'bonus-item', label: '+1 Item', color: '#fbbf24', icon: '🎁', weight: 1 },
  { id: 'shinycharm', label: 'Shiny Charm', color: '#f9a8d4', icon: '✨', weight: 1 },
  { id: 'masterball', label: 'Master Ball', color: '#a855f7', icon: '🔮', weight: 1 },
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
  { id: 'rarecandy', name: 'Rare Candy', icon: '🍬' },
  { id: 'xattack', name: 'X-Attack', icon: '⚔️' },
  { id: 'maxrevive', name: 'Max Revive', icon: '💉' },
  { id: 'pokeball', name: 'Poké Ball', icon: '🔴' },
  { id: 'greatball', name: 'Great Ball', icon: '🔵' },
  { id: 'ultraball', name: 'Ultra Ball', icon: '🟡' },
  { id: 'masterball', name: 'Master Ball', icon: '🟣' },
  { id: 'shinycharm', name: 'Shiny Charm', icon: '✨' },
];

export const BALL_ITEM_IDS = ['pokeball', 'greatball', 'ultraball', 'masterball'] as const;
export type BallItemId = (typeof BALL_ITEM_IDS)[number];

const BALL_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

export const BALL_SPRITES: Record<string, string> = {
  pokeball: `${BALL_SPRITE_BASE}/poke-ball.png`,
  greatball: `${BALL_SPRITE_BASE}/great-ball.png`,
  ultraball: `${BALL_SPRITE_BASE}/ultra-ball.png`,
  masterball: `${BALL_SPRITE_BASE}/master-ball.png`,
};

export const SHOP_CATALOG = [
  { id: 'potion', name: 'Potion', icon: '💊', price: 50 },
  { id: 'xattack', name: 'X-Attack', icon: '⚔️', price: 50 },
  { id: 'rarecandy', name: 'Rare Candy', icon: '🍬', price: 100 },
  { id: 'pokeball', name: 'Poké Ball', icon: '🔴', price: 20 },
  { id: 'greatball', name: 'Great Ball', icon: '🔵', price: 50 },
  { id: 'ultraball', name: 'Ultra Ball', icon: '🟡', price: 100 },
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
  { id: 'potion', weight: 24 },
  { id: 'rarecandy', weight: 25 },
  { id: 'xattack', weight: 25 },
];

const UBER_BONUS_ITEMS = ['potion', 'xattack', 'rarecandy'];

export function getHubWheelSegments(spinsSinceGym: number): WheelSegment[] {
  return spinsSinceGym % 2 === 0 ? HUB_WHEEL_LAYOUT_A : HUB_WHEEL_LAYOUT_B;
}

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
  return pickWeightedItemId(FIND_ITEM_LOOT);
}

export function pickUberBonusItemId(): string {
  return pickRandom(UBER_BONUS_ITEMS);
}

/** BST <= 425 (power <= 45) — common wild encounters (fossil Pokemon excluded) */
export const GEN1_WILD_LOW: number[] = [
  1, 4, 7, 10, 13, 16, 19, 21, 23, 25, 27, 29, 32, 35, 37, 39, 41, 43, 46, 48,
  50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 74, 77, 79, 81, 83, 84, 86, 88, 90,
  92, 95, 96, 98, 100, 102, 104, 108, 109, 111, 116, 118, 120, 129, 133, 137,
  147, 148,
];

/** BST > 425 (power >= 45) — tougher tall-grass encounters (legendaries/fossils excluded) */
export const GEN1_WILD_HIGH: number[] = [
  114, 115, 123, 124, 125, 126, 127, 128, 131, 139, 141, 143, 149,
];

/** Union of both pools (legacy / fallback) */
export const GEN1_WILD: number[] = [...GEN1_WILD_LOW, ...GEN1_WILD_HIGH];

export const LEGENDARY_ENCOUNTER_CHANCE = 0.1;

// Gen 1 (Kanto) species obtainable with the Old/Good/Super Rod.
export const GEN1_FISHING: number[] = [
  54, 60, 61, 72, 73, 79, 90, 98, 99, 116, 117, 118, 119, 120, 129, 130, 147, 148,
];
export const GEN1_CAVE: number[] = [27, 41, 42, 50, 66, 74, 75, 81, 95, 104];
export const FOSSIL_POKEMON: number[] = [138, 140, 142];
export const STARTER_IDS = [1, 4, 7];
export const MAX_PARTY = 5;

export const GEN1_LEGENDARY: number[] = [144, 145, 146, 150, 151];

export const GYM_LEADERS: GymLeader[] = [
  {
    id: 'brock',
    name: 'Brock',
    type: 'rock',
    badgeName: 'Boulder Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brock.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/1.png',
    pokemon: [
      { id: 74, name: 'geodude', level: 12 },
      { id: 95, name: 'onix', level: 14 },
    ],
  },
  {
    id: 'misty',
    name: 'Misty',
    type: 'water',
    badgeName: 'Cascade Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/misty.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/2.png',
    pokemon: [
      { id: 120, name: 'staryu', level: 18 },
      { id: 121, name: 'starmie', level: 21 },
    ],
  },
  {
    id: 'surge',
    name: 'Lt. Surge',
    type: 'electric',
    badgeName: 'Thunder Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/ltsurge.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/3.png',
    pokemon: [
      { id: 100, name: 'voltorb', level: 21 },
      { id: 26, name: 'raichu', level: 24 },
    ],
  },
  {
    id: 'erika',
    name: 'Erika',
    type: 'grass',
    badgeName: 'Rainbow Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/erika.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/4.png',
    pokemon: [
      { id: 114, name: 'tangela', level: 24 },
      { id: 45, name: 'vileplume', level: 29 },
    ],
  },
  {
    id: 'koga',
    name: 'Koga',
    type: 'poison',
    badgeName: 'Soul Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/koga.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/5.png',
    pokemon: [
      { id: 109, name: 'koffing', level: 37 },
      { id: 89, name: 'muk', level: 39 },
    ],
  },
  {
    id: 'sabrina',
    name: 'Sabrina',
    type: 'psychic',
    badgeName: 'Marsh Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sabrina.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/6.png',
    pokemon: [
      { id: 64, name: 'kadabra', level: 38 },
      { id: 65, name: 'alakazam', level: 43 },
    ],
  },
  {
    id: 'blaine',
    name: 'Blaine',
    type: 'fire',
    badgeName: 'Volcano Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blaine.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/7.png',
    pokemon: [
      { id: 58, name: 'growlithe', level: 42 },
      { id: 59, name: 'arcanine', level: 47 },
    ],
  },
  {
    id: 'giovanni',
    name: 'Giovanni',
    type: 'ground',
    badgeName: 'Earth Badge',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png',
    badgeImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/8.png',
    pokemon: [
      { id: 112, name: 'rhydon', level: 45 },
      { id: 31, name: 'nidoqueen', level: 50 },
    ],
  },
];

export const ELITE_FOUR: GymLeader[] = [
  {
    id: 'lorelei',
    name: 'Lorelei',
    type: 'ice',
    badgeName: 'Elite Four: Lorelei',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lorelei-gen1rb.png',
    pokemon: [{ id: 131, name: 'lapras', level: 54 }],
  },
  {
    id: 'bruno',
    name: 'Bruno',
    type: 'fighting',
    badgeName: 'Elite Four: Bruno',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bruno.png',
    pokemon: [{ id: 68, name: 'machamp', level: 56 }],
  },
  {
    id: 'agatha',
    name: 'Agatha',
    type: 'ghost',
    badgeName: 'Elite Four: Agatha',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/agatha-gen1rb.png',
    pokemon: [{ id: 94, name: 'gengar', level: 58 }],
  },
  {
    id: 'lance',
    name: 'Lance',
    type: 'dragon',
    badgeName: 'Elite Four: Lance',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lance.png',
    pokemon: [{ id: 149, name: 'dragonite', level: 62 }],
  },
  {
    id: 'champion',
    name: 'Champion Blue',
    type: 'flying',
    badgeName: 'Champion',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blue.png',
    pokemon: [{ id: 18, name: 'pidgeot', level: 65 }],
  },
];

export const TOTAL_GYMS = GYM_LEADERS.length;

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomPokemonId(pool: number[]): number {
  return pickRandom(pool);
}
