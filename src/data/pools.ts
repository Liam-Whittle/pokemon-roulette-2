import type { GymLeader, WheelSegment } from '../types/game';
import { getCachedSpecies } from './speciesCache';
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

/** Explore World pathway — 9 equal wedges. */
export const PATH_EXPLORE_SEGMENTS: WheelSegment[] = [
  { id: 'uberspin', label: 'Uber Spin', activity: 'uber', color: '#c084fc', icon: '🌀' },
  { id: 'teamrocket', label: 'Team Rocket', activity: 'teamrocket', color: '#1e293b', icon: '🚀' },
  { id: 'money100', label: '+¥100', activity: 'money100', color: '#fde047', icon: '💰' },
  { id: 'trainer', label: 'Trainer', activity: 'trainer', color: '#38bdf8', icon: '🧢' },
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'fullheal', label: 'Full Heal', activity: 'fullheal', color: '#f472b6', icon: '💗' },
  { id: 'rival', label: 'Rival', activity: 'rival', color: '#f97316', icon: '🔥' },
  { id: 'stone', label: 'Stone', activity: 'stone', color: '#a78bfa', icon: '🪨' },
  { id: 'rarecandy', label: 'Rare Candy', activity: 'rarecandy', color: '#f472b6', icon: '🍬' },
];

/** Mew's Mischief third-path wheel. */
export const PATH_MISCHIEF_SEGMENTS: WheelSegment[] = [
  { id: 'wondertrade', label: 'Wonder Trade', activity: 'wondertrade', color: '#a78bfa', icon: '🔁' },
  { id: 'benchwarmers', label: 'Bench Warmers', activity: 'benchwarmers', color: '#4ade80', icon: '📈' },
  { id: 'luckyegg', label: 'Lucky Egg', activity: 'luckyegg', color: '#fde047', icon: '🥚' },
  { id: 'picnic', label: 'Picnic', activity: 'picnic', color: '#fb923c', icon: '🧺' },
  { id: 'carepackage', label: 'Care Package', activity: 'carepackage', color: '#38bdf8', icon: '📦' },
  { id: 'mewtoll', label: "Mew's Toll", activity: 'mewtoll', color: '#f472b6', icon: '💸' },
];

/** @deprecated Legacy hunt-items segments (kept for debug/migration). */
export const PATH_ITEMS_SEGMENTS: WheelSegment[] = [
  { id: 'item', label: 'Find Item', activity: 'item', color: '#fbbf24', icon: '🎒' },
  { id: 'stone', label: 'Stone', activity: 'stone', color: '#a78bfa', icon: '🪨' },
  { id: 'potion', label: 'Potion', activity: 'potion', color: '#fb923c', icon: '💊' },
  { id: 'rarecandy', label: 'Rare Candy', activity: 'rarecandy', color: '#f472b6', icon: '🍬' },
  { id: 'xattack', label: 'X-Attack', activity: 'xattack', color: '#ef4444', icon: '⚔️' },
];

/** @deprecated Legacy mystery segments. */
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

export const PATHWAY_SEGMENTS: Record<'catch' | 'explore' | 'mischief', WheelSegment[]> = {
  catch: PATH_CATCH_SEGMENTS,
  explore: PATH_EXPLORE_SEGMENTS,
  mischief: PATH_MISCHIEF_SEGMENTS,
};

/** Catch-path wheel segments; Johto/Hoenn have no fossil revival activity. */
export function getRegionCatchSegments(region: RegionId): WheelSegment[] {
  if (region === 'Johto' || region === 'Hoenn') {
    return PATH_CATCH_SEGMENTS.filter((segment) => segment.activity !== 'fossil');
  }
  return PATH_CATCH_SEGMENTS;
}

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

export const TRAINER_BATTLE_LEADER: GymLeader = {
  id: 'wild-trainer',
  name: 'Trainer',
  type: 'normal',
  badgeName: '',
  sprite: localTrainerSprite('red-gen3.png'),
  pokemon: [],
};

export const KANTO_RIVAL_LEADER: GymLeader = {
  id: 'rival-blue',
  name: 'Blue',
  type: 'normal',
  badgeName: '',
  sprite: localTrainerSprite('blue.png'),
  pokemon: [],
};

export const JOHTO_RIVAL_LEADER: GymLeader = {
  id: 'rival-silver',
  name: 'Silver',
  type: 'normal',
  badgeName: '',
  sprite: localTrainerSprite('silver.png'),
  pokemon: [],
};

