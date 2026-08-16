export type PokemonGender = 'male' | 'female';

const FIXED_FEMALE = new Set([
  29, 30, 31, // Nidoran♀ line
  113, 242, // Chansey / Blissey
  115, // Kangaskhan
  124, // Jynx
  238, // Smoochum
  241, // Miltank
  314, // Illumise
  380, // Latias
]);

const FIXED_MALE = new Set([
  32, 33, 34, // Nidoran♂ line
  106, 107, 237, // Hitmonlee / Hitmonchan / Hitmontop
  128, // Tauros
  236, // Tyrogue
  313, // Volbeat
  381, // Latios
]);

const GENDERLESS = new Set([
  0, // MissingNo.
  81, 82, // Magnemite / Magneton
  100, 101, // Voltorb / Electrode
  120, 121, // Staryu / Starmie
  132, // Ditto
  137, 233, // Porygon / Porygon2
  144, 145, 146, // legendary birds
  150, 151, // Mewtwo / Mew
  201, // Unown
  243, 244, 245, // legendary beasts
  249, 250, 251, // Lugia / Ho-Oh / Celebi
  292, // Shedinja
  337, 338, // Lunatone / Solrock
  343, 344, // Baltoy / Claydol
  374, 375, 376, // Beldum line
  377, 378, 379, // Regis
  382, 383, 384, // weather trio
  385, 386, // Jirachi / Deoxys
  493, // Arceus
]);

export function isGenderlessSpecies(id: number): boolean {
  return GENDERLESS.has(id);
}

export function fixedGenderForSpecies(id: number): PokemonGender | null {
  if (FIXED_FEMALE.has(id)) return 'female';
  if (FIXED_MALE.has(id)) return 'male';
  return null;
}

export function rollGenderForSpecies(id: number, rng: () => number = Math.random): PokemonGender | null {
  if (GENDERLESS.has(id)) return null;
  const fixed = fixedGenderForSpecies(id);
  if (fixed) return fixed;
  return rng() < 0.5 ? 'male' : 'female';
}
