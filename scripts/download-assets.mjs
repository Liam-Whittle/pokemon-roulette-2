import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'public', 'assets');

const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/trainers';
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

const ITEMS = [
  'potion.png',
  'full-heal.png',
  'heal-powder.png',
  'rare-candy.png',
  'x-attack.png',
  'max-elixir.png',
  'max-revive.png',
  'sacred-ash.png',
  'poke-ball.png',
  'great-ball.png',
  'ultra-ball.png',
  'master-ball.png',
  'shiny-charm.png',
  'fire-stone.png',
  'water-stone.png',
  'thunder-stone.png',
  'leaf-stone.png',
  'moon-stone.png',
  'trade-stone.png',
  'super-rod.png',
  'poke-radar.png',
  'explorer-kit.png',
  'helix-fossil.png',
  'poke-flute.png',
  'nugget.png',
  'kings-rock.png',
  'gold-bottle-cap.png',
  'reaper-cloth.png',
  'dubious-disc.png',
  'dowsing-machine.png',
  'heart-scale.png',
  'escape-rope.png',
  'eject-button.png',
  'amulet-coin.png',
  'electric-gem.png',
  'mystery-egg.png',
];

const TRAINERS = [
  'brock.png',
  'misty.png',
  'ltsurge.png',
  'erika.png',
  'koga.png',
  'sabrina.png',
  'blaine.png',
  'giovanni.png',
  'lorelei-gen1rb.png',
  'bruno.png',
  'agatha-gen1rb.png',
  'lance.png',
  'blue.png',
  'red-gen3.png',
  'leaf-gen3.png',
  'rocketgrunt.png',
];

/** Extra Pokémon sprites not covered by the 1–151 batch download. */
const EXTRA_POKEMON_SPRITES = [];
const ITEM_SOURCE_OVERRIDES = {
  'trade-stone.png': 'enigma-stone.png',
};

async function download(url, dest, { force = false, retries = 6 } = {}) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
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
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      console.warn(`Failed ${url}:`, err.message);
    }
  }
}

async function main() {
  for (const file of ITEMS) {
    const sourceFile = ITEM_SOURCE_OVERRIDES[file] ?? file;
    await download(`${POKEAPI}/items/${sourceFile}`, path.join(assetsDir, 'items', file), {
      force: file === 'ultra-ball.png',
    });
  }

  for (let i = 1; i <= 8; i++) {
    await download(`${POKEAPI}/badges/${i}.png`, path.join(assetsDir, 'badges', `${i}.png`));
  }

  for (const file of TRAINERS) {
    await download(`${SHOWDOWN}/${file}`, path.join(assetsDir, 'trainers', file));
  }

  const gymBattleIds = loadGymBattlePokemonIds();
  console.log(`Downloading ${gymBattleIds.length} gym / Elite Four battle GIFs…`);
  for (const id of gymBattleIds) {
    const dest = path.join(assetsDir, 'pokemon', 'battle', `${id}.gif`);
    await download(`${BATTLE_GIF_CDN}/${id}.gif`, dest);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      await download(`${BATTLE_GIF_RAW}/${id}.gif`, dest);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  for (let id = 1; id <= 151; id++) {
    await download(`${POKEAPI}/pokemon/${id}.png`, path.join(assetsDir, 'pokemon', `${id}.png`));
    await download(
      `${POKEAPI}/pokemon/shiny/${id}.png`,
      path.join(assetsDir, 'pokemon', `${id}-shiny.png`),
      { force: true },
    );
    await download(
      `${POKEAPI}/pokemon/other/official-artwork/${id}.png`,
      path.join(assetsDir, 'artwork', `${id}.png`),
      { force: true },
    );
    await download(
      `${POKEAPI}/pokemon/other/official-artwork/shiny/${id}.png`,
      path.join(assetsDir, 'artwork', `${id}-shiny.png`),
      { force: true },
    );
  }

  for (const { url, dest } of EXTRA_POKEMON_SPRITES) {
    await download(url, path.join(assetsDir, dest));
  }

  console.log('Asset download complete.');
}

main();
