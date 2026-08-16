import speciesAbilitiesJson from './cache/species-abilities.json';
import abilitiesJson from './cache/abilities.json';
import type { BattleWeather } from './battleField';
import type { CaughtPokemon, StatusAilment } from '../types/game';
import type { PokemonGender } from './speciesGender';
import { getTypeEffectiveness } from './typeChart';

export interface AbilityInfo {
  slug: string;
  name: string;
  shortEffect: string;
}

export interface SpeciesAbilitySet {
  standard: string[];
  hidden: string | null;
}

const speciesMap = speciesAbilitiesJson as Record<string, SpeciesAbilitySet>;
const catalog = abilitiesJson as Record<string, { name: string; shortEffect: string }>;

/** This game's ability text (overrides PokeAPI flavor that assumes held items / doubles / wild grass). */
export const GAME_ABILITY_EFFECTS: Record<string, string> = {
  unburden: 'When an item is used on this Pokémon, its Speed doubles for the rest of the battle.',
  pickup: 'The first item used on this Pokémon in a battle still works, but is not consumed.',
  harvest: 'The first item used on this Pokémon in a battle still works, but is not consumed.',
  frisk: 'After this Pokémon uses its first move in a battle, it steals a random common item from the opposing trainer.',
  pickpocket: 'After this Pokémon uses its first move in a battle, it steals a random common item from the opposing trainer.',
  'sticky-hold': 'Prevents Frisk and Pickpocket from stealing items.',
  gluttony: 'Once per battle, when damage drops this Pokémon to 50% HP or lower, it heals as if it used a Potion.',
  unnerve: 'Using a Potion on this Pokémon does not skip its turn.',
  'honey-gather': 'After winning a battle, 50% chance to find Honey, which heals one Pokémon to full HP.',
  illuminate: 'While this Pokémon is in your party, encounter wheels only show Pokémon with 10% higher base stat totals.',
  'run-away': 'Running from a battle or encounter is free.',
  rivalry: "Deals 1.25× damage to the same gender, or 0.75× to the opposite gender. Genderless foes are unaffected.",
  plus: 'Special Attack becomes 1.5× if a party Pokémon with Minus is also in battle condition (alive).',
  minus: 'Special Attack becomes 1.5× if a party Pokémon with Plus is also in battle condition (alive).',
  'friend-guard': 'While this Pokémon is alive on the bench, the active Pokémon takes 15% less damage.',
  healer: 'Each turn, 30% chance to cure the active Pokémon of a major status if this Pokémon is alive in the party.',
  telepathy: 'While this Pokémon is alive in the party, the active Pokémon cannot be confused or infatuated.',
  forecast: "Castform's type and form change with the weather: Fire in sun, Water in rain, Ice in hail.",
  imposter: 'Transforms into the opposing Pokémon upon entering battle.',
  'shed-skin': 'Each turn, 33% chance to cure this Pokémon of a major status condition.',
  'speed-boost': 'Raises Speed by one stage at the end of each turn.',
  'rain-dish': 'Restores 1/16 max HP at the end of each turn in rain.',
  'ice-body': 'Restores 1/16 max HP at the end of each turn in hail, and is immune to hail chip.',
  'solar-power': 'Special attacks deal 1.5× damage in harsh sunlight, but this Pokémon loses 1/8 max HP each turn in the sun.',
  'leaf-guard': 'Prevents major status conditions in harsh sunlight.',
  hydration: 'Cures this Pokémon of a major status condition at the end of each turn in rain.',
  'quick-feet': 'Speed becomes 1.5× when this Pokémon has a major status. Ignores the Speed drop from paralysis.',
  'battle-armor': 'Protects this Pokémon from critical hits.',
  'shell-armor': 'Protects this Pokémon from critical hits.',
  'tinted-lens': 'Not-very-effective moves deal double damage.',
  'sand-force': 'Rock, Ground, and Steel moves deal 1.3× damage in a sandstorm. Immune to sandstorm chip.',
  scrappy: 'Normal- and Fighting-type moves can hit Ghost-type Pokémon.',
  'toxic-boost': 'Physical moves deal 1.5× damage while this Pokémon is poisoned.',
  analytic: 'Deals 1.3× damage if this Pokémon is slower than the target.',
  'big-pecks': "Prevents this Pokémon's Defense from being lowered.",
  overcoat: 'Protects this Pokémon from hail and sandstorm chip damage.',
  'skill-link': 'Multi-strike moves always hit the maximum number of times.',
  'no-guard': "Moves used by or against this Pokémon never miss.",
  prankster: 'Gives status moves +1 priority.',
  stall: 'This Pokémon always moves last when priority is tied.',
  infiltrator: 'Attacks ignore Reflect and Light Screen.',
  unaware: "Ignores the target's stat changes when attacking, and the attacker's when defending.",
  normalize: "This Pokémon's moves become Normal-type.",
  'mold-breaker': "This Pokémon's moves ignore the target's ability.",
  'wonder-skin': 'Status moves used against this Pokémon have at most 50% accuracy.',
  soundproof: 'This Pokémon is immune to sound-based moves.',
  'wind-rider': 'Immune to wind moves, and Attack rises one stage when hit by one.',
  'liquid-ooze': 'Draining moves damage the attacker instead of healing them.',
  'poison-touch': 'Contact moves have a 30% chance to poison the target.',
  'shield-dust': 'Protects this Pokémon from additional effects of moves.',
  damp: 'Prevents Explosion and Self-Destruct from being used.',
  'heavy-metal': "Doubles this Pokémon's weight (stronger Low Kick against it).",
  'light-metal': "Halves this Pokémon's weight (weaker Low Kick against it).",
  'tangled-feet': 'Evasion rises while this Pokémon is confused.',
  'inner-focus': 'This Pokémon cannot flinch.',
  steadfast: 'Raises Speed by one stage if this Pokémon flinches.',
  stench: "This Pokémon's damaging moves have a 10% chance to flinch the target.",
  'cursed-body': "30% chance to disable the attacker's move when hit.",
  'anger-point': 'Maxes Attack if this Pokémon is hit by a critical hit.',
  justified: 'Raises Attack by one stage when hit by a Dark-type move.',
  rattled: 'Raises Speed by one stage when hit by a Bug-, Dark-, or Ghost-type move.',
  'weak-armor': 'Physical hits lower Defense and raise Speed by one stage each.',
  'color-change': "This Pokémon's type becomes the type of the move that hit it.",
  protean: "This Pokémon's type becomes the type of the move it is about to use.",
  download: "On switch-in, raises Attack if the foe's Defense is lower than Special Defense; otherwise raises Special Attack.",
  trace: "On switch-in, copies the opposing Pokémon's ability.",
  anticipation: 'On switch-in, shudders if the foe has a super-effective or one-hit KO move.',
  forewarn: "On switch-in, reveals the foe's strongest move.",
  moxie: 'Raises Attack by one stage after knocking out a Pokémon.',
  aftermath: 'If this Pokémon is knocked out by a contact move, the attacker loses 1/4 of its max HP.',
  'natural-cure': 'Cures this Pokémon of a major status when it switches out.',
  regenerator: 'Restores 1/3 of max HP when this Pokémon switches out.',
  moody: 'Each turn, sharply raises one random stat and lowers another.',
  'early-bird': 'Wakes from sleep twice as quickly.',
  synchronize: 'If this Pokémon is burned, paralyzed, or poisoned, the attacker receives the same status.',
  'arena-trap': 'Prevents grounded foes from fleeing or switching.',
  'shadow-tag': 'Prevents the foe from fleeing or switching.',
  'magnet-pull': 'Prevents Steel-type foes from fleeing or switching.',
  'suction-cups': 'Protects this Pokémon from being forced out by Roar or Whirlwind.',
  contrary: 'Stat changes are reversed.',
  simple: 'Stat changes are doubled.',
  defiant: "Raises Attack by two stages when any of this Pokémon's stats are lowered by the foe.",
  competitive: "Raises Special Attack by two stages when any of this Pokémon's stats are lowered by the foe.",
  'magic-bounce': 'Blocks status moves used against this Pokémon.',
  truant: 'This Pokémon loafs around every other turn and cannot act.',
  pressure: 'The foe spends 1 extra PP when using a move against this Pokémon.',
};

