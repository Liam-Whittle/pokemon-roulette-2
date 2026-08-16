/**
 * Per-file linear gains after loudness normalization (targets: music/cry -16 LUFS, SFX -14).
 * Residual corrections only — most entries stay near 1. Regenerate via:
 *   node scripts/analyze-audio-loudness.mjs
 * then copy gainLinear values if a new asset needs a tweak.
 */
const AUDIO_GAIN: Record<string, number> = {
  // Kept empty on purpose after batch normalize; lookup falls back to 1.
};

/** Linear gain for a public sound path or URL (basename match). */
export function gainForSoundSrc(src: string): number {
  const base = src.split(/[?#]/)[0]?.split(/[/\\]/).pop()?.toLowerCase() ?? '';
  const g = AUDIO_GAIN[base];
  return g != null && Number.isFinite(g) ? g : 1;
}
