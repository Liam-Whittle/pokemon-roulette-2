import type { BattleMove, CaughtPokemon, MoveCategory, StatusAilment, StoredMove } from '../types/game';
import { cachedMoveToStored, getCachedSpecies, getSpeciesWeightKg } from './speciesCache';
import { CURATED_SPECIES_MOVES_GEN1 } from './speciesMovesGen1';
import { getStabMultiplier } from './typeChart';
import { CRIT_CHANCE, CRIT_MULT, HIGH_CRIT_CHANCE, XATTACK_POWER_BONUS } from '../utils/battle';
import { getComputedStats } from '../utils/stats';
import { CURATED_MOVE_DESCRIPTIONS } from './moveDescriptions';

export const MAGIKARP_ID = 129;

const GEN1_VERSION_GROUPS = new Set(['red-blue', 'blue', 'yellow', 'red-green']);

export function extractGen1MoveSlugs(
  moves: { move: { name: string }; version_group_details: { version_group: { name: string } }[] }[],
): string[] {
  const slugs = new Set<string>();
  for (const entry of moves) {
    const slug = entry.move.name;
    const inGen1 = entry.version_group_details?.some((d) =>
      GEN1_VERSION_GROUPS.has(d.version_group.name),
    );
    if (inGen1) slugs.add(slug);
  }
  return [...slugs];
}

function toMoveSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, '-');
  const aliases: Record<string, string> = {
    'sky-attack': 'sky-attack',
    'soft-boiled': 'soft-boiled',
    'self-destruct': 'self-destruct',
    'double-edge': 'double-edge',
    'high-jump-kick': 'high-jump-kick',
    'vice-grip': 'vice-grip',
  };
  return aliases[normalized] ?? normalized;
}

const CUSTOM_MOVES: Record<string, StoredMove> = {
  'bug-bite': { slug: 'bug-bite', name: 'Bug Bite', type: 'bug', power: 60, accuracy: 100, category: 'physical', maxPp: 20, statusEffect: null },
  'dynamic-punch': { slug: 'dynamic-punch', name: 'Dynamic Punch', type: 'fighting', power: 100, accuracy: 50, category: 'physical', maxPp: 5, statusEffect: null },
  'extreme-speed': { slug: 'extreme-speed', name: 'Extreme Speed', type: 'normal', power: 80, accuracy: 100, category: 'physical', maxPp: 5, statusEffect: null },
  'flash-cannon': { slug: 'flash-cannon', name: 'Flash Cannon', type: 'steel', power: 80, accuracy: 100, category: 'special', maxPp: 10, statusEffect: null },
  'rock-blast': { slug: 'rock-blast', name: 'Rock Blast', type: 'rock', power: 25, accuracy: 90, category: 'physical', maxPp: 10, statusEffect: null },
  'shadow-ball': { slug: 'shadow-ball', name: 'Shadow Ball', type: 'ghost', power: 80, accuracy: 100, category: 'special', maxPp: 15, statusEffect: null },
  'stone-edge': { slug: 'stone-edge', name: 'Stone Edge', type: 'rock', power: 100, accuracy: 80, category: 'physical', maxPp: 5, statusEffect: null },
  waterfall: { slug: 'waterfall', name: 'Waterfall', type: 'water', power: 80, accuracy: 100, category: 'physical', maxPp: 15, statusEffect: null },
};

function fallbackMove(name: string, slug: string, typeHint: string): StoredMove {
  return {
    slug,
    name,
    type: typeHint,
    power: 0,
    accuracy: 100,
    category: 'status',
    maxPp: 20,
    statusEffect: null,
  };
}

export function assignMoves(speciesId: number, types: string[], _level = 5, preferStrong = false): StoredMove[] {
  void _level;
  void preferStrong;

  const curated = CURATED_SPECIES_MOVES_GEN1[speciesId];
  if (curated) {
    return curated.moves
      .map((moveName) => {
        const slug = toMoveSlug(moveName);
        return cachedMoveToStored(slug)
          ?? CUSTOM_MOVES[slug]
          ?? fallbackMove(moveName, slug, types[0] ?? 'normal');
      })
      .slice(0, 4);
  }

  const species = getCachedSpecies(speciesId);
  const learnset = species?.learnset ?? [];
  return learnset
    .map((slug) => cachedMoveToStored(slug))
    .filter((m): m is StoredMove => !!m)
    .slice(0, 4);
}