export const HIDDEN_ABILITY_CHANCE = 0.2;

export const COMMON_STEAL_ITEM_IDS = ['potion', 'pokeball', 'greatball', 'healpowder', 'xattack'] as const;

const TITLE_SMALL = new Set(['of', 'the']);

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (TITLE_SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function getSpeciesAbilities(id: number): SpeciesAbilitySet {
  return speciesMap[String(id)] ?? { standard: [], hidden: null };
}

export function defaultAbilityForSpecies(id: number): string | undefined {
  return getSpeciesAbilities(id).standard[0];
}

/** Roll one ability for a new Pokémon: 20% hidden, otherwise even among standard. */
export function rollAbilityForSpecies(id: number, rng: () => number = Math.random): string | undefined {
  const set = getSpeciesAbilities(id);
  if (set.hidden && rng() < HIDDEN_ABILITY_CHANCE) return set.hidden;
  if (set.standard.length === 0) return set.hidden ?? undefined;
  const index = Math.min(set.standard.length - 1, Math.floor(rng() * set.standard.length));
  return set.standard[index];
}

export function getAbilityInfo(slug: string | undefined | null): AbilityInfo | null {
  if (!slug) return null;
  const entry = catalog[slug];
  return {
    slug,
    name: entry?.name ?? titleCaseSlug(slug),
    shortEffect: GAME_ABILITY_EFFECTS[slug] ?? entry?.shortEffect ?? 'No additional effect.',
  };
}

export function getMonAbility(mon: { ability?: string; id: number } | null | undefined): string | undefined {
  if (!mon) return undefined;
  return mon.ability ?? defaultAbilityForSpecies(mon.id);
}

export function monHasAbility(
  mon: { ability?: string; id: number } | null | undefined,
  slug: string,
): boolean {
  return getMonAbility(mon) === slug;
}

export function partyHasAbility(
  party: Array<{ ability?: string; id: number } | null | undefined>,
  slug: string,
): boolean {
  return party.some((m) => monHasAbility(m, slug));
}

export function partyHasAbilityAlive(party: CaughtPokemon[], slug: string): boolean {
  return party.some((m) => (m.hp ?? 1) > 0 && monHasAbility(m, slug));
}

export function isHiddenAbilityForSpecies(id: number, slug: string | undefined): boolean {
  return !!slug && getSpeciesAbilities(id).hidden === slug;
}

export function abilityLabel(slug: string | undefined | null): string {
  return getAbilityInfo(slug)?.name ?? '';
}

/** Moves that make contact (Gen 3–style). Used by Static, Poison Point, Rough Skin, etc. */
export const CONTACT_MOVES = new Set([
  'aerial-ace', 'bind', 'bite', 'body-slam', 'brick-break', 'comet-punch', 'constrict',
  'crabhammer', 'cross-chop', 'crunch', 'cut', 'dig', 'dive', 'double-edge', 'double-kick',
  'dragon-claw', 'drill-peck', 'dynamic-punch', 'extreme-speed', 'facade', 'faint-attack',
  'feint-attack', 'fire-punch', 'fly', 'focus-punch', 'frustration', 'fury-cutter',
  'fury-swipes', 'headbutt', 'high-jump-kick', 'horn-attack', 'horn-drill', 'ice-punch',
  'iron-tail', 'karate-chop', 'leaf-blade', 'leech-life', 'lick', 'low-kick', 'mach-punch',
  'mega-kick', 'mega-punch', 'megahorn', 'metal-claw', 'meteor-mash', 'needle-arm',
  'outrage', 'petal-dance', 'poison-fang', 'pound', 'pursuit', 'quick-attack', 'return',
  'reversal', 'rock-smash', 'rollout', 'scratch', 'seismic-toss', 'shadow-punch',
  'skull-bash', 'sky-uppercut', 'slash', 'spark', 'steel-wing', 'strength', 'submission',
  'super-fang', 'tackle', 'take-down', 'thief', 'thrash', 'thunder-punch', 'triple-kick',
  'vine-whip', 'vital-throw', 'waterfall', 'wing-attack', 'wrap', 'zen-headbutt',
]);

const PUNCH_MOVES = new Set([
  'bullet-punch', 'comet-punch', 'dizzy-punch', 'dynamic-punch', 'fire-punch',
  'focus-punch', 'ice-punch', 'mach-punch', 'mega-punch', 'meteor-mash',
  'shadow-punch', 'sky-uppercut', 'thunder-punch',
]);

const TYPE_ABSORB: Record<string, { type: string; kind: 'heal' | 'boost' }> = {
  'water-absorb': { type: 'water', kind: 'heal' },
  'volt-absorb': { type: 'electric', kind: 'heal' },
  'dry-skin': { type: 'water', kind: 'heal' },
  'flash-fire': { type: 'fire', kind: 'boost' },
  'lightning-rod': { type: 'electric', kind: 'boost' },
  'motor-drive': { type: 'electric', kind: 'boost' },
  'storm-drain': { type: 'water', kind: 'boost' },
  'sap-sipper': { type: 'grass', kind: 'boost' },
};

const STATUS_IMMUNE: Record<string, StatusAilment[]> = {
  immunity: ['poison', 'toxic'],
  limber: ['paralysis'],
  insomnia: ['sleep'],
  'vital-spirit': ['sleep'],
  'magma-armor': ['freeze'],
  'water-veil': ['burn'],
};

const WEATHER_SETTERS: Record<string, BattleWeather> = {
  drizzle: 'rain',
  drought: 'sunny',
  'sand-stream': 'sandstorm',
  'snow-warning': 'hail',
};

export type AbilityAbsorbKind = 'heal' | 'boost' | 'immune';

export function abilityAbsorbBoostDelta(
  ability: string | undefined,
): { atk?: number; spa?: number; spe?: number } | null {
  if (ability === 'flash-fire' || ability === 'lightning-rod' || ability === 'storm-drain') return { spa: 1 };
  if (ability === 'motor-drive') return { spe: 1 };
  if (ability === 'sap-sipper' || ability === 'wind-rider') return { atk: 1 };
  return null;
}

export function abilityAbsorbMessage(
  ability: string | undefined,
  displayName: string,
  kind: AbilityAbsorbKind,
): string {
  const name = abilityLabel(ability);
  if (kind === 'heal') return `${displayName} restored HP with ${name}!`;
  if (kind === 'boost') return `${displayName}'s ${name} raised its stats!`;
  return `It doesn't affect ${displayName}...`;
}

export const SOUND_MOVES = new Set([
  'growl', 'screech', 'sing', 'supersonic', 'hyper-voice', 'uproar', 'snore',
  'perish-song', 'heal-bell', 'grass-whistle', 'metal-sound', 'howl',
]);

export const WIND_MOVES = new Set([
  'gust', 'whirlwind', 'twister', 'air-cutter', 'razor-wind', 'icy-wind',
  'heat-wave', 'blizzard', 'hurricane',
]);

export function isSoundMove(slug: string): boolean {
  return SOUND_MOVES.has(slug);
}

export function isWindMove(slug: string): boolean {
  return WIND_MOVES.has(slug);
}

export function abilityAbsorbsMove(
  ability: string | undefined,
  moveType: string,
  moveSlug?: string,
): AbilityAbsorbKind | null {
  if (!ability) return null;
  if (ability === 'levitate' && moveType === 'ground') return 'immune';
  if (ability === 'flash-fire' && moveType === 'fire') return 'boost';
  if (ability === 'soundproof' && moveSlug && isSoundMove(moveSlug)) return 'immune';
  if (ability === 'wind-rider' && moveSlug && isWindMove(moveSlug)) return 'boost';
  const absorb = TYPE_ABSORB[ability];
  if (absorb && absorb.type === moveType) return absorb.kind;
  return null;
}

export function abilityWonderGuardBlocks(
  ability: string | undefined,
  effectiveness: number,
  category: string,
): boolean {
  return ability === 'wonder-guard' && category !== 'status' && effectiveness < 2;
}

export function abilityTypeDamageMult(
  defenderAbility: string | undefined,
  moveType: string,
): number {
  if (defenderAbility === 'thick-fat' && (moveType === 'fire' || moveType === 'ice')) return 0.5;
  if (defenderAbility === 'dry-skin' && moveType === 'fire') return 1.25;
  if ((defenderAbility === 'filter' || defenderAbility === 'solid-rock') && moveType) return 1;
  return 1;
}

export function abilitySeReduction(defenderAbility: string | undefined, effectiveness: number): number {
  if ((defenderAbility === 'filter' || defenderAbility === 'solid-rock') && effectiveness > 1) return 0.75;
  return 1;
}

export function rivalryDamageMult(
  ability: string | undefined,
  attackerGender?: PokemonGender | null,
  defenderGender?: PokemonGender | null,
): number {
  if (ability !== 'rivalry') return 1;
  if (!attackerGender || !defenderGender) return 1;
  if (attackerGender === defenderGender) return 1.25;
  return 0.75;
}

export function plusMinusSpaMult(
  ability: string | undefined,
  party: CaughtPokemon[],
): number {
  if (ability !== 'plus' && ability !== 'minus') return 1;
  const hasPlus = partyHasAbilityAlive(party, 'plus');
  const hasMinus = partyHasAbilityAlive(party, 'minus');
  return hasPlus && hasMinus ? 1.5 : 1;
}

export function friendGuardDamageMult(
  activeCaughtAt: number | undefined,
  party: CaughtPokemon[],
): number {
  const benchProtects = party.some(
    (m) =>
      m.caughtAt !== activeCaughtAt &&
      (m.hp ?? 1) > 0 &&
      monHasAbility(m, 'friend-guard'),
  );
  return benchProtects ? 0.85 : 1;
}

export function abilityAttackerDamageMult(opts: {
  ability?: string;
  moveSlug: string;
  moveType: string;
  movePower: number;
  category: string;
  attackerTypes: string[];
  attackerHp: number;
  attackerMaxHp: number;
  statusKind?: string;
  attackerGender?: PokemonGender | null;
  defenderGender?: PokemonGender | null;
  plusMinusParty?: CaughtPokemon[];
  weather?: BattleWeather;
  weatherSuppressed?: boolean;
  effectiveness?: number;
  attackerSlower?: boolean;
}): number {
  const { ability, moveSlug, moveType, movePower, category, attackerTypes, attackerHp, attackerMaxHp, statusKind } = opts;
  if (!ability) return 1;
  let mult = 1;
  if (ability === 'huge-power' || ability === 'pure-power') {
    if (category === 'physical') mult *= 2;
  }
  if (ability === 'guts' && statusKind && category === 'physical') mult *= 1.5;
  if (ability === 'hustle' && category === 'physical') mult *= 1.5;
  if (ability === 'blaze' && moveType === 'fire' && attackerHp <= attackerMaxHp / 3) mult *= 1.5;
  if (ability === 'overgrow' && moveType === 'grass' && attackerHp <= attackerMaxHp / 3) mult *= 1.5;
  if (ability === 'torrent' && moveType === 'water' && attackerHp <= attackerMaxHp / 3) mult *= 1.5;
  if (ability === 'swarm' && moveType === 'bug' && attackerHp <= attackerMaxHp / 3) mult *= 1.5;
  if (ability === 'technician' && movePower <= 60) mult *= 1.5;
  if (ability === 'iron-fist' && PUNCH_MOVES.has(moveSlug)) mult *= 1.2;
  if (ability === 'reckless' && (moveSlug === 'double-edge' || moveSlug === 'take-down' || moveSlug === 'submission' || moveSlug === 'high-jump-kick')) {
    mult *= 1.2;
  }
  if (ability === 'adaptability' && attackerTypes.some((t) => t.toLowerCase() === moveType.toLowerCase())) {
    mult *= 4 / 3;
  }
  if (ability === 'sheer-force') mult *= 1.3;
  if (ability === 'solar-power' && category === 'special' && !opts.weatherSuppressed && opts.weather === 'sunny') {
    mult *= 1.5;
  }
  if (
    ability === 'sand-force' &&
    !opts.weatherSuppressed &&
    opts.weather === 'sandstorm' &&
    (moveType === 'rock' || moveType === 'ground' || moveType === 'steel')
  ) {
    mult *= 1.3;
  }
  if (ability === 'tinted-lens' && (opts.effectiveness ?? 1) > 0 && (opts.effectiveness ?? 1) < 1) {
    mult *= 2;
  }
  if (ability === 'toxic-boost' && category === 'physical' && (statusKind === 'poison' || statusKind === 'toxic')) {
    mult *= 1.5;
  }
  if (ability === 'analytic' && opts.attackerSlower) mult *= 1.3;
  mult *= rivalryDamageMult(ability, opts.attackerGender, opts.defenderGender);
  if (category === 'special' && opts.plusMinusParty) {
    mult *= plusMinusSpaMult(ability, opts.plusMinusParty);
  }
  return mult;
}

export function abilityIgnoresBurnAtkDrop(ability: string | undefined): boolean {
  return ability === 'guts';
}

export function abilityDefenseMult(ability: string | undefined, statusKind?: string): number {
  if (ability === 'marvel-scale' && statusKind) return 1.5;
  return 1;
}

export function abilityAccuracyMult(ability: string | undefined): number {
  if (ability === 'compound-eyes' || ability === 'compoundeyes') return 1.3;
  if (ability === 'hustle') return 0.8;
  return 1;
}

export function abilityCritStageBonus(ability: string | undefined): number {
  return ability === 'super-luck' ? 1 : 0;
}

export function abilityCritDamageMult(ability: string | undefined, crit: boolean): number {
  if (crit && ability === 'sniper') return 1.5;
  return 1;
}

export function abilitySecondaryChanceMult(ability: string | undefined): number {
  if (ability === 'serene-grace') return 2;
  if (ability === 'sheer-force') return 0;
  return 1;
}

export function abilityBlocksRecoil(ability: string | undefined): boolean {
  return ability === 'rock-head' || ability === 'magic-guard';
}

export function abilityBlocksStatus(
  ability: string | undefined,
  kind: StatusAilment,
  weather: BattleWeather = 'none',
  weatherSuppressed = false,
): boolean {
  if (!ability) return false;
  if (ability === 'leaf-guard' && !weatherSuppressed && weather === 'sunny') return true;
  return STATUS_IMMUNE[ability]?.includes(kind) ?? false;
}

export function abilityBlocksConfusion(ability: string | undefined): boolean {
  return ability === 'own-tempo';
}

export function abilityBlocksAttract(ability: string | undefined): boolean {
  return ability === 'oblivious';
}

export function abilityPreventsStatDrop(ability: string | undefined, stat: string): boolean {
  if (ability === 'clear-body' || ability === 'white-smoke' || ability === 'full-metal-body') return true;
  if (ability === 'hyper-cutter' && stat === 'atk') return true;
  if (ability === 'keen-eye' && stat === 'acc') return true;
  if (ability === 'big-pecks' && stat === 'def') return true;
  return false;
}

export function abilitySpeedMult(
  ability: string | undefined,
  weather: BattleWeather,
  weatherSuppressed: boolean,
  extra?: { unburden?: boolean; statused?: boolean },
): number {
  let mult = 1;
  if (ability === 'unburden' && extra?.unburden) mult *= 2;
  if (ability === 'quick-feet' && extra?.statused) mult *= 1.5;
  if (!ability || weatherSuppressed) return mult;
  if (ability === 'chlorophyll' && weather === 'sunny') return mult * 2;
  if (ability === 'swift-swim' && weather === 'rain') return mult * 2;
  if (ability === 'sand-rush' && weather === 'sandstorm') return mult * 2;
  return mult;
}

export function abilityEvasionBonus(
  ability: string | undefined,
  weather: BattleWeather,
  weatherSuppressed: boolean,
  extra?: { confused?: boolean },
): number {
  let bonus = 1;
  if (ability === 'tangled-feet' && extra?.confused) bonus *= 2;
  if (!ability || weatherSuppressed) return bonus;
  if (ability === 'sand-veil' && weather === 'sandstorm') return bonus * 1.25;
  if (ability === 'snow-cloak' && weather === 'hail') return bonus * 1.25;
  return bonus;
}

export function weatherIsSuppressed(abilities: Array<string | undefined>): boolean {
  return abilities.some((a) => a === 'air-lock' || a === 'cloud-nine');
}

export function abilitySwitchInWeather(ability: string | undefined): BattleWeather | null {
  if (!ability) return null;
  return WEATHER_SETTERS[ability] ?? null;
}

export function abilityIsIntimidate(ability: string | undefined): boolean {
  return ability === 'intimidate';
}

export function abilityIgnoresSpikes(ability: string | undefined, types: string[]): boolean {
  return ability === 'levitate' || ability === 'magic-guard' || types.includes('flying');
}

export function abilityBlocksIndirectDamage(ability: string | undefined): boolean {
  return ability === 'magic-guard';
}

export function abilityHealsFromPoison(ability: string | undefined): boolean {
  return ability === 'poison-heal';
}

export type ContactAbilityResult =
  | { kind: 'status'; status: StatusAilment; chance: number }
  | { kind: 'damage'; fraction: number }
  | { kind: 'attract'; chance: number }
  | null;

export function abilityOnContact(defenderAbility: string | undefined): ContactAbilityResult {
  switch (defenderAbility) {
    case 'static':
      return { kind: 'status', status: 'paralysis', chance: 0.3 };
    case 'poison-point':
      return { kind: 'status', status: 'poison', chance: 0.3 };
    case 'flame-body':
      return { kind: 'status', status: 'burn', chance: 0.3 };
    case 'effect-spore':
      return { kind: 'status', status: Math.random() < 1 / 3 ? 'poison' : Math.random() < 0.5 ? 'paralysis' : 'sleep', chance: 0.3 };
    case 'cute-charm':
      return { kind: 'attract', chance: 0.3 };
    case 'rough-skin':
    case 'iron-barbs':
      return { kind: 'damage', fraction: 1 / 8 };
    default:
      return null;
  }
}

export function isContactMove(slug: string): boolean {
  return CONTACT_MOVES.has(slug);
}

export function abilityShedSkinTriggers(ability: string | undefined): boolean {
  return ability === 'shed-skin' && Math.random() < 1 / 3;
}

export function abilitySpeedBoost(ability: string | undefined): boolean {
  return ability === 'speed-boost';
}

export function abilityWeatherHeal(
  ability: string | undefined,
  weather: BattleWeather,
  weatherSuppressed: boolean,
): number {
  if (!ability || weatherSuppressed) return 0;
  if (ability === 'rain-dish' && weather === 'rain') return 1 / 16;
  if (ability === 'ice-body' && weather === 'hail') return 1 / 16;
  if (ability === 'dry-skin' && weather === 'rain') return 1 / 8;
  if (ability === 'dry-skin' && weather === 'sunny') return -1 / 8;
  if (ability === 'solar-power' && weather === 'sunny') return -1 / 8;
  return 0;
}

export function abilityMultiscaleActive(
  ability: string | undefined,
  hp: number,
  maxHp: number,
): boolean {
  return ability === 'multiscale' && hp >= maxHp;
}

export type StageKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';
export type StageDelta = Partial<Record<StageKey, number>>;

export interface SwitchInAbilityResult {
  messages: string[];
  weather: BattleWeather | null;
  intimidate: boolean;
  download?: StageDelta;
  tracedAbility?: string;
  typeChange?: string[];
}

export function describeSwitchInAbility(
  ability: string | undefined,
  displayName: string,
  extras?: {
    selfTypes?: string[];
    region?: 'Kanto' | 'Johto' | 'Hoenn';
    foe?: { ability?: string; id: number; types: string[]; moves?: Array<{ slug: string; name: string; type: string; power: number; category: string }> } | null;
    foeDefense?: number;
    foeSpDefense?: number;
  },
): SwitchInAbilityResult {
  const messages: string[] = [];
  const weather = abilitySwitchInWeather(ability);
  if (weather) {
    messages.push(`${displayName}'s ${abilityLabel(ability)} whipped up the ${weather}!`);
  }
  const intimidate = abilityIsIntimidate(ability);
  if (intimidate) {
    messages.push(`${displayName}'s Intimidate cut the foe's Attack!`);
  }
  let download: StageDelta | undefined;
  if (ability === 'download' && extras?.foeDefense != null && extras.foeSpDefense != null) {
    download = extras.foeDefense < extras.foeSpDefense ? { atk: 1 } : { spa: 1 };
    messages.push(
      extras.foeDefense < extras.foeSpDefense
        ? `${displayName}'s Download raised its Attack!`
        : `${displayName}'s Download raised its Special Attack!`,
    );
  }
  let tracedAbility: string | undefined;
  if (ability === 'trace' && extras?.foe) {
    const copied = getMonAbility(extras.foe);
    if (copied && copied !== 'trace') {
      tracedAbility = copied;
      messages.push(`${displayName} traced ${abilityLabel(copied)}!`);
    }
  }
  if (ability === 'anticipation' && extras?.foe?.moves) {
    const selfTypes = extras.selfTypes ?? [];
    const scary = extras.foe.moves.some((m) => {
      if (m.category === 'status') return false;
      if (m.slug === 'horn-drill' || m.slug === 'fissure' || m.slug === 'guillotine' || m.slug === 'sheer-cold') {
        return true;
      }
      return selfTypes.length > 0 && getTypeEffectiveness(m.type, selfTypes, extras.region ?? 'Kanto') >= 2;
    });
    if (scary) {
      messages.push(`${displayName} shuddered with Anticipation!`);
    }
  }
  if (ability === 'forewarn' && extras?.foe?.moves?.length) {
    const strongest = [...extras.foe.moves].sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0];
    if (strongest) {
      messages.push(`${displayName}'s Forewarn revealed ${strongest.name}!`);
    }
  }
  return { messages, weather, intimidate, download, tracedAbility };
}

