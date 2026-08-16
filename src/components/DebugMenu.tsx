import { useState } from 'react';
import { ITEMS,
  PATH_MISCHIEF_SEGMENTS,
  PATHWAY_SEGMENTS,
  getRegionEliteFour,
  getRegionGymLeaders,
  getStoneItemIdsForRegion,
  getRegionTotalGyms,
  pickRandom, resolveRegionId } from '../data/pools';
import { PRESTIGE_UNLOCKS } from '../data/prestige';
import { GameIcon } from './GameIcon';
import { ItemIcon } from './ItemIcon';
import { SegmentIcon } from './SegmentIcon';
import { PokeCenterModal, type HealModalVariant } from './PokeCenterModal';
import { useGameStore } from '../store/useGameStore';
import { fetchPokemon, fetchRegionList, type PokemonListEntry } from '../api/pokeapi';
import { maxHpForMon } from '../utils/stats';
import { localPokemonSprite } from '../utils/localAssets';
import type { WheelSegment } from '../types/game';

function titleCase(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
}

const MINI_GAMES: WheelSegment[] = [
  ...PATHWAY_SEGMENTS.explore,
  PATHWAY_SEGMENTS.explore.find((segment) => segment.activity === 'item'),
].filter((segment): segment is WheelSegment => !!segment);
const DEBUG_ITEMS = ITEMS;

interface DebugMenuProps {
  onUberSpin?: () => void;
  onWonderTrade?: () => void;
  onArceusBlessing?: () => void;
}

