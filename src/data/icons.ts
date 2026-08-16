import { asset } from '../utils/asset';
import { localItemSprite, localPokemonSprite, localTrainerSprite } from '../utils/localAssets';

function itemSprite(filename: string): string {
  return localItemSprite(filename);
}

/** Official PokeAPI item sprites keyed by in-game item id. */
export const ITEM_SPRITES: Record<string, string> = {
  potion: itemSprite('potion.png'),
  fullheal: itemSprite('full-heal.png'),
  healpowder: itemSprite('heal-powder.png'),
  rarecandy: itemSprite('rare-candy.png'),
  xattack: itemSprite('x-attack.png'),
  maxelixer: itemSprite('max-elixir.png'),
  maxrevive: itemSprite('max-revive.png'),
  pokeball: itemSprite('poke-ball.png'),
  greatball: itemSprite('great-ball.png'),
  ultraball: itemSprite('ultra-ball.png'),
  masterball: itemSprite('master-ball.png'),
  shinycharm: itemSprite('shiny-charm.png'),
  firestone: itemSprite('fire-stone.png'),
  waterstone: itemSprite('water-stone.png'),
  thunderstone: itemSprite('thunder-stone.png'),
  leafstone: itemSprite('leaf-stone.png'),
  moonstone: itemSprite('moon-stone.png'),
  kingsrock: itemSprite('kings-rock.png'),
  metalcoat: itemSprite('metal-coat.png'),
  dragonscale: itemSprite('dragon-scale.png'),
  sunstone: itemSprite('sun-stone.png'),
  tradestone: itemSprite('trade-stone.png'),
  /** Chaos wheel: skip turn (leave / pass). */
  escaperope: itemSprite('escape-rope.png'),
  /** Chaos wheel: force a party swap. */
  ejectbutton: itemSprite('eject-button.png'),
  electricgem: itemSprite('electric-gem.png'),
  mysteryegg: itemSprite('mystery-egg.png'),
  mysterygift: itemSprite('parcel.png'),
  omnistone: itemSprite('intriguing-stone.png'),
  secretkey: itemSprite('secret-key.png'),
  maxrepel: itemSprite('max-repel.png'),
  honey: itemSprite('honey.png'),
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
  uberspin: itemSprite('master-ball.png'),
  teamrocket: asset('img/gym.png'),
  battlegym: asset('img/gym.png'),
  evolve: itemSprite('rare-candy.png'),
  potion: itemSprite('potion.png'),
  elixir: itemSprite('max-elixir.png'),
  pokecenter: itemSprite('sacred-ash.png'),
  fullheal: itemSprite('full-heal.png'),
  money100: itemSprite('amulet-coin.png'),
  rarecandy: itemSprite('rare-candy.png'),
  healpowder: itemSprite('heal-powder.png'),
  xattack: itemSprite('x-attack.png'),
  stone: itemSprite('moon-stone.png'),
  trainer: localTrainerSprite('red-gen3.png'),
  rival: localTrainerSprite('blue.png'),
  wondertrade: itemSprite('sachet.png'),
  benchwarmers: itemSprite('exp-share.png'),
  luckyegg: itemSprite('lucky-egg.png'),
  picnic: itemSprite('apricorn-box.png'),
  carepackage: itemSprite('parcel.png'),
  mewtoll: itemSprite('coin-case.png'),
  'bonus-all-items': itemSprite('nugget.png'),
  'bonus-xp': itemSprite('rare-candy.png'),
  'bonus-money': itemSprite('amulet-coin.png'),
  masterball: itemSprite('master-ball.png'),
};

/** UI chrome sprites keyed by semantic name. */
export const UI_SPRITES = {
  hall: itemSprite('kings-rock.png'),
  champion: itemSprite('gold-bottle-cap.png'),
  gameover: itemSprite('reaper-cloth.png'),
  comingSoonFallback: itemSprite('dubious-disc.png'),
  bag: itemSprite('dowsing-machine.png'),
  shop: asset('img/shop.png'),
  gamecorner: itemSprite('amulet-coin.png'),
  mysterygift: itemSprite('parcel.png'),
  cinnabar: itemSprite('hm02.png'),
  fishing: itemSprite('super-rod.png'),
  fossil: itemSprite('helix-fossil.png'),
  cave: itemSprite('explorer-kit.png'),
  life: itemSprite('heart-scale.png'),
  wild: localPokemonSprite(16),
} as const;

export type UISpriteKey = keyof typeof UI_SPRITES;

/** Large hero icons for hub pathway cards. */
export const PATHWAY_HERO_SPRITES: Record<'catch' | 'explore' | 'mischief' | 'items' | 'mystery', string> = {
  catch: localPokemonSprite(133),
  explore: itemSprite('bike.png'),
  mischief: localPokemonSprite(151),
  items: itemSprite('bike.png'),
  mystery: itemSprite('mystery-egg.png'),
};

export function getItemSprite(id: string): string | undefined {
  return ITEM_SPRITES[id];
}

export function getSegmentSprite(segmentId: string): string | undefined {
  return SEGMENT_SPRITES[segmentId];
}

export function getUISprite(key: UISpriteKey): string {
  return UI_SPRITES[key];
}

export function getPathwayHeroSprite(
  pathway: 'catch' | 'explore' | 'mischief' | 'items' | 'mystery',
): string {
  return PATHWAY_HERO_SPRITES[pathway];
}

export function gameIconSrc(key: string): string | undefined {
  return ITEM_SPRITES[key] ?? SEGMENT_SPRITES[key] ?? (UI_SPRITES as Record<string, string>)[key];
}