export const HOENN_RIVAL_LEADER: GymLeader = {
  id: 'rival-may',
  name: 'May',
  type: 'normal',
  badgeName: '',
  sprite: localTrainerSprite('may.png'),
  pokemon: [],
};

export const TEAM_AQUA_MAGMA_LEADER: GymLeader = {
  id: 'team-aqua-magma-grunt',
  name: 'Team Magma / Aqua Grunt',
  type: 'dark',
  badgeName: '',
  sprite: localTrainerSprite('aquagrunt.png'),
  pokemon: [],
};

export const GIOVANNI_LEADER: GymLeader = {
  id: 'giovanni',
  name: 'Giovanni',
  type: 'ground',
  badgeName: '',
  sprite: localTrainerSprite('giovanni.png'),
  pokemon: [],
};

export function getRegionRivalLeader(region: RegionId): GymLeader {
  if (region === 'Hoenn') return HOENN_RIVAL_LEADER;
  if (region === 'Johto') return JOHTO_RIVAL_LEADER;
  return KANTO_RIVAL_LEADER;
}

export function getRegionRocketLeader(region: RegionId): GymLeader {
  return region === 'Hoenn' ? TEAM_AQUA_MAGMA_LEADER : TEAM_ROCKET_LEADER;
}

/** Explore World wedges with region-correct trainer / rival / villain labels. */
export function getRegionExploreSegments(region: RegionId): WheelSegment[] {
  const rivalSprite = getRegionRivalLeader(region).sprite;
  const trainerSprite = TRAINER_BATTLE_LEADER.sprite;
  return PATH_EXPLORE_SEGMENTS.map((seg) => {
    if (seg.id === 'trainer') return { ...seg, image: trainerSprite };
    if (seg.id === 'rival') return { ...seg, image: rivalSprite };
    if (seg.id === 'teamrocket' && region === 'Hoenn') {
      return {
        ...seg,
        label: 'Team Magma / Aqua',
        image: TEAM_AQUA_MAGMA_LEADER.sprite,
      };
    }
    return seg;
  });
}

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
  { id: 'kingsrock', name: "King's Rock", icon: '👑' },
  { id: 'metalcoat', name: 'Metal Coat', icon: '⚙️' },
  { id: 'dragonscale', name: 'Dragon Scale', icon: '🐉' },
  { id: 'sunstone', name: 'Sun Stone', icon: '☀️' },
  { id: 'tradestone', name: 'Trade Stone', icon: '🔁' },
  { id: 'mysterygift', name: 'Mystery Gift', icon: '🎁' },
  { id: 'omnistone', name: 'Omnistone', icon: '💎' },
  { id: 'secretkey', name: 'Secret Key', icon: '🔑' },
  { id: 'mysteryegg', name: 'Mystery Egg', icon: '🥚' },
  { id: 'maxrepel', name: 'Max Repel', icon: '🛡️' },
  { id: 'honey', name: 'Honey', icon: '🍯' },
];