export function storedToBattleMove(
  move: StoredMove,
  owner: CaughtPokemon,
  fromActive: boolean,
  pp?: Record<string, number>,
): BattleMove {
  return {
    slug: move.slug,
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
    category: move.category,
    statusEffect: move.statusEffect,
    ownerCaughtAt: owner.caughtAt,
    ownerDisplayName: owner.nickname ?? owner.displayName,
    fromActive,
    maxPp: move.maxPp,
    currentPp: pp?.[move.slug] ?? move.maxPp,
    splashGag: move.slug === 'splash',
    hollowPurple: owner.shiny && owner.id === MAGIKARP_ID && move.slug === 'splash',
  };
}

export function buildActiveMoves(active: CaughtPokemon): BattleMove[] {
  if (active.shiny && active.id === MAGIKARP_ID) {
    return [{
      slug: 'hollow-purple',
      name: 'Hollow Purple',
      type: 'psychic',
      power: 999,
      accuracy: 100,
      category: 'special',
      ownerCaughtAt: active.caughtAt,
      ownerDisplayName: active.nickname ?? active.displayName,
      fromActive: true,
      maxPp: 1,
      currentPp: 1,
      hollowPurple: true,
    }];
  }
  return active.moves.map((m) => storedToBattleMove(m, active, true, active.pp));
}

/** Gen 1 moves with an increased critical-hit ratio (1/8 vs 1/24). */
const HIGH_CRIT_MOVE_SLUGS = new Set([
  'karate-chop',
  'razor-leaf',
  'slash',
  'crabhammer',
]);

export function isHighCritMove(slug: string): boolean {
  return HIGH_CRIT_MOVE_SLUGS.has(slug);
}

export function getCritChance(moveSlug: string, critStageBonus = 0): number {
  const base = isHighCritMove(moveSlug) ? HIGH_CRIT_CHANCE : CRIT_CHANCE;
  if (critStageBonus <= 0) return base;
  return Math.min(1, base * (2 ** critStageBonus));
}

export function rollCrit(moveSlug: string, critStageBonus = 0): boolean {
  return Math.random() < getCritChance(moveSlug, critStageBonus);
}

export function computeDamage(opts: {
  movePower: number;
  moveType: string;
  category: MoveCategory;
  effectiveness: number;
  attacker: CaughtPokemon;
  defender: CaughtPokemon;
  defenderIsEnemy?: boolean;
  crit: boolean;
  xAttackPhysical?: boolean;
  xAttackSpecial?: boolean;
  physicalMult?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  screenDamageMult?: number;
}): number {
  if (opts.effectiveness <= 0) return 0;

  const atkStats = getComputedStats(opts.attacker);
  const defStats = getComputedStats(opts.defender);
  const atk =
    (opts.category === 'physical' ? atkStats.attack : atkStats.specialAttack) *
    (opts.attackMultiplier ?? 1);
  const def = Math.max(
    1,
    (opts.category === 'physical' ? defStats.defense : defStats.specialDefense) *
      (opts.defenseMultiplier ?? 1),
  );
  const level = Math.max(1, opts.attacker.level ?? 1);
  // Mainline-lite core scaling: level + atk/def ratio gate raw move power.
  let base =
    (((2 * level) / 5 + 2) * Math.max(1, opts.movePower) * Math.max(1, atk) / def) / 50 + 2;
  if (opts.xAttackPhysical && opts.category === 'physical') {
    base += Math.max(1, opts.movePower) * XATTACK_POWER_BONUS;
  }
  if (opts.xAttackSpecial && opts.category === 'special') {
    base += Math.max(1, opts.movePower) * XATTACK_POWER_BONUS;
  }
  if (opts.physicalMult && opts.category === 'physical') {
    base *= opts.physicalMult;
  }
  if (opts.screenDamageMult != null && opts.screenDamageMult < 1) {
    base *= opts.screenDamageMult;
  }
  const stab = getStabMultiplier(opts.attacker.types, opts.moveType);
  let dmg = base * stab * opts.effectiveness;
  if (opts.crit) dmg *= CRIT_MULT;
  return Math.max(1, Math.round(dmg));
}

/** Low Kick power by target weight (mainline-style tiers). */
export function getLowKickPower(weightKg: number): number {
  if (weightKg < 10) return 20;
  if (weightKg < 25) return 40;
  if (weightKg < 50) return 60;
  if (weightKg < 100) return 80;
  if (weightKg < 200) return 100;
  return 120;
}

