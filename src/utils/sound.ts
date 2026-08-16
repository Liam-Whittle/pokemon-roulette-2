import { asset } from './asset';
import { gainForSoundSrc } from './audioGains';
import { CRY_VOLUME_SCALE, getClipBaseVolume, playClip } from './music';
import { showdownSpriteId } from './localAssets';

let audioCtx: AudioContext | null = null;

/** Battle sample level relative to clip base (assets are normalized to -14 LUFS). */
const BATTLE_SAMPLE_SCALE = 0.85;
/** Move hits sit above other battle SFX so impacts read over music. */
const HIT_SAMPLE_SCALE = 1.54;
/** Pokéball send-out / return — a bit hotter than generic battle samples. */
const BALL_SFX_SCALE = 1.06;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio not available
  }
}

/** Short noise burst for punchier impact SFX. */
function playNoise(duration: number, volume = 0.18, filterFreq = 900) {
  try {
    const ctx = getCtx();
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + duration);
  } catch {
    // audio not available
  }
}

/**
 * Game Boy period → Hz used by pret/pokered square_note frequency args.
 * f = 131072 / (2048 - n)
 */
function gbPeriodToHz(period: number): number {
  const n = Math.max(0, Math.min(2047, period));
  return 131072 / Math.max(1, 2048 - n);
}

/**
 * Authentic-feeling recreation of pret/pokered `SFX_Ball_Toss`
 * (duty 2, pitch_sweep 2/-7, square ~1920 period ≈ 1024 Hz descending).
 */
function synthPokeballThrow() {
  try {
    const ctx = getCtx();
    const t0 = ctx.currentTime;
    const start = gbPeriodToHz(1920);
    const end = start * 0.42;

    const makeVoice = (detune: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(start + detune, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, end + detune), t0 + 0.28);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    };

    makeVoice(0, 0.11);
    makeVoice(2, 0.07);
    playNoise(0.05, 0.06, 1800);
  } catch {
    playTone(900, 0.12, 'square', 0.1);
    setTimeout(() => playTone(420, 0.14, 'square', 0.07), 90);
  }
}

/**
 * Authentic-feeling recreation of pret/pokered `SFX_Ball_Poof`
 * (square duty 2 + pitch_sweep + noise_note) — the classic “Pokémon out of ball” sound.
 */
function synthPokeballOpen() {
  try {
    const ctx = getCtx();
    const t0 = ctx.currentTime;
    const start = gbPeriodToHz(1024); // ~128 Hz
    const peak = start * 3.2;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(start, t0);
    osc.frequency.exponentialRampToValueAtTime(peak, t0 + 0.08);
    osc.frequency.exponentialRampToValueAtTime(peak * 0.7, t0 + 0.22);
    gain.gain.setValueAtTime(0.14, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.28);

    // Noise “poof” layer (Ch8 noise_note)
    playNoise(0.16, 0.22, 2400);
    setTimeout(() => playNoise(0.1, 0.1, 1200), 40);
  } catch {
    playNoise(0.12, 0.2, 2000);
    playTone(180, 0.08, 'square', 0.1);
    setTimeout(() => playTone(420, 0.1, 'square', 0.08), 50);
  }
}

/** Decoded battle SFX — Web Audio BufferSource does not get GC-cut like HTMLAudio one-shots. */
const bufferCache = new Map<string, AudioBuffer>();
const bufferLoads = new Map<string, Promise<AudioBuffer | null>>();
/** Keep BufferSource nodes referenced until they finish. */
const activeSources = new Set<AudioBufferSourceNode>();
/** Paths that 404'd / failed decode — skip on later attempts. */
const failedSamplePaths = new Set<string>();

async function loadAudioBuffer(path: string): Promise<AudioBuffer | null> {
  if (failedSamplePaths.has(path)) return null;
  const cached = bufferCache.get(path);
  if (cached) return cached;
  const inflight = bufferLoads.get(path);
  if (inflight) return inflight;

  const load = (async () => {
    try {
      const ctx = getCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => undefined);
      }
      const res = await fetch(asset(path));
      if (!res.ok) {
        failedSamplePaths.add(path);
        return null;
      }
      const raw = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      bufferCache.set(path, buffer);
      return buffer;
    } catch {
      failedSamplePaths.add(path);
      return null;
    } finally {
      bufferLoads.delete(path);
    }
  })();

  bufferLoads.set(path, load);
  return load;
}

