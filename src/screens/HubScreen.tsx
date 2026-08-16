import { useState, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidePanel } from '../components/SidePanel';
import { DebugMenu } from '../components/DebugMenu';
import { Wheel, type SpinnerSegment } from '../components/Wheel';
import { PathwaySelector, HubShopButton } from '../components/PathwaySelector';
import {
  ELITE_PREP_SPINS,
  ITEMS,
  PATHWAY_SEGMENTS,
  SPINS_PER_GYM,
  UBER_EMPTY_BAG_ITEMS,
  UBER_SPIN_SEGMENTS,
  filterPoolByMinBst,
  getRegionAllPokemonPool,
  getRegionExploreSegments,
  getRegionTotalGyms,
  getStoneItemIdsForRegion,
  pickRandom,
  resolveRegionId,
} from '../data/pools';
import {
  ARCEUS_BLESSING_CHANCE,
  ARCEUS_BST_MIN,
  NEW_POKEMON_WHEEL_WEDGES,
} from '../data/prestige';
import { PokeCenterVisits } from '../components/PokeDollar';
import { PokeCenterModal, type HealModalVariant } from '../components/PokeCenterModal';
import { OldManCatchTutorial } from '../components/OldManCatchTutorial';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { publishHostWheelSpin } from '../multiplayer/publish';
import { getSegmentSprite } from '../data/icons';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { fetchPokemon } from '../api/pokeapi';
import { createCaughtAtLevel } from '../utils/pokemonInstance';
import { maxHpForMon } from '../utils/stats';
import { isDebugUnlocked, subscribeDebugUnlock } from '../utils/debugUnlock';
import { TYPE_COLORS } from '../data/typeChart';
import { localPokemonSprite } from '../utils/localAssets';
import { filterPoolForIlluminate, partyHasAbility } from '../data/abilities';
import { MISSINGNO_ID } from '../data/missingno';
import { ArceusBlessingModal, playArceusCry } from '../components/ArceusBlessingModal';
import { TrainerProfileModal } from '../components/TrainerProfileModal';
import { playSfx } from '../utils/sound';
import type { PathwayId, PokemonData, WheelSegment } from '../types/game';

function sampleUnique<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

async function fetchAndPreloadCatchMons(ids: number[]): Promise<PokemonData[]> {
  const results = await Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null)));
  const list = results.filter((p): p is PokemonData => p !== null);
  await Promise.all(list.map((p) => preloadImage(p.sprite || PLACEHOLDER_SPRITE)));
  return list;
}

