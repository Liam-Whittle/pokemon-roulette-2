import { asset } from './asset';

export type MusicTrack = 'title' | 'main' | 'gym' | 'elite4' | 'pokemon' | 'gamewin' | 'gamelose';

const TRACKS: Record<MusicTrack, string> = {
  title: asset('sounds/title.mp3'),
  main: asset('sounds/main.mp3'),
  gym: asset('sounds/gym.mp3'),
  elite4: asset('sounds/elite4.mp3'),
  pokemon: asset('sounds/pokemon.mp3'),
  gamewin: asset('sounds/game_win.mp3'),
  gamelose: asset('sounds/game_lose.mp3'),
};

let audio: HTMLAudioElement | null = null;
let unlocked = false; // becomes true after the first user gesture
let userMuted = false;
let volume = 0.05;
let currentTrack: MusicTrack | null = null;
let pendingTrack: MusicTrack = 'title';

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
  a.volume = userMuted ? 0 : volume;
  tryPlay(a);
}

/** Called on the first real user gesture to make the music audible. */
export function unlockMusic() {
  unlocked = true;
  const a = ensureAudio();
  applyTrack(a);
  a.muted = false;
  a.volume = userMuted ? 0 : volume;
  if (a.paused) tryPlay(a);
}

export function stopMusic() {
  if (audio) audio.pause();
}

export function setMusicTrack(track: MusicTrack) {
  pendingTrack = track;
  if (!audio) return;
  if (currentTrack === track && !audio.paused) return;
  applyTrack(audio);
  audio.muted = !unlocked;
  audio.volume = userMuted ? 0 : volume;
  tryPlay(audio);
}

export function setMusicMuted(value: boolean) {
  userMuted = value;
  if (!audio) return;
  audio.volume = userMuted ? 0 : volume;
  if (!userMuted) {
    // Toggling sound is a user gesture, so unlock + resume if needed.
    unlocked = true;
    audio.muted = false;
    if (audio.paused) tryPlay(audio);
  }
}

export function setMusicVolume(nextVolume: number) {
  volume = Math.max(0, Math.min(1, nextVolume));
  if (audio) audio.volume = userMuted ? 0 : volume;
}

// One-shot clips that are currently playing, so they can be stopped on demand
// (e.g. when the player leaves the victory screen).
let activeClips: HTMLAudioElement[] = [];

/**
 * Plays a short one-shot audio clip (e.g. a victory jingle) over the top of the
 * background music. Respects the global mute toggle and volume slider, but
 * boosts the level a touch so the jingle is audible above the looping track.
 */
export function playClip(src: string) {
  if (userMuted) return;
  try {
    const clip = new Audio(src);
    clip.volume = Math.min(1, Math.max(volume, volume * 2, 0.1));
    activeClips.push(clip);
    clip.addEventListener('ended', () => {
      activeClips = activeClips.filter((c) => c !== clip);
    });
    clip.play().catch(() => {
      /* Autoplay blocked until a user gesture; safe to ignore. */
    });
  } catch {
    /* Audio not available. */
  }
}

/** Immediately stops any one-shot clips started via playClip. */
export function stopClips() {
  for (const clip of activeClips) {
    clip.pause();
    clip.currentTime = 0;
  }
  activeClips = [];
}
