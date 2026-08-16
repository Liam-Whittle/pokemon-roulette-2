/** Same-type attack bonus (Gen 2+ mainline). */
export const STAB_MULTIPLIER = 1.5;

/** Generation 1 type chart (Red/Blue/Yellow). 15 types only. */
const GEN1_CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5 },
  ice: { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, bug: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 2, flying: 0.5, psychic: 2, ghost: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2 },
  ghost: { normal: 0, psychic: 0, ghost: 2 },
  dragon: { dragon: 2 },
};

/** Generation 2-5 style chart used for Johto runs. */
const GEN2_PLUS_CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, steel: 0.5, ghost: 0 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 },
};

export function getTypeEffectiveness(
  attackType: string,
  defenderTypes: string[],
  region: 'Kanto' | 'Johto' | 'Hoenn' = 'Kanto',
): number {
  const chart = region === 'Kanto' ? GEN1_CHART : GEN2_PLUS_CHART;
  let multiplier = 1;
  for (const defType of defenderTypes) {
    const row = chart[attackType.toLowerCase()];
    if (row && row[defType.toLowerCase()] !== undefined) {
      multiplier *= row[defType.toLowerCase()];
    }
  }
  return multiplier;
}

export function hasStab(attackerTypes: string[], moveType: string): boolean {
  const normalized = moveType.toLowerCase();
  return attackerTypes.some((t) => t.toLowerCase() === normalized);
}

export function getStabMultiplier(attackerTypes: string[], moveType: string): number {
  return hasStab(attackerTypes, moveType) ? STAB_MULTIPLIER : 1;
}

/** Battle log line for type effectiveness (empty on neutral 1×). */
export function getEffectivenessLabel(multiplier: number): string {
  if (multiplier <= 0) return "It doesn't affect the opposing Pokémon!";
  if (multiplier >= 4) return "It's 4× super effective!";
  if (multiplier >= 2) return "It's super effective!";
  if (multiplier < 1) return "It's not very effective…";
  return '';
}

/** Short chip label for move picker; null when neutral (1×). */
export function getEffectivenessChipLabel(multiplier: number): string | null {
  if (multiplier >= 4) return '4× Super';
  if (multiplier >= 2) return 'Super';
  if (multiplier <= 0) return 'No Effect';
  if (multiplier < 1) return 'Not Very';
  return null;
}

export function hitTimesMessage(hits: number): string | null {
  if (hits <= 1) return null;
  return `Hit ${hits} times!`;
}

export function buildHitBattleMessage(
  usedLine: string,
  effectiveness: number,
  damage: number,
  crit: boolean,
): string {
  if (effectiveness <= 0) {
    return `${usedLine} It doesn't affect the opposing Pokémon!`;
  }
  let msg = usedLine;
  if (crit) msg += ' A critical hit!';
  msg += ` Dealt ${damage} damage!`;
  const note = getEffectivenessLabel(effectiveness);
  if (note) msg += ` ${note}`;
  return msg;
}

export const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};
