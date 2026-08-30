import type { BiomeDef } from '../types';

export const BIOMES: Record<string, BiomeDef> = {
  'viridian-forest': {
    id: 'viridian-forest',
    name: 'Novice Wing',
    act: 1,
    flavor: 'The first elevators. Trainers here are still finding their rhythm.',
    normals: ['e-weedle-kakuna', 'e-pidgey-pair', 'e-pidgey-rattata', 'e-voltorb-rattata', 'e-forest-trio', 'e-bug-swarm'],
    elites: ['e-fearow', 'e-arbok'],
    boss: 'e-beedrill',
    events: ['mysterious-shrine', 'fishing-guru', 'sleeping-snorlax'],
  },
  'mt-moon': {
    id: 'mt-moon',
    name: 'Foundation Hall',
    act: 1,
    flavor: 'Practice arenas and stone galleries just above the lobby.',
    normals: ['e-geodude-pair', 'e-zubat-geodude', 'e-paras-zubat', 'e-clefairy', 'e-cave-swarm'],
    elites: ['e-onix', 'e-arbok'],
    boss: 'e-golem',
    events: ['mysterious-shrine', 'cursed-rod', 'abandoned-mart'],
  },
  'rocket-hideout': {
    id: 'rocket-hideout',
    name: 'Veteran Wing',
    act: 2,
    flavor: 'The lights get harsher. Every room is a ranked match.',
    normals: ['e-koffing-pair', 'e-grimer-pair', 'e-magneton', 'e-raticate-ekans', 'e-rocket-trio'],
    elites: ['e-weezing', 'e-muk'],
    boss: 'e-nidoking',
    events: ['rocket-grunts', 'rocket-bargain', 'bill-pc'],
  },
  'safari-zone': {
    id: 'safari-zone',
    name: 'Exhibition Circuit',
    act: 2,
    flavor: 'Show floors and baited challenges for the crowd in the stands.',
    normals: ['e-doduo-tauros', 'e-nidorino-scyther', 'e-chansey', 'e-grimer-pair', 'e-grimer-mob'],
    elites: ['e-kangaskhan', 'e-pinsir'],
    boss: 'e-snorlax',
    events: ['safari-gate', 'fishing-guru', 'mysterious-egg'],
  },
  'victory-road': {
    id: 'victory-road',
    name: 'Master Ascent',
    act: 3,
    flavor: 'The last stretch of elevators before the roof.',
    normals: ['e-golbat-graveler', 'e-machoke', 'e-graveler-pair', 'e-ascent-trio'],
    elites: ['e-machamp', 'e-rhydon'],
    boss: 'e-dragonite',
    events: ['move-tutor', 'pokemon-center-nurse', 'cursed-rod'],
  },
  'indigo-plateau': {
    id: 'indigo-plateau',
    name: 'Summit League',
    act: 3,
    flavor: 'The top of the tower. Only legends wait above.',
    normals: ['e-kadabra-abra', 'e-alakazam', 'e-arcanine', 'e-ascent-trio'],
    elites: ['e-gyarados', 'e-lapras'],
    boss: 'e-mewtwo',
    events: ['mysterious-egg', 'move-tutor', 'bill-pc'],
  },
};

export function biomesForAct(act: 1 | 2 | 3): BiomeDef[] {
  return Object.values(BIOMES).filter((b) => b.act === act);
}

export function getBiomeDef(id: string): BiomeDef {
  const def = BIOMES[id];
  if (!def) throw new Error(`Unknown biome ${id}`);
  return def;
}
