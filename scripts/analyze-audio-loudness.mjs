/**
 * Measure loudness for public/sounds via ffmpeg loudnorm + volumedetect.
 * Writes scripts/audio-loudness-report.json and scripts/audio-gain-table.json
 *
 * Usage: node scripts/analyze-audio-loudness.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const soundsDir = path.join(root, 'public', 'sounds');

/** Integrated loudness targets (LUFS). */
const TARGET_MUSIC = -16;
const TARGET_SFX = -14;
const TARGET_CRY = -16;

/** Long files whose audible attack is much hotter than integrated LUFS. */
const BURST_FILES = new Set(['pokemon_out.mp3', 'pokemon_return.mp3']);

const MATCH_MUSIC_FILES = new Set([
  'pokemon_out.mp3',
  'pokemon_return.mp3',
  'battle_pokeball_open.mp3',
  'battle_pokeball_open.wav',
  'battle_pokeball_throw.mp3',
  'battle_pokeball_throw.wav',
]);

const MUSIC_FILES = new Set([
  'title.mp3',
  'title_new.mp3',
  'title_extra.mp3',
  'create_trainer.mp3',
  'main.mp3',
  'kanto.mp3',
  'johto.mp3',
  'hoenn.mp3',
  'gym.mp3',
  'elite4.mp3',
  'pokemon.mp3',
  'game_win.mp3',
  'gamewin_new.mp3',
  'game_lose.mp3',
  'pokemart.mp3',
  'team_rocket.mp3',
  'team_aqua.mp3',
  'trainer_battle.mp3',
  'rival_battle.mp3',
  'giovanni.mp3',
  'game_corner.mp3',
  'cinnabar_island.mp3',
  'missingno_catch.mp3',
]);

const CRY_RE = /(_cry|cry\.)/i;

function listAudioFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort();
}

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', args, {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return `${result.stderr ?? ''}\n${result.stdout ?? ''}`;
}

function parseLoudnormJson(log) {
  const start = log.lastIndexOf('{');
  const end = log.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(log.slice(start, end + 1));
  } catch {
    return null;
  }
}

function analyze(file) {
  const loudLog = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
    '-f',
    'null',
    '-',
  ]);
  const ln = parseLoudnormJson(loudLog);
  const volLog = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const mean = volLog.match(/mean_volume:\s*([-\d.]+)\s*dB/);
  const max = volLog.match(/max_volume:\s*([-\d.]+)\s*dB/);
  const dur = loudLog.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  let durationSec = null;
  if (dur) {
    durationSec = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  }
  const name = path.basename(file);
  let burstI = null;
  let burstTp = null;
  if (BURST_FILES.has(name)) {
    const burstLog = runFfmpeg([
      '-hide_banner',
      '-nostats',
      '-t',
      '1.5',
      '-i',
      file,
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ]);
    const burst = parseLoudnormJson(burstLog);
    if (burst) {
      burstI = Number(burst.input_i);
      burstTp = Number(burst.input_tp);
    }
  }
  return {
    file: name,
    durationSec,
    inputI: ln ? Number(ln.input_i) : null,
    inputTp: ln ? Number(ln.input_tp) : null,
    inputLra: ln ? Number(ln.input_lra) : null,
    burstI,
    burstTp,
    meanVolumeDb: mean ? Number(mean[1]) : null,
    maxVolumeDb: max ? Number(max[1]) : null,
  };
}

function categoryFor(name) {
  if (MUSIC_FILES.has(name) || MATCH_MUSIC_FILES.has(name)) return 'music';
  if (CRY_RE.test(name)) return 'cry';
  return 'sfx';
}

function targetFor(cat) {
  if (cat === 'music') return TARGET_MUSIC;
  if (cat === 'cry') return TARGET_CRY;
  return TARGET_SFX;
}

/** Linear gain from measured LUFS → target, limited by true-peak headroom. */
function computeGain(row) {
  const cat = categoryFor(row.file);
  const target = targetFor(cat);
  const loudness = row.burstI != null && Number.isFinite(row.burstI) ? row.burstI : row.inputI;
  if (loudness == null || !Number.isFinite(loudness)) {
    return { category: cat, targetLufs: target, gainDb: 0, gainLinear: 1, note: 'no measurement' };
  }
  // Short one-shots: loudnorm I can under-read; prefer max_volume toward -3 dBFS.
  let gainDb = target - loudness;
  if (cat !== 'music' && row.durationSec != null && row.durationSec < 3 && row.maxVolumeDb != null) {
    const peakTarget = -3;
    const peakGain = peakTarget - row.maxVolumeDb;
    // Blend: don't boost quiet short SFX solely from LUFS (can explode)
    gainDb = Math.min(gainDb, peakGain);
  }
  // True-peak safety: don't push TP above -1.0 dBTP
  if (row.inputTp != null && Number.isFinite(row.inputTp)) {
    const maxBoost = -1.0 - row.inputTp;
    if (gainDb > maxBoost) gainDb = maxBoost;
  }
  // Cap extreme corrections
  gainDb = Math.max(-18, Math.min(12, gainDb));
  const gainLinear = Math.pow(10, gainDb / 20);
  return {
    category: cat,
    targetLufs: target,
    gainDb: Number(gainDb.toFixed(2)),
    gainLinear: Number(gainLinear.toFixed(4)),
  };
}

const files = listAudioFiles(soundsDir);
const rows = [];
for (const file of files) {
  process.stdout.write(`Analyzing ${path.basename(file)}… `);
  const row = analyze(file);
  rows.push(row);
  const measured = row.burstI ?? row.inputI;
  console.log(
    measured != null
      ? `${measured.toFixed(1)} LUFS / TP ${row.inputTp?.toFixed(1)} dBTP${row.burstI != null ? ' (burst)' : ''}`
      : 'FAILED',
  );
}

const gains = {};
for (const row of rows) {
  gains[row.file] = {
    ...computeGain(row),
    measuredLufs: row.burstI ?? row.inputI,
    measuredTp: row.burstTp ?? row.inputTp,
  };
}

rows.sort((a, b) => (a.burstI ?? a.inputI ?? 99) - (b.burstI ?? b.inputI ?? 99));

const reportPath = path.join(root, 'scripts', 'audio-loudness-report.json');
const gainPath = path.join(root, 'scripts', 'audio-gain-table.json');
fs.writeFileSync(reportPath, JSON.stringify({ targets: { music: TARGET_MUSIC, sfx: TARGET_SFX, cry: TARGET_CRY }, rows }, null, 2));
fs.writeFileSync(gainPath, JSON.stringify(gains, null, 2));

console.log('\nQuietest → loudest (measured LUFS):');
for (const r of rows) {
  const g = gains[r.file];
  console.log(
    `${String((r.burstI ?? r.inputI)?.toFixed(1) ?? 'n/a').padStart(7)} LUFS | ${String(g.gainDb).padStart(6)} dB → ×${String(g.gainLinear).padStart(6)} | ${g.category.padEnd(5)} | ${r.file}`,
  );
}
console.log(`\nWrote ${reportPath}`);
console.log(`Wrote ${gainPath}`);
