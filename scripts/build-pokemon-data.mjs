import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cacheDir = path.join(root, 'src', 'data', 'cache');
const BASE = 'https://pokeapi.co/api/v2';
const REGION_MAX = 151;

const GEN1_VERSION_GROUPS = new Set(['red-blue', 'blue', 'yellow', 'red-green']);

const GEN_ORDER = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
};

function extractId(url) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

function gen1Types(data) {
  const past = (data.past_types ?? [])
    .map((p) => ({
      gen: GEN_ORDER[p.generation.name] ?? 99,
      types: p.types.map((t) => t.type.name),
    }))
    .sort((a, b) => a.gen - b.gen);
  return past[0]?.types ?? data.types.map((t) => t.type.name);
}

function extractGen1MoveSlugs(moves) {
  const slugs = new Set();
  for (const entry of moves) {
    const slug = entry.move.name;
    const inGen1 = entry.version_group_details?.some((d) =>
      GEN1_VERSION_GROUPS.has(d.version_group.name),
    );
    if (inGen1) slugs.add(slug);
  }
  return [...slugs];
}

function findEvolutionTargets(node, currentName) {
  if (node.species.name === currentName) {
    return node.evolves_to.map((next) => extractId(next.species.url));
  }
  for (const child of node.evolves_to) {
    const targets = findEvolutionTargets(child, currentName);
    if (targets.length) return targets;
  }
  return [];
}

/** Level-up evolution targets with min_level from PokeAPI evolution_details. */
function findLevelEvolutions(node, currentName) {
  if (node.species.name === currentName) {
    const evolutions = [];
    for (const next of node.evolves_to) {
      const toId = extractId(next.species.url);
      const levelDetail = (next.evolution_details ?? []).find(
        (d) => d.trigger?.name === 'level-up' && d.min_level != null,
      );
      if (levelDetail && toId > 0 && toId <= REGION_MAX) {
        evolutions.push({ toId, minLevel: levelDetail.min_level });
      }
    }
    return evolutions;
  }
  for (const child of node.evolves_to) {
    const found = findLevelEvolutions(child, currentName);
    if (found.length) return found;
  }
  return [];
}

function mapAilment(meta) {
  const a = meta?.ailment?.name;
  if (!a || a === 'none') return null;
  if (a === 'burn') return 'burn';
  if (a === 'freeze') return 'freeze';
  if (a === 'paralysis') return 'paralysis';
  if (a === 'poison') return 'poison';
  if (a === 'sleep') return 'sleep';
  if (a === 'confusion') return null;
  return null;
}

function mapCategory(damageClass) {
  const n = damageClass?.name;
  if (n === 'physical') return 'physical';
  if (n === 'special') return 'special';
  return 'status';
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const species = {};
  const allMoveSlugs = new Set();

  for (let id = 1; id <= REGION_MAX; id++) {
    const data = await fetchJson(`${BASE}/pokemon/${id}`);
    let catchRate = 45;
    let isLegendary = false;
    let evolvesToIds = [];
    let evolutions = [];
    try {
      const sp = await fetchJson(data.species.url);
      catchRate = sp.capture_rate;
      isLegendary = sp.is_legendary;
      if (sp.evolution_chain?.url) {
        const evo = await fetchJson(sp.evolution_chain.url);
        evolvesToIds = findEvolutionTargets(evo.chain, data.name).filter(
          (evoId) => evoId > 0 && evoId <= REGION_MAX,
        );
        evolutions = findLevelEvolutions(evo.chain, data.name);
      }
    } catch {
      // optional
    }

    const stats = {
      hp: data.stats[0].base_stat,
      attack: data.stats[1].base_stat,
      defense: data.stats[2].base_stat,
      specialAttack: data.stats[3].base_stat,
      specialDefense: data.stats[4].base_stat,
      speed: data.stats[5].base_stat,
    };
    const learnset = extractGen1MoveSlugs(data.moves ?? []);
    learnset.forEach((s) => allMoveSlugs.add(s));

    species[id] = {
      id,
      name: data.name,
      types: gen1Types(data),
      baseStats: stats,
      baseStatTotal: Object.values(stats).reduce((a, b) => a + b, 0),
      catchRate,
      isLegendary,
      evolvesToIds,
      evolutions,
      learnset,
      weightKg: data.weight / 10,
    };
    console.log(`Species ${id}/${REGION_MAX}: ${data.name}`);
  }

  const moves = {};
  const slugs = [...allMoveSlugs].sort();
  for (const slug of slugs) {
    try {
      const m = await fetchJson(`${BASE}/move/${slug}`);
      moves[slug] = {
        slug,
        name: m.name
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        type: m.type.name,
        power: m.power ?? 0,
        accuracy: m.accuracy ?? 100,
        category: mapCategory(m.damage_class),
        pp: m.pp ?? 15,
        statusEffect: mapAilment(m.meta),
        isToxic: slug === 'toxic',
      };
    } catch {
      console.warn(`Skip move ${slug}`);
    }
  }

  fs.writeFileSync(path.join(cacheDir, 'species-gen1.json'), JSON.stringify(species, null, 2));
  fs.writeFileSync(path.join(cacheDir, 'moves.json'), JSON.stringify(moves, null, 2));
  console.log(`Wrote ${Object.keys(species).length} species, ${Object.keys(moves).length} moves`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