function startBufferSource(
  buffer: AudioBuffer,
  path: string,
  volumeScale: number,
  opts?: { fadeFromRatio?: number; fadeDurationSec?: number },
): { source: AudioBufferSourceNode; durationSec: number } {
  const ctx = getCtx();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  const level = Math.max(0, Math.min(1, getClipBaseVolume() * gainForSoundSrc(path) * volumeScale));
  const durationSec = buffer.duration;
  const t0 = ctx.currentTime;
  const fadeFrom = opts?.fadeFromRatio;
  let playSec = durationSec;

  if (fadeFrom != null && fadeFrom >= 0 && fadeFrom < 1 && durationSec > 0) {
    const fadeStartOffset = durationSec * fadeFrom;
    const remaining = Math.max(0, durationSec - fadeStartOffset);
    const fadeDur = Math.min(opts?.fadeDurationSec ?? remaining, remaining);
    const fadeStart = t0 + fadeStartOffset;
    const fadeEnd = fadeStart + fadeDur;
    gain.gain.setValueAtTime(level, t0);
    gain.gain.setValueAtTime(level, fadeStart);
    gain.gain.linearRampToValueAtTime(0.0001, fadeEnd);
    playSec = fadeStartOffset + fadeDur;
  } else {
    gain.gain.setValueAtTime(level, t0);
  }

  src.connect(gain);
  gain.connect(ctx.destination);
  activeSources.add(src);
  src.onended = () => {
    activeSources.delete(src);
    try {
      src.disconnect();
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
  };
  src.start(t0);
  // Stop when the fade hits silence (or at clip end if there is no fade).
  try {
    src.stop(t0 + playSec + 0.02);
  } catch {
    /* ignore */
  }
  return { source: src, durationSec: playSec };
}

/** Play ripped battle SFX. Most clips are mp3-only; wav is used when present. */
function playBattleSample(basename: string, volumeScale = BATTLE_SAMPLE_SCALE): boolean {
  const paths = (['mp3', 'wav', 'ogg'] as const).map((ext) => `sounds/${basename}.${ext}`);
  for (const path of paths) {
    const cached = bufferCache.get(path);
    if (cached) {
      startBufferSource(cached, path, volumeScale);
      return true;
    }
  }
  const candidates = paths.filter((path) => !failedSamplePaths.has(path));
  if (candidates.length === 0) return false;

  // Don't treat a missing .wav as success — try the next extension on the same attack.
  void (async () => {
    for (const path of candidates) {
      const buffer = await loadAudioBuffer(path);
      if (buffer) {
        startBufferSource(buffer, path, volumeScale);
        return;
      }
    }
  })();
  return true;
}

/** Quick fade after the first third of pokemon_out / pokemon_return. */
const BALL_SFX_FADE_SEC = 0.14;

/**
 * Play a ball send-out / return clip. Volume holds until 30%, then fades out
 * quickly and the clip is stopped so battle flow can continue without waiting
 * for the remaining silent tail.
 * @returns audible duration in milliseconds (0 if muted / missing).
 */
export async function playPokemonBallSfx(
  kind: 'out' | 'return',
  muted: boolean,
  volumeScale = BALL_SFX_SCALE,
): Promise<number> {
  if (muted) return 0;
  const path = kind === 'out' ? 'sounds/pokemon_out.mp3' : 'sounds/pokemon_return.mp3';
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined);
    }
    const buffer = await loadAudioBuffer(path);
    if (!buffer) {
      if (kind === 'out') synthPokeballOpen();
      else synthPokeballThrow();
      return kind === 'out' ? 320 : 300;
    }
    const { durationSec } = startBufferSource(buffer, path, volumeScale, {
      fadeFromRatio: 0.3,
      fadeDurationSec: BALL_SFX_FADE_SEC,
    });
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, Math.round(durationSec * 1000) + 20);
    });
    return Math.round(durationSec * 1000);
  } catch {
    return 0;
  }
}

