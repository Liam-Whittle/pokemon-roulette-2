import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'public', 'assets');
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const BATTLE_GIF_CDN = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/versions/generation-v/black-white/animated';
const BATTLE_GIF_RAW = `${POKEAPI}/pokemon/versions/generation-v/black-white/animated`;

function loadGymBattlePokemonIds() {
  const poolsPath = path.join(root, 'src', 'data', 'pools.ts');
  const src = fs.readFileSync(poolsPath, 'utf8');
  const ids = new Set();
  for (const match of src.matchAll(/\{\s*id:\s*(\d+),\s*name:\s*'[^']+',\s*level:\s*\d+/g)) {
    ids.add(Number(match[1]));
  }
  return [...ids].sort((a, b) => a - b);
}

function loadGymBattlePokemonNames() {
  const poolsPath = path.join(root, 'src', 'data', 'pools.ts');
  const src = fs.readFileSync(poolsPath, 'utf8');
  const names = new Map();
  for (const match of src.matchAll(/\{\s*id:\s*(\d+),\s*name:\s*'([^']+)',\s*level:\s*\d+/g)) {
    names.set(Number(match[1]), match[2]);
  }
  return names;
}

function hasFile(dest) {
  return fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function download(url, dest, { force = false, retries = 6 } = {}) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return;
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        const wait = 1500 * (attempt + 1);
        console.warn(`Rate limited ${url}, retry in ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.warn(`Skip ${url}: ${res.status}`);
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`Saved ${path.relative(root, dest)}`);
      return;
    } catch (err) {
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      console.warn(`Failed ${url}:`, err.message);
    }
  }
}

const ids = loadGymBattlePokemonIds();
const names = loadGymBattlePokemonNames();
console.log(`Downloading ${ids.length} gym / Elite Four battle GIFs…`);
for (const id of ids) {
  const dest = path.join(assetsDir, 'pokemon', 'battle', `${id}.gif`);
  await download(`${BATTLE_GIF_CDN}/${id}.gif`, dest);
  if (!hasFile(dest)) {
    await download(`${BATTLE_GIF_RAW}/${id}.gif`, dest);
  }
  if (!hasFile(dest)) {
    const slug = names.get(id);
    if (slug) {
      await download(`https://play.pokemonshowdown.com/sprites/ani/${slug}.gif`, dest);
    }
  }
  await sleep(250);
}
console.log('Battle GIF download complete.');
