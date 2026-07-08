import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CatchChance } from '../components/CatchChance';
import { CatchCombo } from '../components/CatchCombo';
import { SpriteCard } from '../components/SpriteCard';
import { Confetti } from '../components/Confetti';
import { Wheel } from '../components/Wheel';
import { ITEM_SPRITES } from '../data/icons';
import { SHINY_WHEEL_CHARM_SEGMENTS, SHINY_WHEEL_SEGMENTS } from '../data/pools';
import { publishHostActivity, publishHostWheelSpin } from '../multiplayer/publish';
import { isHostConnected, useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { useGameStore } from '../store/useGameStore';
import { resolveEncounterPokemon, resetEncounterSession } from '../utils/encounterSession';
import { playSfx } from '../utils/sound';
import { playClip, stopClips } from '../utils/music';
import { asset } from '../utils/asset';
import { getSpeciesCatchRate, encounterLevelForBadges } from '../utils/xp';
import { catchProbability, formatCatchPercent } from '../utils/catchChance';
import type { ActivityType, PokemonData } from '../types/game';

type CatchPhase = 'ball' | 'catch' | 'chance' | 'caught' | 'shiny' | 'done';
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

export function CatchScreen() {
  const currentActivity = useGameStore((s) => s.currentActivity);
  const bag = useGameStore((s) => s.bag);
  const lastCaughtAt = useGameStore((s) => s.lastCaughtAt);
  const lastCaughtId = useGameStore((s) => s.lastCaughtId);
  const catchGamemode = useGameStore((s) => s.catchGamemode) ?? 'skill';
  const catchPokemon = useGameStore((s) => s.catchPokemon);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const setShinyOnCatch = useGameStore((s) => s.setShinyOnCatch);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const setScreen = useGameStore((s) => s.setScreen);
  const badges = useGameStore((s) => s.badges);
  const muted = useGameStore((s) => s.muted);
  const awaitingGuest = useMultiplayerStore((s) => s.awaitingGuest);

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
  const [chanceStatus, setChanceStatus] = useState('Throwing...');

  const isChanceMode = catchGamemode === 'chance';
  const hasShinyCharm = (bag.find((item) => item.id === 'shinycharm')?.quantity ?? 0) > 0;
  const ownedBalls = BALL_OPTIONS.filter(
    (ball) => (bag.find((item) => item.id === ball.id)?.quantity ?? 0) > 0,
  );

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
      playSfx('battle', muted);
    }
  }, [loading, pokemon, muted]);

  useEffect(() => {
    if (!isHostConnected()) return;
    const applyShiny = (shiny: boolean) => {
      const game = useGameStore.getState();
      if (shiny && (game.lastCaughtAt != null || game.lastCaughtId != null)) {
        setShinyOnCatch(game.lastCaughtAt ?? 0);
        setShinyResult('shiny');
        if (!muted) playClip(asset('sounds/pokemon_caught.mp3'));
        setShowConfetti(true);
      }
      useMultiplayerStore.getState().setOutcome(
        shiny ? 'Your friend rolled a shiny!' : "Friend's shiny roll: not shiny.",
      );
      useMultiplayerStore.getState().setAwaitingGuest(null);
      const mon = pokemon;
      if (mon) {
        publishHostActivity({
          kind: 'catch',
          title: shiny ? 'Shiny Caught!' : 'Caught!',
          message: shiny
            ? `✨ Friend rolled shiny — ${mon.displayName} is shiny!`
            : `${mon.displayName} joined the party.`,
          success: true,
          pokemonName: mon.displayName,
          pokemonSprite: shiny && mon.shinySprite ? mon.shinySprite : mon.sprite,
          shiny,
        });
      }
      setPhase('done');
    };
    useMultiplayerStore.getState().setShinyApplyHandler(applyShiny);
    return () => useMultiplayerStore.getState().setShinyApplyHandler(null);
  }, [muted, setShinyOnCatch, pokemon]);

  function resultActivityType(): ActivityType {
    if (currentActivity === 'fishing') return 'fishing';
    if (currentActivity === 'tallgrass') return 'tallgrass';
    return 'wild';
  }

  function goHub() {
    stopClips();
    resetEncounterSession();
    setScreen('hub');
  }

  function beginCatchSuccess(ballId: BallId) {
    if (!pokemon) return;
    setPokemonAbsorbed(false);
    catchPokemon(pokemon, undefined, ballId);
    setResolved(true);
    setPhase('shiny');
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
    // Pokémon escapes the ball — try another throw.
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

  function handleShinyLand(segment: { id: string }) {
    const isShiny = segment.id === 'shiny';
    const shinySegments = hasShinyCharm ? SHINY_WHEEL_CHARM_SEGMENTS : SHINY_WHEEL_SEGMENTS;
    publishHostWheelSpin({
      kind: 'shiny',
      title: 'Shiny Check',
      segments: shinySegments,
      result: { id: segment.id, label: segment.id === 'shiny' ? 'Shiny' : 'Normal' },
    });

    setShinyResult(isShiny ? 'shiny' : 'normal');
    // Party catches use lastCaughtAt; PC-only duplicate power-boosts use lastCaughtId.
    if (isShiny && (lastCaughtAt != null || lastCaughtId != null)) {
      setShinyOnCatch(lastCaughtAt ?? 0);
    }
    if (!muted) playClip(asset('sounds/pokemon_caught.mp3'));
    setShowConfetti(true);

    // Guest gets an extra shiny roll only when the catch is not already shiny.
    if (!isShiny && isHostConnected()) {
      const game = useGameStore.getState();
      useMultiplayerStore
        .getState()
        .requestShinyRoll(hasShinyCharm, game.lastCaughtAt, game.lastCaughtId);
      return;
    }

    if (pokemon) {
      publishHostActivity({
        kind: 'catch',
        title: isShiny ? 'Shiny Caught!' : 'Caught!',
        message: isShiny
          ? `✨ ${pokemon.displayName} joined the party as a shiny!`
          : `${pokemon.displayName} joined the party.`,
        success: true,
        pokemonName: pokemon.displayName,
        pokemonSprite:
          isShiny && pokemon.shinySprite ? pokemon.shinySprite : pokemon.sprite,
        shiny: isShiny,
      });
    }

    setPhase('done');
  }

  if (loading) {
    return (
      <div className="screen catch-screen">
        <div className="loading">A wild Pokémon appeared...</div>
      </div>
    );
  }

  if (!pokemon) {
    return (
      <div className="screen catch-screen">
        <p>Failed to load Pokémon.</p>
        <button type="button" className="btn btn--primary" onClick={goHub}>
          Back to Hub
        </button>
      </div>
    );
  }

  const catchRate = getSpeciesCatchRate(pokemon.id);
  const encounterLevel = encounterLevelForBadges(badges.length);
  const shinyWheelSegments = hasShinyCharm ? SHINY_WHEEL_CHARM_SEGMENTS : SHINY_WHEEL_SEGMENTS;
  const sceneVariant =
    currentActivity === 'fishing'
      ? 'catch-scene--water'
      : currentActivity === 'cave' || currentActivity === 'fossil'
        ? 'catch-scene--cave'
        : 'catch-scene--grass';

  return (
    <motion.div
      className="screen catch-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active={showConfetti} />

      <div className={`catch-scene ${sceneVariant}`}>
        <div className="catch-scene__grass" />
        <motion.div className="catch-scene__content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className={`catch-flavor ${pokemon.isLegendary ? 'catch-flavor--legendary' : ''}`}>
            {encounterFlavor(currentActivity, pokemon.isLegendary)}
          </p>
          <div className="catch-scene__sprite-area">
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
          </p>

          {phase === 'ball' && (
            <div className="ball-picker">
              <p className="ball-picker__title">Choose a ball to throw</p>
              {ownedBalls.length === 0 ? (
                <p className="ball-picker__empty">You have no Poké Balls left.</p>
              ) : (
                <div className="ball-picker__grid">
                  {ownedBalls.map((ball) => {
                    const qty = bag.find((item) => item.id === ball.id)?.quantity ?? 0;
                    const estChance = isChanceMode
                      ? formatCatchPercent(catchProbability(catchRate, ball.id))
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
              <button type="button" className="btn btn--ghost" onClick={goHub}>
                Run Away
              </button>
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

      {phase === 'shiny' && awaitingGuest !== 'shinyRoll' && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal shiny-wheel-modal">
            <h2 className="battle-modal__title">Shiny Check!</h2>
            <p className="battle-modal__subtitle">
              Spin to see if {pokemon.displayName} becomes shiny
              {hasShinyCharm ? ' (Shiny Charm active — 1 in 15!)' : ' (1 in 40)'}.
            </p>
            <Wheel segments={shinyWheelSegments} onLand={handleShinyLand} />
          </div>
        </div>
      )}

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
    </motion.div>
  );
}
