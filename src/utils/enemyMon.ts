import { assignMoves } from '../data/moves';
import { rollAbilityForSpecies } from '../data/abilities';
import { rollGenderForSpecies } from '../data/speciesGender';
import type { CaughtPokemon, PokemonData } from '../types/game';
import { maxHpForMon, randomIVs, randomNature, zeroEVs } from './stats';

export function buildEnemyMon(species: PokemonData, level: number): CaughtPokemon {
  const mon: CaughtPokemon = {
    id: species.id,
    name: species.name,
    displayName: species.displayName,
    types: species.types,
    sprite: species.sprite,
    shinySprite: species.shinySprite,
    caughtAt: species.id * 1000 + level,
    level,
    xp: 0,
    ivs: randomIVs(),
    evs: zeroEVs(),
    nature: randomNature(),
    moves: assignMoves(species.id, species.types, level, true),
    evolvesToId: species.evolvesToId ?? null,
    ability: rollAbilityForSpecies(species.id),
    gender: rollGenderForSpecies(species.id),
  };
  mon.hp = maxHpForMon(mon);
  return mon;
}

export function buildEnemyTeam(
  speciesList: PokemonData[],
  levels: number[],
): CaughtPokemon[] {
  return speciesList.map((sp, i) => buildEnemyMon(sp, levels[i] ?? levels[0] ?? 5));
}
