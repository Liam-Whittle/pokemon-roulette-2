import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchPokemon } from '../api/pokeapi';
import { resetEncounterSession } from '../utils/encounterSession';
import {
  FOSSIL_POKEMON,
  GEN1_CAVE,
  GEN1_FISHING,
  GEN1_LEGENDARY,
  GEN1_WILD_LOW,
  GEN1_WILD_HIGH,
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
  EvolveResult,
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
  money: number;
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
  lastCaughtAt: number | null;

  setScreen: (screen: Screen) => void;
  setDebugGym: (id: string | null) => void;
  setDebugEliteStage: (stage: number | null) => void;
  setTrainer: (trainer: Trainer) => void;
  setMuted: (muted: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setActivePanel: (tab: PanelTab) => void;
  startActivity: (segment: WheelSegment) => void;
  startLegendaryEncounter: () => void;
  startDebugLegendary: () => void;
  setCurrentPokemon: (pokemon: PokemonData | null) => void;
  clearEncounter: () => void;
  addStarterPokemon: (pokemon: PokemonData) => void;
  catchPokemon: (pokemon: PokemonData, nickname?: string) => void;
  setShinyOnCatch: (caughtAt: number) => void;
  swapPartyMember: (caughtAt: number, pokemonId: number) => void;
  addItem: (itemId: string, quantity?: number) => void;
  consumeItem: (itemId: string, quantity?: number) => boolean;
  useRareCandy: () => Promise<EvolveResult>;
  evolveRandomPartyMember: () => Promise<EvolveResult>;
  earnBadge: (badge: Badge) => void;
  recordChampion: () => void;
  setLastResult: (result: ActivityResult) => void;
  incrementSpins: () => void;
  setLastGymSpin: (spin: number) => void;
  setEliteCleared: (cleared: boolean) => void;
  loseLife: () => number;
  restoreLives: () => void;
  restoreOneLife: () => void;
  addMoney: (amount: number) => void;
  spendMoney: (amount: number) => boolean;
  markSeen: (pokemon: PokemonData) => void;
  getEncounterId: (activity: ActivityType) => number;
  getAttackTypes: () => string[];
  resetGame: () => void;
}

function createDefaultBag(): BagItem[] {
  return [
    { id: 'potion', name: 'Potion', quantity: 1, icon: '💊' },
    { id: 'pokeball', name: 'Poké Ball', quantity: 5, icon: '🔴' },
  ];
}

function toCaughtPokemon(pokemon: PokemonData, nickname?: string): CaughtPokemon {
  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: pokemon.displayName,
    types: pokemon.types,
    sprite: pokemon.sprite,
    shinySprite: pokemon.shinySprite,
    caughtAt: Date.now(),
    nickname,
    powerLevel: pokemon.powerLevel,
    evolvesToId: pokemon.evolvesToId ?? null,
    shiny: false,
  };
}

interface EvolvableMember {
  member: CaughtPokemon;
  fromData: PokemonData;
  evolvesToId: number;
}

/**
 * Resolves which party members can currently evolve by re-fetching their
 * species data (cached). This is more reliable than the stored `evolvesToId`,
 * which can be stale on older saves or cleared when a Pokémon is swapped in.
 */
async function findEvolvableMembers(party: CaughtPokemon[]): Promise<EvolvableMember[]> {
  const datas = await Promise.all(
    party.map((member) => fetchPokemon(member.id).catch(() => null)),
  );
  const result: EvolvableMember[] = [];
  party.forEach((member, index) => {
    const data = datas[index];
    if (data && data.evolvesToId) {
      result.push({ member, fromData: data, evolvesToId: data.evolvesToId });
    }
  });
  return result;
}

