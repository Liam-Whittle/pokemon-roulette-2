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
  { id: 'maxelixer', name: 'Max Elixir', icon: '🧪' },
  { id: 'maxrevive', name: 'Max Revive', icon: '💉' },
  { id: 'pokeball', name: 'Poké Ball', icon: '🔴' },
  { id: 'greatball', name: 'Great Ball', icon: '🔵' },
  { id: 'ultraball', name: 'Ultra Ball', icon: '🟡' },
  { id: 'masterball', name: 'Master Ball', icon: '🟣' },
  { id: 'shinycharm', name: 'Shiny Charm', icon: '✨' },
];

/** What each item actually does in THIS game (not the mainline Pokémon games). */
export const ITEM_DESCRIPTIONS: Record<string, string> = {
  potion:
    'Use in battle (bag or party icon): heal one non-fainted Pokémon by half its max HP. Cannot revive fainted Pokémon.',
  rarecandy:
    'Evolves one random eligible Pokémon in your party. If none of your Pokémon can evolve right now, it turns into a Potion instead.',
  xattack:
    'Use in battle on a move: boosts that move\u2019s power by +20 for the rest of the current enemy Pokémon fight only.',
  maxelixer:
    'Use on one Pokémon (bag or party icon) to fully restore the PP of all of that Pokémon\u2019s moves. Only affects the Pokémon you use it on.',
  maxrevive:
    'If you run out of lives, use a Max Revive on the Game Over screen to revive with one more life and keep your run going.',
  pokeball:
    'The basic ball for catching wild Pokémon. Standard timing zone in the catch mini-game.',
  greatball:
    'A better ball: widens the timing zone in the catch mini-game, making catches easier than a regular Poké Ball.',
  ultraball:
    'A premium ball: widens the timing zone and slows the marker down in the catch mini-game for the easiest standard catch.',
  masterball:
    'Instantly catches any Pokémon with no mini-game \u2014 a guaranteed catch. Best saved for Legendaries.',
  shinycharm:
    'While in your bag, it improves the post-catch Shiny Check, boosting the shiny chance from 1 in 40 to 1 in 15.',
};

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
  { id: 'maxelixer', name: 'Max Elixir', icon: '🧪', price: 100 },
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
  // 15% chance to find a Max Elixir; otherwise the standard weighted loot.
  if (Math.random() < 0.15) return 'maxelixer';
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

/**
 * National Pokédex ID ceiling for the currently-playable region. Evolutions
 * that would cross into a later generation (e.g. Onix → Steelix, or Eevee →
 * Espeon/Umbreon) are filtered out until the region that unlocks them is added.
 * Kanto = 151. Raise this (or swap to a per-region value) when new regions ship.
 */
export const REGION_MAX_DEX_ID = 151;

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
      { id: 25, name: 'pikachu', level: 18 },
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
      { id: 70, name: 'weepinbell', level: 29 },
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
      { id: 122, name: 'mr-mime', level: 37 },
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
      { id: 77, name: 'ponyta', level: 47 },
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
      { id: 111, name: 'rhyhorn', level: 45 },
      { id: 51, name: 'dugtrio', level: 42 },
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
    pokemon: [
      { id: 87, name: 'dewgong', level: 54 },
      { id: 91, name: 'cloyster', level: 53 },
      { id: 80, name: 'slowbro', level: 54 },
      { id: 124, name: 'jynx', level: 56 },
      { id: 131, name: 'lapras', level: 56 },
    ],
  },
  {
    id: 'bruno',
    name: 'Bruno',
    type: 'fighting',
    badgeName: 'Elite Four: Bruno',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bruno.png',
    pokemon: [
      { id: 95, name: 'onix', level: 53 },
      { id: 107, name: 'hitmonchan', level: 55 },
      { id: 106, name: 'hitmonlee', level: 55 },
      { id: 95, name: 'onix', level: 56 },
      { id: 68, name: 'machamp', level: 58 },
    ],
  },
  {
    id: 'agatha',
    name: 'Agatha',
    type: 'ghost',
    badgeName: 'Elite Four: Agatha',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/agatha-gen1rb.png',
    pokemon: [
      { id: 94, name: 'gengar', level: 56 },
      { id: 42, name: 'golbat', level: 56 },
      { id: 93, name: 'haunter', level: 55 },
      { id: 24, name: 'arbok', level: 58 },
      { id: 94, name: 'gengar', level: 60 },
    ],
  },
  {
    id: 'lance',
    name: 'Lance',
    type: 'dragon',
    badgeName: 'Elite Four: Lance',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lance.png',
    pokemon: [
      { id: 130, name: 'gyarados', level: 58 },
      { id: 148, name: 'dragonair', level: 56 },
      { id: 148, name: 'dragonair', level: 56 },
      { id: 142, name: 'aerodactyl', level: 60 },
      { id: 149, name: 'dragonite', level: 62 },
    ],
  },
  {
    id: 'champion',
    name: 'Champion Blue',
    type: 'mixed',
    badgeName: 'Champion',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blue.png',
    pokemon: [
      { id: 18, name: 'pidgeot', level: 61 },
      { id: 65, name: 'alakazam', level: 59 },
      { id: 112, name: 'rhydon', level: 61 },
      { id: 103, name: 'exeggutor', level: 61 },
      { id: 59, name: 'arcanine', level: 61 },
      { id: 9, name: 'blastoise', level: 63 },
    ],
  },
];

export const TOTAL_GYMS = GYM_LEADERS.length;

/** Hub spins required between each Gym battle. */
export const SPINS_PER_GYM = 2;

/**
 * Extra prep spins granted after the 8th badge before the Elite Four gauntlet.
 * Gives the player a longer run-up to train/stock up since the Elite Four +
 * Champion is a tough, uninterrupted gauntlet.
 */
export const ELITE_PREP_SPINS = 6;

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomPokemonId(pool: number[]): number {
  return pickRandom(pool);
}