/** Warm pokéball SFX so the first send-out isn't waiting on decode. */
export function preloadBattleBallSfx(): void {
  void loadAudioBuffer('sounds/pokemon_out.mp3');
  void loadAudioBuffer('sounds/pokemon_return.mp3');
  void loadAudioBuffer('sounds/battle_pokeball_throw.wav');
  void loadAudioBuffer('sounds/battle_pokeball_open.wav');
  void loadAudioBuffer('sounds/battle_pokeball_throw.mp3');
  void loadAudioBuffer('sounds/battle_pokeball_open.mp3');
}

function synthHit() {
  playTone(90, 0.14, 'sine', 0.36);
  playTone(160, 0.1, 'triangle', 0.26);
  playNoise(0.09, 0.44, 1400);
  setTimeout(() => playTone(70, 0.08, 'sine', 0.19), 35);
}

/** Metallic blade *shing* fallback if the Mixkit clip fails to play. */
function synthShing() {
  try {
    const ctx = getCtx();
    const t0 = ctx.currentTime;
    const level = Math.min(1, Math.max(0.04, getClipBaseVolume() * 1.25));

    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * 0.24));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5600, t0);
    bp.frequency.exponentialRampToValueAtTime(1600, t0 + 0.22);
    bp.Q.value = 1.15;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(level * 0.42, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
    noise.connect(hp);
    hp.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.26);

    const ring = (freq: number, vol: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.7), t0 + dur);
      gain.gain.setValueAtTime(level * vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };
    ring(2100, 0.22, 0.16);
    ring(3180, 0.16, 0.22);
    ring(4820, 0.1, 0.14);
  } catch {
    playTone(2400, 0.1, 'sine', 0.1);
    playTone(3600, 0.16, 'triangle', 0.07);
  }
}

/** Mixkit "Magic sparkle whoosh" — debounce Strict Mode double-mounts. */
let lastShingAt = 0;

export const sfx = {
  click: () => playTone(800, 0.08, 'square', 0.08),
  spin: () => playTone(400, 0.15, 'sawtooth', 0.06),
  tick: () => playTone(1500, 0.03, 'square', 0.07),
  spinStop: () => playTone(600, 0.2, 'triangle', 0.1),
  /** Catch / generic toss — send-out prefers pokeballThrow. */
  throw: () => {
    if (!playBattleSample('battle_pokeball_throw')) synthPokeballThrow();
  },
  /** Gen 3 Emerald `SE_BALL_THROW` (from pret/pokeemerald se_ball_throw.mid). */
  pokeballThrow: () => {
    if (!playBattleSample('battle_pokeball_throw')) synthPokeballThrow();
  },
  /** Gen 3 Emerald `SE_BALL_OPEN` / poof (from pret/pokeemerald se_ball_open.mid). */
  pokeballOpen: () => {
    if (!playBattleSample('battle_pokeball_open')) synthPokeballOpen();
  },
  dig: () => playTone(120, 0.08, 'square', 0.1),
  clink: () => {
    playTone(620, 0.06, 'sine', 0.1);
    setTimeout(() => playTone(920, 0.1, 'sine', 0.09), 50);
  },
  /** Gen 3 Ruby/Sapphire "Hit Normal Damage" SE (shared physical impact). */
  hitPhysical: () => {
    if (!playBattleSample('battle_hit_physical', HIT_SAMPLE_SCALE)) synthHit();
  },
  /** Fallback / contact-style hit (Counter, unknown category). */
  hit: () => {
    if (!playBattleSample('battle_hit_physical', HIT_SAMPLE_SCALE)) synthHit();
  },
  buff: () => {
    if (!playBattleSample('battle_buff')) {
      playTone(523, 0.1, 'sine', 0.1);
      setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 50);
      setTimeout(() => playTone(784, 0.16, 'sine', 0.08), 100);
    }
  },
  statusHit: () => {
    if (!playBattleSample('battle_status')) {
      playTone(340, 0.12, 'triangle', 0.08);
    }
  },
  shake: () => playTone(150, 0.08, 'triangle', 0.1),
  ballClick: () => {
    playTone(1800, 0.04, 'square', 0.12);
    setTimeout(() => playTone(2400, 0.06, 'sine', 0.1), 30);
  },
  item: () => {
    playTone(523, 0.15, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 120);
    setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 240);
  },
  fail: () => playTone(180, 0.3, 'sawtooth', 0.08),
  heal: () => {
    playTone(880, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.1), 100);
  },
  battle: () => playTone(220, 0.2, 'square', 0.1),
  win: () => {
    playTone(523, 0.12, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.12), 100);
    setTimeout(() => playTone(784, 0.12, 'sine', 0.12), 200);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.12), 300);
  },
  sparkle: () => {
    playTone(1318, 0.08, 'sine', 0.1);
    setTimeout(() => playTone(1760, 0.08, 'sine', 0.1), 80);
    setTimeout(() => playTone(2093, 0.1, 'sine', 0.1), 160);
    setTimeout(() => playTone(2637, 0.18, 'sine', 0.1), 240);
  },
  /** Mixkit "Magic sparkle whoosh" for the trainer VS intro slash. */
  shing: () => {
    const now = Date.now();
    if (now - lastShingAt < 400) return;
    lastShingAt = now;
    if (!playClip(asset('sounds/vs_shing.mp3'), 1.2)) synthShing();
  },
};

