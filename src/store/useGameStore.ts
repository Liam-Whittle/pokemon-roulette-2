import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchPokemon } from '../api/pokeapi';
import { resetEncounterSession } from '../utils/encounterSession';
import {
  FOSSIL_POKEMON,
  GEN1_CAVE,
  GEN1_FISHING,
  GEN1_LEGENDARY,
  GEN1_WILD_HIGH,
  GEN1_WILD_LOW,
  ITEMS,
  LEGENDARY_ENCOUNTER_CHANCE,
  MAX_PARTY,
  pickRandom,
  pickRandomPokemonId,
} from '../data/pools';
import type {
  ActivityResult,
  ActivityType,
  Badge,
  BagItem,
  CaughtPokemon,
  ChampionRecord,
  PokedexEntry,
  PokemonData,
  Screen,
  Trainer,
  WheelSegment,
} from '../types/game';

type PanelTab = 'party' | 'pokedex' | 'bag';

interface GameState {
  screen: Screen;
  trainer: Trainer | null;
  party: CaughtPokemon[];
  pokedex: Record<number, PokedexEntry>;
  bag: BagItem[];
  badges: Badge[];
  hallOfChampions: ChampionRecord[];
  muted: boolean;
  musicVolume: number;
  currentActivity: ActivityType | null;
  currentSegment: WheelSegment | null;
  currentPokemon: PokemonData | null;
  currentEncounterId: number | null;
  lastResult: ActivityResult | null;
  spinsCount: number;
  lastGymSpin: number;
  eliteCleared: boolean;
  lives: number;
  starterClaimed: boolean;
  activePanel: PanelTab;
  debugGymId: string | null;
  debugEliteStage: number | null;

  setScreen: (screen: Screen) => void;
  setDebugGym: (id: string | null) => void;
  setDebugEliteStage: (stage: number | null) => void;
  setTrainer: (trainer: Trainer) => void;
  setMuted: (muted: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setActivePanel: (tab: PanelTab) => void;
  startActivity: (segment: WheelSegment) => void;
  setCurrentPokemon: (pokemon: PokemonData | null) => void;
  clearEncounter: () => void;
  addStarterPokemon: (pokemon: PokemonData) => void;
  catchPokemon: (pokemon: PokemonData, nickname?: string) => void;
  swapPartyMember: (caughtAt: number, pokemonId: number) => void;
  addItem: (itemId: string, quantity?: number) => void;
  consumeItem: (itemId: string, quantity?: number) => boolean;
  useRareCandy: () => Promise<string>;
  earnBadge: (badge: Badge) => void;
  recordChampion: () => void;
  setLastResult: (result: ActivityResult) => void;
  incrementSpins: () => void;
  setLastGymSpin: (spin: number) => void;
  setEliteCleared: (cleared: boolean) => void;
  loseLife: () => number;
  restoreLives: () => void;
  markSeen: (pokemon: PokemonData) => void;
  getEncounterId: (activity: ActivityType) => number;
  getAttackTypes: () => string[];
  resetGame: () => void;
}

const defaultBag: BagItem[] = [
  { id: 'potion', name: 'Potion', quantity: 1, icon: '💊' },
];

function toCaughtPokemon(pokemon: PokemonData, nickname?: string): CaughtPokemon {
  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: pokemon.displayName,
    types: pokemon.types,
    sprite: pokemon.sprite,
    caughtAt: Date.now(),
    nickname,
    powerLevel: pokemon.powerLevel,
    evolvesToId: pokemon.evolvesToId ?? null,
  };
}

function pickGrassEncounterId(activity: 'wild' | 'tallgrass'): number {
  if (activity === 'wild') {
    return pickRandomPokemonId(GEN1_WILD_LOW);
  }
  if (Math.random() < LEGENDARY_ENCOUNTER_CHANCE) {
    return pickRandomPokemonId(GEN1_LEGENDARY);
  }
  return pickRandomPokemonId(GEN1_WILD_HIGH);
}