async function performEvolution(
  set: (updater: (state: GameState) => Partial<GameState>) => void,
  chosen: EvolvableMember,
): Promise<EvolveResult> {
  const { member, fromData, evolvesToId } = chosen;
  const evolved = await fetchPokemon(evolvesToId);

  set((state) => {
    const party = state.party.map((entry) =>
      entry.caughtAt === member.caughtAt
        ? { ...toCaughtPokemon(evolved, member.nickname), shiny: member.shiny }
        : entry,
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

  return {
    message: `${member.displayName} evolved into ${evolved.displayName}!`,
    evolution: {
      fromName: member.nickname ?? member.displayName,
      fromArtwork: fromData.artwork,
      fromTypes: fromData.types,
      toName: evolved.displayName,
      toArtwork: evolved.artwork,
      toTypes: evolved.types,
    },
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
  const existing = bag.find((i) => i.id === itemId);
  if (existing) {
    const nextQty = existing.quantity + quantity;
    if (nextQty <= 0) return bag.filter((i) => i.id !== itemId);
    return bag.map((i) => (i.id === itemId ? { ...i, quantity: nextQty } : i));
  }
  if (quantity <= 0) return bag;
  return [...bag, { id: itemDef.id, name: itemDef.name, quantity, icon: itemDef.icon }];
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'title',
      trainer: null,
      party: [],
      pokedex: {},
      bag: createDefaultBag(),
      badges: [],
      hallOfChampions: [],
      muted: false,
      musicVolume: 0.05,
      money: 100,
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
      lastCaughtAt: null,

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
          legendary: 'catch',
          shop: 'shop',
        };

        const isGrass = segment.activity === 'wild' || segment.activity === 'tallgrass';
        const isLegendary = segment.activity === 'legendary';
        const encounterId = isLegendary
          ? pickRandomPokemonId(GEN1_LEGENDARY)
          : isGrass
            ? pickGrassEncounterId(segment.activity as 'wild' | 'tallgrass')
            : null;

        if (isGrass || isLegendary) resetEncounterSession();

        set({
          currentSegment: segment,
          currentActivity: isLegendary ? 'tallgrass' : segment.activity,
          currentEncounterId: encounterId,
          currentPokemon: null,
          screen: screenMap[segment.activity] ?? 'coming-soon',
        });
      },

      startLegendaryEncounter: () => {
        resetEncounterSession();
        set({
          currentSegment: null,
          currentActivity: 'tallgrass',
          currentEncounterId: pickRandomPokemonId(GEN1_LEGENDARY),
          currentPokemon: null,
          screen: 'catch',
        });
      },

      startDebugLegendary: () => {
        get().startLegendaryEncounter();
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
            lastCaughtAt: caught.caughtAt,
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

      setShinyOnCatch: (caughtAt) => {
        set((state) => ({
          party: state.party.map((member) =>
            member.caughtAt === caughtAt ? { ...member, shiny: true } : member,
          ),
        }));
      },

      swapPartyMember: (caughtAt, pokemonId) => {
        set((state) => {
          const entry = state.pokedex[pokemonId];
          if (!entry) return state;
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
          return { message: 'No Rare Candy left.', evolution: null };
        }

        const evolvable = await findEvolvableMembers(get().party);
        if (evolvable.length === 0) {
          get().addItem('potion', 1);
          return {
            message: 'None of your Pokémon can evolve right now, so you received a Potion!',
            evolution: null,
          };
        }

        const chosen = pickRandom(evolvable);
        return performEvolution(set, chosen);
      },

      evolveRandomPartyMember: async () => {
        const evolvable = await findEvolvableMembers(get().party);
        if (evolvable.length === 0) {
          return { message: 'None of your Pokémon can evolve right now.', evolution: null };
        }

        const chosen = pickRandom(evolvable);
        return performEvolution(set, chosen);
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
      restoreOneLife: () => set({ lives: 1 }),
      addMoney: (amount) => set((state) => ({ money: state.money + amount })),
      spendMoney: (amount) => {
        if (get().money < amount) return false;
        set((state) => ({ money: state.money - amount }));
        return true;
      },

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
          case 'legendary':
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
          bag: createDefaultBag(),
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
          money: 100,
          lastCaughtAt: null,
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
        money: state.money,
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
