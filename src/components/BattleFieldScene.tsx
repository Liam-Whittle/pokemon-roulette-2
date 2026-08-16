import type { CSSProperties } from 'react';
import { BattleEffectBadges, hasVisibleBattleEffects, StageBadges, hasVisibleStageChanges } from './StatusBadge';
import { TypeBadge } from './TypeBadge';
import { TYPE_COLORS } from '../data/typeChart';
import { hasSubstitute, type BattleVolatiles } from '../data/battleVolatiles';
import type { StatStages } from '../data/battleMoveResolver';
import type { CaughtPokemon } from '../types/game';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { MISSINGNO_ID, MISSINGNO_SPRITE } from '../data/missingno';
import {
  battleBackGifOnError,
  battleGifOnError,
  imgFallback,
  castformBattleStem,
  localBattleFormGif,
  localBattleGif,
  localItemSprite,
  localSubstituteBackGif,
  localSubstituteGif,
  remoteBattleBackGif,
  remoteSubstituteBackGif,
  remoteSubstituteGif,
  remoteTrainerSprite,
} from '../utils/localAssets';

function battlerShowdownName(mon: CaughtPokemon): string {
  if (mon.id !== 351) return mon.name;
  const stem = castformBattleStem(mon.types);
  return stem === '351' ? 'castform' : stem.replace('351-', 'castform-');
}

function enemyBattleSrc(mon: CaughtPokemon, shiny: boolean, hasSub: boolean): string {
  if (hasSub) return localSubstituteGif();
  if (mon.id === MISSINGNO_ID) return MISSINGNO_SPRITE;
  if (mon.id === 351) return localBattleFormGif(castformBattleStem(mon.types, shiny));
  return shiny && mon.shinySprite ? mon.shinySprite : localBattleGif(mon.id);
}

function platformStyle(types: string[] | undefined): CSSProperties {
  if (!types?.length) {
    return {
      '--platform-c1': '#78C850',
      '--platform-c2': '#508830',
    } as CSSProperties;
  }
  const c1 = TYPE_COLORS[types[0]?.toLowerCase()] ?? '#78C850';
  const c2 = TYPE_COLORS[(types[1] ?? types[0])?.toLowerCase()] ?? c1;
  return {
    '--platform-c1': c1,
    '--platform-c2': c2,
  } as CSSProperties;
}