export const STONE_ITEM_IDS = [
  'firestone',
  'waterstone',
  'thunderstone',
  'leafstone',
  'moonstone',
  'kingsrock',
  'metalcoat',
  'dragonscale',
  'sunstone',
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
  kingsrock: "Use on Poliwhirl or Slowpoke in Johto to trigger King's Rock evolution.",
  metalcoat: 'Use on Onix or Scyther in Johto to trigger Metal Coat evolution.',
  dragonscale: 'Use on Seadra in Johto to trigger Dragon Scale evolution.',
  sunstone: 'Use on Gloom or Sunkern in Johto to trigger Sun Stone evolution.',
  tradestone: 'Use on trade-evolution Pokémon from your Party to evolve without trading.',
  mysterygift: 'Open for a random unique item: Omnistone, Secret Key, Mystery Egg, or Max Repel.',
  omnistone: 'One-time use. Evolves any stone-evolution Pokémon as if you had the correct stone.',
  secretkey: 'Hmm... I wonder what it opens?',
  mysteryegg:
    'Hold through 4 gym battles to hatch a max-IV regional Pokémon at your party average level.',
  honey:
    'Use on one Pokémon to fully restore its HP. In battle this skips your turn, like a Potion.',
  maxrepel:
    'Next 3 New Pokémon Wheel spins only include Pokémon with Base Stat Total higher than 400.',
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

export interface ShopCatalogEntry {
  id: string;
  name: string;
  icon: string;
  price: number;
  /** Max purchases per run; omit/undefined = infinite. */
  stock?: number;
}

export const SHOP_CATALOG: ShopCatalogEntry[] = [
  { id: 'potion', name: 'Potion', icon: '💊', price: 50 },
  { id: 'healpowder', name: 'Heal Powder', icon: '🌿', price: 50 },
  { id: 'xattack', name: 'X-Attack', icon: '⚔️', price: 50 },
  { id: 'maxelixer', name: 'Max Elixir', icon: '🧪', price: 50 },
  { id: 'fullheal', name: 'Full Heal', icon: '💚', price: 250, stock: 3 },
  { id: 'shinycharm', name: 'Shiny Charm', icon: '✨', price: 300, stock: 1 },
  { id: 'pokeball', name: 'Poké Ball', icon: '🔴', price: 20 },
  { id: 'greatball', name: 'Great Ball', icon: '🔵', price: 30 },
  { id: 'ultraball', name: 'Ultra Ball', icon: '🟡', price: 50 },
];

export const HIDDEN_STOCK_RARE_CANDY: ShopCatalogEntry = {
  id: 'rarecandy',
  name: 'Rare Candy',
  icon: '🍬',
  price: 100,
};

export const HIDDEN_STOCK_MASTERBALL: ShopCatalogEntry = {
  id: 'masterball',
  name: 'Master Ball',
  icon: '🟣',
  price: 1000,
  stock: 1,
};

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

export function pickFindItemId(region: RegionId = 'Kanto'): string {
  if (Math.random() < 0.05) return pickRandom(getStoneItemIdsForRegion(region));
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
export const MAX_PARTY_BIGGER = 6;

export function getMaxPartySize(biggerBetter: boolean): number {
  return biggerBetter ? MAX_PARTY_BIGGER : MAX_PARTY;
}

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

export function getCryStyleForRegion(region: RegionId): 'legacy' | 'latest' {
  return region === 'Kanto' ? 'legacy' : 'latest';
}

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

export type RegionId = 'Kanto' | 'Johto' | 'Hoenn';

export const JOHTO_STARTER_IDS = [152, 155, 158] as const;
export const JOHTO_LEGENDARY: number[] = [243, 244, 245, 249, 250, 251];

const JOHTO_GEN1_EVOLUTION_BASES = [
  25, 26, 35, 36, 39, 40, 133, 61, 79, 95, 123, 117, 44, 41, 42, 125, 124, 126,
];

export const JOHTO_FISHING: number[] = [
  60, 61, 79, 90, 116, 117, 120, 129, 130,
  170, 171, 183, 184, 186, 194, 195, 211, 222, 223, 224, 226, 230,
];

export const JOHTO_CAVE: number[] = [
  41, 42, 74, 75, 95, 167, 168, 185, 194, 195, 198, 200, 207, 208, 213, 214, 215, 220, 221,
  246, 247,
];

const JOHTO_EXCLUSIVE_POOL = new Set([
  ...JOHTO_FISHING,
  ...JOHTO_CAVE,
  ...JOHTO_LEGENDARY,
]);

export const JOHTO_GRASS: number[] = [
  ...Array.from({ length: 100 }, (_, i) => i + 152),
  ...JOHTO_GEN1_EVOLUTION_BASES,
].filter((id, idx, arr) => arr.indexOf(id) === idx && !JOHTO_EXCLUSIVE_POOL.has(id));

export const JOHTO_FOSSIL: number[] = [];

export const JOHTO_TEAM_ROCKET_POOL = [
  ...TEAM_ROCKET_POOL,
  228, 229, 198,
];

export const JOHTO_GYM_LEADERS: GymLeader[] = [
  {
    id: 'falkner',
    name: 'Falkner',
    type: 'flying',
    badgeName: 'Zephyr Badge',
    sprite: localTrainerSprite('falkner.png'),
    badgeImage: localBadge(9),
    pokemon: [
      { id: 16, name: 'pidgey', level: 8 },
      { id: 17, name: 'pidgeotto', level: 9 },
    ],
  },
  {
    id: 'bugsy',
    name: 'Bugsy',
    type: 'bug',
    badgeName: 'Hive Badge',
    sprite: localTrainerSprite('bugsy.png'),
    badgeImage: localBadge(10),
    pokemon: [
      { id: 11, name: 'metapod', level: 14 },
      { id: 14, name: 'kakuna', level: 14 },
      { id: 123, name: 'scyther', level: 16 },
    ],
  },
  {
    id: 'whitney',
    name: 'Whitney',
    type: 'normal',
    badgeName: 'Plain Badge',
    sprite: localTrainerSprite('whitney.png'),
    badgeImage: localBadge(11),
    pokemon: [
      { id: 35, name: 'clefairy', level: 18 },
      { id: 241, name: 'miltank', level: 20 },
    ],
  },
  {
    id: 'morty',
    name: 'Morty',
    type: 'ghost',
    badgeName: 'Fog Badge',
    sprite: localTrainerSprite('morty.png'),
    badgeImage: localBadge(12),
    pokemon: [
      { id: 92, name: 'gastly', level: 21 },
      { id: 93, name: 'haunter', level: 21 },
      { id: 93, name: 'haunter', level: 23 },
      { id: 94, name: 'gengar', level: 25 },
    ],
  },
  {
    id: 'chuck',
    name: 'Chuck',
    type: 'fighting',
    badgeName: 'Storm Badge',
    sprite: localTrainerSprite('chuck.png'),
    badgeImage: localBadge(13),
    pokemon: [
      { id: 95, name: 'onix', level: 27 },
      { id: 62, name: 'poliwrath', level: 30 },
    ],
  },
  {
    id: 'jasmine',
    name: 'Jasmine',
    type: 'steel',
    badgeName: 'Mineral Badge',
    sprite: localTrainerSprite('jasmine.png'),
    badgeImage: localBadge(14),
    pokemon: [
      { id: 81, name: 'magnemite', level: 30 },
      { id: 81, name: 'magnemite', level: 30 },
      { id: 208, name: 'steelix', level: 35 },
    ],
  },
  {
    id: 'pryce',
    name: 'Pryce',
    type: 'ice',
    badgeName: 'Glacier Badge',
    sprite: localTrainerSprite('pryce.png'),
    badgeImage: localBadge(15),
    pokemon: [
      { id: 87, name: 'dewgong', level: 30 },
      { id: 91, name: 'cloyster', level: 32 },
      { id: 221, name: 'piloswine', level: 34 },
    ],
  },
  {
    id: 'clair',
    name: 'Clair',
    type: 'dragon',
    badgeName: 'Rising Badge',
    sprite: localTrainerSprite('clair.png'),
    badgeImage: localBadge(16),
    pokemon: [
      { id: 148, name: 'dragonair', level: 37 },
      { id: 148, name: 'dragonair', level: 37 },
      { id: 142, name: 'aerodactyl', level: 37 },
      { id: 230, name: 'kingdra', level: 40 },
    ],
  },
];

export const JOHTO_ELITE_FOUR: GymLeader[] = [
  {
    id: 'will',
    name: 'Will',
    type: 'psychic',
    badgeName: 'Elite Four: Will',
    sprite: localTrainerSprite('will.png'),
    pokemon: [
      { id: 178, name: 'xatu', level: 40 },
      { id: 124, name: 'jynx', level: 41 },
      { id: 80, name: 'slowbro', level: 41 },
      { id: 178, name: 'xatu', level: 42 },
      { id: 199, name: 'slowking', level: 42 },
    ],
  },
  {
    id: 'koga-johto',
    name: 'Koga',
    type: 'poison',
    badgeName: 'Elite Four: Koga',
    sprite: localTrainerSprite('koga.png'),
    pokemon: [
      { id: 169, name: 'crobat', level: 42 },
      { id: 89, name: 'muk', level: 42 },
      { id: 110, name: 'weezing', level: 43 },
      { id: 110, name: 'weezing', level: 43 },
      { id: 169, name: 'crobat', level: 44 },
    ],
  },
  {
    id: 'bruno-johto',
    name: 'Bruno',
    type: 'fighting',
    badgeName: 'Elite Four: Bruno',
    sprite: localTrainerSprite('bruno.png'),
    pokemon: [
      { id: 95, name: 'onix', level: 42 },
      { id: 107, name: 'hitmonchan', level: 42 },
      { id: 106, name: 'hitmonlee', level: 42 },
      { id: 95, name: 'onix', level: 43 },
      { id: 68, name: 'machamp', level: 46 },
    ],
  },
  {
    id: 'karen',
    name: 'Karen',
    type: 'dark',
    badgeName: 'Elite Four: Karen',
    sprite: localTrainerSprite('karen.png'),
    pokemon: [
      { id: 197, name: 'umbreon', level: 42 },
      { id: 169, name: 'crobat', level: 42 },
      { id: 229, name: 'houndoom', level: 47 },
      { id: 198, name: 'murkrow', level: 44 },
      { id: 94, name: 'gengar', level: 45 },
    ],
  },
  {
    id: 'champion-lance-johto',
    name: 'Champion Lance',
    type: 'dragon',
    badgeName: 'Champion',
    sprite: localTrainerSprite('lance.png'),
    pokemon: [
      { id: 130, name: 'gyarados', level: 44 },
      { id: 149, name: 'dragonite', level: 47 },
      { id: 149, name: 'dragonite', level: 47 },
      { id: 142, name: 'aerodactyl', level: 46 },
      { id: 149, name: 'dragonite', level: 50 },
      { id: 6, name: 'charizard', level: 50 },
    ],
  },
];

export const HOENN_STARTER_IDS = [252, 255, 258] as const;
export const HOENN_LEGENDARY: number[] = [377, 378, 379, 380, 381, 382, 383, 384, 385, 386];
/** Gen 2 line members needed for Azurill / Wynaut evolutions in Hoenn. */
export const HOENN_GEN2_EXCEPTIONS = [183, 184, 202] as const;

export const HOENN_FISHING: number[] = [
  270, 271, 272, 278, 279, 283, 318, 319, 320, 321, 339, 340, 341, 342, 349, 350,
  363, 364, 365, 366, 367, 368, 369, 370, 183, 184,
];

export const HOENN_CAVE: number[] = [
  293, 294, 295, 299, 302, 303, 304, 305, 306, 307, 308, 322, 323, 324, 337, 338,
  343, 344, 353, 354, 355, 356, 361, 362, 374, 375, 376,
];

const HOENN_EXCLUSIVE_POOL = new Set([
  ...HOENN_FISHING,
  ...HOENN_CAVE,
  ...HOENN_LEGENDARY,
]);

export const HOENN_GRASS: number[] = [
  ...Array.from({ length: 135 }, (_, i) => i + 252),
  ...HOENN_GEN2_EXCEPTIONS,
].filter((id, idx, arr) => arr.indexOf(id) === idx && !HOENN_EXCLUSIVE_POOL.has(id));

export const HOENN_FOSSIL: number[] = [345, 347];

export const HOENN_TEAM_AQUA_MAGMA_POOL = [
  261, 262, 264, 296, 297, 318, 319, 322, 323, 332, 342, 359,
];

export const HOENN_GYM_LEADERS: GymLeader[] = [
  {
    id: 'roxanne',
    name: 'Roxanne',
    type: 'rock',
    badgeName: 'Stone Badge',
    sprite: localTrainerSprite('roxanne.png'),
    badgeImage: localBadge(17),
    pokemon: [
      { id: 74, name: 'geodude', level: 12 },
      { id: 74, name: 'geodude', level: 12 },
      { id: 299, name: 'nosepass', level: 15 },
    ],
  },
  {
    id: 'brawly',
    name: 'Brawly',
    type: 'fighting',
    badgeName: 'Knuckle Badge',
    sprite: localTrainerSprite('brawly.png'),
    badgeImage: localBadge(18),
    pokemon: [
      { id: 66, name: 'machop', level: 16 },
      { id: 307, name: 'meditite', level: 16 },
      { id: 296, name: 'makuhita', level: 19 },
    ],
  },
  {
    id: 'wattson',
    name: 'Wattson',
    type: 'electric',
    badgeName: 'Dynamo Badge',
    sprite: localTrainerSprite('wattson.png'),
    badgeImage: localBadge(19),
    pokemon: [
      { id: 100, name: 'voltorb', level: 20 },
      { id: 82, name: 'magneton', level: 22 },
      { id: 309, name: 'electrike', level: 20 },
      { id: 310, name: 'manectric', level: 24 },
    ],
  },
  {
    id: 'flannery',
    name: 'Flannery',
    type: 'fire',
    badgeName: 'Heat Badge',
    sprite: localTrainerSprite('flannery.png'),
    badgeImage: localBadge(20),
    pokemon: [
      { id: 322, name: 'numel', level: 24 },
      { id: 218, name: 'slugma', level: 24 },
      { id: 323, name: 'camerupt', level: 26 },
      { id: 324, name: 'torkoal', level: 29 },
    ],
  },
  {
    id: 'norman',
    name: 'Norman',
    type: 'normal',
    badgeName: 'Balance Badge',
    sprite: localTrainerSprite('norman.png'),
    badgeImage: localBadge(21),
    pokemon: [
      { id: 327, name: 'spinda', level: 27 },
      { id: 288, name: 'vigoroth', level: 27 },
      { id: 264, name: 'linoone', level: 29 },
      { id: 289, name: 'slaking', level: 31 },
    ],
  },
  {
    id: 'winona',
    name: 'Winona',
    type: 'flying',
    badgeName: 'Feather Badge',
    sprite: localTrainerSprite('winona.png'),
    badgeImage: localBadge(22),
    pokemon: [
      { id: 333, name: 'swablu', level: 29 },
      { id: 357, name: 'tropius', level: 29 },
      { id: 279, name: 'pelipper', level: 30 },
      { id: 227, name: 'skarmory', level: 31 },
      { id: 334, name: 'altaria', level: 33 },
    ],
  },
  {
    id: 'tate-and-liza',
    name: 'Tate & Liza',
    type: 'psychic',
    badgeName: 'Mind Badge',
    sprite: localTrainerSprite('tateandliza.png'),
    badgeImage: localBadge(23),
    pokemon: [
      { id: 344, name: 'claydol', level: 41 },
      { id: 178, name: 'xatu', level: 41 },
      { id: 337, name: 'lunatone', level: 42 },
      { id: 338, name: 'solrock', level: 42 },
    ],
  },
  {
    id: 'juan',
    name: 'Juan',
    type: 'water',
    badgeName: 'Rain Badge',
    sprite: localTrainerSprite('juan.png'),
    badgeImage: localBadge(24),
    pokemon: [
      { id: 370, name: 'luvdisc', level: 41 },
      { id: 340, name: 'whiscash', level: 41 },
      { id: 364, name: 'sealeo', level: 43 },
      { id: 342, name: 'crawdaunt', level: 43 },
      { id: 230, name: 'kingdra', level: 46 },
    ],
  },
];

export const HOENN_ELITE_FOUR: GymLeader[] = [
  {
    id: 'sidney',
    name: 'Sidney',
    type: 'dark',
    badgeName: 'Elite Four: Sidney',
    sprite: localTrainerSprite('sidney.png'),
    pokemon: [
      { id: 262, name: 'mightyena', level: 46 },
      { id: 332, name: 'cacturne', level: 46 },
      { id: 275, name: 'shiftry', level: 48 },
      { id: 342, name: 'crawdaunt', level: 48 },
      { id: 359, name: 'absol', level: 49 },
    ],
  },
  {
    id: 'phoebe',
    name: 'Phoebe',
    type: 'ghost',
    badgeName: 'Elite Four: Phoebe',
    sprite: localTrainerSprite('phoebe.png'),
    pokemon: [
      { id: 356, name: 'dusclops', level: 48 },
      { id: 354, name: 'banette', level: 49 },
      { id: 354, name: 'banette', level: 49 },
      { id: 302, name: 'sableye', level: 50 },
      { id: 356, name: 'dusclops', level: 51 },
    ],
  },
  {
    id: 'glacia',
    name: 'Glacia',
    type: 'ice',
    badgeName: 'Elite Four: Glacia',
    sprite: localTrainerSprite('glacia.png'),
    pokemon: [
      { id: 362, name: 'glalie', level: 50 },
      { id: 364, name: 'sealeo', level: 50 },
      { id: 362, name: 'glalie', level: 52 },
      { id: 364, name: 'sealeo', level: 52 },
      { id: 365, name: 'walrein', level: 53 },
    ],
  },
  {
    id: 'drake',
    name: 'Drake',
    type: 'dragon',
    badgeName: 'Elite Four: Drake',
    sprite: localTrainerSprite('drake-gen3.png'),
    pokemon: [
      { id: 372, name: 'shelgon', level: 52 },
      { id: 334, name: 'altaria', level: 54 },
      { id: 230, name: 'kingdra', level: 53 },
      { id: 330, name: 'flygon', level: 53 },
      { id: 373, name: 'salamence', level: 55 },
    ],
  },
  {
    id: 'champion-wallace',
    name: 'Champion Wallace',
    type: 'water',
    badgeName: 'Champion',
    sprite: localTrainerSprite('wallace.png'),
    pokemon: [
      { id: 321, name: 'wailord', level: 57 },
      { id: 73, name: 'tentacruel', level: 55 },
      { id: 340, name: 'whiscash', level: 56 },
      { id: 272, name: 'ludicolo', level: 56 },
      { id: 130, name: 'gyarados', level: 56 },
      { id: 350, name: 'milotic', level: 58 },
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

export function getRegionStarters(region: RegionId): number[] {
  if (region === 'Hoenn') return [...HOENN_STARTER_IDS];
  if (region === 'Johto') return [...JOHTO_STARTER_IDS];
  return [...STARTER_IDS];
}

export function getRegionFishingPool(region: RegionId): number[] {
  if (region === 'Hoenn') return HOENN_FISHING;
  if (region === 'Johto') return JOHTO_FISHING;
  return GEN1_FISHING;
}

export function getRegionCavePool(region: RegionId): number[] {
  if (region === 'Hoenn') return HOENN_CAVE;
  if (region === 'Johto') return JOHTO_CAVE;
  return GEN1_CAVE;
}

export function getRegionFossilPool(region: RegionId): number[] {
  if (region === 'Hoenn') return HOENN_FOSSIL;
  if (region === 'Johto') return JOHTO_FOSSIL;
  return FOSSIL_POKEMON;
}

export function getRegionGrassPool(region: RegionId): number[] {
  if (region === 'Hoenn') return HOENN_GRASS;
  if (region === 'Johto') return JOHTO_GRASS;
  return GEN1_GRASS;
}

export function getRegionLegendaryPool(region: RegionId): number[] {
  if (region === 'Hoenn') return HOENN_LEGENDARY;
  if (region === 'Johto') return JOHTO_LEGENDARY;
  return GEN1_LEGENDARY;
}

export function getRegionRocketPool(region: RegionId): number[] {
  if (region === 'Hoenn') return HOENN_TEAM_AQUA_MAGMA_POOL;
  if (region === 'Johto') return JOHTO_TEAM_ROCKET_POOL;
  return TEAM_ROCKET_POOL;
}

/** Full regional dex ID list for the New Pokémon Wheel / random battles. */
export function getRegionAllPokemonPool(region: RegionId): number[] {
  if (region === 'Hoenn') {
    return [
      ...HOENN_GEN2_EXCEPTIONS,
      ...Array.from({ length: 135 }, (_, i) => i + 252),
    ];
  }
  if (region === 'Johto') {
    return Array.from({ length: 100 }, (_, i) => i + 152);
  }
  return Array.from({ length: 151 }, (_, i) => i + 1);
}

/** High-BST pool for Arceus's Blessing (uses cached species when available). */
export function filterPoolByMinBst(pool: number[], minBst: number): number[] {
  return pool.filter((id) => {
    const species = getCachedSpecies(id);
    return species ? species.baseStatTotal >= minBst : false;
  });
}

export function getStoneItemIdsForRegion(region: RegionId): StoneItemId[] {
  if (region === 'Johto' || region === 'Hoenn') return [...STONE_ITEM_IDS];
  return [
    'firestone',
    'waterstone',
    'thunderstone',
    'leafstone',
    'moonstone',
    'tradestone',
  ];
}

export function getRegionGymLeaders(region: RegionId): GymLeader[] {
  if (region === 'Hoenn') return HOENN_GYM_LEADERS;
  if (region === 'Johto') return JOHTO_GYM_LEADERS;
  return GYM_LEADERS;
}

export function getRegionEliteFour(region: RegionId): GymLeader[] {
  if (region === 'Hoenn') return HOENN_ELITE_FOUR;
  if (region === 'Johto') return JOHTO_ELITE_FOUR;
  return ELITE_FOUR;
}

/** Normalize trainer.region (or unknown) to a valid RegionId. */
export function resolveRegionId(region: string | undefined | null): RegionId {
  if (region === 'Hoenn' || region === 'Johto') return region;
  return 'Kanto';
}

export function getRegionTotalGyms(region: RegionId): number {
  return getRegionGymLeaders(region).length;
}

/** Resolve a badge sprite from persisted data or the region gym roster. */
export function resolveBadgeImage(
  badge: { id: string; image?: string },
  region: RegionId,
): string | undefined {
  if (badge.image) return badge.image;
  return getRegionGymLeaders(region).find((leader) => leader.id === badge.id)?.badgeImage;
}
