import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidePanel } from '../components/SidePanel';
import { DebugMenu } from '../components/DebugMenu';
import { Wheel } from '../components/Wheel';
import { PathwaySelector, HubShopButton } from '../components/PathwaySelector';
import {
  ELITE_PREP_SPINS,
  ITEMS,
  PATHWAY_SEGMENTS,
  SPINS_PER_GYM,
  getRegionCatchSegments,
  getStoneItemIdsForRegion,
  getRegionTotalGyms,
  UBER_EMPTY_BAG_ITEMS,
  UBER_SPIN_SEGMENTS,
  pickRandom,
} from '../data/pools';
import { PokeCenterVisits } from '../components/PokeDollar';
import { PokeCenterModal } from '../components/PokeCenterModal';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { publishHostActivity, publishHostWheelSpin } from '../multiplayer/publish';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { PathwayId, WheelSegment } from '../types/game';

export function HubScreen() {
  const trainer = useGameStore((s) => s.trainer);
  const region = trainer?.region === 'Johto' ? 'Johto' : 'Kanto';
  const party = useGameStore((s) => s.party);
  const badges = useGameStore((s) => s.badges);
  const spinsCount = useGameStore((s) => s.spinsCount);
  const lastGymSpin = useGameStore((s) => s.lastGymSpin);
  const eliteCleared = useGameStore((s) => s.eliteCleared);
  const lives = useGameStore((s) => s.lives);
  const setScreen = useGameStore((s) => s.setScreen);
  const startActivity = useGameStore((s) => s.startActivity);
  const startLegendaryEncounter = useGameStore((s) => s.startLegendaryEncounter);
  const incrementSpins = useGameStore((s) => s.incrementSpins);
  const setLastGymSpin = useGameStore((s) => s.setLastGymSpin);
  const addItem = useGameStore((s) => s.addItem);
  const restorePartyPp = useGameStore((s) => s.restorePartyPp);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const grantXpAllPartyAndPc = useGameStore((s) => s.grantXpAllPartyAndPc);
  const addMoney = useGameStore((s) => s.addMoney);
  const pendingHubNotice = useGameStore((s) => s.pendingHubNotice);
  const setPendingHubNotice = useGameStore((s) => s.setPendingHubNotice);

  const setPendingGymAfterShop = useGameStore((s) => s.setPendingGymAfterShop);

  const [activePathway, setActivePathway] = useState<PathwayId | null>(null);
  const [wheelLocked, setWheelLocked] = useState(false);
  const [uberSpinOpen, setUberSpinOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pokeCenterOpen, setPokeCenterOpen] = useState(false);
  const [martPrompt, setMartPrompt] = useState<'gym' | 'elite' | null>(null);

  const totalGyms = getRegionTotalGyms(region);
  const gymBadges = badges.length;
  const allGymsDone = gymBadges >= totalGyms;
  const spinsSinceGym = spinsCount - lastGymSpin;
  const spinsThreshold = allGymsDone ? ELITE_PREP_SPINS : SPINS_PER_GYM;
  const spinsUntilNext = Math.max(0, spinsThreshold - spinsSinceGym);
  const pathsDisabled = wheelLocked || uberSpinOpen || !!notice || pokeCenterOpen || !!martPrompt;

  const wheelSegments: WheelSegment[] = activePathway
    ? activePathway === 'catch'
      ? getRegionCatchSegments(region)
      : PATHWAY_SEGMENTS[activePathway]
    : [];

  const maybeTriggerGym = useCallback(() => {
    const state = useGameStore.getState();
    const gymsDone = state.badges.length >= getRegionTotalGyms(state.trainer?.region === 'Johto' ? 'Johto' : 'Kanto');
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

  const handleLand = useCallback(
    (segment: { activity?: string; id: string; label?: string }) => {
      if (!activePathway) return;

      incrementSpins();
      grantXpAllPartyAndPc(50);
      setWheelLocked(true);
      publishHostWheelSpin({
        kind: activePathway,
        title: `${activePathway} Path`,
        segments: wheelSegments,
        result: { id: segment.id, label: segment.label ?? segment.id },
      });

      setTimeout(async () => {
        if (segment.activity === 'legendary') {
          publishHostActivity({
            kind: 'notice',
            title: 'Legendary!',
            message: 'A legendary encounter begins!',
            success: true,
          });
          startLegendaryEncounter();
        } else if (segment.activity === 'uber') {
          setUberSpinOpen(true);
        } else if (segment.activity === 'teamrocket') {
          const partySize = useGameStore.getState().party.length;
          if (partySize <= 1) {
            addItem('potion', 2);
            const msg =
              "Come back when you're a challenge for Team Rocket! They laughed you off and left 2 Potions behind.";
            setNotice(msg);
            publishHostActivity({
              kind: 'notice',
              title: 'Team Rocket',
              message: msg,
              success: false,
              itemId: 'potion',
            });
          } else {
            publishHostActivity({
              kind: 'notice',
              title: 'Team Rocket',
              message: 'Prepare for trouble!',
              success: true,
            });
            setScreen('teamrocket');
          }
        } else if (segment.activity === 'potion') {
          addItem('potion', 1);
          const msg = 'You received a Potion!';
          setNotice(msg);
          publishHostActivity({ kind: 'notice', title: 'Potion!', message: msg, success: true, itemId: 'potion' });
        } else if (segment.activity === 'rarecandy') {
          addItem('rarecandy', 1);
          const msg = 'You received a Rare Candy!';
          setNotice(msg);
          publishHostActivity({
            kind: 'notice',
            title: 'Rare Candy!',
            message: msg,
            success: true,
            itemId: 'rarecandy',
          });
        } else if (segment.activity === 'xattack') {
          addItem('xattack', 1);
          const msg = 'You received an X-Attack!';
          setNotice(msg);
          publishHostActivity({
            kind: 'notice',
            title: 'X-Attack!',
            message: msg,
            success: true,
            itemId: 'xattack',
          });
        } else if (segment.activity === 'stone') {
          const stoneId = pickRandom(getStoneItemIdsForRegion(region));
          const stone = ITEMS.find((item) => item.id === stoneId);
          addItem(stoneId, 1);
          const stoneName = stone?.name ?? 'Evolution Stone';
          const msg = `You received a ${stoneName}!`;
          setNotice(msg);
          publishHostActivity({
            kind: 'notice',
            title: 'Stone!',
            message: msg,
            success: true,
            itemId: stoneId,
          });
        } else if (segment.activity === 'fullheal' || segment.activity === 'pokecenter') {
          reviveHealAllParty();
          setPokeCenterOpen(true);
          publishHostActivity({
            kind: 'notice',
            title: 'Full Heal',
            message: 'The party was fully healed!',
            success: true,
          });
        } else if (segment.activity === 'money100') {
          addMoney(100);
          const msg = 'You found ¥100!';
          setNotice(msg);
          publishHostActivity({ kind: 'notice', title: 'Cash!', message: msg, success: true });
        } else {
          publishHostActivity({
            kind: 'notice',
            title: segment.label ?? 'Path chosen',
            message: `Heading to ${segment.label ?? segment.id}…`,
            success: true,
          });
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
      startActivity,
      startLegendaryEncounter,
      setScreen,
      addItem,
      reviveHealAllParty,
      addMoney,
      wheelSegments,
    ],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
    returnToPathHub();
  }, [returnToPathHub]);

  const dismissPokeCenter = useCallback(() => {
    setPokeCenterOpen(false);
    returnToPathHub();
  }, [returnToPathHub]);

  const handleUberLand = useCallback(
    (segment: { id: string; label: string }) => {
      publishHostWheelSpin({
        kind: 'uber',
        title: 'Uber Spin',
        segments: UBER_SPIN_SEGMENTS,
        result: segment,
      });
      setUberSpinOpen(false);
      if (segment.id === 'masterball') {
        addItem('masterball');
        const msg = 'Uber Spin awarded a Master Ball!';
        setNotice(msg);
        publishHostActivity({
          kind: 'notice',
          title: 'Uber Spin',
          message: msg,
          success: true,
          itemId: 'masterball',
        });
        return;
      }
      if (segment.id === 'bonus-all-items') {
        const state = useGameStore.getState();
        const itemIds =
          state.bag.length > 0 ? state.bag.map((item) => item.id) : [...UBER_EMPTY_BAG_ITEMS];
        for (const itemId of itemIds) {
          addItem(itemId, 1);
        }
        const msg =
          state.bag.length > 0
            ? 'Uber Spin awarded +1 to every item in your bag!'
            : 'Uber Spin stocked your bag with starter items!';
        setNotice(msg);
        publishHostActivity({
          kind: 'notice',
          title: 'Uber Spin',
          message: msg,
          success: true,
        });
        return;
      }
      if (segment.id === 'bonus-xp') {
        grantXpAllPartyAndPc(200);
        const msg = 'Uber Spin awarded +200 XP to your party and PC!';
        setNotice(msg);
        publishHostActivity({
          kind: 'notice',
          title: 'Uber Spin',
          message: msg,
          success: true,
        });
        return;
      }
      if (segment.id === 'bonus-money') {
        addMoney(250);
        const msg = 'Uber Spin awarded ¥250!';
        setNotice(msg);
        publishHostActivity({
          kind: 'notice',
          title: 'Uber Spin',
          message: msg,
          success: true,
        });
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

  return (
    <motion.div
      className="screen hub-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="hub-header">
        <div className="hub-header__trainer">
          {trainer?.avatar && /[/.]/.test(trainer.avatar) ? (
            <img
              src={trainer.avatar}
              alt={trainer.name}
              className="hub-header__avatar-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
              }}
            />
          ) : (
            <span className="hub-header__avatar">{trainer?.avatar}</span>
          )}
          <div>
            <h2 className="hub-header__name">{trainer?.name}</h2>
            <p className="hub-header__stats">
              Party: {party.length}/5 · Badges: {gymBadges}/{totalGyms} · Paths: {spinsCount} ·{' '}
              <PokeCenterVisits lives={lives} />
            </p>
          </div>
        </div>
      </header>

      {eliteCleared && (
        <div className="hub-champion-banner">
          <GameIcon ui="champion" alt="" className="game-icon-img game-icon-img--inline" /> {region} Champion!
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
                    ? 'Catch Pokémon'
                    : activePathway === 'items'
                      ? 'Hunt Items'
                      : 'Mystery Path'}
                </h3>
                <Wheel segments={wheelSegments} onLand={handleLand} disabled={wheelLocked} />
                {gymCounter}
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
                <PathwaySelector onSelect={setActivePathway} disabled={pathsDisabled} />
                {gymCounter}
                <HubShopButton onClick={() => setScreen('shop')} />
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
            <p className="battle-modal__subtitle">A secret wheel with rare rewards!</p>
            <Wheel segments={UBER_SPIN_SEGMENTS} onLand={handleUberLand} />
            <button type="button" className="btn btn--ghost" onClick={() => setUberSpinOpen(false)}>
              Close
            </button>
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

      {pokeCenterOpen && <PokeCenterModal onClose={dismissPokeCenter} />}

      {trainer?.name.toLowerCase() === 'debug' && <DebugMenu onUberSpin={() => setUberSpinOpen(true)} />}
    </motion.div>
  );
}
