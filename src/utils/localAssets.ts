import { asset } from './asset';

const POKEAPI_SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const POKEAPI_ITEMS = `${POKEAPI_SPRITES}/items`;
const POKEAPI_POKEMON = `${POKEAPI_SPRITES}/pokemon`;
const POKEAPI_ARTWORK = `${POKEAPI_SPRITES}/pokemon/other/official-artwork`;
const SHOWDOWN_TRAINERS = 'https://play.pokemonshowdown.com/sprites/trainers';
const SHOWDOWN_SPRITES = 'https://play.pokemonshowdown.com/sprites';

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

export function localBattleFormGif(stem: string): string {
  return localAsset(`pokemon/battle/${stem}.gif`);
}

export function castformBattleStem(types: string[] | undefined, shiny = false): string {
  const t = types?.[0]?.toLowerCase();
  const form = t === 'fire' ? '351-sunny' : t === 'water' ? '351-rainy' : t === 'ice' ? '351-snowy' : '351';
  return shiny ? `${form}-shiny` : form;
}

/** Official green Substitute dummy (front / foe side). */
export function localSubstituteGif(): string {
  return localAsset('pokemon/battle/substitute.gif');
}

/** Official Substitute dummy back sprite (player side). */
export function localSubstituteBackGif(): string {
  return localAsset('pokemon/battle/substitute-back.gif');
}

export function remoteSubstituteGif(): string {
  return `${SHOWDOWN_SPRITES}/gen5ani/substitute.gif`;
}

export function remoteSubstituteBackGif(): string {
  return `${SHOWDOWN_SPRITES}/gen5ani-back/substitute.gif`;
}

/** Showdown sprite folder id: strips non-alphanumeric (mr-mime → mrmime). */
export function showdownSpriteId(speciesName: string): string {
  return speciesName.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function remoteBattleBackGif(speciesName: string, shiny = false): string {
  const id = showdownSpriteId(speciesName);
  return shiny
    ? `${SHOWDOWN_SPRITES}/gen5ani-back-shiny/${id}.gif`
    : `${SHOWDOWN_SPRITES}/gen5ani-back/${id}.gif`;
}

export function remoteBattleBackStatic(speciesName: string, shiny = false): string {
  const id = showdownSpriteId(speciesName);
  return shiny
    ? `${SHOWDOWN_SPRITES}/gen5-back-shiny/${id}.png`
    : `${SHOWDOWN_SPRITES}/gen5-back/${id}.png`;
}

export function remotePokemonBackSprite(id: number, shiny = false): string {
  return shiny
    ? `${POKEAPI_POKEMON}/back/shiny/${id}.png`
    : `${POKEAPI_POKEMON}/back/${id}.png`;
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

/**
 * Player-side back sprite fallback:
 * Showdown ani-back → Showdown static gen5-back → PokeAPI back → front/static placeholder.
 */
export function battleBackGifOnError(
  e: { currentTarget: HTMLImageElement },
  opts: { id: number; speciesName: string; shiny?: boolean; staticFallback?: string },
): void {
  const img = e.currentTarget;
  const shiny = !!opts.shiny;
  const step = Number(img.dataset.backFallback ?? '0');
  if (step === 0) {
    img.dataset.backFallback = '1';
    img.src = remoteBattleBackStatic(opts.speciesName, shiny);
    return;
  }
  if (step === 1) {
    img.dataset.backFallback = '2';
    img.src = remotePokemonBackSprite(opts.id, shiny);
    return;
  }
  const placeholder =
    opts.staticFallback ?? (shiny ? localPokemonShinySprite(opts.id) : localPokemonSprite(opts.id));
  img.src = placeholder;
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
