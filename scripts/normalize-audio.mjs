/**
 * Normalize public/sounds to consistent loudness targets (two-pass loudnorm).
 * Music/cries → -16 LUFS; SFX/jingles → -14 LUFS; true peak ≤ -1.5 dBTP.
 *
 * Short / burst SFX (pokéball send-out, etc.) are matched to the first 1.5s
 * so a long silent tail doesn't hide a piercing attack. Short clips also use
 * a stricter -3 dBTP cap.
 *
 * Files already within 1 LUFS of target (and under the TP cap) are skipped
 * to avoid generation-loss re-encodes. Pass --force to rewrite everything.
 *
 * Usage: node scripts/normalize-audio.mjs
 *        node scripts/normalize-audio.mjs --force
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const soundsDir = path.join(root, 'public', 'sounds');
const reportPath = path.join(root, 'scripts', 'audio-loudness-report.json');
const force = process.argv.includes('--force');
const CLOSE_LUFS = 1.0;

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

/** Long files whose audible attack is much hotter than integrated LUFS. */
const BURST_FILES = new Set(['pokemon_out.mp3', 'pokemon_return.mp3']);

/** Match music so send-out / return sit in the same mix. */
const MATCH_MUSIC_FILES = new Set([
  'pokemon_out.mp3',
  'pokemon_return.mp3',
  'battle_pokeball_open.mp3',
  'battle_pokeball_open.wav',
  'battle_pokeball_throw.mp3',
  'battle_pokeball_throw.wav',
]);

function isCry(name) {
  return /_cry/i.test(name);
}

function isMusicLike(name) {
  return MUSIC_FILES.has(name) || isCry(name) || MATCH_MUSIC_FILES.has(name);
}

function targetI(name) {
  if (isMusicLike(name)) return -16;
  return -14;
}

function targetTp(name, durationSec) {
  if (BURST_FILES.has(name) || MATCH_MUSIC_FILES.has(name)) return -3;
  if (durationSec != null && durationSec < 3 && !MUSIC_FILES.has(name) && !isCry(name)) return -3;
  return -1.5;
}

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', args, {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { code: result.status ?? 1, log: `${result.stderr ?? ''}\n${result.stdout ?? ''}` };
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

function parseDuration(log) {
  const dur = log.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!dur) return null;
  return Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
}

function measure(file, extraInputArgs = []) {
  const { log } = runFfmpeg([
    '-hide_banner',
    '-nostats',
    ...extraInputArgs,
    '-i',
    file,
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
    '-f',
    'null',
    '-',
  ]);
  const ln = parseLoudnormJson(log);
  if (!ln) return null;
  return { ...ln, durationSec: parseDuration(log) };
}

function codecArgs(ext) {
  if (ext === '.mp3') return ['-codec:a', 'libmp3lame', '-q:a', '2'];
  if (ext === '.ogg') return ['-codec:a', 'libvorbis', '-q:a', '6'];
  return ['-codec:a', 'pcm_s16le'];
}

function applyFilter(file, filter) {
  const ext = path.extname(file).toLowerCase();
  const tmp = `${file}.norm.tmp${ext}`;
  const args = ['-y', '-hide_banner', '-nostats', '-i', file, '-af', filter, ...codecArgs(ext), tmp];
  const { code, log } = runFfmpeg(args);
  if (code !== 0 || !fs.existsSync(tmp)) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw new Error(`normalize failed: ${path.basename(file)}\n${log.slice(-500)}`);
  }
  fs.renameSync(tmp, file);
}

function normalizeFile(file) {
  const name = path.basename(file);
  const I = targetI(name);
  const full = measure(file);
  if (!full) throw new Error(`measure failed: ${name}`);

  const durationSec = full.durationSec;
  const TP = targetTp(name, durationSec);
  let measuredI = Number(full.input_i);
  let window = 'full';

  if (BURST_FILES.has(name)) {
    const burst = measure(file, ['-t', '1.5']);
    const burstI = burst ? Number(burst.input_i) : NaN;
    if (Number.isFinite(burstI) && burstI > measuredI + 1) {
      measuredI = burstI;
      window = 'burst1.5s';
    }
  }

  const tp = Number(full.input_tp);
  let gainDb = I - measuredI;
  if (Number.isFinite(tp)) {
    gainDb = Math.min(gainDb, TP - tp);
  }
  gainDb = Math.max(-18, Math.min(12, gainDb));

  const alreadyClose = Math.abs(I - measuredI) <= CLOSE_LUFS && (!Number.isFinite(tp) || tp <= TP + 0.3);
  if (!force && alreadyClose) {
    return {
      name,
      skipped: true,
      target: I,
      before: measuredI,
      measuredTp: tp,
      window,
      gainDb: 0,
    };
  }

  if (window === 'burst1.5s' || !isMusicLike(name) || MATCH_MUSIC_FILES.has(name)) {
    const limit = Number(Math.pow(10, TP / 20).toFixed(4));
    applyFilter(file, `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${limit}:level=false`);
  } else {
    const filter = [
      `loudnorm=I=${I}:TP=${TP}:LRA=11`,
      `measured_I=${full.input_i}`,
      `measured_LRA=${full.input_lra}`,
      `measured_TP=${full.input_tp}`,
      `measured_thresh=${full.input_thresh}`,
      'linear=true',
      'print_format=summary',
    ].join(':');
    applyFilter(file, filter);
  }

  return {
    name,
    skipped: false,
    target: I,
    before: measuredI,
    measuredTp: tp,
    window,
    gainDb: Number(gainDb.toFixed(2)),
  };
}

const files = fs
  .readdirSync(soundsDir)
  .filter((f) => /\.(mp3|ogg|wav)$/i.test(f))
  .map((f) => path.join(soundsDir, f))
  .sort();

const results = [];
let changed = 0;
let skipped = 0;
for (const file of files) {
  process.stdout.write(`Checking ${path.basename(file)}… `);
  try {
    const r = normalizeFile(file);
    results.push(r);
    if (r.skipped) {
      skipped += 1;
      console.log(`ok ${r.before.toFixed(1)} LUFS (${r.window})`);
    } else {
      changed += 1;
      const sign = r.gainDb > 0 ? '+' : '';
      console.log(`${r.before.toFixed(1)} → ${r.target} LUFS (${sign}${r.gainDb} dB, ${r.window})`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error(err.message ?? err);
    process.exitCode = 1;
  }
}

fs.writeFileSync(
  path.join(root, 'scripts', 'audio-normalize-log.json'),
  JSON.stringify({ at: new Date().toISOString(), force, results }, null, 2),
);
console.log(`\nDone. ${changed} rewritten, ${skipped} already on target, ${results.length}/${files.length} scanned.`);
if (fs.existsSync(reportPath)) {
  console.log('Re-run: node scripts/analyze-audio-loudness.mjs');
}