function HpBar({ current, max }: { current: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const tone = ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low';
  return (
    <div className="hp-bar-wrap hp-bar-wrap--battle-box">
      <div className={`hp-bar hp-bar--${tone}${ratio <= 0.2 && ratio > 0 ? ' hp-bar--pulse' : ''}`}>
        <div className="hp-bar__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="hp-bar__text">
        {current}/{max}
      </span>
    </div>
  );
}

export type TrainerSlideState = 'hidden' | 'enter' | 'present' | 'exit';
export type BallThrowSide = 'player' | 'enemy' | 'player-recall' | 'enemy-recall' | null;

export interface BattleFieldHitFx {
  side: 'player' | 'enemy';
  mode: 'damage' | 'status' | 'buff';
  type: string;
  id: number;
}

interface BattleFieldSceneProps {
  enemy: CaughtPokemon | null;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStages: StatStages;
  enemyVolatiles: BattleVolatiles;
  enemyTransformPhase: 'out' | 'in' | null;
  enemyVisible: boolean;
  enemyFainted: boolean;
  enemyTeamLength: number;
  enemyIndex: number;
  player: CaughtPokemon | null;
  playerHp: number;
  playerMaxHp: number;
  playerStages: StatStages;
  playerVolatiles: BattleVolatiles;
  playerVisible: boolean;
  playerFainted: boolean;
  trainerSprite?: string | null;
  trainerName: string;
  trainerSlide: TrainerSlideState;
  giovanniVfx: boolean;
  ballThrow: BallThrowSide;
  ballBurst: BallThrowSide;
  hitFx: BattleFieldHitFx | null;
  damagePopup: { text: string; side: 'player' | 'enemy' } | null;
  onEnemyClick: (enemy: CaughtPokemon) => void;
}

function HitFxOverlay({
  hitFx,
  side,
}: {
  hitFx: BattleFieldHitFx | null;
  side: 'player' | 'enemy';
}) {
  if (!hitFx || hitFx.side !== side) return null;
  return (
    <span
      key={`hit-fx-${hitFx.id}`}
      className={`battle-hit-fx battle-hit-fx--${hitFx.mode} battle-hit-fx--type-${hitFx.type}`}
      style={
        {
          '--hit-color':
            hitFx.mode === 'buff' ? '#fbbf24' : (TYPE_COLORS[hitFx.type] ?? TYPE_COLORS.normal),
        } as CSSProperties
      }
      aria-hidden
    >
      <span className="battle-hit-fx__burst" />
      <span className="battle-hit-fx__ring" />
      <span className="battle-hit-fx__spark battle-hit-fx__spark--1" />
      <span className="battle-hit-fx__spark battle-hit-fx__spark--2" />
      <span className="battle-hit-fx__spark battle-hit-fx__spark--3" />
      <span className="battle-hit-fx__spark battle-hit-fx__spark--4" />
    </span>
  );
}

export function BattleFieldScene({
  enemy,
  enemyHp,
  enemyMaxHp,
  enemyStages,
  enemyVolatiles,
  enemyTransformPhase,
  enemyVisible,
  enemyFainted,
  enemyTeamLength,
  enemyIndex,
  player,
  playerHp,
  playerMaxHp,
  playerStages,
  playerVolatiles,
  playerVisible,
  playerFainted,
  trainerSprite,
  trainerName,
  trainerSlide,
  giovanniVfx,
  ballThrow,
  ballBurst,
  hitFx,
  damagePopup,
  onEnemyClick,
}: BattleFieldSceneProps) {
  const playerShiny = !!player?.shiny;
  const enemyShiny = !!enemy?.shiny;
  const playerHasSub = hasSubstitute(playerVolatiles);
  const enemyHasSub = hasSubstitute(enemyVolatiles);

  return (
    <div className="battle-scene battle-scene--field">
      {enemy && enemyVisible && (
        <div className={`battle-hud-box battle-hud-box--enemy${enemyFainted ? ' battle-hud-box--hidden' : ''}`}>
          <div className="battle-hud-box__top">
            <span className="battle-hud-box__name">{enemy.displayName}</span>
            <span className="battle-hud-box__level">Lv.{enemy.level}</span>
          </div>
          <div className="battle-hud-box__pips-row" aria-hidden={enemyTeamLength <= 1}>
            {enemyTeamLength > 1 ? (
              <span className="battle-team-pips battle-team-pips--box">
                {Array.from({ length: enemyTeamLength }, (_, i) => (
                  <span
                    key={i}
                    className={`battle-team-pip${i < enemyIndex ? ' battle-team-pip--done' : ''}${
                      i === enemyIndex ? ' battle-team-pip--active' : ''
                    }`}
                  />
                ))}
              </span>
            ) : (
              <span className="battle-hud-box__pips-spacer" />
            )}
          </div>
          <HpBar current={enemyHp} max={enemyMaxHp} />
          {hasVisibleBattleEffects(enemy.status, enemyVolatiles) && (
            <div className="battle-hud-box__badges">
              <BattleEffectBadges status={enemy.status} volatiles={enemyVolatiles} placement="battle-row" />
            </div>
          )}
          {hasVisibleStageChanges(enemyStages) && (
            <div className="battle-hud-box__badges">
              <StageBadges stages={enemyStages} placement="battle-row" />
            </div>
          )}
          <div className="battle-hud-box__types">
            {enemy.types.map((type) => (
              <TypeBadge key={type} type={type} size="sm" />
            ))}
          </div>
        </div>
      )}

      <div className="battle-stage battle-stage--enemy">
        <div className="battle-platform battle-platform--far" style={platformStyle(enemy?.types)} aria-hidden>
          <span className="battle-platform__rim" />
          <span className="battle-platform__fill" />
        </div>
        {trainerSlide !== 'hidden' && trainerSprite && (
          <div
            className={`battle-trainer__sprite-wrap battle-trainer__sprite-wrap--field battle-trainer__sprite-wrap--${trainerSlide}${
              giovanniVfx ? ' battle-trainer__sprite-wrap--giovanni' : ''
            }`}
          >
            <img
              src={trainerSprite}
              alt={trainerName}
              className="battle-trainer__sprite"
              onError={(e) => {
                const filename = trainerSprite.split('/').pop();
                imgFallback(e, filename ? remoteTrainerSprite(filename) : undefined, PLACEHOLDER_SPRITE);
              }}
            />
            {giovanniVfx && (
              <>
                <span className="battle-trainer__ground-shadow" aria-hidden />
                <span className="battle-trainer__smoke" aria-hidden>
                  <span className="battle-trainer__smoke-wisp" />
                  <span className="battle-trainer__smoke-wisp" />
                  <span className="battle-trainer__smoke-wisp" />
                  <span className="battle-trainer__smoke-wisp" />
                  <span className="battle-trainer__smoke-wisp" />
                  <span className="battle-trainer__smoke-wisp" />
                  <span className="battle-trainer__smoke-plume" />
                </span>
                <span className="battle-trainer__red-eye" aria-hidden />
              </>
            )}
          </div>
        )}
        {ballThrow === 'enemy' && (
          <img
            className="battle-pokeball battle-pokeball--enemy"
            src={localItemSprite('poke-ball.png')}
            alt=""
            aria-hidden
            draggable={false}
          />
        )}
        {ballThrow === 'enemy-recall' && (
          <img
            className="battle-pokeball battle-pokeball--enemy-recall"
            src={localItemSprite('poke-ball.png')}
            alt=""
            aria-hidden
            draggable={false}
          />
        )}
        {ballBurst === 'enemy' && <span className="battle-ball-burst battle-ball-burst--enemy" aria-hidden />}
        {enemy && enemyVisible && (
          <div
            key={`enemy-battler-${enemyIndex}-${enemy.id}`}
            className={`gym-enemy__sprite-wrap battle-battler battle-battler--enemy${
              enemyTransformPhase ? ' gym-enemy__sprite-wrap--transforming' : ''
            }${enemyFainted ? ' battle-battler--faint' : ' battle-battler--appear'}`}
          >
            {enemyTransformPhase && (
              <span
                className={`gym-enemy__transform-flash gym-enemy__transform-flash--${enemyTransformPhase}`}
                aria-hidden
              />
            )}
            <HitFxOverlay hitFx={hitFx} side="enemy" />
            <img
              key={`enemy-gif-${enemy.id}-${enemyIndex}-${enemyShiny ? 's' : 'n'}-${enemyHasSub ? 'sub' : 'mon'}-${enemyTransformPhase ?? 'idle'}`}
              src={enemyBattleSrc(enemy, enemyShiny, enemyHasSub)}
              alt={enemyHasSub ? `${enemy.displayName}'s Substitute` : enemy.displayName}
              className={`gym-enemy__sprite gym-enemy__sprite--clickable${
                enemyHasSub ? ' gym-enemy__sprite--substitute' : ''
              }${
                enemy.id === MISSINGNO_ID && !enemyHasSub ? ' gym-enemy__sprite--missingno' : ''
              }${
                enemyTransformPhase ? ` gym-enemy__sprite--transform-${enemyTransformPhase}` : ''
              }${
                hitFx?.side === 'enemy' && hitFx.mode === 'damage' ? ' gym-enemy__sprite--hit-damage' : ''
              }${
                hitFx?.side === 'enemy' && hitFx.mode === 'status' ? ' gym-enemy__sprite--hit-status' : ''
              }${hitFx?.side === 'enemy' && hitFx.mode === 'buff' ? ' gym-enemy__sprite--hit-buff' : ''}`}
              title={`View ${enemy.displayName} details`}
              aria-label={`View ${enemy.displayName} details`}
              role="button"
              tabIndex={0}
              onClick={() => onEnemyClick(enemy)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEnemyClick(enemy);
                }
              }}
              onError={(e) => {
                const img = e.currentTarget;
                delete img.dataset.remoteFallback;
                if (enemyHasSub) {
                  imgFallback(e, remoteSubstituteGif());
                  return;
                }
                if (enemy.id === MISSINGNO_ID) {
                  img.src = MISSINGNO_SPRITE;
                  return;
                }
                battleGifOnError(e, enemy.id, enemy.sprite || PLACEHOLDER_SPRITE, enemyShiny);
              }}
            />
          </div>
        )}
      </div>

      <div className="battle-stage battle-stage--player">
        <div className="battle-platform battle-platform--near" style={platformStyle(player?.types)} aria-hidden>
          <span className="battle-platform__rim" />
          <span className="battle-platform__fill" />
        </div>
        {ballThrow === 'player' && (
          <img
            className="battle-pokeball battle-pokeball--player"
            src={localItemSprite('poke-ball.png')}
            alt=""
            aria-hidden
            draggable={false}
          />
        )}
        {ballThrow === 'player-recall' && (
          <img
            className="battle-pokeball battle-pokeball--player-recall"
            src={localItemSprite('poke-ball.png')}
            alt=""
            aria-hidden
            draggable={false}
          />
        )}
        {ballBurst === 'player' && <span className="battle-ball-burst battle-ball-burst--player" aria-hidden />}
        {player && playerVisible && (
          <div
            key={`player-battler-${player.caughtAt}-${player.id}`}
            className={`battle-battler battle-battler--player${
              playerFainted ? ' battle-battler--faint' : ' battle-battler--appear'
            }`}
          >
            <HitFxOverlay hitFx={hitFx} side="player" />
            <img
              key={`player-back-${player.id}-${player.caughtAt}-${playerShiny ? 's' : 'n'}-${playerHasSub ? 'sub' : 'mon'}`}
              src={
                playerHasSub
                  ? localSubstituteBackGif()
                  : player.id === MISSINGNO_ID
                    ? MISSINGNO_SPRITE
                    : remoteBattleBackGif(battlerShowdownName(player), playerShiny)
              }
              alt={
                playerHasSub
                  ? `${player.nickname ?? player.displayName}'s Substitute`
                  : (player.nickname ?? player.displayName)
              }
              className={`battle-player__sprite${
                playerHasSub ? ' battle-player__sprite--substitute' : ''
              }${
                player.id === MISSINGNO_ID && !playerHasSub ? ' battle-player__sprite--missingno' : ''
              }${
                hitFx?.side === 'player' && hitFx.mode === 'damage' ? ' gym-enemy__sprite--hit-damage' : ''
              }${
                hitFx?.side === 'player' && hitFx.mode === 'status' ? ' gym-enemy__sprite--hit-status' : ''
              }${hitFx?.side === 'player' && hitFx.mode === 'buff' ? ' gym-enemy__sprite--hit-buff' : ''}`}
              onError={(e) => {
                const img = e.currentTarget;
                if (playerHasSub) {
                  delete img.dataset.remoteFallback;
                  imgFallback(e, remoteSubstituteBackGif());
                  return;
                }
                if (player.id === MISSINGNO_ID) {
                  img.src = MISSINGNO_SPRITE;
                  return;
                }
                delete img.dataset.backFallback;
                battleBackGifOnError(e, {
                  id: player.id,
                  speciesName: player.name,
                  shiny: playerShiny,
                  staticFallback: player.sprite || PLACEHOLDER_SPRITE,
                });
              }}
            />
          </div>
        )}
      </div>

      {player && playerVisible && (
        <div className={`battle-hud-box battle-hud-box--player${playerFainted ? ' battle-hud-box--hidden' : ''}`}>
          <div className="battle-hud-box__top">
            <span className="battle-hud-box__name">{player.nickname ?? player.displayName}</span>
            <span className="battle-hud-box__level">Lv.{player.level}</span>
          </div>
          <div className="battle-hud-box__pips-row" aria-hidden>
            <span className="battle-hud-box__pips-spacer" />
          </div>
          <HpBar current={playerHp} max={playerMaxHp} />
          {hasVisibleBattleEffects(player.status, playerVolatiles) && (
            <div className="battle-hud-box__badges">
              <BattleEffectBadges
                status={player.status}
                volatiles={playerVolatiles}
                placement="battle-row"
              />
            </div>
          )}
          {hasVisibleStageChanges(playerStages) && (
            <div className="battle-hud-box__badges">
              <StageBadges stages={playerStages} placement="battle-row" />
            </div>
          )}
          <div className="battle-hud-box__types">
            {player.types.map((type) => (
              <TypeBadge key={type} type={type} size="sm" />
            ))}
          </div>
        </div>
      )}

      {damagePopup && (
        <span className={`battle-damage battle-damage--${damagePopup.side}`}>{damagePopup.text}</span>
      )}
    </div>
  );
}
