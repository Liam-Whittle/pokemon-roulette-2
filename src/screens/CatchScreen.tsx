import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CatchChance } from '../components/CatchChance';
import { CatchCombo } from '../components/CatchCombo';
import { SpriteCard } from '../components/SpriteCard';
import { Confetti } from '../components/Confetti';
import { ITEM_SPRITES } from '../data/icons';
import { publishHostActivity } from '../multiplayer/publish';
import { useGameStore } from '../store/useGameStore';
import { resolveEncounterPokemon, resetEncounterSession } from '../utils/encounterSession';
import { playSfx } from '../utils/sound';
import { playClip, stopClips } from '../utils/music';
import { asset } from '../utils/asset';
import { getSpeciesCatchRate, encounterLevelForBadges } from '../utils/xp';
import {
  THROW_CHAIN_BONUS,
  catchProbability,
  formatCatchPercent,
} from '../utils/catchChance';
import { resolveRegionId } from '../data/pools';
import type { ActivityType, PokemonData } from '../types/game';

const RUN_BTN_W = 140;
const RUN_BTN_H = 48;
const RUN_PAD = 12;
const RUN_GAP = 20;

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: DOMRect,
  gap: number,
): boolean {
  return !(
    a.right + gap < b.left ||
    a.left - gap > b.right ||
    a.bottom + gap < b.top ||
    a.top - gap > b.bottom
  );
}

type CatchPhase = 'ball' | 'catch' | 'chance' | 'caught' | 'done';
type BallId = 'pokeball' | 'greatball' | 'ultraball' | 'masterball';

const BALL_OPTIONS: { id: BallId; label: string; sprite: string }[] = [
  { id: 'pokeball', label: 'Poké Ball', sprite: ITEM_SPRITES.pokeball },
  { id: 'greatball', label: 'Great Ball', sprite: ITEM_SPRITES.greatball },
  { id: 'ultraball', label: 'Ultra Ball', sprite: ITEM_SPRITES.ultraball },
  { id: 'masterball', label: 'Master Ball', sprite: ITEM_SPRITES.masterball },
];

const BALL_EMOJI: Record<BallId, string> = {
  pokeball: '🔴',
  greatball: '🔵',
  ultraball: '🟡',
  masterball: '🟣',
};

/** Ball sprite with an emoji fallback if the remote image fails to load. */
function BallIcon({ id, sprite, label, className }: { id: BallId; sprite: string; label: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={className} role="img" aria-label={label}>{BALL_EMOJI[id]}</span>;
  }
  return <img src={sprite} alt={label} className={className} onError={() => setFailed(true)} />;
}

function encounterFlavor(activity: ActivityType | null, isLegendary: boolean): string {
  if (activity === 'fishing') return 'You hooked something from the water!';
  if (activity === 'tallgrass' && isLegendary) return 'A legendary Pokémon appeared in the tall grass!';
  if (activity === 'tallgrass') return 'A strong Pokémon appeared in the tall grass!';
  return 'A wild Pokémon appeared!';
}

interface CatchScreenProps {
  /** MissingNo. encounter — purple glitch reskin + dedicated music/bg from parent. */
  variant?: 'default' | 'missingno';
}

