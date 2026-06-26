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
  hit: () => playTone(200, 0.12, 'square', 0.12),
  shake: () => playTone(150, 0.08, 'triangle', 0.1),
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
