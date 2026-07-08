import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wheel } from '../components/Wheel';
import { TypeBadge } from '../components/TypeBadge';
import { ItemIcon } from '../components/ItemIcon';
import { SHINY_WHEEL_CHARM_SEGMENTS, SHINY_WHEEL_SEGMENTS } from '../data/pools';
import { CHAOS_WHEEL_SEGMENTS, chaosOutcomeLabel } from '../multiplayer/chaosWheel';
import type { ChaosEffectId } from '../multiplayer/protocol';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { getTypeEffectiveness, getEffectivenessChipLabel, TYPE_COLORS } from '../data/typeChart';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { battleGifOnError, imgFallback, localBattleGif, localPokemonSprite } from '../utils/localAssets';
import { formatMovePowerDisplay, isFixedDamageMove } from '../data/moves';
import type { BattleMove } from '../types/game';

export function MpGuestScreen() {
  const muted = useGameStore((s) => s.muted);
  const setScreen = useGameStore((s) => s.setScreen);
  const spectate = useMultiplayerStore((s) => s.spectate);
  const awaitingGuest = useMultiplayerStore((s) => s.awaitingGuest);
  const outcome = useMultiplayerStore((s) => s.outcome);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const submitShinyResult = useMultiplayerStore((s) => s.submitShinyResult);
  const submitChaosResult = useMultiplayerStore((s) => s.submitChaosResult);
  const submitBattleMove = useMultiplayerStore((s) => s.submitBattleMove);
  const submitBattleSwitch = useMultiplayerStore((s) => s.submitBattleSwitch);
  const clearOutcome = useMultiplayerStore((s) => s.clearOutcome);
  const resetMultiplayer = useMultiplayerStore((s) => s.resetMultiplayer);

  const [shinyDone, setShinyDone] = useState(false);
  const [chaosDone, setChaosDone] = useState(false);
  const [wheelLandedLabel, setWheelLandedLabel] = useState<string | null>(null);
  const [wheelLandedKey, setWheelLandedKey] = useState<number | null>(null);

  const activeWheel = spectate?.activeWheel ?? null;
  const activityEvent = spectate?.activityEvent ?? null;

  useEffect(() => {
    if (awaitingGuest === 'shinyRoll') setShinyDone(false);
    if (awaitingGuest === 'chaosWheel') setChaosDone(false);
  }, [awaitingGuest]);

  useEffect(() => {
    if (activeWheel && activeWheel.id !== wheelLandedKey) {
      setWheelLandedLabel(null);
    }
  }, [activeWheel, wheelLandedKey]);

  const shinySegments = useMemo(() => {
    const charm = spectate?.hasShinyCharm ?? false;
    return charm ? SHINY_WHEEL_CHARM_SEGMENTS : SHINY_WHEEL_SEGMENTS;
  }, [spectate?.hasShinyCharm]);

  if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
    return (
      <div className="screen mp-guest-screen">
        <h2 className="screen-title">Disconnected</h2>
        <p>Connection to the host was lost.</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            resetMultiplayer();
            setScreen('title');
          }}
        >
          Back to Title
        </button>
      </div>
    );
  }

  if (!spectate) {
    return (
      <div className="screen mp-guest-screen">
        <div className="loading">Connected — waiting for host…</div>
      </div>
    );
  }

  const battle = spectate.battle;
  const guestControls = battle?.guestControlsActive && !awaitingGuest;
  /** Finish watching the host's spin before prompting the guest to act. */
  const watchingHostWheel = !!(activeWheel && wheelLandedKey !== activeWheel.id);
  const guestActionPending =
    !outcome &&
    !watchingHostWheel &&
    ((awaitingGuest === 'shinyRoll' && !shinyDone) ||
      (awaitingGuest === 'chaosWheel' && !chaosDone));

  return (
    <motion.div
      className="screen mp-guest-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="screen-title">Helping {spectate.trainerName}</h2>
      <p className="mp-guest-screen__meta">
        Badges {spectate.badges}/8 · Lives {spectate.lives} · ${spectate.money} · Screen:{' '}
        {spectate.screen}
      </p>

      <div className="mp-guest-party">
        {spectate.party.map((member) => (
          <div
            key={member.caughtAt}
            className={`mp-guest-party__slot${member.guestOwned ? ' mp-guest-party__slot--guest' : ''}${member.guestLocked ? ' mp-guest-party__slot--locked' : ''}`}
          >
            <img
              src={member.shiny && member.shinySprite ? member.shinySprite : member.sprite}
              alt={member.displayName}
              onError={(e) => imgFallback(e, localPokemonSprite(member.id), PLACEHOLDER_SPRITE)}
            />
            <span>
              {member.guestOwned ? '★ ' : ''}
              {member.nickname ?? member.displayName}
              {member.guestLocked ? ' 🔒' : ''}
              {member.shiny ? ' ✨' : ''}
            </span>
          </div>
        ))}
      </div>

      {outcome && (
        <div className="mp-overlay__card mp-guest-screen__outcome">
          <h3 className="mp-overlay__title">Result</h3>
          <p className="mp-overlay__body">{outcome}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              playSfx('click', muted);
              setShinyDone(false);
              setChaosDone(false);
              clearOutcome();
            }}
          >
            OK
          </button>
        </div>
      )}

      {/* Host wheel spins — same animation, lands on the host's result. */}
      {!outcome && watchingHostWheel && activeWheel && (
        <div className="mp-guest-action mp-guest-spectate-wheel">
          <h3>{activeWheel.title}</h3>
          <p className="mp-guest-screen__hint">Watching your friend&apos;s spin…</p>
          <div className="mp-guest-action__wheel">
            <Wheel
              key={activeWheel.id}
              segments={activeWheel.segments}
              replay={{ key: activeWheel.id, segmentId: activeWheel.resultSegmentId }}
              onLand={(segment) => {
                setWheelLandedKey(activeWheel.id);
                setWheelLandedLabel(segment.label || activeWheel.resultLabel);
              }}
            />
          </div>
        </div>
      )}

      {!outcome &&
        !watchingHostWheel &&
        activeWheel &&
        wheelLandedKey === activeWheel.id &&
        wheelLandedLabel &&
        !guestActionPending && (
          <p className="mp-guest-spectate-wheel__result">
            Landed on <strong>{wheelLandedLabel}</strong>
          </p>
        )}

      {!outcome && awaitingGuest === 'shinyRoll' && !shinyDone && !watchingHostWheel && (
        <div className="mp-guest-action">
          <h3>Extra shiny roll!</h3>
          <p>Spin for a chance to make the catch shiny.</p>
          <div className="mp-guest-action__wheel">
            <Wheel
              segments={shinySegments}
              onLand={(segment) => {
                const shiny = segment.id === 'shiny';
                setShinyDone(true);
                submitShinyResult(shiny);
              }}
            />
          </div>
        </div>
      )}

      {!outcome && awaitingGuest === 'chaosWheel' && !chaosDone && !watchingHostWheel && (
        <div className="mp-guest-action">
          <h3>Chaos wheel!</h3>
          <p>Spin to mess with (or help) your friend.</p>
          <div className="mp-guest-action__wheel">
            <Wheel
              segments={CHAOS_WHEEL_SEGMENTS}
              onLand={(segment) => {
                const effect = segment.id as ChaosEffectId;
                setChaosDone(true);
                submitChaosResult(effect);
                useMultiplayerStore.setState({
                  awaitingGuest: null,
                  outcome: chaosOutcomeLabel(effect),
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Catch / item / notice outcomes from host minigames. */}
      {!guestActionPending && !outcome && activityEvent && (
        <div
          className={`mp-guest-activity${activityEvent.success === false ? ' mp-guest-activity--fail' : ''}${activityEvent.shiny ? ' mp-guest-activity--shiny' : ''}`}
        >
          <h3>{activityEvent.title}</h3>
          {activityEvent.pokemonSprite && (
            <img
              src={activityEvent.pokemonSprite}
              alt={activityEvent.pokemonName ?? ''}
              className="mp-guest-activity__sprite"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
              }}
            />
          )}
          {activityEvent.itemId && (
            <ItemIcon
              id={activityEvent.itemId}
              icon={activityEvent.itemIcon ?? '🎁'}
              name={activityEvent.title}
              className="mp-guest-activity__item"
            />
          )}
          <p>{activityEvent.message}</p>
        </div>
      )}

      {battle && !awaitingGuest && (
        <div className="mp-guest-battle">
          <h3>{battle.title}</h3>
          <div className="mp-guest-battle__enemy">
            <img
              src={localBattleGif(battle.enemyId)}
              alt={battle.enemyName}
              onError={(e) => battleGifOnError(e, battle.enemyId, PLACEHOLDER_SPRITE)}
            />
            <p>
              {battle.enemyName} · HP {battle.enemyHp}/{battle.enemyMaxHp}
            </p>
            <div className="mp-guest-battle__types">
              {battle.enemyTypes.map((type) => (
                <TypeBadge key={type} type={type} size="sm" />
              ))}
            </div>
          </div>
          <p className="battle-message">{battle.message}</p>

          {guestControls ? (
            <div className="battle-move-select">
              <p className="battle-move-select__title">Your Pokémon — choose a move</p>
              <div className="battle-move-grid">
                {battle.moves.map((move) => {
                  const mult = getTypeEffectiveness(move.type, battle.enemyTypes);
                  const effChip =
                    move.fromActive &&
                    !isFixedDamageMove(move.slug) &&
                    (move.power > 0 || move.slug === 'low-kick')
                      ? getEffectivenessChipLabel(mult)
                      : null;
                  const key = `${move.ownerCaughtAt}-${move.slug}-${move.fromActive}`;
                  const ppDepleted = move.fromActive && move.currentPp <= 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`battle-move-btn${!move.fromActive ? ' battle-move-btn--switch' : ''}${ppDepleted ? ' battle-move-btn--disabled' : ''}`}
                      style={{ backgroundColor: TYPE_COLORS[move.type] ?? '#888' }}
                      disabled={ppDepleted || battle.processing}
                      onClick={() => {
                        playSfx('click', muted);
                        if (!move.fromActive) {
                          submitBattleSwitch(move.ownerCaughtAt);
                          return;
                        }
                        submitBattleMove(move as BattleMove);
                      }}
                    >
                      <span className="battle-move-btn__name">{move.name}</span>
                      <span className="battle-move-btn__meta">
                        {move.ownerDisplayName}
                        {!move.fromActive && ' · switch'}
                      </span>
                      <span className="battle-move-btn__footer">
                        <span>Pwr {formatMovePowerDisplay(move as BattleMove, 5)}</span>
                        <span>
                          PP {move.currentPp}/{move.maxPp}
                        </span>
                      </span>
                      {effChip && (
                        <span className="gym-effectiveness">{effChip}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mp-guest-screen__hint">
              {battle.guestControlsActive
                ? 'Waiting…'
                : 'Spectating battle — your friend is in control.'}
            </p>
          )}
        </div>
      )}

      {!battle && !awaitingGuest && !outcome && !activeWheel && !activityEvent && (
        <p className="mp-guest-screen__hint">
          Semi-spectating. You&apos;ll see spins and outcomes here, and get prompted when it&apos;s
          your turn to act.
        </p>
      )}
    </motion.div>
  );
}