export function playSfx(name: keyof typeof sfx, muted: boolean) {
  if (muted) return;
  sfx[name]();
}

/**
 * Play a species cry from the best available source:
 * explicit URL → PokeAPI cries CDN → Showdown cry CDN.
 */
export function playPokemonCry(
  opts: {
    id: number;
    speciesName?: string;
    style?: 'legacy' | 'latest';
    cryUrl?: string | null;
  },
  muted: boolean,
): void {
  if (muted || opts.id <= 0) return;

  const style = opts.style ?? 'latest';
  const pokeApiPrimary = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/${style}/${opts.id}.ogg`;
  const pokeApiAlt = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/${
    style === 'legacy' ? 'latest' : 'legacy'
  }/${opts.id}.ogg`;
  const showdown =
    opts.speciesName != null
      ? `https://play.pokemonshowdown.com/audio/cries/${showdownSpriteId(opts.speciesName)}.mp3`
      : null;

  const tryPlay = (url: string, volumeScale = CRY_VOLUME_SCALE) => {
    try {
      const clip = new Audio(url);
      clip.volume = Math.max(0, Math.min(1, getClipBaseVolume() * volumeScale));
      void clip.play().catch(() => {
        /* missing / blocked */
      });
      return clip;
    } catch {
      return null;
    }
  };

  if (opts.cryUrl) {
    tryPlay(opts.cryUrl);
    return;
  }

  const primary = tryPlay(pokeApiPrimary);
  if (!primary) {
    if (showdown) tryPlay(showdown);
    return;
  }
  primary.addEventListener(
    'error',
    () => {
      const alt = tryPlay(pokeApiAlt);
      if (!alt && showdown) tryPlay(showdown);
      else if (alt) {
        alt.addEventListener(
          'error',
          () => {
            if (showdown) tryPlay(showdown);
          },
          { once: true },
        );
      }
    },
    { once: true },
  );
}

/** Gen 3 special-move SE keyed by type (`battle_special_<type>.mp3`). */
function playSpecialByType(moveType: string | undefined) {
  const type = (moveType ?? 'normal').toLowerCase();
  if (playBattleSample(`battle_special_${type}`, HIT_SAMPLE_SCALE)) return;
  // Unknown / missing type → Normal Swift, then synth
  if (type !== 'normal' && playBattleSample('battle_special_normal', HIT_SAMPLE_SCALE)) return;
  synthHit();
}

/** Physical: shared hit SE. Special: type-specific move SE. */
export function playHitSfx(
  category: 'physical' | 'special' | 'status' | string | undefined,
  muted: boolean,
  moveType?: string,
) {
  if (muted) return;
  if (category === 'special') playSpecialByType(moveType);
  else sfx.hitPhysical();
}
