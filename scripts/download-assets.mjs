import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'public', 'assets');

const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const SHOWDOWN = 'https://play.pokemonshowdown.com/sprites/trainers';

const ITEMS = [
  'potion.png',
  'full-heal.png',
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
];

async function download(url, dest, { force = false } = {}) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  if (!force && fs.existsSync(dest)) return;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Skip ${url}: ${res.status}`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`Saved ${path.relative(root, dest)}`);
  } catch (err) {
    console.warn(`Failed ${url}:`, err.message);
  }
}

async function main() {
  for (const file of ITEMS) {
    await download(`${POKEAPI}/items/${file}`, path.join(assetsDir, 'items', file), {
      force: file === 'ultra-ball.png',
    });
  }

  for (let i = 1; i <= 8; i++) {
    await download(`${POKEAPI}/badges/${i}.png`, path.join(assetsDir, 'badges', `${i}.png`));
  }

  for (const file of TRAINERS) {
    await download(`${SHOWDOWN}/${file}`, path.join(assetsDir, 'trainers', file));
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

  console.log('Asset download complete.');
}

main();
