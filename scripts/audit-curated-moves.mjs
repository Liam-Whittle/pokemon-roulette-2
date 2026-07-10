import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function parseSpeciesRows(fileName) {
  const speciesPath = path.join(root, 'src/data', fileName);
  const speciesTs = fs.readFileSync(speciesPath, 'utf8');
  const start = speciesTs.indexOf('const RAW_ROWS = `') + 'const RAW_ROWS = `'.length;
  const end = speciesTs.indexOf('`.trim()', start);
  const RAW_ROWS = start > 0 && end > start ? speciesTs.slice(start, end) : '';
  const moveCounts = new Map();
  for (const line of RAW_ROWS.trim().split('\n')) {
    const parts = line.split(',');
    for (const slot of parts.slice(2, 6)) {
      const name = slot.trim();
      if (!name) continue;
      const slug = name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/\s+/g, '-');
      moveCounts.set(slug, (moveCounts.get(slug) ?? 0) + 1);
    }
  }
  return moveCounts;
}

const movesJson = JSON.parse(fs.readFileSync(path.join(root, 'src/data/cache/moves.json'), 'utf8'));

const descPath = path.join(root, 'src/data/moveDescriptions.ts');
const descTs = fs.readFileSync(descPath, 'utf8');
const curatedSlugs = new Set(
  [...descTs.matchAll(/'([a-z0-9-]+)':/g)].map((m) => m[1]),
);

const moveCounts = new Map();
for (const file of ['speciesMovesGen1.ts', 'speciesMovesGen2.ts']) {
  for (const [slug, count] of parseSpeciesRows(file)) {
    moveCounts.set(slug, (moveCounts.get(slug) ?? 0) + count);
  }
}

const REMOVED = new Set(['teleport', 'roar', 'conversion', 'pay-day']);
const IMPLEMENTED = new Set([
  'transform', 'metronome', 'reflect', 'light-screen', 'barrier',
  'thrash', 'petal-dance', 'tri-attack', 'disable', 'leech-seed',
  'confuse-ray', 'supersonic', 'swagger', 'focus-energy', 'minimize',
  'skull-bash', 'fly', 'dig', 'sky-attack',
]);

const audit = [...moveCounts.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([slug, count]) => {
    const cached = movesJson[slug];
    const hasCuratedDesc = curatedSlugs.has(slug);
    return {
      slug,
      name: cached?.name ?? slug,
      inCuratedCount: count,
      category: cached?.category ?? 'missing',
      power: cached?.power ?? null,
      accuracy: cached?.accuracy ?? null,
      statusEffect: cached?.statusEffect ?? null,
      battleStatus: REMOVED.has(slug)
        ? 'removed'
        : IMPLEMENTED.has(slug)
          ? 'implemented'
          : cached
            ? 'standard'
            : 'missing-cache',
      descriptionStatus: hasCuratedDesc ? 'accurate' : 'generic',
      gen1EffectSummary: hasCuratedDesc ? 'curated in moveDescriptions.ts' : 'needs description',
    };
  });

const genericCount = audit.filter((a) => a.descriptionStatus === 'generic').length;
const missingCache = audit.filter((a) => a.battleStatus === 'missing-cache');
const outPath = path.join(root, 'src/data/move-audit.json');
fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
console.log(`Wrote ${audit.length} move audit entries (${genericCount} generic) to ${outPath}`);
if (missingCache.length > 0) {
  console.warn(
    `Moves without cache entry (may use CUSTOM_MOVES): ${missingCache.map((a) => a.slug).join(', ')}`,
  );
}
