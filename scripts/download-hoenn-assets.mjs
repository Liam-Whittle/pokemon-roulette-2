/**
 * Download Hoenn (252–386) sprites, artwork, battle GIFs, trainers, and badges.
 * Safe to re-run; skips files that already exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'public', 'assets');

const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/trainers';
const BATTLE_GIF_CDN =
  'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/versions/generation-v/black-white/animated';
const BATTLE_GIF_RAW = `${POKEAPI}/pokemon/versions/generation-v/black-white/animated`;
const SHOWDOWN_ANI = 'https://play.pokemonshowdown.com/sprites/ani';

/** local filename → Showdown source candidates */
const TRAINERS = {
  'brendan.png': ['brendan.png', 'brendan-gen3.png'],
  'may.png': ['may.png', 'may-gen3.png'],
  'roxanne.png': ['roxanne.png'],
  'brawly.png': ['brawly.png'],
  'wattson.png': ['wattson.png'],
  'flannery.png': ['flannery.png'],
  'norman.png': ['norman.png'],
  'winona.png': ['winona.png'],
  'tateandliza.png': ['tateandliza.png', 'tateliza.png', 'tate.png'],
  'juan.png': ['juan.png'],
  'sidney.png': ['sidney.png'],
  'phoebe.png': ['phoebe-gen3.png', 'phoebe.png'],
  'glacia.png': ['glacia.png'],
  'drake-gen3.png': ['drake-gen3.png', 'drake.png'],
  'wallace.png': ['wallace.png'],
  'aquagrunt.png': ['aquagrunt.png', 'teamagua.png', 'aqua.png'],
  'magmagrunt.png': ['magmagrunt.png', 'teammagma.png', 'magma.png'],
  'silver.png': ['silver.png'],
};

const SPECIES_NAMES = {
  74: 'geodude',
  66: 'machop',
  82: 'magneton',
  100: 'voltorb',
  218: 'slugma',
  227: 'skarmory',
  73: 'tentacruel',
  130: 'gyarados',
  178: 'xatu',
  230: 'kingdra',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hasFile(dest) {
  return fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

async function download(url, dest, { force = false, retries = 5 } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!force && hasFile(dest)) return true;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) return false;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 50) return false;
      fs.writeFileSync(dest, buf);
      console.log(`Saved ${path.relative(root, dest)}`);
      return true;
    } catch {
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return false;
    }
  }
  return false;
}

async function downloadTrainer(localName, sources) {
  const dest = path.join(assetsDir, 'trainers', localName);
  if (hasFile(dest)) return;
  for (const src of sources) {
    if (await download(`${SHOWDOWN}/${src}`, dest)) return;
  }
  console.warn(`Missing trainer ${localName}`);
}

async function downloadBattleGif(id, slugHint) {
  const dest = path.join(assetsDir, 'pokemon', 'battle', `${id}.gif`);
  if (hasFile(dest)) return;
  if (await download(`${BATTLE_GIF_CDN}/${id}.gif`, dest)) return;
  if (await download(`${BATTLE_GIF_RAW}/${id}.gif`, dest)) return;
  if (slugHint && (await download(`${SHOWDOWN_ANI}/${slugHint}.gif`, dest))) return;
  console.warn(`Missing battle gif ${id}`);
}

async function main() {
  console.log('Hoenn trainers…');
  for (const [local, sources] of Object.entries(TRAINERS)) {
    await downloadTrainer(local, sources);
    await sleep(100);
  }

  // Copy aqua grunt as fallback if magma missing (and vice versa)
  const aqua = path.join(assetsDir, 'trainers', 'aquagrunt.png');
  const magma = path.join(assetsDir, 'trainers', 'magmagrunt.png');
  if (hasFile(aqua) && !hasFile(magma)) fs.copyFileSync(aqua, magma);
  if (hasFile(magma) && !hasFile(aqua)) fs.copyFileSync(magma, aqua);

  console.log('Hoenn badges 17–24 (best-effort)…');
  for (let i = 17; i <= 24; i++) {
    const dest = path.join(assetsDir, 'badges', `${i}.png`);
    if (hasFile(dest)) continue;
    const ok = await download(`${POKEAPI}/badges/${i}.png`, dest);
    if (!ok) {
      // Fallback: reuse Kanto badge styling placeholders from 1–8
      const fallback = path.join(assetsDir, 'badges', `${((i - 17) % 8) + 1}.png`);
      if (hasFile(fallback)) {
        fs.copyFileSync(fallback, dest);
        console.log(`Badge ${i} fallback from ${path.basename(fallback)}`);
      }
    }
    await sleep(80);
  }

  console.log('Sprites / artwork / battle GIFs 252–386…');
  for (let id = 252; id <= 386; id++) {
    await download(`${POKEAPI}/pokemon/${id}.png`, path.join(assetsDir, 'pokemon', `${id}.png`));
    await download(
      `${POKEAPI}/pokemon/shiny/${id}.png`,
      path.join(assetsDir, 'pokemon', `${id}-shiny.png`),
    );
    await download(
      `${POKEAPI}/pokemon/other/official-artwork/${id}.png`,
      path.join(assetsDir, 'artwork', `${id}.png`),
    );
    await download(
      `${POKEAPI}/pokemon/other/official-artwork/shiny/${id}.png`,
      path.join(assetsDir, 'artwork', `${id}-shiny.png`),
    );
    await downloadBattleGif(id);
    await sleep(120);
  }

  // Gym extras outside Hoenn dex that appear on Emerald teams
  const extras = [66, 73, 74, 82, 100, 130, 178, 218, 227, 230];
  console.log('Gym extra battle GIFs…');
  for (const id of extras) {
    await downloadBattleGif(id, SPECIES_NAMES[id]);
    await sleep(120);
  }

  console.log('Hoenn asset download complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
