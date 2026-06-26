import { asset } from '../utils/asset';

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

function itemSprite(filename: string): string {
  return `${SPRITE_BASE}/${filename}`;
}

/** Official PokeAPI item sprites keyed by in-game item id. */
export const ITEM_SPRITES: Record<string, string> = {
  potion: itemSprite('potion.png'),
  rarecandy: itemSprite('rare-candy.png'),
  xattack: itemSprite('x-attack.png'),
  maxrevive: itemSprite('max-revive.png'),
  pokeball: itemSprite('poke-ball.png'),
  greatball: itemSprite('great-ball.png'),
  ultraball: itemSprite('ultra-ball.png'),
  masterball: itemSprite('master-ball.png'),
  shinycharm: itemSprite('shiny-charm.png'),
};

/** Wheel segment sprites keyed by segment id. */
export const SEGMENT_SPRITES: Record<string, string> = {
  wild: asset('img/grass.png'),
  wild2: asset('img/grass_tall.png'),
  fishing: itemSprite('super-rod.png'),
  item: itemSprite('poke-radar.png'),
  cave: itemSprite('explorer-kit.png'),
  fossil: itemSprite('helix-fossil.png'),
  shop: asset('img/shop.png'),
  legendary: itemSprite('poke-flute.png'),
  uber: itemSprite('master-ball.png'),
  battlegym: asset('img/gym.png'),
  evolve: itemSprite('rare-candy.png'),
  potion: itemSprite('potion.png'),
  'bonus-item': itemSprite('nugget.png'),
};

/** UI chrome sprites keyed by semantic name. */
export const UI_SPRITES = {
  hall: itemSprite('gold-bottle-cap.png'),
  champion: itemSprite('gold-bottle-cap.png'),
  gameover: itemSprite('reaper-cloth.png'),
  comingSoonFallback: itemSprite('dubious-disc.png'),
  bag: itemSprite('dowsing-machine.png'),
  shop: asset('img/shop.png'),
  fishing: itemSprite('super-rod.png'),
  fossil: itemSprite('helix-fossil.png'),
  cave: itemSprite('explorer-kit.png'),
  life: itemSprite('heart-scale.png'),
} as const;

export type UISpriteKey = keyof typeof UI_SPRITES;

export function getItemSprite(id: string): string | undefined {
  return ITEM_SPRITES[id];
}

export function getSegmentSprite(segmentId: string): string | undefined {
  return SEGMENT_SPRITES[segmentId];
}

export function getUISprite(key: UISpriteKey): string {
  return UI_SPRITES[key];
}

export function gameIconSrc(key: string): string | undefined {
  return ITEM_SPRITES[key] ?? SEGMENT_SPRITES[key] ?? (UI_SPRITES as Record<string, string>)[key];
}
