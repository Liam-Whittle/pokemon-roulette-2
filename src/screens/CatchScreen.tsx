import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CatchCombo } from '../components/CatchCombo';
import { SpriteCard } from '../components/SpriteCard';
import { Confetti } from '../components/Confetti';
import { Wheel } from '../components/Wheel';
import { BALL_SPRITES, SHINY_WHEEL_CHARM_SEGMENTS, SHINY_WHEEL_SEGMENTS } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { resolveEncounterPokemon, resetEncounterSession } from '../utils/encounterSession';
import { playSfx } from '../utils/sound';
import { playClip } from '../utils/music';
import { asset } from '../utils/asset';
import type { ActivityType, PokemonData } from '../types/game';

type CatchPhase = 'ball' | 'catch' | 'caught' | 'shiny' | 'done';
type BallId = 'pokeball' | 'greatball' | 'ultraball' | 'masterball';

const BALL_OPTIONS: { id: BallId; label: string; sprite: string }[] = [
  { id: 'pokeball', label: 'Poké Ball', sprite: BALL_SPRITES.pokeball },
  { id: 'greatball', label: 'Great Ball', sprite: BALL_SPRITES.greatball },
  { id: 'ultraball', label: 'Ultra Ball', sprite: BALL_SPRITES.ultraball },
  { id: 'masterball', label: 'Master Ball', sprite: BALL_SPRITES.masterball },
];

function encounterFlavor(activity: ActivityType | null, isLegendary: boolean): string {
  if (activity === 'fishing') return 'You hooked something from the water!';
  if (activity === 'tallgrass' && isLegendary) return 'A legendary Pokémon appeared in the tall grass!';
  if (activity === 'tallgrass') return 'A strong Pokémon appeared in the tall grass!';
  return 'A wild Pokémon appeared!';
}

function ballModifiers(ballId: BallId): { zoneBonus: number; speedMult: number } {
  switch (ballId) {
    case 'greatball':
      return { zoneBonus: 0.1, speedMult: 1 };
    case 'ultraball':
      return { zoneBonus: 0.1, speedMult: 0.9 };
    default:
      return { zoneBonus: 0, speedMult: 1 };
  }
}

export function CatchScreen() {
  const currentActivity = useGameStore((s) => s.currentActivity);
  const bag = useGameStore((s) => s.bag);
  const lastCaughtAt = useGameStore((s) => s.lastCaughtAt);
  const catchPokemon = useGameStore((s) => s.catchPokemon);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const setShinyOnCatch = useGameStore((s) => s.setShinyOnCatch);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<CatchPhase>('ball');
  const [selectedBall, setSelectedBall] = useState<BallId | null>(null);
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shinyResult, setShinyResult] = useState<'shiny' | 'normal' | null>(null);
  const [confirmMasterBall, setConfirmMasterBall] = useState(false);

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

  function resultActivityType(): ActivityType {
    if (currentActivity === 'fishing') return 'fishing';
    if (currentActivity === 'tallgrass') return 'tallgrass';
    return 'wild';
  }

  function goHub() {
    resetEncounterSession();
    setScreen('hub');
  }

  function beginCatchSuccess() {
    if (!pokemon) return;
    catchPokemon(pokemon);
    setResolved(true);
    setPhase('shiny');
  }

  function handleSelectBall(ballId: BallId) {
    if (ballId === 'masterball') {
      setConfirmMasterBall(true);
      return;
    }
    if (!consumeItem(ballId, 1)) return;
    setSelectedBall(ballId);
    setPhase('catch');
  }

  function confirmMasterBallUse() {
    setConfirmMasterBall(false);
    if (!consumeItem('masterball', 1)) return;
    setSelectedBall('masterball');
    beginCatchSuccess();
  }

  function handleComboResult(success: boolean) {
    if (!pokemon) return;
    setResolved(success);
    if (success) {
      beginCatchSuccess();
    } else {
      playSfx('fail', muted);
      setLastResult({
        type: resultActivityType(),
        success: false,
        message: `${pokemon.displayName} ran away!`,
      });
      setPhase('done');
    }
  }

  function handleShinyLand(segment: { id: string }) {
    const isShiny = segment.id === 'shiny';
    setShinyResult(isShiny ? 'shiny' : 'normal');
    if (isShiny && lastCaughtAt) {
      setShinyOnCatch(lastCaughtAt);
    }
    if (!muted) playClip(asset('sounds/pokemon_caught.mp3'));
    setShowConfetti(true);
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

  const safePower = Number.isFinite(pokemon.powerLevel) ? pokemon.powerLevel : 0.3;
  const modifiers = selectedBall ? ballModifiers(selectedBall) : { zoneBonus: 0, speedMult: 1 };
  const shinyWheelSegments = hasShinyCharm ? SHINY_WHEEL_CHARM_SEGMENTS : SHINY_WHEEL_SEGMENTS;

  return (
    <motion.div
      className="screen catch-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active={showConfetti} />

      <div className="catch-scene">
        <div className="catch-scene__grass" />
        <motion.div className="catch-scene__content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className={`catch-flavor ${pokemon.isLegendary ? 'catch-flavor--legendary' : ''}`}>
            {encounterFlavor(currentActivity, pokemon.isLegendary)}
          </p>
          <SpriteCard pokemon={pokemon} size="lg" />
          <p className="catch-power">
            Catch difficulty scales with Power {Math.round(safePower * 100)}
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
                    return (
                      <button
                        key={ball.id}
                        type="button"
                        className="ball-picker__btn"
                        title={`${ball.label} (×${qty})`}
                        onClick={() => handleSelectBall(ball.id)}
                      >
                        <img src={ball.sprite} alt={ball.label} className="ball-picker__icon" />
                        <span className="ball-picker__qty">×{qty}</span>
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

          {phase === 'catch' && (
            <CatchCombo
              powerLevel={safePower}
              isLegendary={pokemon.isLegendary}
              zoneBonus={modifiers.zoneBonus}
              speedMult={modifiers.speedMult}
              ballSprite={selectedBall ? BALL_SPRITES[selectedBall] : undefined}
              onResult={handleComboResult}
            />
          )}

          {phase === 'done' && (
            <div className="catch-result-panel">
              <h2 className="catch-result__title">
                {resolved ? (shinyResult === 'shiny' ? 'Shiny Caught!' : 'Caught!') : 'Escaped!'}
              </h2>
              <p className="catch-result__msg">
                {resolved
                  ? shinyResult === 'shiny'
                    ? `✨ ${pokemon.displayName} joined your party as a shiny!`
                    : `${pokemon.displayName} joined your party.`
                  : `${pokemon.displayName} got away.`}
              </p>
              <button type="button" className="btn btn--primary" onClick={goHub}>
                Back to Hub
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {phase === 'shiny' && (
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
            <img src={BALL_SPRITES.masterball} alt="Master Ball" className="master-ball-confirm__icon" />
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
