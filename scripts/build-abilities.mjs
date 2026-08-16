import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cacheDir = path.join(root, 'src', 'data', 'cache');
const RAW = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const REGION_MAX = 386;
const EN = 9;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function cleanEffect(text) {
  return text
    .replace(/\[([^\]]+)\]\{[^}]+\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseSlug(slug) {
  return slug
    .split('-')
    .map((w) => (w === 'of' || w === 'the' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

const [abilitiesCsv, namesCsv, proseCsv, pokeAbilCsv] = await Promise.all([
  fetchText(`${RAW}/abilities.csv`),
  fetchText(`${RAW}/ability_names.csv`),
  fetchText(`${RAW}/ability_prose.csv`),
  fetchText(`${RAW}/pokemon_abilities.csv`),
]);

const abilities = parseCsv(abilitiesCsv);
const names = parseCsv(namesCsv);
const prose = parseCsv(proseCsv);
const pokeAbils = parseCsv(pokeAbilCsv);

const nameById = new Map();
for (const row of names) {
  if (Number(row.local_language_id) === EN) nameById.set(Number(row.ability_id), row.name);
}

const effectById = new Map();
for (const row of prose) {
  if (Number(row.local_language_id) === EN) {
    effectById.set(Number(row.ability_id), cleanEffect(row.short_effect || row.effect || ''));
  }
}

const slugById = new Map();
for (const row of abilities) {
  slugById.set(Number(row.id), row.identifier);
}

const species = {};
const usedAbilityIds = new Set();

for (const row of pokeAbils) {
  const pokeId = Number(row.pokemon_id);
  if (pokeId < 1 || pokeId > REGION_MAX) continue;
  const abilityId = Number(row.ability_id);
  const slug = slugById.get(abilityId);
  if (!slug) continue;
  usedAbilityIds.add(abilityId);
  if (!species[pokeId]) species[pokeId] = { standard: [], hidden: null };
  if (Number(row.is_hidden) === 1) {
    species[pokeId].hidden = slug;
  } else if (!species[pokeId].standard.includes(slug)) {
    species[pokeId].standard.push(slug);
  }
}

const catalog = {};
for (const id of usedAbilityIds) {
  const slug = slugById.get(id);
  if (!slug) continue;
  catalog[slug] = {
    name: nameById.get(id) ?? titleCaseSlug(slug),
    shortEffect: effectById.get(id) ?? 'No additional effect.',
  };
}

fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(path.join(cacheDir, 'species-abilities.json'), `${JSON.stringify(species, null, 2)}\n`);
fs.writeFileSync(path.join(cacheDir, 'abilities.json'), `${JSON.stringify(catalog, null, 2)}\n`);

const speciesCount = Object.keys(species).length;
const abilityCount = Object.keys(catalog).length;
console.log(`Wrote ${speciesCount} species ability maps and ${abilityCount} abilities.`);