export function DebugMenu({ onUberSpin, onWonderTrade, onArceusBlessing }: DebugMenuProps) {
  const startActivity = useGameStore((s) => s.startActivity);
  const startDebugLegendary = useGameStore((s) => s.startDebugLegendary);
  const setScreen = useGameStore((s) => s.setScreen);
  const setDebugGym = useGameStore((s) => s.setDebugGym);
  const setDebugEliteStage = useGameStore((s) => s.setDebugEliteStage);
  const addItem = useGameStore((s) => s.addItem);
  const addMoney = useGameStore((s) => s.addMoney);
  const spendMoney = useGameStore((s) => s.spendMoney);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const grantXpAllPartyAndPc = useGameStore((s) => s.grantXpAllPartyAndPc);
  const makeRandomPartyShiny = useGameStore((s) => s.makeRandomPartyShiny);
  const debugAddToParty = useGameStore((s) => s.debugAddToParty);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const restoreLives = useGameStore((s) => s.restoreLives);
  const earnBadge = useGameStore((s) => s.earnBadge);
  const badges = useGameStore((s) => s.badges);
  const bag = useGameStore((s) => s.bag);
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const gymLeaders = getRegionGymLeaders(region);
  const eliteFour = getRegionEliteFour(region);
  const totalGyms = getRegionTotalGyms(region);
  const debugGrantPrestige = useGameStore((s) => s.debugGrantPrestige);
  const debugGrantUnlock = useGameStore((s) => s.debugGrantUnlock);
  const debugClearUnlocks = useGameStore((s) => s.debugClearUnlocks);
  const debugUnlockAllRegions = useGameStore((s) => s.debugUnlockAllRegions);
  const refillShopStock = useGameStore((s) => s.refillShopStock);
  const setMaxRepelSpins = useGameStore((s) => s.setMaxRepelSpins);
  const setLuckyEggActive = useGameStore((s) => s.setLuckyEggActive);
  const setMissingNoReady = useGameStore((s) => s.setMissingNoReady);
  const setMysteryEggGyms = useGameStore((s) => s.setMysteryEggGyms);
  const setActiveUnlocks = useGameStore((s) => s.setActiveUnlocks);
  const ownedUnlocks = useGameStore((s) => s.ownedUnlocks);
  const activeUnlocks = useGameStore((s) => s.activeUnlocks);
  const prestigePoints = useGameStore((s) => s.prestigePoints);
  const mewMischiefActive = useGameStore((s) => s.mewMischiefActive);

  const [open, setOpen] = useState(false);
  const [healModal, setHealModal] = useState<HealModalVariant | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pokemonList, setPokemonList] = useState<PokemonListEntry[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  function launchGym(id: string) {
    setDebugGym(id);
    setScreen('gym');
    setOpen(false);
  }

  function launchTeamRocket() {
    setScreen('teamrocket');
    setOpen(false);
  }

  function launchElite(stage: number) {
    setDebugEliteStage(stage);
    setScreen('elite');
    setOpen(false);
  }

  function launchMiniGame(segment: WheelSegment) {
    startActivity(segment);
    setOpen(false);
  }

  function launchElixir() {
    addItem('maxelixer', 1);
    setOpen(false);
    setNotice('You received a free Max Elixir!');
  }

  function launchHeal() {
    reviveHealAllParty();
    setOpen(false);
    setHealModal('pokecenter');
  }

  function launchLegendary() {
    startDebugLegendary();
    setOpen(false);
  }

  function launchUberSpin() {
    onUberSpin?.();
    setOpen(false);
  }

  function launchArceusBlessing() {
    onArceusBlessing?.();
    setOpen(false);
  }

  function forceMewMischiefPath(active: boolean) {
    const state = useGameStore.getState();
    const unlocks = state.activeUnlocks.includes('mewsMischief')
      ? state.activeUnlocks
      : [...state.activeUnlocks, 'mewsMischief' as const];
    if (!state.ownedUnlocks.includes('mewsMischief')) {
      debugGrantUnlock('mewsMischief');
    }
    useGameStore.setState({
      activeUnlocks: unlocks,
      mewMischiefActive: active,
      mewMischiefAtSpin: Math.max(1, state.spinsCount || 1),
    });
    setNotice(active ? "Mew's Mischief path forced on hub." : "Mew's Mischief path cleared.");
  }

  function launchMischief(segment: WheelSegment) {
    const activity = segment.activity;
    if (activity === 'wondertrade') {
      onWonderTrade?.();
      setOpen(false);
      return;
    }
    if (activity === 'picnic') {
      reviveHealAllParty();
      setOpen(false);
      setHealModal('picnic');
      return;
    }
    if (activity === 'luckyegg') {
      setLuckyEggActive(true);
      setNotice('Lucky Egg! Next battle grants bonus XP.');
      setOpen(false);
      return;
    }
    if (activity === 'carepackage') {
      addItem('pokeball', 2);
      addItem('potion', 1);
      const bonusCandy = Math.random() < 0.1;
      if (bonusCandy) addItem('rarecandy', 1);
      setNotice(`Care Package: 2 Poké Balls, 1 Potion${bonusCandy ? ', Rare Candy!' : '!'}`);
      setOpen(false);
      return;
    }
    if (activity === 'mewtoll') {
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
      setOpen(false);
      return;
    }
    if (activity === 'benchwarmers') {
      const state = useGameStore.getState();
      if (state.party.length === 0) {
        setNotice('No party to train.');
      } else {
        const avg = Math.round(state.party.reduce((s, m) => s + m.level, 0) / state.party.length);
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
      setOpen(false);
      return;
    }
    launchMiniGame(segment);
  }

  function launchChampionScreen() {
    const store = useGameStore.getState();
    store.setEliteCleared(true);
    store.recordChampion();
    setScreen('champion');
    setOpen(false);
  }

  function launchGameOverScreen() {
    setScreen('gameover');
    setOpen(false);
  }

  function launchShop() {
    setScreen('shop');
    setOpen(false);
  }

  function launchRandomShiny() {
    makeRandomPartyShiny();
    setOpen(false);
  }

  function grantRandomStone() {
    const stoneId = pickRandom(getStoneItemIdsForRegion(region));
    const stoneName = ITEMS.find((item) => item.id === stoneId)?.name ?? 'Stone';
    addItem(stoneId, 1);
    setNotice(`You received a ${stoneName}!`);
  }

  function grantAllStones() {
    for (const stoneId of getStoneItemIdsForRegion(region)) addItem(stoneId, 1);
    setNotice('You received all evolution stones (+1 each).');
  }

  function grantNextBadge() {
    if (badges.length >= totalGyms) {
      setNotice('All gym badges already earned.');
      return;
    }
    const next = gymLeaders[badges.length];
    if (!next) return;
    earnBadge({
      id: next.id,
      name: next.badgeName,
      type: next.type,
      earnedAt: Date.now(),
      image: next.badgeImage,
    });
    setNotice(`Earned ${next.badgeName}.`);
  }

  async function togglePokemonList() {
    const next = !listOpen;
    setListOpen(next);
    if (next && pokemonList.length === 0 && !loadingList) {
      setLoadingList(true);
      try {
        setPokemonList(await fetchRegionList(region));
      } catch {
        // network optional; list stays empty
      } finally {
        setLoadingList(false);
      }
    }
  }

  async function addPokemonToParty(id: number) {
    setAddingId(id);
    try {
      const pokemon = await fetchPokemon(id);
      debugAddToParty(pokemon);
    } catch {
      // ignore fetch failures
    } finally {
      setAddingId(null);
    }
  }

  const filteredList = pokemonList.filter((entry) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return entry.name.includes(q) || String(entry.id) === q || `#${entry.id}` === q;
  });

  return (
    <>
      <button type="button" className="debug-fab" onClick={() => setOpen((v) => !v)}>
        🐞 Debug
      </button>

      {open && (
        <div className="debug-panel">
          <div className="debug-panel__header">
            <strong>Debug Menu</strong>
            <button type="button" className="debug-panel__close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Meta / Prestige ({prestigePoints} PP)</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={() => debugGrantPrestige(1)}>
                +1 Prestige
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => debugUnlockAllRegions()}>
                Unlock Regions
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  for (const u of PRESTIGE_UNLOCKS) debugGrantUnlock(u.id);
                  setNotice('All unlocks owned.');
                }}
              >
                Own All Unlocks
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  setActiveUnlocks([...ownedUnlocks]);
                  setNotice('Active unlocks = all owned.');
                }}
              >
                Activate Owned
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => debugClearUnlocks()}>
                Clear Unlocks
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('prestige')}>
                Prestige Shop
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('global-pokedex')}>
                Global Dex
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('daily')}>
                Daily Encounter
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('gamecorner')}>
                Game Corner
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('trainerbattle')}>
                Trainer Battle
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('rivalbattle')}>
                Rival Battle
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('giovanni')}>
                Giovanni
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => setScreen('missingno')}>
                MissingNo.
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => refillShopStock()}>
                Refill Shop Stock
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  addItem('mysterygift', 1);
                  setNotice('Granted Mystery Gift.');
                }}
              >
                <ItemIcon id="mysterygift" icon="🎁" name="Mystery Gift" className="game-icon-img game-icon-img--btn" />{' '}
                Grant Mystery Gift
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  addItem('maxrepel', 1);
                  setMaxRepelSpins(3);
                  setNotice('Max Repel ready (3 Catch wheels).');
                }}
              >
                <ItemIcon id="maxrepel" icon="🛡️" name="Max Repel" className="game-icon-img game-icon-img--btn" />{' '}
                Activate Max Repel
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  addItem('mysteryegg', 1);
                  setMysteryEggGyms(0);
                  setNotice('Mystery Egg granted (ready to hatch on hub).');
                }}
              >
                <ItemIcon id="mysteryegg" icon="🥚" name="Mystery Egg" className="game-icon-img game-icon-img--btn" />{' '}
                Grant Mystery Egg
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  setMissingNoReady(true);
                  setNotice('Cinnabar Island flight unlocked.');
                }}
              >
                Ready MissingNo. Flight
              </button>
              <button
                type="button"
                className="debug-panel__btn"
                onClick={() => {
                  if (!activeUnlocks.includes('weLikeGamba')) {
                    setActiveUnlocks([...activeUnlocks, 'weLikeGamba']);
                  }
                  if (!ownedUnlocks.includes('weLikeGamba')) debugGrantUnlock('weLikeGamba');
                  setNotice('Game Corner unlock active for this run.');
                }}
              >
                Enable Game Corner Unlock
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">
              Mew&apos;s Mischief {mewMischiefActive ? '(path active)' : ''}
            </p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={() => forceMewMischiefPath(true)}>
                Force Mischief Path
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => forceMewMischiefPath(false)}>
                Clear Mischief Path
              </button>
              {PATH_MISCHIEF_SEGMENTS.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => launchMischief(segment)}
                >
                  <SegmentIcon
                    id={segment.id}
                    fallbackIcon={segment.icon}
                    className="game-icon-img game-icon-img--btn"
                  />{' '}
                  {segment.label}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Explore / Activities</p>
            <div className="debug-panel__grid">
              {MINI_GAMES.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => {
                    if (segment.activity === 'trainer') {
                      setScreen('trainerbattle');
                      setOpen(false);
                      return;
                    }
                    if (segment.activity === 'rival') {
                      setScreen('rivalbattle');
                      setOpen(false);
                      return;
                    }
                    if (segment.activity === 'teamrocket') {
                      launchTeamRocket();
                      return;
                    }
                    if (segment.activity === 'uber') {
                      launchUberSpin();
                      return;
                    }
                    if (
                      segment.activity === 'fullheal' ||
                      segment.activity === 'money100' ||
                      segment.activity === 'stone' ||
                      segment.activity === 'rarecandy'
                    ) {
                      if (segment.activity === 'fullheal') {
                        reviveHealAllParty();
                        setHealModal('pokecenter');
                      } else if (segment.activity === 'money100') addMoney(100);
                      else if (segment.activity === 'rarecandy') addItem('rarecandy', 1);
                      else grantRandomStone();
                      setOpen(false);
                      return;
                    }
                    launchMiniGame(segment);
                  }}
                >
                  <SegmentIcon
                    id={segment.id}
                    fallbackIcon={segment.icon}
                    className="game-icon-img game-icon-img--btn"
                  />{' '}
                  {segment.label}
                </button>
              ))}
              <button type="button" className="debug-panel__btn" onClick={launchElixir}>
                <SegmentIcon id="elixir" className="game-icon-img game-icon-img--btn" /> Elixir
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchHeal}>
                <SegmentIcon id="pokecenter" className="game-icon-img game-icon-img--btn" /> Heal
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchLegendary}>
                <SegmentIcon id="legendary" className="game-icon-img game-icon-img--btn" /> Legendary Encounter
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchUberSpin}>
                <SegmentIcon id="uber" className="game-icon-img game-icon-img--btn" /> Uber Spin
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchArceusBlessing}>
                <img
                  src={localPokemonSprite(493)}
                  alt=""
                  className="game-icon-img game-icon-img--btn"
                  width={24}
                  height={24}
                />{' '}
                Arceus&apos;s Blessing
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Shop & Money</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={launchShop}>
                <GameIcon ui="shop" alt="" className="game-icon-img game-icon-img--btn" /> Visit Shop
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => addMoney(100)}>
                ¥ +100 Dollars
              </button>
              <button type="button" className="debug-panel__btn" onClick={() => grantXpAllPartyAndPc(1000)}>
                ⭐ +1000 XP (Party + PC)
              </button>
              <button type="button" className="debug-panel__btn" onClick={restoreLives}>
                💚 Restore Lives
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Progression</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={grantNextBadge}>
                🏅 Grant Next Badge ({badges.length}/{totalGyms})
              </button>
              <button type="button" className="debug-panel__btn" onClick={grantRandomStone}>
                <SegmentIcon id="stone" className="game-icon-img game-icon-img--btn" /> Grant Random Stone
              </button>
              <button type="button" className="debug-panel__btn" onClick={grantAllStones}>
                <SegmentIcon id="stone" className="game-icon-img game-icon-img--btn" /> Grant All Stones
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Party</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={launchRandomShiny}>
                <ItemIcon id="shinycharm" icon="✨" name="Shiny Charm" className="game-icon-img game-icon-img--btn" />{' '}
                Make Random Party Pokémon Shiny
              </button>
              <button type="button" className="debug-panel__btn" onClick={togglePokemonList}>
                {listOpen ? '▾' : '▸'} Add Region Pokémon
              </button>
            </div>

            {listOpen && (
              <div className="debug-pokelist">
                <input
                  type="text"
                  className="debug-pokelist__search"
                  placeholder="Search name or #id…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {loadingList ? (
                  <p className="debug-pokelist__status">Loading…</p>
                ) : pokemonList.length === 0 ? (
                  <p className="debug-pokelist__status">Couldn’t load list.</p>
                ) : (
                  <div className="debug-pokelist__scroll">
                    {filteredList.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="debug-pokelist__item"
                        disabled={addingId === entry.id}
                        onClick={() => addPokemonToParty(entry.id)}
                      >
                        <span className="debug-pokelist__id">#{String(entry.id).padStart(3, '0')}</span>
                        {titleCase(entry.name)}
                        {addingId === entry.id ? ' …' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Add Items</p>
            <div className="debug-panel__grid">
              {DEBUG_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => addItem(item.id, 1)}
                >
                  <ItemIcon id={item.id} icon={item.icon} name={item.name} className="game-icon-img game-icon-img--btn" />{' '}
                  +1 {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Gym Battles</p>
            <div className="debug-panel__grid">
              {gymLeaders.map((leader) => (
                <button
                  key={leader.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => launchGym(leader.id)}
                >
                  {leader.name}
                </button>
              ))}
              <button type="button" className="debug-panel__btn" onClick={launchTeamRocket}>
                <SegmentIcon id="teamrocket" fallbackIcon="🚀" className="game-icon-img game-icon-img--btn" />{' '}
                Team Rocket
              </button>
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">Elite Four / Champion</p>
            <div className="debug-panel__grid">
              {eliteFour.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  className="debug-panel__btn"
                  onClick={() => launchElite(index)}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>

          <div className="debug-panel__section">
            <p className="debug-panel__label">End Game</p>
            <div className="debug-panel__grid">
              <button type="button" className="debug-panel__btn" onClick={launchChampionScreen}>
                <GameIcon ui="champion" alt="" className="game-icon-img game-icon-img--btn" /> Champion Victory Screen
              </button>
              <button type="button" className="debug-panel__btn" onClick={launchGameOverScreen}>
                <GameIcon ui="gameover" alt="" className="game-icon-img game-icon-img--btn" /> Game Over Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {healModal && (
        <PokeCenterModal variant={healModal} onClose={() => setHealModal(null)} />
      )}

      {notice && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            <p className="hub-notice-modal__text">{notice}</p>
            <button type="button" className="btn btn--primary" onClick={() => setNotice(null)}>
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}