export function abilitySturdySurvives(
  ability: string | undefined,
  hp: number,
  maxHp: number,
  incoming: number,
): boolean {
  return ability === 'sturdy' && hp >= maxHp && incoming >= hp;
}

export function isPickupStyleAbility(ability: string | undefined): boolean {
  return ability === 'pickup' || ability === 'harvest';
}

export function pickupSkipsConsume(ability: string | undefined, alreadyUsed: boolean): boolean {
  return isPickupStyleAbility(ability) && !alreadyUsed;
}

export function gluttonyShouldHeal(
  ability: string | undefined,
  hp: number,
  maxHp: number,
  alreadyUsed: boolean,
): boolean {
  return ability === 'gluttony' && !alreadyUsed && hp > 0 && hp <= maxHp / 2;
}

export function isStealAbility(ability: string | undefined): boolean {
  return ability === 'frisk' || ability === 'pickpocket';
}

export function stickyHoldBlocksSteal(defenderAbility: string | undefined): boolean {
  return defenderAbility === 'sticky-hold';
}

export function pickStolenCommonItem(availableIds: string[], rng: () => number = Math.random): string | null {
  const pool = availableIds.filter((id) =>
    (COMMON_STEAL_ITEM_IDS as readonly string[]).includes(id),
  );
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] ?? null;
}

