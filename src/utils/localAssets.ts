import { asset } from './asset';

const POKEAPI_SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const POKEAPI_ITEMS = `${POKEAPI_SPRITES}/items`;
const POKEAPI_POKEMON = `${POKEAPI_SPRITES}/pokemon`;
const POKEAPI_ARTWORK = `${POKEAPI_SPRITES}/pokemon/other/official-artwork`;
const SHOWDOWN_TRAINERS = 'https://play.pokemonshowdown.com/sprites/trainers';

/** Local public path for a bundled asset under public/assets/. */
export function localAsset(path: string): string {
  return asset(`assets/${path.replace(/^\/+/, '')}`);
}

export function remoteItemSprite(filename: string): string {
  return `${POKEAPI_ITEMS}/${filename}`;
}

export function localItemSprite(filename: string): string {
  return localAsset(`items/${filename}`);
}

export function localPokemonSprite(id: number): string {
  return localAsset(`pokemon/${id}.png`);
}

export function localPokemonShinySprite(id: number): string {
  return localAsset(`pokemon/${id}-shiny.png`);
}

export function localPokemonArtwork(id: number): string {
  return localAsset(`artwork/${id}.png`);
}

export function localPokemonShinyArtwork(id: number): string {
  return localAsset(`artwork/${id}-shiny.png`);
}

export function remotePokemonSprite(id: number): string {
  return `${POKEAPI_POKEMON}/${id}.png`;
}

export function remotePokemonShinySprite(id: number): string {
  return `${POKEAPI_POKEMON}/shiny/${id}.png`;
}

export function remotePokemonArtwork(id: number): string {
  return `${POKEAPI_ARTWORK}/${id}.png`;
}

export function remotePokemonShinyArtwork(id: number): string {
  return `${POKEAPI_ARTWORK}/shiny/${id}.png`;
}

export function remoteBattleGif(id: number): string {
  return `${POKEAPI_POKEMON}/versions/generation-v/black-white/animated/${id}.gif`;
}

export function remoteShinyBattleGif(id: number): string {
  return `${POKEAPI_POKEMON}/versions/generation-v/black-white/animated/shiny/${id}.gif`;
}

export function localBattleGif(id: number): string {
  return localAsset(`pokemon/battle/${id}.gif`);
}

/**
 * Battle sprite fallback:
 * - Normal: local GIF → remote GIF → static PNG
 * - Shiny: remote shiny GIF (often already the src) → shiny static PNG
 */
export function battleGifOnError(
  e: { currentTarget: HTMLImageElement },
  id: number,
  staticFallback?: string,
  shiny = false,
): void {
  const img = e.currentTarget;
  if (shiny) {
    imgFallback(
      e,
      remotePokemonShinySprite(id),
      staticFallback ?? localPokemonShinySprite(id),
    );
    return;
  }
  if (img.dataset.remoteFallback !== '1') {
    img.dataset.remoteFallback = '1';
    img.src = remoteBattleGif(id);
    return;
  }
  imgFallback(e, localPokemonSprite(id), staticFallback);
}

export function localBadge(id: number): string {
  return localAsset(`badges/${id}.png`);
}

export function remoteBadge(id: number): string {
  return `${POKEAPI_SPRITES}/badges/${id}.png`;
}

export function localTrainerSprite(filename: string): string {
  return localAsset(`trainers/${filename}`);
}

export function remoteTrainerSprite(filename: string): string {
  return `${SHOWDOWN_TRAINERS}/${filename}`;
}

/** onError handler: try remote URL once, then placeholder. */
export function imgFallback(
  e: { currentTarget: HTMLImageElement },
  remoteUrl?: string,
  placeholder?: string,
): void {
  const img = e.currentTarget;
  if (remoteUrl && img.dataset.remoteFallback !== '1') {
    img.dataset.remoteFallback = '1';
    img.src = remoteUrl;
    return;
  }
  if (placeholder) img.src = placeholder;
}