/** Power fed into the damage formula (before type/STAB/crit). */
export function getEffectiveMovePower(
  move: Pick<StoredMove, 'slug' | 'power'>,
  defenderSpeciesId: number,
): number {
  if (move.slug === 'low-kick') {
    return getLowKickPower(getSpeciesWeightKg(defenderSpeciesId));
  }
  return move.power;
}

export function getFixedDamage(move: Pick<StoredMove, 'slug'>, attackerLevel: number, defenderHp: number): number | null {
  switch (move.slug) {
    case 'dragon-rage':
      return 40;
    case 'sonic-boom':
      return 20;
    case 'night-shade':
    case 'seismic-toss':
      return Math.max(1, attackerLevel);
    case 'super-fang':
      return Math.max(1, Math.floor(defenderHp / 2));
    default:
      return null;
  }
}

const OHKO_MOVE_SLUGS = new Set(['guillotine', 'horn-drill', 'fissure']);

/** Moves whose damage ignores type effectiveness — hide misleading type chips. */
export function isFixedDamageMove(slug: string): boolean {
  return (
    OHKO_MOVE_SLUGS.has(slug) ||
    slug === 'dragon-rage' ||
    slug === 'sonic-boom' ||
    slug === 'night-shade' ||
    slug === 'seismic-toss' ||
    slug === 'super-fang'
  );
}

export interface MovePowerDisplayOptions {
  defenderSpeciesId?: number;
  defenderHp?: number;
}

/** Human-readable power for move buttons (handles 0-power fixed-damage moves). */
export function formatMovePowerDisplay(
  move: Pick<BattleMove, 'slug' | 'power' | 'category'>,
  level: number,
  boosted = false,
  opts?: MovePowerDisplayOptions,
): string {
  if (move.category === 'status') return '—';
  if (OHKO_MOVE_SLUGS.has(move.slug)) return 'OHKO';
  if (move.slug === 'seismic-toss' || move.slug === 'night-shade') return String(level);
  if (move.slug === 'super-fang') return '½ HP';
  if (move.slug === 'low-kick') {
    const power =
      opts?.defenderSpeciesId != null
        ? getLowKickPower(getSpeciesWeightKg(opts.defenderSpeciesId))
        : null;
    if (power != null) {
      return String(boosted ? Math.round(power * (1 + XATTACK_POWER_BONUS)) : power);
    }
    return 'Var';
  }

  const fixed = getFixedDamage(move, level, opts?.defenderHp ?? 100);
  if (fixed !== null) return String(fixed);

  if (move.power > 0) {
    return String(boosted ? Math.round(move.power * (1 + XATTACK_POWER_BONUS)) : move.power);
  }
  return '—';
}

export function rollHit(accuracy: number): boolean {
  if (accuracy <= 0) return true;
  return Math.random() * 100 < accuracy;
}

export function hasReducedPp(pp: Record<string, number> | undefined, moves: StoredMove[]): boolean {
  if (!pp) return false;
  return moves.some((m) => (pp[m.slug] ?? m.maxPp) < m.maxPp);
}

export { moveKey } from '../utils/battle';

const STATUS_DESCRIPTIONS: Record<StatusAilment, string> = {
  burn: 'May burn the target.',
  freeze: 'May freeze the target.',
  paralysis: 'May paralyze the target.',
  poison: 'May poison the target.',
  toxic: 'May badly poison the target.',
  sleep: 'May put the target to sleep.',
};

const STAT_MOVE_DESCRIPTIONS: Record<string, string> = {
  growl: "Growls cutely to lower the target's Attack.",
  leer: "An intimidating look that lowers the target's Defense.",
  'tail-whip': "Wags its tail cutely to lower the target's Defense.",
  'string-shot': "Shoots sticky silk that harshly lowers the target's Speed.",
  'sand-attack': "Throws sand to lower the target's Accuracy.",
  smokescreen: 'Obscures the target with smoke, lowering its Accuracy.',
  flash: "A bright flash that lowers the target's Accuracy.",
  harden: 'Stiffens the body to raise Defense.',
  withdraw: 'Withdraws into its shell to raise Defense.',
  'defense-curl': 'Curls up to raise Defense.',
  barrier: 'Creates a barrier that raises Defense.',
  reflect: 'Sets up a reflective wall that raises Defense.',
  agility: "Relaxes the body to sharply raise Speed.",
  meditate: 'Meditates to raise Attack.',
  sharpen: 'Sharpens its body to raise Attack.',
  'swords-dance': 'A frenetic dance that raises Attack.',
  growth: 'Grows the body to raise Special Attack.',
  rest: 'Falls asleep to fully restore HP.',
  recover: 'Restores up to half of its max HP.',
  'soft-boiled': 'Restores up to half of its max HP.',
};

