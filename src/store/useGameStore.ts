import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchPokemon, getPlaceholderPokemon } from '../api/pokeapi';
import { resetEncounterSession } from '../utils/encounterSession';
import { assignMoves } from '../data/moves';
import { hasReducedPp } from '../data/moves';
import { currentHp, maxHpForMon, XP_PER_LEVEL } from '../utils/stats';
import { clearAllStatuses } from '../utils/status';
import { applyXp, applyXpToAll, encounterLevelForBadges } from '../utils/xp';
import { getAvailableEvolutions } from '../utils/evolution';
import { createCaughtPokemon, createCaughtAtLevel, migrateCaughtPokemon } from '../utils/pokemonInstance';
import { getCachedSpecies } from '../data/speciesCache';
import { filterEncounterPoolByEvolutionLevel } from '../utils/encounterPool';
import {
  ITEMS,
  MAX_PARTY,
  getRegionCavePool,
  getRegionFishingPool,
  getRegionFossilPool,
  getRegionGrassPool,
  getRegionGymLeaders,
  getRegionLegendaryPool,
  resolveBadgeImage,
  pickRandom,
  pickRandomPokemonId,
} from '../data/pools';
import type { RegionId } from '../data/pools';
import type {
  ActivityResult,
  ActivityType,
  Badge,
  BagItem,
  BattleSnapshot,
  CatchBallId,
  CatchGamemode,
  CaughtPokemon,
  ChampionRecord,
  EvolveResult,
  PcStat,
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
  /** Species IDs that left the PC (e.g. evolved away) and shouldn't appear there. */
  pcExcluded: number[];
  /** HP/PP retained for Pokémon sitting in the PC, keyed by species id. */
  pcStats: Record<number, PcStat>;
  pokedex: Record<number, PokedexEntry>;
  bag: BagItem[];
  badges: Badge[];
  hallOfChampions: ChampionRecord[];
  muted: boolean;
  musicVolume: number;
  showTypeEffectiveness: boolean;
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
  lastCaughtId: number | null;
  /** Once per gym battle or Elite Four run — persisted with the battle snapshot. */
  fullHealUsedInBattle: boolean;
  /** Mid-battle progress so a refresh/exit resumes the same fight. */
  battleSnapshot: BattleSnapshot | null;
  /** Catch minigame style for this run — set at trainer creation. */
  catchGamemode: CatchGamemode;
  /** One-shot notice shown when the hub screen next mounts (e.g. after Team Rocket). */
  pendingHubNotice: string | null;
  /** When set, leaving the Poké Mart routes to this battle instead of the hub. */
  pendingGymAfterShop: 'gym' | 'elite' | null;
  /** Wall-clock start of the current run; null before trainer setup. */
  runStartedAt: number | null;
  itemsUsed: number;
  livesUsed: number;
  revivesUsed: number;
  faints: number;
  shiniesCaught: number;

  setScreen: (screen: Screen) => void;
  setPendingGymAfterShop: (target: 'gym' | 'elite' | null) => void;
  setDebugGym: (id: string | null) => void;
  setDebugEliteStage: (stage: number | null) => void;
  setTrainer: (trainer: Trainer) => void;
  setCatchGamemode: (mode: CatchGamemode) => void;
  setMuted: (muted: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setShowTypeEffectiveness: (show: boolean) => void;
  setActivePanel: (tab: PanelTab) => void;
  startActivity: (segment: WheelSegment) => void;
  startLegendaryEncounter: () => void;
  startDebugLegendary: () => void;
  setCurrentPokemon: (pokemon: PokemonData | null) => void;
  clearEncounter: () => void;
  addStarterPokemon: (pokemon: PokemonData, shiny?: boolean) => void;
  /** Multiplayer: add the joined friend's helper mon. Returns caughtAt or null. */
  addGuestPokemon: (pokemon: PokemonData) => number | null;
  catchPokemon: (pokemon: PokemonData, nickname?: string, caughtWithBall?: CatchBallId) => void;
  setShinyOnCatch: (caughtAt: number) => void;
  swapPartyMember: (caughtAt: number, pokemonId: number) => void;
  swapPartyOrder: (caughtAtA: number, caughtAtB: number) => void;
  addItem: (itemId: string, quantity?: number) => void;
  consumeItem: (itemId: string, quantity?: number) => boolean;
  useRareCandyOnMember: (caughtAt: number) => boolean;
  evolvePartyMember: (caughtAt: number, toId?: number) => Promise<EvolveResult>;
  restorePartyHpSnapshot: (snapshot: Record<number, number>) => void;
  stealRandomPartyPokemon: () => string | null;
  setPendingHubNotice: (message: string | null) => void;
  useHealPowderAllParty: () => boolean;
  grantXpAllPartyAndPc: (amount: number) => void;
  earnBadge: (badge: Badge) => void;
  recordChampion: () => void;
  clearHallOfFame: () => void;
  setLastResult: (result: ActivityResult) => void;
  incrementSpins: () => void;
  setLastGymSpin: (spin: number) => void;
  setEliteCleared: (cleared: boolean) => void;
  loseLife: () => number;
  restoreLives: () => void;
  restoreOneLife: () => void;
  recordReviveUsed: () => void;
  recordFaint: () => void;
  addMoney: (amount: number) => void;
  spendMoney: (amount: number) => boolean;
  markSeen: (pokemon: PokemonData) => void;
  getEncounterId: (activity: ActivityType) => number;
  getAttackTypes: () => string[];
  makeRandomPartyShiny: () => void;
  debugAddToParty: (pokemon: PokemonData) => void;
  healPartyMember: (caughtAt: number, amount: number) => void;
  damagePartyMember: (caughtAt: number, amount: number) => void;
  setActivePartyMember: (caughtAt: number) => boolean;
  reviveHealAllParty: () => void;
  restorePartyPp: () => void;
  usePotionOnMember: (caughtAt: number) => boolean;
  useMovePp: (caughtAt: number, slug: string, maxPp: number) => void;
  useMaxElixirOnMember: (caughtAt: number) => boolean;
  /** Restore PP on a party member without consuming an item (chaos elixir). */
  restoreMemberPp: (caughtAt: number) => boolean;
  useFullHealAllParty: (inBattle?: boolean) => boolean;
  resetFullHealBattle: () => void;
  setFullHealUsedInBattle: (used: boolean) => void;
  saveBattleSnapshot: (snapshot: BattleSnapshot) => void;
  clearBattleSnapshot: () => void;
  resetGame: () => void;
}

const GUEST_UNLOCK_BADGES = 2;

function syncGuestLocks(party: CaughtPokemon[], badgeCount: number): CaughtPokemon[] {
  const unlocked = badgeCount >= GUEST_UNLOCK_BADGES;
  return party.map((member) =>
    member.guestOwned ? { ...member, guestLocked: !unlocked } : member,
  );
}

function createDefaultBag(catchGamemode: CatchGamemode = 'chance'): BagItem[] {
  if (catchGamemode === 'chance') {
    return [
      { id: 'pokeball', name: 'Poké Ball', quantity: 15, icon: '🔴' },
      { id: 'greatball', name: 'Great Ball', quantity: 5, icon: '🔵' },
      { id: 'ultraball', name: 'Ultra Ball', quantity: 1, icon: '🟡' },
    ];
  }
  return [
    { id: 'pokeball', name: 'Poké Ball', quantity: 6, icon: '🔴' },
    { id: 'greatball', name: 'Great Ball', quantity: 3, icon: '🔵' },
    { id: 'ultraball', name: 'Ultra Ball', quantity: 1, icon: '🟡' },
  ];
}

interface EvolvableMember {
  member: CaughtPokemon;
  fromData: PokemonData;
  evolvesToId: number;
}

function ownsSpecies(
  state: { party: CaughtPokemon[]; pokedex: Record<number, PokedexEntry>; pcExcluded: number[] },
  pokemonId: number,
): boolean {
  if (state.party.some((member) => member.id === pokemonId)) return true;
  const dex = state.pokedex[pokemonId];
  return !!(dex?.caught && !state.pcExcluded.includes(pokemonId));
}

function activityResultType(activity: ActivityType | null): ActivityType {
  if (activity === 'fishing') return 'fishing';
  if (activity === 'tallgrass') return 'tallgrass';
  return 'wild';
}

async function performEvolution(
  set: (updater: (state: GameState) => Partial<GameState>) => void,
  chosen: EvolvableMember,
): Promise<EvolveResult> {
  const { member, fromData, evolvesToId } = chosen;
  const evolved = await fetchPokemon(evolvesToId);

  // Warm the browser image cache for the evolved forms so the sprite is ready
  // immediately (e.g. when a gym battle starts right after evolving).
  if (typeof Image !== 'undefined') {
    [evolved.sprite, evolved.artwork, evolved.shinySprite, evolved.shinyArtwork].forEach((url) => {
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }

  const newMoves = assignMoves(evolved.id, evolved.types, member.level, true);
  const oldMax = maxHpForMon(member);
  const evolvedMember: CaughtPokemon = {
    ...createCaughtPokemon(evolved, {
      nickname: member.nickname,
      caughtWithBall: member.caughtWithBall,
      shiny: member.shiny,
      level: member.level,
      preferStrongMoves: true,
      caughtAt: member.caughtAt,
    }),
    moves: newMoves,
    xp: member.xp,
    ivs: member.ivs,
    evs: member.evs,
    nature: member.nature,
    pp: member.pp,
    status: member.status,
  };
  const newMax = maxHpForMon(evolvedMember);
  evolvedMember.hp = (member.hp ?? oldMax) + (newMax - oldMax);

  set((state) => {
    const party = state.party.map((entry) =>
      entry.caughtAt === member.caughtAt ? evolvedMember : entry,
    );
    const stillOwnsPreEvo = party.some((entry) => entry.id === member.id);
    const pcExcluded = [
      ...state.pcExcluded.filter((id) => id !== evolved.id && id !== member.id),
      ...(stillOwnsPreEvo ? [] : [member.id]),
    ];
    const priorEvoDex = state.pokedex[evolved.id];
    return {
      party,
      pcExcluded,
      pokedex: {
        ...state.pokedex,
        [evolved.id]: {
          seen: true,
          caught: true,
          name: evolved.displayName,
          sprite: evolved.sprite,
          types: evolved.types,
          level: member.level,
          shiny: member.shiny ?? false,
          shinySprite: evolved.shinySprite,
          caughtWithBall: priorEvoDex?.caughtWithBall ?? member.caughtWithBall,
        },
      },
    };
  });

  const isShiny = member.shiny ?? false;
  return {
    message: `${member.displayName} evolved into ${evolved.displayName}!`,
    evolution: {
      fromName: member.nickname ?? member.displayName,
      fromArtwork: (isShiny && fromData.shinyArtwork) || fromData.artwork,
      fromTypes: fromData.types,
      toName: evolved.displayName,
      toArtwork: (isShiny && evolved.shinyArtwork) || evolved.artwork,
      toTypes: evolved.types,
    },
  };
}

function filteredPoolForBadges(pool: number[], badgeCount: number): number[] {
  return filterEncounterPoolByEvolutionLevel(pool, encounterLevelForBadges(badgeCount));
}

function getActiveRegion(state: Pick<GameState, 'trainer'>): RegionId {
  return state.trainer?.region === 'Johto' ? 'Johto' : 'Kanto';
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
      pcExcluded: [],
      pcStats: {},
      pokedex: {},
      bag: createDefaultBag(),
      badges: [],
      hallOfChampions: [],
      muted: false,
      musicVolume: 0.05,
      showTypeEffectiveness: true,
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
      lastCaughtId: null,
      fullHealUsedInBattle: false,
      battleSnapshot: null,
      catchGamemode: 'skill' as CatchGamemode,
      pendingHubNotice: null,
      pendingGymAfterShop: null,
      runStartedAt: null,
      itemsUsed: 0,
      livesUsed: 0,
      revivesUsed: 0,
      faints: 0,
      shiniesCaught: 0,

      setScreen: (screen) => set({ screen }),
      setPendingGymAfterShop: (pendingGymAfterShop) => set({ pendingGymAfterShop }),
      setPendingHubNotice: (pendingHubNotice) => set({ pendingHubNotice }),
      setDebugGym: (debugGymId) => set({ debugGymId }),
      setDebugEliteStage: (debugEliteStage) => set({ debugEliteStage }),
      setTrainer: (trainer) =>
        set({
          trainer,
          runStartedAt: Date.now(),
          itemsUsed: 0,
          livesUsed: 0,
          revivesUsed: 0,
          faints: 0,
          shiniesCaught: 0,
        }),
      setCatchGamemode: (mode) =>
        set({
          catchGamemode: mode,
          bag: createDefaultBag(mode),
        }),
      setMuted: (muted) => set({ muted }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      setShowTypeEffectiveness: (showTypeEffectiveness) => set({ showTypeEffectiveness }),
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

        const activeRegion = getActiveRegion(get());
        const isGrass = segment.activity === 'wild' || segment.activity === 'tallgrass';
        const isLegendary = segment.activity === 'legendary';
        const encounterId = isLegendary
          ? pickRandomPokemonId(
            filteredPoolForBadges(getRegionLegendaryPool(activeRegion), get().badges.length),
          )
          : isGrass
            ? pickRandomPokemonId(
              filteredPoolForBadges(getRegionGrassPool(activeRegion), get().badges.length),
            )
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
        const activeRegion = getActiveRegion(get());
        set({
          currentSegment: null,
          currentActivity: 'tallgrass',
          currentEncounterId: pickRandomPokemonId(
            filteredPoolForBadges(getRegionLegendaryPool(activeRegion), get().badges.length),
          ),
          currentPokemon: null,
          screen: 'catch',
        });
      },

      startDebugLegendary: () => {
        get().startLegendaryEncounter();
      },

      addStarterPokemon: (pokemon, shiny = false) => {
        const caught = { ...createCaughtPokemon(pokemon, { level: 5, shiny }), shiny };
        set((state) => ({
          party: [caught],
          pcExcluded: state.pcExcluded.filter((id) => id !== pokemon.id),
          starterClaimed: true,
          shiniesCaught: shiny ? state.shiniesCaught + 1 : state.shiniesCaught,
          pokedex: {
            ...state.pokedex,
            [pokemon.id]: {
              seen: true,
              caught: true,
              name: pokemon.displayName,
              sprite: pokemon.sprite,
              types: pokemon.types,
              level: 5,
              shiny,
              shinySprite: pokemon.shinySprite,
            },
          },
        }));
      },

      addGuestPokemon: (pokemon) => {
        const state = get();
        if (state.party.some((m) => m.guestOwned)) {
          return state.party.find((m) => m.guestOwned)!.caughtAt;
        }
        if (state.party.length >= MAX_PARTY) return null;
        const caughtAt = Date.now() + 1;
        const locked = state.badges.length < GUEST_UNLOCK_BADGES;
        const caught: CaughtPokemon = {
          ...createCaughtPokemon(pokemon, { level: 5 }),
          caughtAt,
          guestOwned: true,
          guestLocked: locked,
          nickname: pokemon.displayName,
        };
        set((s) => ({
          party: [...s.party, caught],
          pcExcluded: s.pcExcluded.filter((id) => id !== pokemon.id),
          pokedex: {
            ...s.pokedex,
            [pokemon.id]: {
              seen: true,
              caught: true,
              name: pokemon.displayName,
              sprite: pokemon.sprite,
              types: pokemon.types,
              level: 5,
              shiny: false,
              shinySprite: pokemon.shinySprite,
            },
          },
        }));
        return caughtAt;
      },

      catchPokemon: (pokemon, nickname, caughtWithBall) => {
        set((state) => {
          const resultType = activityResultType(state.currentActivity);
          const level = encounterLevelForBadges(state.badges.length);
          const existingPartyMember = state.party.find((member) => member.id === pokemon.id);

          if (existingPartyMember) {
            const { mon: leveledMon, leveledUp } = applyXp(existingPartyMember, XP_PER_LEVEL);
            const party = state.party.map((member) =>
              member.caughtAt === existingPartyMember.caughtAt ? leveledMon : member,
            );
            const existingDex = state.pokedex[pokemon.id];
            return {
              party,
              lastCaughtAt: existingPartyMember.caughtAt,
              lastCaughtId: pokemon.id,
              pokedex: existingDex
                ? {
                    ...state.pokedex,
                    [pokemon.id]: {
                      ...existingDex,
                      level: leveledMon.level,
                      shiny: leveledMon.shiny ?? existingDex.shiny,
                      shinySprite: leveledMon.shinySprite ?? existingDex.shinySprite,
                    },
                  }
                : state.pokedex,
              lastResult: {
                type: resultType,
                success: true,
                pokemon: leveledMon,
                message: leveledUp
                  ? `${existingPartyMember.displayName} gained a level from the duplicate catch!`
                  : `${existingPartyMember.displayName} is already max level!`,
              },
            };
          }

          if (ownsSpecies(state, pokemon.id)) {
            return {
              lastCaughtId: pokemon.id,
              lastResult: {
                type: resultType,
                success: true,
                message: `You already own ${pokemon.displayName}!`,
              },
            };
          }

          const caught = createCaughtAtLevel(pokemon, state.badges.length, nickname, caughtWithBall);
          const nextParty =
            state.party.length < MAX_PARTY ? [...state.party, caught] : state.party;

          const priorDex = state.pokedex[pokemon.id];
          return {
            party: nextParty,
            pcExcluded: state.pcExcluded.filter((id) => id !== pokemon.id),
            lastCaughtAt: caught.caughtAt,
            lastCaughtId: caught.id,
            pokedex: {
              ...state.pokedex,
              [pokemon.id]: {
                seen: true,
                caught: true,
                name: pokemon.displayName,
                sprite: pokemon.sprite,
                types: pokemon.types,
                level,
                shiny: priorDex?.shiny ?? false,
                shinySprite: priorDex?.shinySprite ?? pokemon.shinySprite,
                caughtWithBall: priorDex?.caughtWithBall ?? caughtWithBall,
              },
            },
            lastResult: {
              type: resultType,
              success: true,
              pokemon: caught,
              message: `Gotcha! ${caught.displayName} was caught!`,
            },
          };
        });
      },

      setShinyOnCatch: (caughtAt) => {
        set((state) => {
          const target =
            caughtAt != null
              ? state.party.find((member) => member.caughtAt === caughtAt)
              : undefined;
          // Party match, or PC-only / full-party catch via lastCaughtId.
          const pokedexId = target?.id ?? state.lastCaughtId ?? undefined;
          const existing = pokedexId !== undefined ? state.pokedex[pokedexId] : undefined;
          const shinySprite = target?.shinySprite ?? existing?.shinySprite;
          const party = state.party.map((member) => {
            if (target && member.caughtAt === target.caughtAt) {
              return { ...member, shiny: true, shinySprite: shinySprite ?? member.shinySprite };
            }
            // Duplicate-catch shiny on a PC mon that is not in party: no party change.
            // If lastCaughtId matches a party member (should be rare), still mark it.
            if (!target && pokedexId !== undefined && member.id === pokedexId) {
              return { ...member, shiny: true, shinySprite: shinySprite ?? member.shinySprite };
            }
            return member;
          });
          return {
            party,
            shiniesCaught: state.shiniesCaught + 1,
            pokedex:
              pokedexId !== undefined && existing
                ? {
                    ...state.pokedex,
                    [pokedexId]: {
                      ...existing,
                      shiny: true,
                      shinySprite: shinySprite ?? existing.shinySprite,
                    },
                  }
                : state.pokedex,
          };
        });
      },

      makeRandomPartyShiny: () => {
        const { party } = get();
        const candidates = party.filter((member) => !member.shiny);
        if (candidates.length === 0) return;
        const chosen = pickRandom(candidates);
        set((state) => {
          const partyNext = state.party.map((member) =>
            member.caughtAt === chosen.caughtAt ? { ...member, shiny: true } : member,
          );
          const existing = state.pokedex[chosen.id];
          return {
            party: partyNext,
            pokedex: existing
              ? {
                  ...state.pokedex,
                  [chosen.id]: { ...existing, shiny: true, shinySprite: chosen.shinySprite },
                }
              : state.pokedex,
          };
        });
      },

      debugAddToParty: (pokemon) => {
        const caught = createCaughtPokemon(pokemon, { level: 5 });
        set((state) => {
          const party =
            state.party.length < MAX_PARTY
              ? [...state.party, caught]
              : [...state.party.slice(0, MAX_PARTY - 1), caught];
          return {
            party,
            lastCaughtAt: caught.caughtAt,
            pokedex: {
              ...state.pokedex,
              [pokemon.id]: {
                seen: true,
                caught: true,
                name: pokemon.displayName,
                sprite: pokemon.sprite,
                types: pokemon.types,
                level: 5,
                shiny: state.pokedex[pokemon.id]?.shiny ?? false,
                shinySprite: state.pokedex[pokemon.id]?.shinySprite ?? pokemon.shinySprite,
              },
            },
          };
        });
      },

      swapPartyMember: (caughtAt, pokemonId) => {
        set((state) => {
          const entry = state.pokedex[pokemonId];
          if (!entry) return state;
          if (state.party.some((member) => member.id === pokemonId)) return state;
          const outgoing = state.party.find((member) => member.caughtAt === caughtAt);
          if (outgoing?.guestOwned) return state;
          const saved = state.pcStats[pokemonId];
          const cached = getCachedSpecies(pokemonId);
          const baseMon = createCaughtPokemon(
            cached
              ? {
                  id: pokemonId,
                  name: cached.name,
                  displayName: cached.name,
                  types: cached.types,
                  sprite: entry.sprite,
                  artwork: entry.sprite,
                  shinySprite: entry.shinySprite,
                  shinyArtwork: entry.shinySprite,
                  catchRate: cached.catchRate,
                  isLegendary: cached.isLegendary,
                  baseStats: cached.baseStats,
                  baseStatTotal: cached.baseStatTotal,
                  evolvesToId: cached.evolvesToIds[0] ?? null,
                  evolvesToIds: cached.evolvesToIds,
                }
              : getPlaceholderPokemon(pokemonId),
            { level: entry.level, shiny: entry.shiny, caughtWithBall: entry.caughtWithBall, caughtAt: Date.now() },
          );
          const replacement: CaughtPokemon = {
            ...baseMon,
            hp: saved ? Math.min(saved.hp, maxHpForMon(baseMon)) : maxHpForMon(baseMon),
            pp: saved?.pp,
            status: saved?.status,
          };
          const pcStats = { ...state.pcStats };
          delete pcStats[pokemonId];
          let pokedex = state.pokedex;
          if (outgoing) {
            pcStats[outgoing.id] = { hp: currentHp(outgoing), pp: outgoing.pp, status: outgoing.status };
            const outDex = state.pokedex[outgoing.id];
            if (outDex) {
              pokedex = {
                ...pokedex,
                [outgoing.id]: {
                  ...outDex,
                  level: outgoing.level,
                  shiny: outgoing.shiny ?? outDex.shiny,
                  shinySprite: outgoing.shinySprite ?? outDex.shinySprite,
                },
              };
            }
          }
          return {
            party: state.party.map((member) => (member.caughtAt === caughtAt ? replacement : member)),
            pcStats,
            pokedex,
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
        set((state) => ({
          bag: upsertBagItem(state.bag, itemId, -quantity),
          itemsUsed: itemId === 'maxrevive' ? state.itemsUsed : state.itemsUsed + quantity,
        }));
        return true;
      },

      useRareCandyOnMember: (caughtAt) => {
        if (!get().consumeItem('rarecandy', 1)) return false;
        const member = get().party.find((m) => m.caughtAt === caughtAt);
        if (!member) return false;
        const { mon } = applyXp(member, XP_PER_LEVEL);
        set((state) => ({
          party: state.party.map((entry) => (entry.caughtAt === caughtAt ? mon : entry)),
        }));
        return true;
      },

      evolvePartyMember: async (caughtAt, toId) => {
        const member = get().party.find((m) => m.caughtAt === caughtAt);
        if (!member) {
          return { message: 'Pokémon not found in party.', evolution: null };
        }
        const currentRegion = getActiveRegion(get());
        const available = getAvailableEvolutions(member.id, member.level, get().bag, {
          region: currentRegion,
          caughtAt: member.caughtAt,
        });
        if (available.length === 0) {
          return { message: `${member.displayName} cannot evolve yet.`, evolution: null };
        }
        const targetId = toId ?? available[0].toId;
        const chosen = available.find((evo) => evo.toId === targetId);
        if (!chosen) {
          return { message: 'That evolution is not available.', evolution: null };
        }
        const data = await fetchPokemon(member.id).catch(() => null);
        if (!data) {
          return { message: 'Could not load Pokémon data.', evolution: null };
        }
        if (chosen.stoneId && !get().consumeItem(chosen.stoneId, 1)) {
          const stoneName = ITEMS.find((item) => item.id === chosen.stoneId)?.name ?? 'required stone';
          return { message: `You need a ${stoneName} to evolve this Pokémon.`, evolution: null };
        }
        return performEvolution(set, { member, fromData: data, evolvesToId: targetId });
      },

      restorePartyHpSnapshot: (snapshot) => {
        set((state) => ({
          party: state.party.map((member) => {
            const hp = snapshot[member.caughtAt];
            if (hp === undefined) return member;
            return { ...member, hp };
          }),
        }));
      },

      stealRandomPartyPokemon: () => {
        const party = get().party;
        if (party.length === 0) return null;
        const stolen = pickRandom(party);
        const stolenName = stolen.nickname ?? stolen.displayName;
        set((state) => {
          const nextParty = state.party.filter((m) => m.caughtAt !== stolen.caughtAt);
          const stillInParty = nextParty.some((m) => m.id === stolen.id);
          const pcExcluded = stillInParty
            ? state.pcExcluded
            : [...state.pcExcluded.filter((id) => id !== stolen.id), stolen.id];
          return { party: nextParty, pcExcluded };
        });
        return stolenName;
      },

      earnBadge: (badge) => {
        set((state) => {
          if (state.badges.some((b) => b.id === badge.id)) return state;
          const region = getActiveRegion(state);
          const image =
            badge.image ??
            getRegionGymLeaders(region).find((leader) => leader.id === badge.id)?.badgeImage;
          const badges = [...state.badges, { ...badge, image }];
          return {
            badges,
            party: syncGuestLocks(state.party, badges.length),
          };
        });
      },

      recordChampion: () => {
        const {
          trainer,
          party,
          runStartedAt,
          itemsUsed,
          livesUsed,
          revivesUsed,
          faints,
          shiniesCaught,
        } = get();
        if (!trainer) return;
        const started = runStartedAt ?? Date.now();
        const record: ChampionRecord = {
          id: `${Date.now()}-${trainer.name}`,
          trainerName: trainer.name,
          trainerAvatar: trainer.avatar,
          region: trainer.region || 'Kanto',
          party: party.map((member) => ({ ...member })),
          date: Date.now(),
          timeMs: Math.max(0, Date.now() - started),
          itemsUsed,
          livesUsed,
          revivesUsed,
          faints,
          shiniesCaught,
        };
        set((state) => ({ hallOfChampions: [record, ...state.hallOfChampions] }));
      },

      clearHallOfFame: () => set({ hallOfChampions: [] }),

      setLastResult: (result) => set({ lastResult: result }),
      incrementSpins: () => set((state) => ({ spinsCount: state.spinsCount + 1 })),
      setLastGymSpin: (spin) => set({ lastGymSpin: spin }),
      setEliteCleared: (cleared) => set({ eliteCleared: cleared }),
      loseLife: () => {
        let lives = 0;
        set((state) => {
          lives = Math.max(0, state.lives - 1);
          return { lives, livesUsed: state.livesUsed + 1 };
        });
        return lives;
      },
      restoreLives: () => set({ lives: 2 }),
      restoreOneLife: () => set({ lives: 1 }),
      recordReviveUsed: () => set((state) => ({ revivesUsed: state.revivesUsed + 1 })),
      recordFaint: () => set((state) => ({ faints: state.faints + 1 })),
      addMoney: (amount) => set((state) => ({ money: state.money + amount })),
      spendMoney: (amount) => {
        if (get().money < amount) return false;
        set((state) => ({ money: state.money - amount }));
        return true;
      },

      markSeen: (pokemon) => {
        set((state) => {
          const existing = state.pokedex[pokemon.id];
          return {
            pokedex: {
              ...state.pokedex,
              [pokemon.id]: {
                seen: true,
                caught: existing?.caught ?? false,
                name: pokemon.displayName,
                sprite: pokemon.sprite,
                types: pokemon.types,
                level: existing?.level ?? Math.min(40, 5 + state.badges.length * 5),
                shiny: existing?.shiny ?? false,
                shinySprite: existing?.shinySprite,
                caughtWithBall: existing?.caughtWithBall,
              },
            },
          };
        });
      },

      getEncounterId: (activity) => {
        const activeRegion = getActiveRegion(get());
        switch (activity) {
          case 'fishing':
            return pickRandomPokemonId(
              filteredPoolForBadges(getRegionFishingPool(activeRegion), get().badges.length),
            );
          case 'cave':
            return pickRandomPokemonId(
              filteredPoolForBadges(getRegionCavePool(activeRegion), get().badges.length),
            );
          case 'fossil': {
            const fossilPool = getRegionFossilPool(activeRegion);
            if (fossilPool.length === 0) {
              return pickRandomPokemonId(
                filteredPoolForBadges(getRegionGrassPool(activeRegion), get().badges.length),
              );
            }
            return pickRandomPokemonId(
              filteredPoolForBadges(fossilPool, get().badges.length),
            );
          }
          case 'tallgrass':
          case 'legendary':
          case 'wild':
            return pickRandomPokemonId(
              filteredPoolForBadges(getRegionGrassPool(activeRegion), get().badges.length),
            );
          default:
            return pickRandomPokemonId(
              filteredPoolForBadges(getRegionGrassPool(activeRegion), get().badges.length),
            );
        }
      },

      getAttackTypes: () => {
        const allTypes = new Set(get().party.flatMap((pokemon) => pokemon.types));
        return Array.from(allTypes);
      },

      healPartyMember: (caughtAt, amount) => {
        set((state) => ({
          party: state.party.map((member) => {
            if (member.caughtAt !== caughtAt) return member;
            const max = maxHpForMon(member);
            const hp = currentHp(member);
            if (hp <= 0) return member;
            return { ...member, hp: Math.min(max, hp + amount) };
          }),
        }));
      },

      damagePartyMember: (caughtAt, amount) => {
        set((state) => {
          let fainted = false;
          const party = state.party.map((member) => {
            if (member.caughtAt !== caughtAt) return member;
            const hp = currentHp(member);
            if (hp <= 0) return member;
            const nextHp = Math.max(0, hp - amount);
            if (nextHp <= 0) fainted = true;
            return { ...member, hp: nextHp };
          });
          return {
            party,
            faints: fainted ? state.faints + 1 : state.faints,
          };
        });
      },

      swapPartyOrder: (caughtAtA, caughtAtB) => {
        set((state) => {
          const a = state.party.findIndex((m) => m.caughtAt === caughtAtA);
          const b = state.party.findIndex((m) => m.caughtAt === caughtAtB);
          if (a === -1 || b === -1 || a === b) return state;
          const party = [...state.party];
          [party[a], party[b]] = [party[b], party[a]];
          return { party };
        });
      },

      setActivePartyMember: (caughtAt) => {
        const state = get();
        const idx = state.party.findIndex((m) => m.caughtAt === caughtAt);
        if (idx <= 0) return false;
        const member = state.party[idx];
        if (currentHp(member) <= 0) return false;
        if (member.guestLocked) return false;
        const newParty = [member, ...state.party.filter((_, i) => i !== idx)];
        set({ party: newParty });
        return true;
      },

      reviveHealAllParty: () => {
        set((state) => ({
          party: state.party.map((member) => ({
            ...member,
            hp: maxHpForMon(member),
            pp: {},
            status: undefined,
          })),
        }));
      },

      restorePartyPp: () => {
        set((state) => ({
          party: state.party.map((member) => ({ ...member, pp: {} })),
        }));
      },

      useMovePp: (caughtAt, slug, maxPp) => {
        set((state) => ({
          party: state.party.map((member) => {
            if (member.caughtAt !== caughtAt) return member;
            const pp = { ...(member.pp ?? {}) };
            const current = pp[slug] ?? maxPp;
            pp[slug] = Math.max(0, current - 1);
            return { ...member, pp };
          }),
        }));
      },

      useMaxElixirOnMember: (caughtAt) => {
        const state = get();
        const member = state.party.find((m) => m.caughtAt === caughtAt);
        if (!member || !hasReducedPp(member.pp, member.moves)) return false;
        if (!get().consumeItem('maxelixer', 1)) return false;
        set((s) => ({
          party: s.party.map((m) => (m.caughtAt === caughtAt ? { ...m, pp: {} } : m)),
        }));
        return true;
      },

      restoreMemberPp: (caughtAt) => {
        const state = get();
        const member = state.party.find((m) => m.caughtAt === caughtAt);
        if (!member) return false;
        set((s) => ({
          party: s.party.map((m) => (m.caughtAt === caughtAt ? { ...m, pp: {} } : m)),
        }));
        return true;
      },

      usePotionOnMember: (caughtAt) => {
        const state = get();
        const member = state.party.find((m) => m.caughtAt === caughtAt);
        if (!member) return false;
        const hp = currentHp(member);
        const max = maxHpForMon(member);
        if (hp <= 0 || hp >= max) return false;
        if (!get().consumeItem('potion', 1)) return false;
        get().healPartyMember(caughtAt, Math.round(max / 2));
        return true;
      },

      useFullHealAllParty: (inBattle = false) => {
        if (inBattle && get().fullHealUsedInBattle) return false;
        const needsHeal = get().party.some(
          (member) => currentHp(member) < maxHpForMon(member),
        );
        if (!needsHeal) return false;
        if (!get().consumeItem('fullheal', 1)) return false;
        set((state) => ({
          fullHealUsedInBattle: inBattle ? true : state.fullHealUsedInBattle,
          party: state.party.map((member) => ({
            ...member,
            hp: maxHpForMon(member),
          })),
        }));
        return true;
      },

      useHealPowderAllParty: () => {
        const state = get();
        if (!state.party.some((m) => m.status)) return false;
        if (!get().consumeItem('healpowder', 1)) return false;
        set((s) => ({ party: clearAllStatuses(s.party) }));
        return true;
      },

      grantXpAllPartyAndPc: (amount) => {
        set((state) => {
          const party = applyXpToAll(state.party, amount);
          const pokedex = { ...state.pokedex };
          for (const [id, entry] of Object.entries(pokedex)) {
            if (entry.caught) {
              pokedex[Number(id)] = { ...entry, level: Math.min(100, entry.level + Math.floor(amount / 100)) };
            }
          }
          return { party, pokedex };
        });
      },

      resetFullHealBattle: () => set({ fullHealUsedInBattle: false }),

      setFullHealUsedInBattle: (used) => set({ fullHealUsedInBattle: used }),

      saveBattleSnapshot: (snapshot) => set({ battleSnapshot: snapshot }),

      clearBattleSnapshot: () => set({ battleSnapshot: null }),

      resetGame: () =>
        set({
          screen: 'title',
          trainer: null,
          party: [],
          pcExcluded: [],
          pcStats: {},
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
          lastCaughtId: null,
          fullHealUsedInBattle: false,
          battleSnapshot: null,
          catchGamemode: 'chance',
          pendingHubNotice: null,
          pendingGymAfterShop: null,
          runStartedAt: null,
          itemsUsed: 0,
          livesUsed: 0,
          revivesUsed: 0,
          faints: 0,
          shiniesCaught: 0,
        }),
    }),
    {
      name: 'pokemon-catch-quest',
      partialize: (state) => ({
        screen: state.screen,
        trainer: state.trainer,
        party: state.party,
        pcExcluded: state.pcExcluded,
        pcStats: state.pcStats,
        pokedex: state.pokedex,
        bag: state.bag,
        badges: state.badges,
        hallOfChampions: state.hallOfChampions,
        muted: state.muted,
        musicVolume: state.musicVolume,
        showTypeEffectiveness: state.showTypeEffectiveness,
        money: state.money,
        currentActivity: state.currentActivity,
        currentSegment: state.currentSegment,
        currentEncounterId: state.currentEncounterId,
        currentPokemon: state.currentPokemon,
        spinsCount: state.spinsCount,
        lastGymSpin: state.lastGymSpin,
        eliteCleared: state.eliteCleared,
        lives: state.lives,
        starterClaimed: state.starterClaimed,
        activePanel: state.activePanel,
        fullHealUsedInBattle: state.fullHealUsedInBattle,
        battleSnapshot: state.battleSnapshot,
        catchGamemode: state.catchGamemode,
        runStartedAt: state.runStartedAt,
        itemsUsed: state.itemsUsed,
        livesUsed: state.livesUsed,
        revivesUsed: state.revivesUsed,
        faints: state.faints,
        shiniesCaught: state.shiniesCaught,
      }),
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        if (Array.isArray(state.party)) {
          state.party = state.party.map((m) => migrateCaughtPokemon(m as Record<string, unknown>));
        }
        if (state.pokedex && typeof state.pokedex === 'object') {
          const dex = state.pokedex as Record<string, Record<string, unknown>>;
          for (const [id, entry] of Object.entries(dex)) {
            dex[id] = {
              ...entry,
              level: typeof entry.level === 'number' ? entry.level : 5,
            };
            delete dex[id].powerLevel;
            delete dex[id].proteinUsed;
          }
        }
        if (Array.isArray(state.hallOfChampions)) {
          state.hallOfChampions = (state.hallOfChampions as ChampionRecord[]).filter(
            (entry) => typeof entry.timeMs === 'number' && !!entry.region,
          );
        }
        if (typeof state.runStartedAt !== 'number') state.runStartedAt = null;
        if (typeof state.itemsUsed !== 'number') state.itemsUsed = 0;
        if (typeof state.livesUsed !== 'number') state.livesUsed = 0;
        if (typeof state.revivesUsed !== 'number') state.revivesUsed = 0;
        if (typeof state.faints !== 'number') state.faints = 0;
        if (typeof state.shiniesCaught !== 'number') state.shiniesCaught = 0;
        if (Array.isArray(state.badges)) {
          const trainer = state.trainer as { region?: string } | null;
          const region = trainer?.region === 'Johto' ? 'Johto' : 'Kanto';
          state.badges = (state.badges as Badge[]).map((badge) => {
            const image = resolveBadgeImage(badge, region);
            return image ? { ...badge, image } : badge;
          });
        }
        return state;
      },
      version: 11,
    },
  ),
);
