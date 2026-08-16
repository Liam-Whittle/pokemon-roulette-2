import { DEBUG_STORAGE_KEY } from '../data/prestige';

type Phase = 'settings' | 'sound' | 'done';

let phase: Phase = 'settings';
let count = 0;
let lastClickAt = 0;
const GAP_MS = 2000;
const NEED = 10;

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function isDebugUnlocked(): boolean {
  try {
    return sessionStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function subscribeDebugUnlock(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function resetSequence() {
  phase = 'settings';
  count = 0;
}

function noteClick() {
  const now = Date.now();
  if (lastClickAt && now - lastClickAt > GAP_MS) {
    resetSequence();
  }
  lastClickAt = now;
}

export function registerSettingsDebugClick(): void {
  if (isDebugUnlocked()) return;
  noteClick();
  if (phase !== 'settings') {
    resetSequence();
    noteClick();
  }
  count += 1;
  if (count >= NEED) {
    phase = 'sound';
    count = 0;
  }
}

export function registerSoundDebugClick(): boolean {
  if (isDebugUnlocked()) return true;
  noteClick();
  if (phase !== 'sound') {
    resetSequence();
    return false;
  }
  count += 1;
  if (count >= NEED) {
    try {
      sessionStorage.setItem(DEBUG_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    phase = 'done';
    count = 0;
    notify();
    return true;
  }
  return false;
}
