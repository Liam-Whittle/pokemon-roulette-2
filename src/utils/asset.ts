/**
 * Resolves a path to a file in the `public/` folder, accounting for the Vite
 * `base` (e.g. the GitHub Pages subpath). Pass paths relative to `public/`
 * with or without a leading slash.
 *
 *   asset('sounds/title.mp3') -> '/pokemon-roulette-2/sounds/title.mp3'
 */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

/** Shared fallback sprite used across the app for broken images. */
export const PLACEHOLDER_SPRITE = asset('placeholder-pokemon.svg');