export function rollHoneyGather(rng: () => number = Math.random): boolean {
  return rng() < 0.5;
}

export function forecastTypesForWeather(
  weather: BattleWeather,
  weatherSuppressed: boolean,
): string[] {
  if (weatherSuppressed || weather === 'none' || weather === 'sandstorm') return ['normal'];
  if (weather === 'sunny') return ['fire'];
  if (weather === 'rain') return ['water'];
  if (weather === 'hail') return ['ice'];
  return ['normal'];
}

export type ForecastForm = 'castform' | 'castform-sunny' | 'castform-rainy' | 'castform-snowy';

export function forecastFormForWeather(
  weather: BattleWeather,
  weatherSuppressed: boolean,
): ForecastForm {
  if (weatherSuppressed || weather === 'none' || weather === 'sandstorm') return 'castform';
  if (weather === 'sunny') return 'castform-sunny';
  if (weather === 'rain') return 'castform-rainy';
  if (weather === 'hail') return 'castform-snowy';
  return 'castform';
}

export function shouldAutoImposter(mon: { ability?: string; id: number } | null | undefined): boolean {
  return monHasAbility(mon, 'imposter');
}

export function medianBst(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

/** Keep species whose BST is at least 10% above the pool median; fill from the next-highest if too few. */
export function filterPoolForIlluminate<T>(
  items: T[],
  getBst: (item: T) => number,
  minKeep: number,
): T[] {
  if (items.length === 0) return items;
  const threshold = medianBst(items.map(getBst)) * 1.1;
  const high = items.filter((item) => getBst(item) >= threshold);
  if (high.length >= minKeep) return high;
  const rest = items
    .filter((item) => getBst(item) < threshold)
    .sort((a, b) => getBst(b) - getBst(a));
  return [...high, ...rest].slice(0, Math.max(minKeep, high.length));
}

export function abilityIgnoresDefenderAbility(ability: string | undefined): boolean {
  return ability === 'mold-breaker';
}

export function abilitiesAreNeutralized(abilities: Array<string | undefined>): boolean {
  return abilities.some((a) => a === 'neutralizing-gas');
}

export function battleAbility(
  ability: string | undefined,
  fieldAbilities: Array<string | undefined>,
): string | undefined {
  if (!ability) return undefined;
  if (ability === 'neutralizing-gas') return ability;
  if (abilitiesAreNeutralized(fieldAbilities)) return undefined;
  return ability;
}

export function abilityBlocksCrit(ability: string | undefined): boolean {
  return ability === 'battle-armor' || ability === 'shell-armor';
}

export function abilityBlocksWeatherChip(
  ability: string | undefined,
  weather: BattleWeather,
): boolean {
  if (!ability) return false;
  if (ability === 'overcoat' || ability === 'magic-guard') return true;
  if (weather === 'hail' && (ability === 'ice-body' || ability === 'snow-cloak')) return true;
  if (weather === 'sandstorm' && (ability === 'sand-veil' || ability === 'sand-rush' || ability === 'sand-force')) {
    return true;
  }
  return false;
}

export function abilityWeightMult(ability: string | undefined): number {
  if (ability === 'heavy-metal') return 2;
  if (ability === 'light-metal') return 0.5;
  return 1;
}

export function abilityPriorityBonus(ability: string | undefined, category: string): number {
  if (ability === 'prankster' && category === 'status') return 1;
  return 0;
}

export function abilityMovesLast(ability: string | undefined): boolean {
  return ability === 'stall';
}

export function abilityNeverMisses(attackerAbility?: string, defenderAbility?: string): boolean {
  return attackerAbility === 'no-guard' || defenderAbility === 'no-guard';
}

export function abilityStatusAccuracyCap(defenderAbility: string | undefined, accuracy: number): number {
  if (defenderAbility === 'wonder-skin' && accuracy > 50) return 50;
  return accuracy;
}

export function abilitySkillLinkMaxHits(ability: string | undefined): boolean {
  return ability === 'skill-link';
}

export function abilityIgnoresScreens(ability: string | undefined): boolean {
  return ability === 'infiltrator';
}

export function abilityIgnoresFoeStages(ability: string | undefined): boolean {
  return ability === 'unaware';
}

export function abilityNormalizedMoveType(
  ability: string | undefined,
  moveType: string,
): string {
  return ability === 'normalize' ? 'normal' : moveType;
}

export function abilityBlocksExplosion(abilities: Array<string | undefined>): boolean {
  return abilities.some((a) => a === 'damp');
}

export function abilityBlocksFlinch(ability: string | undefined): boolean {
  return ability === 'inner-focus';
}

export function abilityFlinchChance(attackerAbility: string | undefined): number {
  return attackerAbility === 'stench' ? 0.1 : 0;
}

export function abilitySleepTickCount(ability: string | undefined): number {
  return ability === 'early-bird' ? 2 : 1;
}

export function abilityCuresStatusEot(
  ability: string | undefined,
  weather: BattleWeather,
  weatherSuppressed: boolean,
): boolean {
  if (ability === 'hydration' && !weatherSuppressed && weather === 'rain') return true;
  return abilityShedSkinTriggers(ability);
}

export function abilityExtraPpCost(defenderAbility: string | undefined): number {
  return defenderAbility === 'pressure' ? 1 : 0;
}

export function abilityOnSwitchOut(
  ability: string | undefined,
  hp: number,
  maxHp: number,
): { clearStatus: boolean; heal: number } {
  const clearStatus = ability === 'natural-cure';
  const heal = ability === 'regenerator' ? Math.max(1, Math.floor(maxHp / 3)) : 0;
  return { clearStatus, heal: hp > 0 ? heal : 0 };
}

export function abilityRewriteStageDelta(
  ability: string | undefined,
  delta: StageDelta,
): StageDelta {
  if (!ability || (!delta || Object.keys(delta).length === 0)) return delta;
  const next: StageDelta = {};
  for (const [stat, value] of Object.entries(delta) as [StageKey, number | undefined][]) {
    if (value == null || value === 0) continue;
    let v = value;
    if (ability === 'contrary') v = -v;
    if (ability === 'simple') v *= 2;
    next[stat] = v;
  }
  return next;
}

export function abilityRetaliateStatDrop(ability: string | undefined, dropped: boolean): StageDelta | null {
  if (!dropped) return null;
  if (ability === 'defiant') return { atk: 2 };
  if (ability === 'competitive') return { spa: 2 };
  return null;
}

export function abilityTrapsFoe(
  ability: string | undefined,
  foeTypes: string[],
  foeAbility?: string,
): boolean {
  if (!ability) return false;
  if (ability === 'shadow-tag' && foeAbility !== 'shadow-tag') return true;
  if (ability === 'magnet-pull' && foeTypes.some((t) => t.toLowerCase() === 'steel')) return true;
  if (ability === 'arena-trap') {
    if (foeTypes.some((t) => t.toLowerCase() === 'flying')) return false;
    if (foeAbility === 'levitate') return false;
    return true;
  }
  return false;
}

export function abilityBlocksForcedSwitch(ability: string | undefined): boolean {
  return ability === 'suction-cups';
}

export function abilityBouncesStatus(ability: string | undefined): boolean {
  return ability === 'magic-bounce';
}

export function abilityIsTruant(ability: string | undefined): boolean {
  return ability === 'truant';
}

export function abilityIsProtean(ability: string | undefined): boolean {
  return ability === 'protean';
}

export function abilityDrainHurtsAttacker(defenderAbility: string | undefined): boolean {
  return defenderAbility === 'liquid-ooze';
}

export function abilityOnContactAttack(attackerAbility: string | undefined): ContactAbilityResult {
  if (attackerAbility === 'poison-touch') {
    return { kind: 'status', status: 'poison', chance: 0.3 };
  }
  return null;
}

export interface AfterHitAbilityResult {
  messages: string[];
  defenderStageDelta?: StageDelta;
  disableAttackerMove?: boolean;
  defenderTypes?: string[];
  flinchDefender?: boolean;
}

export function abilityAfterBeingHit(opts: {
  defenderAbility?: string;
  attackerAbility?: string;
  defenderName: string;
  moveType: string;
  moveSlug: string;
  category: string;
  crit: boolean;
  damage: number;
  rng?: () => number;
}): AfterHitAbilityResult {
  const rng = opts.rng ?? Math.random;
  const messages: string[] = [];
  const result: AfterHitAbilityResult = { messages };
  const def = opts.defenderAbility;
  if (!def || opts.damage <= 0) {
    if (opts.attackerAbility === 'stench' && opts.damage > 0 && rng() < 0.1) {
      result.flinchDefender = true;
    }
    return result;
  }
  if (def === 'anger-point' && opts.crit) {
    result.defenderStageDelta = { ...result.defenderStageDelta, atk: 12 };
    messages.push(`${opts.defenderName}'s Anger Point maxed its Attack!`);
  }
  if (def === 'justified' && opts.moveType === 'dark') {
    result.defenderStageDelta = { ...result.defenderStageDelta, atk: (result.defenderStageDelta?.atk ?? 0) + 1 };
    messages.push(`${opts.defenderName}'s Justified raised its Attack!`);
  }
  if (def === 'rattled' && (opts.moveType === 'bug' || opts.moveType === 'dark' || opts.moveType === 'ghost')) {
    result.defenderStageDelta = { ...result.defenderStageDelta, spe: (result.defenderStageDelta?.spe ?? 0) + 1 };
    messages.push(`${opts.defenderName}'s Rattled raised its Speed!`);
  }
  if (def === 'weak-armor' && opts.category === 'physical') {
    result.defenderStageDelta = {
      ...result.defenderStageDelta,
      def: (result.defenderStageDelta?.def ?? 0) - 1,
      spe: (result.defenderStageDelta?.spe ?? 0) + 1,
    };
    messages.push(`${opts.defenderName}'s Weak Armor lowered its Defense and raised its Speed!`);
  }
  if (def === 'color-change' && opts.moveType) {
    result.defenderTypes = [opts.moveType];
    messages.push(`${opts.defenderName}'s Color Change made it ${opts.moveType}!`);
  }
  if (def === 'cursed-body' && rng() < 0.3) {
    result.disableAttackerMove = true;
    messages.push(`${opts.defenderName}'s Cursed Body disabled the move!`);
  }
  if (opts.attackerAbility === 'stench' && rng() < 0.1) {
    result.flinchDefender = true;
  }
  return result;
}

export function abilityOnKnockOut(opts: {
  attackerAbility?: string;
  defenderAbility?: string;
  contact: boolean;
  attackerMaxHp: number;
}): { moxie: boolean; aftermathDamage: number } {
  const moxie = opts.attackerAbility === 'moxie';
  const aftermathDamage =
    opts.defenderAbility === 'aftermath' && opts.contact
      ? Math.max(1, Math.floor(opts.attackerMaxHp / 4))
      : 0;
  return { moxie, aftermathDamage };
}

export type MoodyPick = { plus: StageKey; minus: StageKey };

export function abilityMoodyDelta(rng: () => number = Math.random): MoodyPick | null {
  const stats: StageKey[] = ['atk', 'def', 'spa', 'spd', 'spe'];
  const plus = stats[Math.min(stats.length - 1, Math.floor(rng() * stats.length))]!;
  const rest = stats.filter((s) => s !== plus);
  const minus = rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))]!;
  return { plus, minus };
}

