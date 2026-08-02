import { asset } from './asset';

export type MusicTrack =
  | 'title'
  | 'titleExtra'
  | 'main'
  | 'kanto'
  | 'johto'
  | 'gym'
  | 'elite4'
  | 'pokemon'
  | 'gamewin'
  | 'gamelose'
  | 'pokemart'
  | 'teamrocket'
  | 'trainerBattle'
  | 'rivalBattle'
  | 'giovanni'
  | 'gamecorner'
  | 'cinnabar'
  | 'missingnoCatch';

const TRACKS: Record<MusicTrack, string> = {
  title: asset('sounds/title_new.mp3'),
  titleExtra: asset('sounds/title_extra.mp3'),
  main: asset('sounds/main.mp3'),
  kanto: asset('sounds/kanto.mp3'),
  johto: asset('sounds/johto.mp3'),
  gym: asset('sounds/gym.mp3'),
  elite4: asset('sounds/elite4.mp3'),
  pokemon: asset('sounds/pokemon.mp3'),
  gamewin: asset('sounds/gamewin_new.mp3'),
  gamelose: asset('sounds/game_lose.mp3'),
  pokemart: asset('sounds/pokemart.mp3'),
  teamrocket: asset('sounds/team_rocket.mp3'),
  trainerBattle: asset('sounds/trainer_battle.mp3'),
  rivalBattle: asset('sounds/rival_battle.mp3'),
  giovanni: asset('sounds/giovanni.mp3'),
  gamecorner: asset('sounds/game_corner.mp3'),
  cinnabar: asset('sounds/cinnabar_island.mp3'),
  missingnoCatch: asset('sounds/missingno_catch.mp3'),
};

/** Scales the user volume slider so music stays comfortable across the full range. */
const MASTER_GAIN = 0.3;

/** Per-track multipliers for quieter source files. */
const TRACK_GAIN: Partial<Record<MusicTrack, number>> = {
  titleExtra: 2.2,
  giovanni: 1.44,
};

let audio: HTMLAudioElement | null = null;
let unlocked = false; // becomes true after the first user gesture
let userMuted = false;
let volume = 0.05;
let currentTrack: MusicTrack | null = null;
let pendingTrack: MusicTrack = 'title';

function effectiveVolume(): number {
  if (userMuted) return 0;
  const trackGain = TRACK_GAIN[pendingTrack] ?? 1;
  return Math.min(1, volume * MASTER_GAIN * trackGain);
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
  }
  return audio;
}

function applyTrack(a: HTMLAudioElement) {
  if (currentTrack !== pendingTrack) {
    currentTrack = pendingTrack;
    a.src = TRACKS[pendingTrack];
  }
}

function tryPlay(a: HTMLAudioElement) {
  a.play().catch(() => {
    /* Autoplay blocked; will retry on the next user gesture. */
  });
}

/**
 * Starts the audio element muted as soon as the app loads. Browsers allow
 * muted autoplay, so the track is already running and becomes audible the
 * instant the user interacts (see unlockMusic).
 */
export function primeMusic() {
  const a = ensureAudio();
  applyTrack(a);
  a.muted = !unlocked;
  a.volume = effectiveVolume();
  tryPlay(a);
}

/** Called on the first real user gesture to make the music audible. */
export function unlockMusic() {
  unlocked = true;
  const a = ensureAudio();
  applyTrack(a);
  a.muted = false;
  a.volume = effectiveVolume();
  if (a.paused) tryPlay(a);
}

export function stopMusic() {
  if (audio) audio.pause();
}

/** Resume the current looping track after a temporary override (e.g. one-shot clip). */
export function resumeMusic() {
  if (!audio) return;
  audio.muted = !unlocked;
  audio.volume = effectiveVolume();
  if (audio.paused) tryPlay(audio);
}

export function setMusicTrack(track: MusicTrack) {
  pendingTrack = track;
  if (!audio) return;
  // Same track still needs a volume refresh (per-track gain), but skip reloading src.
  if (currentTrack === track && !audio.paused) {
    audio.volume = effectiveVolume();
    return;
  }
  applyTrack(audio);
  audio.muted = !unlocked;
  audio.volume = effectiveVolume();
  tryPlay(audio);
}

export function setMusicMuted(value: boolean) {
  userMuted = value;
  if (!audio) return;
  audio.volume = effectiveVolume();
  if (!userMuted) {
    // Toggling sound is a user gesture, so unlock + resume if needed.
    unlocked = true;
    audio.muted = false;
    if (audio.paused) tryPlay(audio);
  }
}

export function setMusicVolume(nextVolume: number) {
  volume = Math.max(0, Math.min(1, nextVolume));
  if (audio) audio.volume = effectiveVolume();
}

// One-shot clips that are currently playing, so they can be stopped on demand
// (e.g. when the player leaves the victory screen).
let activeClips: HTMLAudioElement[] = [];

/**
 * Plays a short one-shot audio clip (e.g. a victory jingle) over the top of the
 * background music. Respects the global mute toggle and volume slider, but
 * boosts the level a touch so the jingle is audible above the looping track.
 */
export function playClip(src: string, volumeScale = 1): HTMLAudioElement | null {
  if (userMuted) return null;
  try {
    const clip = new Audio(src);
    const base = Math.min(1, Math.max(volume, volume * 2, 0.1));
    clip.volume = Math.min(1, Math.max(0, base * volumeScale));
    activeClips.push(clip);
    clip.addEventListener('ended', () => {
      activeClips = activeClips.filter((c) => c !== clip);
    });
    clip.play().catch(() => {
      /* Autoplay blocked until a user gesture; safe to ignore. */
    });
    return clip;
  } catch {
    /* Audio not available. */
    return null;
  }
}

/** Stops and removes a single clip previously started via playClip. */
export function stopClip(clip: HTMLAudioElement | null) {
  if (!clip) return;
  cancelClipFade(clip);
  clip.pause();
  clip.currentTime = 0;
  activeClips = activeClips.filter((c) => c !== clip);
}

const clipFadeRafs = new WeakMap<HTMLAudioElement, number>();

function cancelClipFade(clip: HTMLAudioElement) {
  const raf = clipFadeRafs.get(clip);
  if (raf != null) {
    cancelAnimationFrame(raf);
    clipFadeRafs.delete(clip);
  }
}

/**
 * Fade a one-shot clip to silence, then stop it.
 * Resolves when the fade finishes (or immediately if there is no clip).
 */
export function fadeOutClip(clip: HTMLAudioElement | null, durationMs = 1200): Promise<void> {
  if (!clip) return Promise.resolve();
  cancelClipFade(clip);
  const startVol = clip.volume;
  if (startVol <= 0 || durationMs <= 0) {
    stopClip(clip);
    return Promise.resolve();
  }
  const start = performance.now();
  return new Promise((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      clip.volume = startVol * (1 - t);
      if (t < 1) {
        const raf = requestAnimationFrame(step);
        clipFadeRafs.set(clip, raf);
        return;
      }
      clipFadeRafs.delete(clip);
      stopClip(clip);
      resolve();
    };
    const raf = requestAnimationFrame(step);
    clipFadeRafs.set(clip, raf);
  });
}

/** Immediately stops any one-shot clips started via playClip. */
export function stopClips() {
  for (const clip of activeClips) {
    clip.pause();
    clip.currentTime = 0;
  }
  activeClips = [];
}
