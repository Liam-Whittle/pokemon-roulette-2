import { asset } from './asset';

let audioCtx: AudioContext | null = null;

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

const sampleCache = new Map<string, HTMLAudioElement>();

/** Play a one-shot sample from public/; returns false if it couldn't start. */
function playSample(path: string, volume = 0.55): boolean {
  try {
    let base = sampleCache.get(path);
    if (!base) {
      base = new Audio(asset(path));
      base.preload = 'auto';
      sampleCache.set(path, base);
    }
    const clip = base.cloneNode(true) as HTMLAudioElement;
    clip.volume = Math.max(0, Math.min(1, volume));
    void clip.play().catch(() => {
      /* Autoplay / missing file — ignore. */
    });
    return true;
  } catch {
    return false;
  }
}

/** Prefer ripped game SFX (.mp3/.ogg), fall back to generated .wav. */
function playBattleSample(basename: string, volume: number): boolean {
  for (const ext of ['mp3', 'ogg', 'wav'] as const) {
    if (playSample(`sounds/${basename}.${ext}`, volume)) return true;
  }
  return false;
}

function synthHit() {
  playTone(90, 0.14, 'sine', 0.22);
  playTone(160, 0.1, 'triangle', 0.16);
  playNoise(0.09, 0.28, 1400);
  setTimeout(() => playTone(70, 0.08, 'sine', 0.12), 35);
}

export const sfx = {
  click: () => playTone(800, 0.08, 'square', 0.08),
  spin: () => playTone(400, 0.15, 'sawtooth', 0.06),
  tick: () => playTone(1500, 0.03, 'square', 0.07),
  spinStop: () => playTone(600, 0.2, 'triangle', 0.1),
  throw: () => {
    playTone(300, 0.1, 'square', 0.1);
    setTimeout(() => playTone(500, 0.15, 'sine', 0.08), 80);
  },
  dig: () => playTone(120, 0.08, 'square', 0.1),
  clink: () => {
    playTone(620, 0.06, 'sine', 0.1);
    setTimeout(() => playTone(920, 0.1, 'sine', 0.09), 50);
  },
  /** Gen 3 Ruby/Sapphire "Hit Normal Damage" SE (shared physical impact). */
  hitPhysical: () => {
    if (!playBattleSample('battle_hit_physical', 0.56)) synthHit();
  },
  /** Fallback / contact-style hit (Counter, unknown category). */
  hit: () => {
    if (!playBattleSample('battle_hit_physical', 0.56)) synthHit();
  },
  buff: () => {
    // Gen 3 Stat Rise Up SE
    if (!playBattleSample('battle_buff', 0.44)) {
      playTone(523, 0.1, 'sine', 0.1);
      setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 50);
      setTimeout(() => playTone(784, 0.16, 'sine', 0.08), 100);
    }
  },
  statusHit: () => {
    // Gen 3 Stat Fall Down SE
    if (!playBattleSample('battle_status', 0.4)) {
      playTone(340, 0.12, 'triangle', 0.08);
    }
  },
  shake: () => playTone(150, 0.08, 'triangle', 0.1),
  ballClick: () => {
    playTone(1800, 0.04, 'square', 0.12);
    setTimeout(() => playTone(2400, 0.06, 'sine', 0.1), 30);
  },
  catch: () => {
    playTone(523, 0.15, 'sine', 0.12);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 120);
    setTimeout(() => playTone(784, 0.25, 'sine', 0.12), 240);
  },
  fail: () => playTone(180, 0.3, 'sawtooth', 0.08),
  item: () => {
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
};

export function playSfx(name: keyof typeof sfx, muted: boolean) {
  if (muted) return;
  sfx[name]();
}

/** Gen 3 special-move SE keyed by type (`battle_special_<type>.mp3`). */
function playSpecialByType(moveType: string | undefined) {
  const type = (moveType ?? 'normal').toLowerCase();
  if (playBattleSample(`battle_special_${type}`, 0.52)) return;
  // Unknown / missing type → Normal Swift, then synth
  if (type !== 'normal' && playBattleSample('battle_special_normal', 0.52)) return;
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