export interface EndOfTurnAbilityResult {
  messages: string[];
  clearStatus?: boolean;
  healFraction?: number;
  speedBoost?: boolean;
  moody?: MoodyPick;
}

export function resolveEndOfTurnAbility(opts: {
  ability?: string;
  displayName: string;
  weather: BattleWeather;
  weatherSuppressed: boolean;
  hasStatus: boolean;
  rng?: () => number;
}): EndOfTurnAbilityResult {
  const { ability, displayName, weather, weatherSuppressed } = opts;
  const messages: string[] = [];
  const result: EndOfTurnAbilityResult = { messages };
  if (!ability) return result;
  if (opts.hasStatus && abilityCuresStatusEot(ability, weather, weatherSuppressed)) {
    result.clearStatus = true;
    messages.push(
      ability === 'hydration'
        ? `${displayName}'s Hydration cured its status!`
        : `${displayName}'s Shed Skin cured its status!`,
    );
  }
  const heal = abilityWeatherHeal(ability, weather, weatherSuppressed);
  if (heal !== 0) {
    result.healFraction = heal;
    messages.push(
      heal > 0
        ? `${displayName} restored HP with ${abilityLabel(ability)}!`
        : `${displayName} is hurt by ${abilityLabel(ability)}!`,
    );
  }
  if (abilitySpeedBoost(ability)) {
    result.speedBoost = true;
    messages.push(`${displayName}'s Speed Boost raised its Speed!`);
  }
  if (ability === 'moody') {
    result.moody = abilityMoodyDelta(opts.rng);
    if (result.moody) {
      messages.push(`${displayName}'s Moody sharply raised one stat and lowered another!`);
    }
  }
  return result;
}

export function abilityScrappyEffectiveness(
  ability: string | undefined,
  moveType: string,
  defenderTypes: string[],
  effectiveness: number,
): number {
  if (ability !== 'scrappy' || effectiveness !== 0) return effectiveness;
  if (moveType !== 'normal' && moveType !== 'fighting') return effectiveness;
  if (!defenderTypes.some((t) => t.toLowerCase() === 'ghost')) return effectiveness;
  return 1;
}

export function abilitySecondaryChanceMultForHit(
  attackerAbility: string | undefined,
  defenderAbility: string | undefined,
): number {
  if (defenderAbility === 'shield-dust') return 0;
  return abilitySecondaryChanceMult(attackerAbility);
}