const SPECIAL_MOVE_DESCRIPTIONS: Record<string, string | ((level: number) => string)> = {
  'seismic-toss': (level) =>
    `Throws the target with seismic force. Always deals damage equal to the user's level (${level} at Lv. ${level}). Type matchups do not affect this damage.`,
  'night-shade': (level) =>
    `Unleashes a sinister ray. Always deals damage equal to the user's level (${level} at Lv. ${level}). Type matchups do not affect this damage.`,
  'dragon-rage': () =>
    'Unleashes draconic rage. Always deals exactly 40 damage. Type matchups do not affect this damage.',
  'sonic-boom': () =>
    'Launches a shock wave. Always deals exactly 20 damage. Type matchups do not affect this damage.',
  'super-fang': () =>
    "Chomps with sharp fangs. Cuts the target's remaining HP in half. Type matchups do not affect this damage.",
  'low-kick': () =>
    'A low, tripping kick. Inflicts greater damage on heavier opponents (power 20–120 by target weight). Affected by type matchups and STAB.',
  'karate-chop': () =>
    'A sharp chop. Deals physical damage with power 50. High critical-hit ratio (1/8 instead of 1/24).',
  slash: () =>
    'Slashes with claws or blades. Deals physical damage with power 70. High critical-hit ratio (1/8 instead of 1/24).',
  'razor-leaf': () =>
    'Sharp leaves are launched to slice the foe. Deals physical damage with power 55. High critical-hit ratio (1/8 instead of 1/24).',
  crabhammer: () =>
    'Hammers with a pincer. Deals physical damage with power 90. High critical-hit ratio (1/8 instead of 1/24).',
  guillotine: () =>
    'A vicious tearing attack. If it hits, it knocks out the target in one blow.',
  'horn-drill': () =>
    'A horn drill attack. If it hits, it knocks out the target in one blow.',
  fissure: () =>
    'Opens a fissure under the target. If it hits, it knocks out the target in one blow.',
  'solar-beam': () =>
    'Absorbs light on the first turn, then attacks with a powerful beam on the next turn.',
  'hyper-beam': () =>
    'A devastating beam. The user must recharge on the turn after attacking.',
  'self-destruct': () =>
    'Explodes to inflict heavy damage, but the user faints afterward.',
  explosion: () =>
    'A massive explosion that damages the target, but the user faints afterward.',
};

export function formatMoveCategory(category: MoveCategory): string {
  if (category === 'physical') return 'Physical';
  if (category === 'special') return 'Special';
  return 'Status';
}

export interface DescribeMoveOptions {
  level?: number;
  defenderSpeciesId?: number;
}

export function describeMove(move: StoredMove, opts: DescribeMoveOptions = {}): string {
  const level = opts.level ?? 5;

  if (move.slug === 'splash') return 'The user flops around and does nothing.';
  if (move.slug === 'hollow-purple') return 'Unleashes devastating psychic energy. One use only.';

  const curatedEntry = CURATED_MOVE_DESCRIPTIONS[move.slug];
  if (curatedEntry) {
    return typeof curatedEntry === 'function' ? curatedEntry(level) : curatedEntry;
  }

  const statDesc = STAT_MOVE_DESCRIPTIONS[move.slug];
  if (statDesc) return statDesc;

  const specialDesc = SPECIAL_MOVE_DESCRIPTIONS[move.slug];
  if (specialDesc) {
    return typeof specialDesc === 'function' ? specialDesc(level) : specialDesc;
  }

  if (move.category === 'status') {
    if (move.statusEffect) return STATUS_DESCRIPTIONS[move.statusEffect];
    return 'A status move that does not deal direct damage.';
  }

  const kind = move.category === 'physical' ? 'physical' : 'special';
  const power =
    move.slug === 'low-kick' && opts.defenderSpeciesId != null
      ? getLowKickPower(getSpeciesWeightKg(opts.defenderSpeciesId))
      : move.power;
  let text = `Deals ${kind} damage with power ${power}.`;
  if (isHighCritMove(move.slug)) {
    text += ' High critical-hit ratio (1/8 instead of 1/24).';
  }
  if (move.statusEffect) text += ` ${STATUS_DESCRIPTIONS[move.statusEffect]}`;
  return text;
}
