import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(__dirname, '..', 'src', 'data', 'cache', 'species-gen1.json');
const species = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

for (let id = 1; id <= 151; id++) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`pokemon ${id}: ${res.status}`);
  const data = await res.json();
  const key = String(id);
  if (!species[key]) continue;
  species[key].weightKg = data.weight / 10;
  console.log(`${id} ${data.name}: ${species[key].weightKg} kg`);
}

fs.writeFileSync(cachePath, JSON.stringify(species, null, 2));
console.log('Patched species-gen1.json with weightKg');