export function CatchScreen({ variant = 'default' }: CatchScreenProps) {
  const isGlitch = variant === 'missingno';
  const currentActivity = useGameStore((s) => s.currentActivity);
  const bag = useGameStore((s) => s.bag);
  const catchGamemode = useGameStore((s) => s.catchGamemode) ?? 'skill';
  const catchPokemon = useGameStore((s) => s.catchPokemon);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const setShinyOnCatch = useGameStore((s) => s.setShinyOnCatch);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const setScreen = useGameStore((s) => s.setScreen);
  const badges = useGameStore((s) => s.badges);
  const muted = useGameStore((s) => s.muted);
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));

  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<CatchPhase>('ball');
  const [selectedBall, setSelectedBall] = useState<BallId | null>(null);
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shinyResult, setShinyResult] = useState<'shiny' | 'normal' | null>(null);
  const [confirmMasterBall, setConfirmMasterBall] = useState(false);
  const [pokemonAbsorbed, setPokemonAbsorbed] = useState(false);
  const [throwKey, setThrowKey] = useState(0);
  /** Failed throws this encounter — each adds +1% catch chance to every ball. */
  const [failedThrows, setFailedThrows] = useState(0);
  const [chanceStatus, setChanceStatus] = useState('Throwing...');
  const [runPos, setRunPos] = useState<{ x: number; y: number } | null>(null);
  const spriteAreaRef = useRef<HTMLDivElement | null>(null);
  const ballGridRef = useRef<HTMLDivElement | null>(null);

  const isChanceMode = catchGamemode === 'chance';
  const hasShinyCharm = (bag.find((item) => item.id === 'shinycharm')?.quantity ?? 0) > 0;
  const ownedBalls = BALL_OPTIONS.filter(
    (ball) => (bag.find((item) => item.id === ball.id)?.quantity ?? 0) > 0,
  );
  const outOfBalls = ownedBalls.length === 0;

  useEffect(() => {
    let cancelled = false;
    resolveEncounterPokemon().then((data) => {
      if (!cancelled) {
        setPokemon(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && pokemon) {
      useGameStore.getState().markSeen(pokemon);
      if (!isGlitch) playSfx('battle', muted);
    }
  }, [loading, pokemon, muted, isGlitch]);

  function resultActivityType(): ActivityType {
    if (currentActivity === 'fishing') return 'fishing';
    if (currentActivity === 'tallgrass') return 'tallgrass';
    return 'wild';
  }

  function goHub() {
    stopClips();
    resetEncounterSession();
    const state = useGameStore.getState();
    if (
      state.activeUnlocks.includes('hardcore') &&
      !state.starterClaimed &&
      state.party.length < state.getMaxParty()
    ) {
      setScreen('hardcore-draft');
      return;
    }
    setScreen('hub');
  }

  function teleportRunAway() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const forbidden: DOMRect[] = [];
    if (spriteAreaRef.current) forbidden.push(spriteAreaRef.current.getBoundingClientRect());
    if (ballGridRef.current) forbidden.push(ballGridRef.current.getBoundingClientRect());
    // Keep clear of top-right app controls.
    forbidden.push(new DOMRect(vw - 220, 0, 220, 72));

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const x = RUN_PAD + Math.random() * Math.max(0, vw - RUN_BTN_W - RUN_PAD * 2);
      const y = RUN_PAD + Math.random() * Math.max(0, vh - RUN_BTN_H - RUN_PAD * 2);
      const candidate = { left: x, top: y, right: x + RUN_BTN_W, bottom: y + RUN_BTN_H };
      if (forbidden.every((zone) => !rectsOverlap(candidate, zone, RUN_GAP))) {
        setRunPos({ x, y });
        return;
      }
    }
    // Fallback corners if random sampling fails.
    const corners = [
      { x: RUN_PAD, y: RUN_PAD },
      { x: Math.max(RUN_PAD, vw - RUN_BTN_W - RUN_PAD), y: RUN_PAD },
      { x: RUN_PAD, y: Math.max(RUN_PAD, vh - RUN_BTN_H - RUN_PAD) },
      {
        x: Math.max(RUN_PAD, vw - RUN_BTN_W - RUN_PAD),
        y: Math.max(RUN_PAD, vh - RUN_BTN_H - RUN_PAD),
      },
    ];
    for (const corner of corners) {
      const candidate = {
        left: corner.x,
        top: corner.y,
        right: corner.x + RUN_BTN_W,
        bottom: corner.y + RUN_BTN_H,
      };
      if (forbidden.every((zone) => !rectsOverlap(candidate, zone, RUN_GAP))) {
        setRunPos(corner);
        return;
      }
    }
    setRunPos(corners[0]!);
  }

  function handleRunAway() {
    playSfx('click', muted);
    // MissingNo. taunts you until you catch it or run out of balls.
    if (isGlitch && !outOfBalls) {
      teleportRunAway();
      return;
    }
    goHub();
  }

  function beginCatchSuccess(ballId: BallId) {
    if (!pokemon) return;
    setPokemonAbsorbed(false);
    catchPokemon(pokemon, undefined, ballId);
    setResolved(true);

    // Shiny is rolled at catch time (like the starter): 1/40 normally, 1/15 with
    // a Shiny Charm in the bag. No separate spin.
    const shinyPlus = useGameStore.getState().activeUnlocks.includes('shinyCharmPlus');
    const shinyOdds = shinyPlus ? 1 / 5 : hasShinyCharm ? 1 / 15 : 1 / 40;
    const isShiny = Math.random() < shinyOdds;
    setShinyResult(isShiny ? 'shiny' : 'normal');

    if (isShiny) {
      const game = useGameStore.getState();
      if (game.lastCaughtAt != null || game.lastCaughtId != null) {
        setShinyOnCatch(game.lastCaughtAt ?? 0);
      }
      if (!muted) playClip(asset('sounds/pokemon_caught.mp3'));
      setShowConfetti(true);
    }

    publishHostActivity({
      kind: 'catch',
      title: isShiny ? 'Shiny Caught!' : 'Caught!',
      message: isShiny
        ? `✨ ${pokemon.displayName} joined the party as a shiny!`
        : `${pokemon.displayName} joined the party.`,
      success: true,
      pokemonName: pokemon.displayName,
      pokemonSprite: isShiny && pokemon.shinySprite ? pokemon.shinySprite : pokemon.sprite,
      shiny: isShiny,
    });

    setPhase('done');
  }

  function startThrow(ballId: BallId) {
    setSelectedBall(ballId);
    setPokemonAbsorbed(false);
    setChanceStatus('Throwing...');
    setThrowKey((k) => k + 1);
    if (isChanceMode) {
      setPhase('chance');
    } else {
      setPhase('catch');
    }
  }

  function handleSelectBall(ballId: BallId) {
    if (ballId === 'masterball') {
      setConfirmMasterBall(true);
      return;
    }
    if (!consumeItem(ballId, 1)) return;
    startThrow(ballId);
  }

  function confirmMasterBallUse() {
    setConfirmMasterBall(false);
    if (!consumeItem('masterball', 1)) return;
    if (isChanceMode) {
      startThrow('masterball');
      return;
    }
    setSelectedBall('masterball');
    beginCatchSuccess('masterball');
  }

  function handleComboResult(success: boolean) {
    if (!pokemon || !selectedBall) return;
    setResolved(success);
    if (success) {
      beginCatchSuccess(selectedBall);
    } else {
      playSfx('fail', muted);
      setLastResult({
        type: resultActivityType(),
        success: false,
        message: `${pokemon.displayName} ran away!`,
      });
      publishHostActivity({
        kind: 'catch',
        title: 'Catch failed',
        message: `${pokemon.displayName} ran away!`,
        success: false,
        pokemonName: pokemon.displayName,
        pokemonSprite: pokemon.sprite,
      });
      setPhase('done');
    }
  }

  function handleChanceResult(success: boolean) {
    if (!pokemon || !selectedBall) return;
    if (success) {
      beginCatchSuccess(selectedBall);
      return;
    }
    // Pokémon escapes the ball — try another throw (chain bonus +1% each fail).
    setFailedThrows((n) => n + 1);
    publishHostActivity({
      kind: 'catch',
      title: 'Ball broke free',
      message: `${pokemon.displayName} broke free! Try another ball.`,
      success: false,
      pokemonName: pokemon.displayName,
      pokemonSprite: pokemon.sprite,
    });
    setPokemonAbsorbed(false);
    setSelectedBall(null);
    setPhase('ball');
  }

  if (loading) {
    return (
      <div className={`screen catch-screen${isGlitch ? ' catch-screen--missingno' : ''}`}>
        <div className="loading">{isGlitch ? 'ERROR…' : 'A wild Pokémon appeared...'}</div>
      </div>
    );
  }

  if (!pokemon) {
    return (
      <div className={`screen catch-screen${isGlitch ? ' catch-screen--missingno' : ''}`}>
        <p>Failed to load Pokémon.</p>
        <button type="button" className="btn btn--primary" onClick={goHub}>
          Back to Hub
        </button>
      </div>
    );
  }

  const catchRate = getSpeciesCatchRate(pokemon.id);
  const encounterLevel = encounterLevelForBadges(badges.length);
  const throwChainBonus = failedThrows * THROW_CHAIN_BONUS;
  const sceneVariant = isGlitch
    ? 'catch-scene--glitch'
    : currentActivity === 'fishing'
      ? 'catch-scene--water'
      : currentActivity === 'cave' || currentActivity === 'fossil'
        ? 'catch-scene--cave'
        : region === 'Hoenn'
          ? 'catch-scene--grass catch-scene--hoenn'
          : 'catch-scene--grass';

  return (
    <motion.div
      className={`screen catch-screen${isGlitch ? ' catch-screen--missingno' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {isGlitch && (
        <div className="catch-screen__missingno-bg" aria-hidden>
          <div className="app-bg__missingno-grid" />
          <div className="app-bg__missingno-blobs" />
          <div className="app-bg__missingno-scan" />
          <div className="app-bg__missingno-tear" />
          <div className="app-bg__missingno-blocks" />
          <div className="app-bg__missingno-vignette" />
        </div>
      )}
      <Confetti active={showConfetti} />

      <div className={`catch-scene ${sceneVariant}`}>
        <div className="catch-scene__grass" />
        {isGlitch && <div className="catch-scene__glitch-scan" aria-hidden />}
        <motion.div className="catch-scene__content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p
            className={`catch-flavor${pokemon.isLegendary ? ' catch-flavor--legendary' : ''}${
              isGlitch ? ' catch-flavor--glitch' : ''
            }`}
          >
            {isGlitch ? 'A wild ßÑŒκéმΘή appeared!' : encounterFlavor(currentActivity, pokemon.isLegendary)}
          </p>
          <div className="catch-scene__sprite-area" ref={spriteAreaRef}>
            <motion.div
              className="catch-scene__sprite-wrap"
              animate={{
                opacity: pokemonAbsorbed ? 0 : 1,
                scale: pokemonAbsorbed ? 0.2 : 1,
              }}
              transition={{ duration: 0.35 }}
            >
              <div className="catch-scene__sprite-card">
                <span className="catch-scene__level">Lv. {encounterLevel}</span>
                <SpriteCard pokemon={pokemon} size="lg" shiny={shinyResult === 'shiny'} />
              </div>
            </motion.div>
            {phase === 'chance' && selectedBall && (
              <CatchChance
                key={throwKey}
                ballId={selectedBall}
                ballSprite={ITEM_SPRITES[selectedBall]}
                catchRate={catchRate}
                chanceBonus={throwChainBonus}
                muted={muted}
                onAbsorb={() => setPokemonAbsorbed(true)}
                onResult={handleChanceResult}
                onStatusChange={setChanceStatus}
              />
            )}
          </div>
          <p className="catch-power">
            {isChanceMode
              ? `Catch rate ${catchRate} at Lv. ${encounterLevel}`
              : `Timing difficulty from catch rate ${catchRate} at Lv. ${encounterLevel}`}
            {pokemon.isLegendary ? ' — Legendary!' : ''}.
            {isChanceMode && throwChainBonus > 0
              ? ` Throw chain +${Math.round(throwChainBonus * 100)}%!`
              : ''}
          </p>

          {phase === 'ball' && (
            <div className="ball-picker">
              <p className="ball-picker__title">Choose a ball to throw</p>
              {outOfBalls ? (
                <>
                  <p className="ball-picker__empty">You have no Poké Balls left.</p>
                  <button type="button" className="btn btn--primary" onClick={goHub}>
                    {isGlitch ? 'Leave' : 'Back to Hub'}
                  </button>
                </>
              ) : (
                <div className="ball-picker__grid" ref={ballGridRef}>
                  {ownedBalls.map((ball) => {
                    const qty = bag.find((item) => item.id === ball.id)?.quantity ?? 0;
                    const estChance = isChanceMode
                      ? formatCatchPercent(catchProbability(catchRate, ball.id, throwChainBonus))
                      : null;
                    return (
                      <button
                        key={ball.id}
                        type="button"
                        className="ball-picker__btn"
                        title={`${ball.label} (×${qty})${estChance ? ` — ${estChance} catch` : ''}`}
                        onClick={() => handleSelectBall(ball.id)}
                      >
                        <BallIcon id={ball.id} sprite={ball.sprite} label={ball.label} className="ball-picker__icon" />
                        <span className="ball-picker__qty">×{qty}</span>
                        {estChance && <span className="ball-picker__chance">{estChance}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* MissingNo: docked until first click, then portaled so it can flee the layout. */}
              {!(isGlitch && runPos) && !outOfBalls && (
                <button type="button" className="btn btn--ghost" onClick={handleRunAway}>
                  Run Away
                </button>
              )}
            </div>
          )}

          {phase === 'chance' && (
            <div className="ball-picker catch-chance-slot" aria-live="polite">
              <p className="catch-chance-slot__status">{chanceStatus}</p>
            </div>
          )}

          {phase === 'catch' && selectedBall && (
            <CatchCombo
              catchRate={catchRate}
              ballId={selectedBall}
              level={encounterLevel}
              isLegendary={pokemon.isLegendary}
              ballSprite={ITEM_SPRITES[selectedBall]}
              onResult={handleComboResult}
            />
          )}

          {phase === 'done' && (() => {
            const name = pokemon.displayName;
            let resultMsg = `${name} got away.`;
            if (resolved) {
              if (shinyResult === 'shiny') {
                resultMsg = `✨ ${name} joined your party as a shiny!`;
              } else {
                resultMsg = `${name} joined your party.`;
              }
            }
            return (
              <div className="catch-result-panel">
                <h2 className="catch-result__title">
                  {resolved ? (shinyResult === 'shiny' ? 'Shiny Caught!' : 'Caught!') : 'Escaped!'}
                </h2>
                <p className="catch-result__msg">{resultMsg}</p>
                <button type="button" className="btn btn--primary" onClick={goHub}>
                  Back to Hub
                </button>
              </div>
            );
          })()}
        </motion.div>
      </div>

      {confirmMasterBall && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal master-ball-confirm">
            <BallIcon id="masterball" sprite={ITEM_SPRITES.masterball} label="Master Ball" className="master-ball-confirm__icon" />
            <h3 className="battle-modal__title">Use Master Ball?</h3>
            <p className="battle-modal__subtitle">This guarantees a catch.</p>
            <div className="master-ball-confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmMasterBall(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmMasterBallUse}>
                Use It
              </button>
            </div>
          </div>
        </div>
      )}

      {isGlitch &&
        phase === 'ball' &&
        runPos &&
        !outOfBalls &&
        createPortal(
          <button
            type="button"
            className="btn btn--ghost missingno-run-btn"
            style={{ left: runPos.x, top: runPos.y }}
            onClick={handleRunAway}
          >
            Run Away
          </button>,
          document.body,
        )}
    </motion.div>
  );
}
