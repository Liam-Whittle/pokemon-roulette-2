import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const moves = JSON.parse(fs.readFileSync(path.join(root, 'src/data/cache/moves.json'), 'utf8'));
const species = JSON.parse(fs.readFileSync(path.join(root, 'src/data/cache/species-gen1.json'), 'utf8'));

console.log('species count', Object.keys(species).length);
console.log('252', species['252']?.name, '386', species['386']?.name);

const raw = fs.readFileSync(path.join(root, 'src/data/speciesMovesGen3.ts'), 'utf8');
const start = raw.indexOf('const RAW_ROWS = `') + 'const RAW_ROWS = `'.length;
const end = raw.indexOf('`.trim()', start);
const lines = raw.slice(start, end).trim().split('\n');

const aliases = {
  'faint-attack': 'feint-attack',
  'hi-jump-kick': 'high-jump-kick',
  dragonbreath: 'dragon-breath',
  bubblebeam: 'bubble-beam',
  'sand-attack': 'sand-attack',
  ancientpower: 'ancient-power',
  'will-o-wisp': 'will-o-wisp',
  thunderpunch: 'thunder-punch',
  solarbeam: 'solar-beam',
  'hidden-power': 'hidden-power',
};

function slug(name) {
  const n = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-');
  return aliases[n] ?? n;
}

const missing = new Set();
for (const line of lines) {
  const parts = line.split(',');
  for (const m of parts.slice(2, 6)) {
    const s = slug(m.trim());
    if (!moves[s]) missing.add(`${s} (from ${m.trim()})`);
  }
}
console.log('missing curated moves:', [...missing].sort().join(', ') || 'none');

const assets = path.join(root, 'public/assets');
const checks = [
  'trainers/may.png',
  'trainers/brendan.png',
  'trainers/roxanne.png',
  'trainers/phoebe.png',
  'trainers/wallace.png',
  'trainers/aquagrunt.png',
  'badges/17.png',
  'badges/24.png',
  'pokemon/252.png',
  'pokemon/386.png',
  'artwork/252.png',
  'pokemon/battle/252.gif',
  'pokemon/battle/386.gif',
  'sounds/../sounds/hoenn.mp3',
];
// hoenn mp3 lives in public/sounds
checks.pop();
const soundOk = fs.existsSync(path.join(root, 'public/sounds/hoenn.mp3'));
console.log('hoenn.mp3', soundOk);

for (const rel of checks) {
  const p = path.join(assets, rel);
  const ok = fs.existsSync(p) && fs.statSync(p).size > 0;
  if (!ok) console.log('MISSING asset', rel);
}
console.log('asset spot-check done');

// pools.ts presence
const pools = fs.readFileSync(path.join(root, 'src/data/pools.ts'), 'utf8');
for (const needle of [
  "RegionId = 'Kanto' | 'Johto' | 'Hoenn'",
  'HOENN_GYM_LEADERS',
  'HOENN_ELITE_FOUR',
  'HOENN_STARTER_IDS',
  'getRegionAllPokemonPool',
]) {
  console.log(needle, pools.includes(needle) ? 'ok' : 'MISSING');
}