export function HubScreen() {
  const trainer = useGameStore((s) => s.trainer);
  const region = resolveRegionId(trainer?.region);
  const party = useGameStore((s) => s.party);
  const badges = useGameStore((s) => s.badges);
  const spinsCount = useGameStore((s) => s.spinsCount);
  const lastGymSpin = useGameStore((s) => s.lastGymSpin);
  const eliteCleared = useGameStore((s) => s.eliteCleared);
  const lives = useGameStore((s) => s.lives);
  const setScreen = useGameStore((s) => s.setScreen);
  const startActivity = useGameStore((s) => s.startActivity);
  const incrementSpins = useGameStore((s) => s.incrementSpins);
  const setLastGymSpin = useGameStore((s) => s.setLastGymSpin);
  const addItem = useGameStore((s) => s.addItem);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const restorePartyPp = useGameStore((s) => s.restorePartyPp);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const grantXpAllPartyAndPc = useGameStore((s) => s.grantXpAllPartyAndPc);
  const addMoney = useGameStore((s) => s.addMoney);
  const spendMoney = useGameStore((s) => s.spendMoney);
  const pendingHubNotice = useGameStore((s) => s.pendingHubNotice);
  const setPendingHubNotice = useGameStore((s) => s.setPendingHubNotice);
  const setPendingGymAfterShop = useGameStore((s) => s.setPendingGymAfterShop);
  const getMaxParty = useGameStore((s) => s.getMaxParty);
  const isUnlockActive = useGameStore((s) => s.isUnlockActive);
  const maxRepelSpinsLeft = useGameStore((s) => s.maxRepelSpinsLeft);
  const setMaxRepelSpins = useGameStore((s) => s.setMaxRepelSpins);
  const pendingCatchWheelIds = useGameStore((s) => s.pendingCatchWheelIds);
  const setPendingCatchWheelIds = useGameStore((s) => s.setPendingCatchWheelIds);
  const setLuckyEggActive = useGameStore((s) => s.setLuckyEggActive);
  const openMysteryGift = useGameStore((s) => s.openMysteryGift);
  const missingNoDismissed = useGameStore((s) => s.missingNoDismissed);
  const missingNoReady = useGameStore((s) => s.missingNoReady);
  const setMissingNoDismissed = useGameStore((s) => s.setMissingNoDismissed);
  const setMissingNoReady = useGameStore((s) => s.setMissingNoReady);
  const mysteryEggGymsLeft = useGameStore((s) => s.mysteryEggGymsLeft);
  const setMysteryEggGyms = useGameStore((s) => s.setMysteryEggGyms);
  const debugAddToParty = useGameStore((s) => s.debugAddToParty);
  const ensurePartyInstanceFields = useGameStore((s) => s.ensurePartyInstanceFields);
  const bag = useGameStore((s) => s.bag);
  const muted = useGameStore((s) => s.muted);

  const hardcore = isUnlockActive('hardcore');
  const arceusBlessing = isUnlockActive('arceusBlessing');
  const gamba = isUnlockActive('weLikeGamba');
  const missingNoUnlock = isUnlockActive('missingNo');
  const showMischief = useGameStore((s) => s.mewMischiefActive);
  const ensureMewMischiefOffer = useGameStore((s) => s.ensureMewMischiefOffer);

  const [activePathway, setActivePathway] = useState<PathwayId | null>(null);
  const [wheelLocked, setWheelLocked] = useState(false);
  const [uberSpinOpen, setUberSpinOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [healModal, setHealModal] = useState<HealModalVariant | null>(null);
  const [martPrompt, setMartPrompt] = useState<'gym' | 'elite' | null>(null);
  const [debugOn, setDebugOn] = useState(isDebugUnlocked);
  const [catchMons, setCatchMons] = useState<PokemonData[] | null>(null);
  const [passName, setPassName] = useState('');
  const [arceusChoices, setArceusChoices] = useState<PokemonData[] | null>(null);
  const [missingPrompt, setMissingPrompt] = useState<number | null>(null);
  const [wonderTradeOpen, setWonderTradeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const totalGyms = getRegionTotalGyms(region);
  const gymBadges = badges.length;
  const allGymsDone = gymBadges >= totalGyms;
  const spinsSinceGym = spinsCount - lastGymSpin;
  const spinsThreshold = allGymsDone ? ELITE_PREP_SPINS : SPINS_PER_GYM;
  const spinsUntilNext = Math.max(0, spinsThreshold - spinsSinceGym);
  const pathsDisabled = wheelLocked || uberSpinOpen || !!notice || !!healModal || !!martPrompt;
  const maxParty = getMaxParty();
  const pokedex = useGameStore((s) => s.pokedex);
  const pcExcluded = useGameStore((s) => s.pcExcluded);
  const hasMissingNo =
    party.some((m) => m.id === MISSINGNO_ID) ||
    !!(pokedex[MISSINGNO_ID]?.caught && !pcExcluded.includes(MISSINGNO_ID));

  useEffect(() => subscribeDebugUnlock(() => setDebugOn(true)), []);
  useEffect(() => {
    ensurePartyInstanceFields();
  }, [ensurePartyInstanceFields]);

  useEffect(() => {
    ensureMewMischiefOffer();
  }, [ensureMewMischiefOffer, spinsCount]);

  // MissingNo. prompt when party has water + flying (last catch types)
  useEffect(() => {
    if (!missingNoUnlock || missingNoDismissed || missingNoReady) return;
    const last = party[party.length - 1];
    if (!last) return;
    const hasWater = party.some((m) => m.types.includes('water'));
    const hasFlying = party.some((m) => m.types.includes('flying'));
    if (hasWater && hasFlying) setMissingPrompt(0);
  }, [party, missingNoUnlock, missingNoDismissed, missingNoReady]);

  // Hatch mystery egg
  useEffect(() => {
    if (mysteryEggGymsLeft !== 0) return;
    if ((bag.find((i) => i.id === 'mysteryegg')?.quantity ?? 0) <= 0) return;
    void (async () => {
      consumeItem('mysteryegg', 1);
      setMysteryEggGyms(null);
      const id = pickRandom(getRegionAllPokemonPool(region));
      try {
        const mon = await fetchPokemon(id);
        const avg =
          party.length > 0
            ? Math.round(party.reduce((s, m) => s + m.level, 0) / party.length)
            : 10;
        const caught = createCaughtAtLevel(mon, 0);
        caught.level = avg;
        caught.ivs = {
          hp: 31,
          attack: 31,
          defense: 31,
          specialAttack: 31,
          specialDefense: 31,
          speed: 31,
        };
        caught.hp = maxHpForMon(caught);
        debugAddToParty(mon);
        useGameStore.setState((state) => ({
          party: state.party.map((m) =>
            m.caughtAt === state.lastCaughtAt
              ? { ...caught, caughtAt: m.caughtAt, shiny: m.shiny }
              : m,
          ),
        }));
        setNotice(`Your Mystery Egg hatched into ${mon.displayName} (max IVs)!`);
      } catch {
        setNotice('Your Mystery Egg hatched, but something went wrong.');
      }
    })();
  }, [
    mysteryEggGymsLeft,
    bag,
    region,
    party,
    consumeItem,
    setMysteryEggGyms,
    debugAddToParty,
  ]);

  const exploreSegments = useMemo(() => getRegionExploreSegments(region), [region]);
  const mischiefSegments = PATHWAY_SEGMENTS.mischief;

  const wheelSegments: WheelSegment[] =
    activePathway === 'explore'
      ? exploreSegments
      : activePathway === 'mischief'
        ? mischiefSegments
        : [];

  // Warm sprites for a locked catch wheel while still on the path picker
  useEffect(() => {
    if (activePathway === 'catch' || !pendingCatchWheelIds?.length) return;
    let cancelled = false;
    void fetchAndPreloadCatchMons(pendingCatchWheelIds).then((list) => {
      if (!cancelled && list.length) setCatchMons(list);
    });
    return () => {
      cancelled = true;
    };
  }, [activePathway, pendingCatchWheelIds]);

  // Load catch wheel mons when catch path selected (reuse locked wheel on Back)
  useEffect(() => {
    if (activePathway !== 'catch') {
      if (activePathway != null) setCatchMons(null);
      setPassName('');
      return;
    }
    let cancelled = false;
    void (async () => {
      const stored = useGameStore.getState().pendingCatchWheelIds;
      if (stored?.length) {
        const list = await fetchAndPreloadCatchMons(stored);
        if (!cancelled) setCatchMons(list);
        return;
      }

      const pool = getRegionAllPokemonPool(region);
      const sampleSize =
        maxRepelSpinsLeft > 0
          ? Math.min(pool.length, NEW_POKEMON_WHEEL_WEDGES * 3)
          : NEW_POKEMON_WHEEL_WEDGES;
      const ids = sampleUnique(pool, sampleSize);
      let list = await fetchAndPreloadCatchMons(ids);
      if (maxRepelSpinsLeft > 0) {
        const high = list.filter((p) => p.baseStatTotal > 400);
        if (high.length >= NEW_POKEMON_WHEEL_WEDGES) {
          list = high.slice(0, NEW_POKEMON_WHEEL_WEDGES);
        } else if (high.length >= 4) {
          list = high;
        } else {
          list = list.slice(0, NEW_POKEMON_WHEEL_WEDGES);
        }
      } else {
        list = list.slice(0, NEW_POKEMON_WHEEL_WEDGES);
      }
      if (partyHasAbility(useGameStore.getState().party, 'illuminate')) {
        list = filterPoolForIlluminate(list, (p) => p.baseStatTotal, NEW_POKEMON_WHEEL_WEDGES);
        if (list.length > NEW_POKEMON_WHEEL_WEDGES) {
          list = list.slice(0, NEW_POKEMON_WHEEL_WEDGES);
        }
      }
      if (cancelled) return;
      setPendingCatchWheelIds(list.map((p) => p.id));
      setCatchMons(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [activePathway, region, maxRepelSpinsLeft, setPendingCatchWheelIds]);

  const catchSegments: SpinnerSegment[] = useMemo(
    () =>
      (catchMons ?? []).map((p) => ({
        id: String(p.id),
        label: p.displayName,
        color: TYPE_COLORS[p.types[0]] ?? '#6b7280',
        icon: '',
        image: p.sprite || PLACEHOLDER_SPRITE,
      })),
    [catchMons],
  );

  const maybeTriggerGym = useCallback(() => {
    const state = useGameStore.getState();
    const gymsDone =
      state.badges.length >=
      getRegionTotalGyms(resolveRegionId(state.trainer?.region));
    const spinsSince = state.spinsCount - state.lastGymSpin;
    if (!gymsDone) {
      if (spinsSince >= SPINS_PER_GYM) {
        setLastGymSpin(state.spinsCount);
        setMartPrompt('gym');
        return true;
      }
    } else if (!state.eliteCleared && spinsSince >= ELITE_PREP_SPINS) {
      setLastGymSpin(state.spinsCount);
      setMartPrompt('elite');
      return true;
    }
    return false;
  }, [setLastGymSpin]);

  const returnToPathHub = useCallback(() => {
    setActivePathway(null);
    maybeTriggerGym();
  }, [maybeTriggerGym]);

  useEffect(() => {
    restorePartyPp();
    maybeTriggerGym();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingHubNotice) return;
    setNotice(pendingHubNotice);
    setPendingHubNotice(null);
  }, [pendingHubNotice, setPendingHubNotice]);

  const handleCatchLand = useCallback(
    async (seg: SpinnerSegment) => {
      incrementSpins();
      grantXpAllPartyAndPc(50);
      setWheelLocked(true);
      if (maxRepelSpinsLeft > 0) setMaxRepelSpins(maxRepelSpinsLeft - 1);

      const lockedMons = catchMons;
      setPendingCatchWheelIds(null);

      if (arceusBlessing && Math.random() < ARCEUS_BLESSING_CHANCE) {
        const pool = filterPoolByMinBst(getRegionAllPokemonPool(region), ARCEUS_BST_MIN);
        const ids = sampleUnique(pool.length ? pool : getRegionAllPokemonPool(region), 5);
        const mons = (
          await Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null)))
        ).filter((p): p is PokemonData => p !== null);
        if (mons.length > 0) {
          setCatchMons(null);
          playArceusCry();
          setArceusChoices(mons);
          setWheelLocked(false);
          setActivePathway(null);
          return;
        }
      }

      const chosenId = Number(seg.id);
      const chosen =
        (lockedMons ?? []).find((p) => p.id === chosenId) ??
        (await fetchPokemon(chosenId).catch(() => null));
      if (!chosen) {
        setWheelLocked(false);
        return;
      }
      useGameStore.getState().setCurrentPokemon(chosen);
      window.setTimeout(() => {
        setCatchMons(null);
        setScreen('catch');
        setWheelLocked(false);
        setActivePathway(null);
      }, 700);
    },
    [
      incrementSpins,
      grantXpAllPartyAndPc,
      maxRepelSpinsLeft,
      setMaxRepelSpins,
      setPendingCatchWheelIds,
      arceusBlessing,
      region,
      catchMons,
      setScreen,
    ],
  );

  const handleLand = useCallback(
    (segment: { activity?: string; id: string; label?: string }) => {
      if (!activePathway) return;

      // Mischief is a bonus path — don't spend a gym/path roll.
      if (activePathway === 'mischief') {
        useGameStore.setState({ mewMischiefActive: false });
      } else {
        incrementSpins();
      }
      grantXpAllPartyAndPc(50);
      setWheelLocked(true);
      publishHostWheelSpin({
        kind: activePathway,
        title: `${activePathway} Path`,
        segments: wheelSegments,
        result: { id: segment.id, label: segment.label ?? segment.id },
      });

      setTimeout(() => {
        const activity = segment.activity;
        if (activity === 'uber') {
          setUberSpinOpen(true);
        } else if (activity === 'teamrocket') {
          if (party.length <= 1) {
            addItem('potion', 2);
            setNotice(
              "Come back when you're a challenge for Team Rocket! They left 2 Potions.",
            );
          } else {
            setScreen('teamrocket');
          }
        } else if (activity === 'trainer') {
          setScreen('trainerbattle');
        } else if (activity === 'rival') {
          setScreen('rivalbattle');
        } else if (activity === 'rarecandy') {
          addItem('rarecandy', 1);
          setNotice('You received a Rare Candy!');
        } else if (activity === 'stone') {
          const stoneId = pickRandom(getStoneItemIdsForRegion(region));
          addItem(stoneId, 1);
          setNotice(`You received a ${ITEMS.find((i) => i.id === stoneId)?.name ?? 'Stone'}!`);
        } else if (activity === 'fullheal') {
          reviveHealAllParty();
          setHealModal('pokecenter');
        } else if (activity === 'picnic') {
          reviveHealAllParty();
          setHealModal('picnic');
        } else if (activity === 'money100') {
          addMoney(100);
          setNotice('You found ¥100!');
        } else if (activity === 'luckyegg') {
          setLuckyEggActive(true);
          setNotice('Lucky Egg! Next battle grants bonus XP.');
        } else if (activity === 'carepackage') {
          addItem('pokeball', 2);
          addItem('potion', 1);
          if (Math.random() < 0.1) addItem('rarecandy', 1);
          setNotice('Care Package: 2 Poké Balls, 1 Potion' + (Math.random() < 0.1 ? ', Rare Candy!' : '!'));
        } else if (activity === 'mewtoll') {
          if (Math.random() < 0.5 && useGameStore.getState().money >= 75) {
            spendMoney(75);
            setNotice("Mew's Toll: lost ¥75.");
          } else {
            const common = ['pokeball', 'potion', 'healpowder'] as const;
            const id = pickRandom([...common]);
            if ((bag.find((i) => i.id === id)?.quantity ?? 0) > 0) {
              consumeItem(id, 1);
              setNotice(`Mew's Toll: lost a ${id}.`);
            } else {
              spendMoney(Math.min(75, useGameStore.getState().money));
              setNotice("Mew's Toll: took some of your money.");
            }
          }
        } else if (activity === 'benchwarmers') {
          const state = useGameStore.getState();
          if (state.party.length === 0) {
            setNotice('No party to train.');
          } else {
            const avg = Math.round(
              state.party.reduce((s, m) => s + m.level, 0) / state.party.length,
            );
            let lowest = state.party[0]!;
            for (const m of state.party) {
              if (m.level < lowest.level) lowest = m;
            }
            if (lowest.level >= avg) {
              setNotice('Your team is already evened out.');
            } else {
              useGameStore.setState((s) => ({
                party: s.party.map((m) =>
                  m.caughtAt === lowest.caughtAt
                    ? { ...m, level: avg, hp: maxHpForMon({ ...m, level: avg }) }
                    : m,
                ),
              }));
              setNotice(`${lowest.displayName} trained up to Lv.${avg}!`);
            }
          }
        } else if (activity === 'wondertrade') {
          setWonderTradeOpen(true);
        } else {
          startActivity(segment as WheelSegment);
        }
        setWheelLocked(false);
        setActivePathway(null);
      }, 800);
    },
    [
      activePathway,
      incrementSpins,
      grantXpAllPartyAndPc,
      wheelSegments,
      party.length,
      addItem,
      setScreen,
      region,
      reviveHealAllParty,
      addMoney,
      setLuckyEggActive,
      spendMoney,
      bag,
      consumeItem,
      startActivity,
    ],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
    returnToPathHub();
  }, [returnToPathHub]);

  const dismissHealModal = useCallback(() => {
    setHealModal(null);
    returnToPathHub();
  }, [returnToPathHub]);

  const handleUberLand = useCallback(
    (segment: { id: string; label: string }) => {
      setUberSpinOpen(false);
      if (segment.id === 'masterball') {
        addItem('masterball');
        setNotice('Uber Spin awarded a Master Ball!');
        return;
      }
      if (segment.id === 'bonus-all-items') {
        const state = useGameStore.getState();
        const itemIds =
          state.bag.length > 0 ? state.bag.map((item) => item.id) : [...UBER_EMPTY_BAG_ITEMS];
        for (const itemId of itemIds) addItem(itemId, 1);
        setNotice('Uber Spin awarded +1 to bag items!');
        return;
      }
      if (segment.id === 'bonus-xp') {
        grantXpAllPartyAndPc(200);
        setNotice('Uber Spin awarded +200 XP!');
        return;
      }
      if (segment.id === 'bonus-money') {
        addMoney(250);
        setNotice('Uber Spin awarded ¥250!');
      }
    },
    [addItem, addMoney, grantXpAllPartyAndPc],
  );

  const gymCounter = !eliteCleared ? (
    <p className="hub-gym-counter">
      {allGymsDone ? (
        spinsUntilNext === 0 ? (
          'The Elite Four await!'
        ) : (
          <>
            Elite Four battle in <span className="gym-counter-number">{spinsUntilNext}</span> path
            {spinsUntilNext === 1 ? '' : 's'}
          </>
        )
      ) : spinsUntilNext === 0 ? (
        'A Gym Leader is ready to battle!'
      ) : (
        <>
          Next Gym battle in <span className="gym-counter-number">{spinsUntilNext}</span> path
          {spinsUntilNext === 1 ? '' : 's'}
        </>
      )}
    </p>
  ) : null;

  const hasMysteryGift = (bag.find((i) => i.id === 'mysterygift')?.quantity ?? 0) > 0;

  return (
    <motion.div
      className="screen hub-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="hub-header">
        <button
          type="button"
          className="hub-header__trainer"
          title="View trainer card"
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
          onClick={() => {
            playSfx('click', muted);
            setProfileOpen(true);
          }}
        >
          {trainer?.avatar && /[/.]/.test(trainer.avatar) ? (
            <span className="hub-header__avatar-btn">
              <img
                src={trainer.avatar}
                alt=""
                className="hub-header__avatar-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                }}
              />
            </span>
          ) : (
            <span className="hub-header__avatar-btn">
              <span className="hub-header__avatar">{trainer?.avatar}</span>
            </span>
          )}
          <div>
            <span className="hub-header__name">{trainer?.name}</span>
            <span className="hub-header__stats">
              Party: {party.length}/{maxParty} · Badges: {gymBadges}/{totalGyms} · Paths:{' '}
              {spinsCount} · <PokeCenterVisits lives={lives} />
            </span>
          </div>
        </button>
      </header>

      {eliteCleared && (
        <div className="hub-champion-banner">
          <GameIcon ui="champion" alt="" className="game-icon-img game-icon-img--inline" />{' '}
          {region} Champion!
        </div>
      )}

      <div className="hub-layout">
        <div className="hub-wheel-area">
          <AnimatePresence mode="wait" initial={false}>
            {activePathway ? (
              <motion.div
                key={`wheel-${activePathway}`}
                className="hub-path-stage"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <h3 className="hub-wheel-title">
                  {activePathway === 'catch'
                    ? 'Catch Pokémon Wheel'
                    : activePathway === 'explore'
                      ? 'Explore World'
                      : "Mew's Mischief"}
                </h3>
                {activePathway === 'catch' ? (
                  <>
                    <p className="wheel-pass-name" aria-live="polite">
                      {passName || 'Spin Wheel'}
                    </p>
                    {catchMons == null || catchSegments.length === 0 ? (
                      <p className="loading">Preparing the wheel…</p>
                    ) : (
                      <Wheel
                        segments={catchSegments}
                        onLand={handleCatchLand}
                        disabled={wheelLocked}
                        hideLabels
                        onPassSegment={(seg) => setPassName(seg.label)}
                      />
                    )}
                  </>
                ) : (
                  <Wheel segments={wheelSegments} onLand={handleLand} disabled={wheelLocked} />
                )}
                {gymCounter}
                <button
                  type="button"
                  className="wheel-back-btn"
                  onClick={() => setActivePathway(null)}
                >
                  ← Back
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="choose-path"
                className="hub-path-stage"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <h3 className="hub-wheel-title">Choose a Path</h3>
                <PathwaySelector
                  onSelect={setActivePathway}
                  disabled={pathsDisabled}
                  showMischief={showMischief}
                  hideCatch={hardcore}
                />
                {gymCounter}
                <div className="hub-shop-row">
                  <HubShopButton onClick={() => setScreen('shop')} />
                  {gamba && (
                    <HubShopButton
                      onClick={() => setScreen('gamecorner')}
                      label="Game Corner"
                      variant="gamecorner"
                    />
                  )}
                  {hasMysteryGift && (
                    <HubShopButton
                      label="Open Mystery Gift"
                      variant="mysterygift"
                      onClick={() => {
                        const reward = openMysteryGift();
                        if (reward) {
                          setNotice(
                            `Mystery Gift opened: ${ITEMS.find((i) => i.id === reward)?.name ?? reward}!`,
                          );
                        }
                      }}
                    />
                  )}
                  {missingNoReady && !hasMissingNo && (
                    <HubShopButton
                      onClick={() => setScreen('missingno')}
                      label="Fly to Cinnabar Island"
                      variant="cinnabar"
                    />
                  )}
                </div>
                {(bag.find((i) => i.id === 'maxrepel')?.quantity ?? 0) > 0 && (
                  <HubShopButton
                    label="Use Max Repel"
                    variant="maxrepel"
                    onClick={() => {
                      if (consumeItem('maxrepel', 1)) {
                        setMaxRepelSpins(3);
                        setNotice('Max Repel activated for the next 3 Pokémon wheels!');
                      }
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <SidePanel highlightActive />
      </div>

      {uberSpinOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal uber-spin-modal">
            <h3 className="battle-modal__title">Uber Spin</h3>
            <Wheel segments={UBER_SPIN_SEGMENTS} onLand={handleUberLand} />
            <button type="button" className="btn btn--ghost" onClick={() => setUberSpinOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {arceusChoices && (
          <ArceusBlessingModal
            key="arceus-blessing"
            choices={arceusChoices}
            onSkip={() => {
              setArceusChoices(null);
              setNotice('Arceus departed… the blessing was left behind.');
            }}
            onChoose={(mon) => {
              debugAddToParty(mon);
              const avg =
                party.length > 0
                  ? Math.round(party.reduce((s, m) => s + m.level, 0) / party.length)
                  : 10;
              useGameStore.setState((state) => ({
                party: state.party.map((m) =>
                  m.caughtAt === state.lastCaughtAt
                    ? { ...m, level: avg, hp: maxHpForMon({ ...m, level: avg }) }
                    : m,
                ),
              }));
              setArceusChoices(null);
              setNotice(`${mon.displayName} joined your team/PC!`);
            }}
          />
        )}
      </AnimatePresence>

      {wonderTradeOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal wonder-trade-modal">
            <div className="wonder-trade-modal__hero">
              <div className="wonder-trade-modal__badge-wrap" aria-hidden>
                <img
                  src={getSegmentSprite('wondertrade') ?? localPokemonSprite(151)}
                  alt=""
                  className="wonder-trade-modal__badge"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                  }}
                />
              </div>
              <div>
                <h3 className="wonder-trade-modal__title">Wonder Trade</h3>
                <p className="wonder-trade-modal__subtitle">
                  Send one party Pokémon into the unknown — Mew finds a similar-strength partner.
                </p>
              </div>
            </div>

            <div className="wonder-trade-modal__list">
              {party.map((m) => (
                <button
                  key={m.caughtAt}
                  type="button"
                  className="wonder-trade-card"
                  onClick={async () => {
                    const pool = getRegionAllPokemonPool(region);
                    const candidates = (
                      await Promise.all(
                        sampleUnique(pool, 20).map((id) => fetchPokemon(id).catch(() => null)),
                      )
                    ).filter((p): p is PokemonData => p !== null);
                    const bst = m.types ? candidates : candidates;
                    const targetBst =
                      candidates.find((c) => Math.abs(c.baseStatTotal - (candidates[0]?.baseStatTotal ?? 0)) < 999) ??
                      candidates[0];
                    // Prefer similar BST using party member's species cache via fetch
                    const fromData = await fetchPokemon(m.id).catch(() => null);
                    const fromBst = fromData?.baseStatTotal ?? 400;
                    const match =
                      candidates.find(
                        (c) => Math.abs(c.baseStatTotal - fromBst) / fromBst <= 0.1,
                      ) ?? pickRandom(candidates);
                    if (!match) {
                      setWonderTradeOpen(false);
                      setNotice('No trade partner found.');
                      return;
                    }
                    useGameStore.setState((state) => ({
                      party: state.party.filter((p) => p.caughtAt !== m.caughtAt),
                    }));
                    debugAddToParty(match);
                    useGameStore.setState((state) => ({
                      party: state.party.map((p) =>
                        p.caughtAt === state.lastCaughtAt
                          ? { ...p, level: m.level, hp: maxHpForMon({ ...p, level: m.level }) }
                          : p,
                      ),
                    }));
                    void bst;
                    void targetBst;
                    setWonderTradeOpen(false);
                    setNotice(`Traded ${m.displayName} for ${match.displayName}!`);
                  }}
                >
                  <img
                    src={m.sprite || localPokemonSprite(m.id)}
                    alt=""
                    className="wonder-trade-card__sprite"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                    }}
                  />
                  <div className="wonder-trade-card__info">
                    <span className="wonder-trade-card__name">{m.displayName}</span>
                    <span className="wonder-trade-card__meta">Lv. {m.level}</span>
                    <div className="wonder-trade-card__types">
                      {m.types.map((t) => (
                        <span
                          key={t}
                          className="wonder-trade-card__type"
                          style={{ background: TYPE_COLORS[t] ?? '#6b7280' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="wonder-trade-card__action">Trade</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="wonder-trade-modal__cancel"
              onClick={() => setWonderTradeOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {missingPrompt !== null && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            {missingPrompt === 0 && (
              <>
                <p className="hub-notice-modal__text">Are you in a hurry?</p>
                <div className="battle-modal__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setMissingPrompt(1)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setMissingNoDismissed(true);
                      setMissingPrompt(null);
                    }}
                  >
                    Yes
                  </button>
                </div>
              </>
            )}
            {missingPrompt === 1 && (
              <>
                <p className="hub-notice-modal__text">
                  I see you are using a Pokédex. When you catch a Pokémon, it&apos;s automatically
                  updated.
                </p>
                <button type="button" className="btn btn--primary" onClick={() => setMissingPrompt(2)}>
                  …
                </button>
              </>
            )}
            {missingPrompt === 2 && (
              <>
                <p className="hub-notice-modal__text">What? You don&apos;t know how to catch Pokémon?</p>
                <button type="button" className="btn btn--primary" onClick={() => setMissingPrompt(3)}>
                  …
                </button>
              </>
            )}
            {missingPrompt === 3 && (
              <OldManCatchTutorial onContinue={() => setMissingPrompt(4)} />
            )}
            {missingPrompt === 4 && (
              <>
                <p className="hub-notice-modal__text">
                  First, you need to weaken the target Pokémon
                </p>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setMissingNoReady(true);
                    setMissingPrompt(null);
                    setNotice('A new option appeared: Fly to Cinnabar Island');
                  }}
                >
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            <p className="hub-notice-modal__text">{notice}</p>
            <button type="button" className="btn btn--primary" onClick={dismissNotice}>
              Continue
            </button>
          </div>
        </div>
      )}

      {martPrompt && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            <p className="hub-notice-modal__text">
              {martPrompt === 'elite'
                ? 'The Elite Four await! Stock up at the Poké Mart before the gauntlet?'
                : 'A Gym Leader is ready! Stock up at the Poké Mart before the battle?'}
            </p>
            <div className="battle-modal__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const target = martPrompt;
                  setMartPrompt(null);
                  setPendingGymAfterShop(target);
                  setScreen('shop');
                }}
              >
                Visit Poké Mart
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  const target = martPrompt;
                  setMartPrompt(null);
                  setScreen(target);
                }}
              >
                Continue to battle
              </button>
            </div>
          </div>
        </div>
      )}

      {healModal && <PokeCenterModal variant={healModal} onClose={dismissHealModal} />}

      {profileOpen && <TrainerProfileModal onClose={() => setProfileOpen(false)} />}

      {debugOn && (
        <DebugMenu
          onUberSpin={() => setUberSpinOpen(true)}
          onWonderTrade={() => setWonderTradeOpen(true)}
          onArceusBlessing={async () => {
            // Play during the click gesture so the browser allows audio.
            playArceusCry();
            const pool = filterPoolByMinBst(getRegionAllPokemonPool(region), ARCEUS_BST_MIN);
            const ids = sampleUnique(pool.length ? pool : getRegionAllPokemonPool(region), 5);
            const mons = (
              await Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null)))
            ).filter((p): p is PokemonData => p !== null);
            if (mons.length > 0) {
              setArceusChoices(mons);
              setActivePathway(null);
              setCatchMons(null);
            } else {
              setNotice("Arceus's Blessing: no eligible Pokémon found.");
            }
          }}
        />
      )}
    </motion.div>
  );
}