function upsertBagItem(bag: BagItem[], itemId: string, quantity: number): BagItem[] {
  const itemDef = ITEMS.find((i) => i.id === itemId);
  if (!itemDef) return bag;
  const next = [...bag];
  const existing = next.find((i) => i.id === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    next.push({ id: itemDef.id, name: itemDef.name, quantity, icon: itemDef.icon });
  }
  return next.filter((i) => i.quantity > 0);
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'title',
      trainer: null,
      party: [],
      pokedex: {},
      bag: defaultBag,
      badges: [],
      hallOfChampions: [],
      muted: false,
      musicVolume: 0.05,
      currentActivity: null,
      currentSegment: null,
      currentPokemon: null,
      currentEncounterId: null,
      lastResult: null,
      spinsCount: 0,
      lastGymSpin: 0,
      eliteCleared: false,
      lives: 2,
      starterClaimed: false,
      activePanel: 'party',
      debugGymId: null,
      debugEliteStage: null,

      setScreen: (screen) => set({ screen }),
      setDebugGym: (debugGymId) => set({ debugGymId }),
      setDebugEliteStage: (debugEliteStage) => set({ debugEliteStage }),
      setTrainer: (trainer) => set({ trainer }),
      setMuted: (muted) => set({ muted }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      setActivePanel: (activePanel) => set({ activePanel }),
      setCurrentPokemon: (pokemon) => set({ currentPokemon: pokemon }),
      clearEncounter: () => set({ currentEncounterId: null, currentPokemon: null }),

      startActivity: (segment) => {
        const screenMap: Partial<Record<ActivityType, Screen>> = {
          wild: 'catch',
          tallgrass: 'catch',
          fishing: 'fishing',
          item: 'item',
          gym: 'gym',
          fossil: 'fossil',
          cave: 'cave',
          'coming-soon': 'coming-soon',
        };

        const isGrass = segment.activity === 'wild' || segment.activity === 'tallgrass';
        const encounterId = isGrass
          ? pickGrassEncounterId(segment.activity as 'wild' | 'tallgrass')
          : null;

        if (isGrass) resetEncounterSession();

        set({
          currentSegment: segment,
          currentActivity: segment.activity,
          currentEncounterId: encounterId,
          currentPokemon: null,
          screen: screenMap[segment.activity] ?? 'coming-soon',
        });
      },

      addStarterPokemon: (pokemon) => {
        const caught = toCaughtPokemon(pokemon);
        set((state) => ({
          party: [caught],
          starterClaimed: true,
          pokedex: {
            ...state.pokedex,
            [pokemon.id]: {
              seen: true,
              caught: true,
              name: pokemon.displayName,
              sprite: pokemon.sprite,
              types: pokemon.types,
              powerLevel: pokemon.powerLevel,
            },
          },
        }));
      },

      catchPokemon: (pokemon, nickname) => {
        const caught = toCaughtPokemon(pokemon, nickname);
        set((state) => {
          const nextParty =
            state.party.some((member) => member.id === caught.id && member.caughtAt === caught.caughtAt)
              ? state.party
              : state.party.length < MAX_PARTY
                ? [...state.party, caught]
                : state.party;

          return {
            party: nextParty,
            pokedex: {
              ...state.pokedex,
              [pokemon.id]: {
                seen: true,
                caught: true,
                name: pokemon.displayName,
                sprite: pokemon.sprite,
                types: pokemon.types,
                powerLevel: pokemon.powerLevel,
              },
            },
            lastResult: {
              type:
                state.currentActivity === 'fishing'
                  ? 'fishing'
                  : state.currentActivity === 'tallgrass'
                    ? 'tallgrass'
                    : 'wild',
              success: true,
              pokemon: caught,
              message: `Gotcha! ${caught.displayName} was caught!`,
            },
          };
        });
      },

      swapPartyMember: (caughtAt, pokemonId) => {
        set((state) => {
          const entry = state.pokedex[pokemonId];
          if (!entry) return state;
          // Don't allow swapping in a species that is already in the party.
          if (state.party.some((member) => member.id === pokemonId)) return state;
          const replacement: CaughtPokemon = {
            id: pokemonId,
            name: entry.name,
            displayName: entry.name,
            types: entry.types,
            sprite: entry.sprite,
            caughtAt: Date.now(),
            powerLevel: entry.powerLevel,
            evolvesToId: null,
          };
          return {
            party: state.party.map((member) => (member.caughtAt === caughtAt ? replacement : member)),
          };
        });
      },

      addItem: (itemId, quantity = 1) => {
        set((state) => ({ bag: upsertBagItem(state.bag, itemId, quantity) }));
      },

      consumeItem: (itemId, quantity = 1) => {
        const bag = get().bag;
        const existing = bag.find((item) => item.id === itemId);
        if (!existing || existing.quantity < quantity) return false;
        set((state) => ({ bag: upsertBagItem(state.bag, itemId, -quantity) }));
        return true;
      },

      useRareCandy: async () => {
        if (!get().consumeItem('rarecandy', 1)) {
          return 'No Rare Candy left.';
        }

        const evolvable = get().party.filter((pokemon) => pokemon.evolvesToId);
        if (evolvable.length === 0) {
          get().addItem('potion', 1);
          return 'No party Pokemon could evolve, so you received a free Potion.';
        }

        const chosen = pickRandom(evolvable);
        const evolved = await fetchPokemon(chosen.evolvesToId!);
        set((state) => {
          const party = state.party.map((member) =>
            member.caughtAt === chosen.caughtAt ? toCaughtPokemon(evolved, member.nickname) : member,
          );
          return {
            party,
            pokedex: {
              ...state.pokedex,
              [evolved.id]: {
                seen: true,
                caught: true,
                name: evolved.displayName,
                sprite: evolved.sprite,
                types: evolved.types,
                powerLevel: evolved.powerLevel,
              },
            },
          };
        });
        return `${chosen.displayName} evolved into ${evolved.displayName}!`;
      },

      earnBadge: (badge) => {
        set((state) => {
          if (state.badges.some((b) => b.id === badge.id)) return state;
          return { badges: [...state.badges, badge] };
        });
      },

      recordChampion: () => {
        const { trainer, party } = get();
        if (!trainer) return;
        const powers = party.map((p) => (Number.isFinite(p.powerLevel) ? p.powerLevel : 0.3));
        const avgPower = powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : 0;
        const record: ChampionRecord = {
          id: `${Date.now()}-${trainer.name}`,
          trainerName: trainer.name,
          trainerAvatar: trainer.avatar,
          region: trainer.region || 'Kanto',
          party: party.map((member) => ({ ...member })),
          avgPower,
          date: Date.now(),
        };
        set((state) => ({ hallOfChampions: [record, ...state.hallOfChampions] }));
      },

      setLastResult: (result) => set({ lastResult: result }),
      incrementSpins: () => set((state) => ({ spinsCount: state.spinsCount + 1 })),
      setLastGymSpin: (spin) => set({ lastGymSpin: spin }),
      setEliteCleared: (cleared) => set({ eliteCleared: cleared }),
      loseLife: () => {
        let lives = 0;
        set((state) => {
          lives = Math.max(0, state.lives - 1);
          return { lives };
        });
        return lives;
      },
      restoreLives: () => set({ lives: 2 }),

      markSeen: (pokemon) => {
        set((state) => ({
          pokedex: {
            ...state.pokedex,
            [pokemon.id]: {
              seen: true,
              caught: state.pokedex[pokemon.id]?.caught ?? false,
              name: pokemon.displayName,
              sprite: pokemon.sprite,
              types: pokemon.types,
              powerLevel: pokemon.powerLevel,
            },
          },
        }));
      },

      getEncounterId: (activity) => {
        switch (activity) {
          case 'fishing':
            return pickRandomPokemonId(GEN1_FISHING);
          case 'cave':
            return pickRandomPokemonId(GEN1_CAVE);
          case 'fossil':
            return pickRandomPokemonId(FOSSIL_POKEMON);
          case 'tallgrass':
            return pickGrassEncounterId('tallgrass');
          case 'wild':
            return pickGrassEncounterId('wild');
          default:
            return pickRandomPokemonId(GEN1_WILD_LOW);
        }
      },

      getAttackTypes: () => {
        const allTypes = new Set(get().party.flatMap((pokemon) => pokemon.types));
        return Array.from(allTypes);
      },

      resetGame: () =>
        set({
          screen: 'title',
          trainer: null,
          party: [],
          pokedex: {},
          bag: defaultBag,
          badges: [],
          currentActivity: null,
          currentSegment: null,
          currentPokemon: null,
          currentEncounterId: null,
          lastResult: null,
          spinsCount: 0,
          lastGymSpin: 0,
          eliteCleared: false,
          lives: 2,
          starterClaimed: false,
          activePanel: 'party',
        }),
    }),
    {
      name: 'pokemon-catch-quest',
      partialize: (state) => ({
        trainer: state.trainer,
        party: state.party,
        pokedex: state.pokedex,
        bag: state.bag,
        badges: state.badges,
        hallOfChampions: state.hallOfChampions,
        muted: state.muted,
        musicVolume: state.musicVolume,
        spinsCount: state.spinsCount,
        lastGymSpin: state.lastGymSpin,
        eliteCleared: state.eliteCleared,
        lives: state.lives,
        starterClaimed: state.starterClaimed,
        activePanel: state.activePanel,
      }),
    },
  ),
);
