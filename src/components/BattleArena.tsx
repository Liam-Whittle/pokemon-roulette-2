import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { AnimatePresence } from 'framer-motion';
import { fetchPokemonBatch } from '../api/pokeapi';
import {
  buildActiveMoves,
  computeDamage,
  formatMovePowerDisplay,
  isFixedDamageMove,
  moveKey,
  rollHit,
} from '../data/moves';
import { calculateMoveDamage, resolveDamageHits } from '../data/battleArenaEffects';
import {
  applyVolatilesPatch,
  counterReleaseDamage,
  effectiveAccuracy,
  isCounterMove,
  mergeStageDelta,
  resolveCounterMove,
  resolvePostDamage,
  resolveStatusMove,
  volatilesPatchOnSleep,
  type StatStages,
  type StatusMoveResult,
} from '../data/battleMoveResolver';
import {
  clearBattleField,
  EMPTY_BATTLE_FIELD,
  initBattleHiddenPowerTypes,
  spikesChipDamage,
  type BattleField,
  type BattleWeather,
  type DelayedHit,
} from '../data/battleField';
import { isSunny, tickWeather, weatherLabel } from '../data/battleWeather';
import {
  canHitSemiInvulnerable,
  CHARGE_MOVE_SLUGS,
  chargeMoveMessage,
  confusionSelfDamagePower,
  DELAYED_ATTACK_SLUGS,
  getCrashDamage,
  getDamagingMoveFailReason,
  getMovePriority,
  HALF_HEAL_MOVES,
  isConfused,
  isCrashMove,
  isRolloutLocked,
  isSemiInvulnerableMove,
  pickRandomTransformTarget,
  buildTransformPatch,
  revertTransform,
  rollConfusionSelfHit,
  isSelfFaintMove,
  RECHARGE_MOVE_SLUGS,
  statusBlockedBySubstitute,
  storedMoveFromSlug,
  weatherResidualDamage,
  isWeatherResidualImmune,
  weatherBallType,
  WEATHER_HEAL_MOVES,
  type TransformSnapshot,
} from '../data/moveEffects';
import {
  absorbSubstituteHit,
  accumulateCounterDamage,
  clearMoveLocks,
  clearVolatiles,
  EMPTY_VOLATILES,
  endOfTurnProtectReset,
  hasSubstitute,
  isProtected,
  isSemiInvulnerable,
  isTaunted,
  isThrashLocked,
  isTrapped,
  tickVolatileTurns,
  volatilesOnSendOut,
  type BattleVolatiles,
} from '../data/battleVolatiles';
import {
  abilityAbsorbBoostDelta,
  abilityAbsorbMessage,
  abilityAfterBeingHit,
  abilityBlocksAttract,
  abilityBlocksExplosion,
  abilityBlocksFlinch,
  abilityBlocksIndirectDamage,
  abilityBlocksWeatherChip,
  abilityBouncesStatus,
  abilityExtraPpCost,
  abilityIgnoresSpikes,
  abilityIsProtean,
  abilityIsTruant,
  abilityLabel,
  abilityMovesLast,
  abilityNeverMisses,
  abilityOnContact,
  abilityOnContactAttack,
  abilityOnKnockOut,
  abilityOnSwitchOut,
  abilityPreventsStatDrop,
  abilityPriorityBonus,
  abilityRetaliateStatDrop,
  abilityRewriteStageDelta,
  abilitySleepTickCount,
  abilityStatusAccuracyCap,
  abilityTrapsFoe,
  COMMON_STEAL_ITEM_IDS,
  describeSwitchInAbility,
  forecastTypesForWeather,
  getMonAbility,
  isContactMove,
  isPickupStyleAbility,
  isStealAbility,
  pickupSkipsConsume,
  gluttonyShouldHeal,
  monHasAbility,
  partyHasAbility,
  partyHasAbilityAlive,
  pickStolenCommonItem,
  resolveEndOfTurnAbility,
  rollHoneyGather,
  shouldAutoImposter,
  stickyHoldBlocksSteal,
  weatherIsSuppressed,
} from '../data/abilities';
import { healFractionForMove, mergeFieldPatch } from '../utils/battleStatusApply';
import { getTypeEffectiveness, getEffectivenessChipLabel, getEffectivenessLabel, buildHitBattleMessage, hitTimesMessage, TYPE_COLORS } from '../data/typeChart';
import { applyRegionMoveType } from '../data/gen2MoveTypes';
import { SidePanel } from './SidePanel';
import { BattleFieldScene, type BallThrowSide, type TrainerSlideState } from './BattleFieldScene';
import { BattleVsIntro } from './BattleVsIntro';
import { isSelfStatusMove } from '../data/statusMoveTarget';
import { TypeBadge } from './TypeBadge';
import { ItemIcon } from './ItemIcon';
import { MagikarpSplashModal } from './MagikarpSplashModal';
import { HollowPurpleCinematic } from './HollowPurpleCinematic';
import { PokemonDetailModal } from './PokemonDetailModal';
import { useGameStore } from '../store/useGameStore';
import { playHitSfx, playPokemonBallSfx, playSfx, preloadBattleBallSfx } from '../utils/sound';
import { playClip, stopClips } from '../utils/music';
import { PokeCenterVisits } from './PokeDollar';
import { PLACEHOLDER_SPRITE, asset } from '../utils/asset';
import { imgFallback, remoteBadge } from '../utils/localAssets';
import { buildEnemyTeam } from '../utils/enemyMon';
import { currentHp, effectiveSpeed, getComputedStats, isFainted, maxHpForMon } from '../utils/stats';
import {
  canApplyStatus,
  createStatus,
  isAsleep,
  isFrozen,
  isFullyParalyzed,
  thawFromFireMove,
  tickSleep,
  tickStatusDamage,
  tryThaw,
  clearAllStatuses,
} from '../utils/status';
import { chaosOutcomeLabel } from '../multiplayer/chaosWheel';
import type { ChaosEffectId, SpectateBattleMove } from '../multiplayer/protocol';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { pickRandom, resolveRegionId } from '../data/pools';
import type { Badge, BattleContext, BattleMove, CaughtPokemon, GymLeader, PokemonData, StoredMove } from '../types/game';

interface BattleArenaProps {
  title: string;
  leader: GymLeader;
  onWin: () => void;
  onLose: () => void;
  winBadge?: Badge;
  finalVictory?: boolean;
  /** Which battle flow this is, for resume-after-refresh snapshots. */
  battleContext: import('../types/game').BattleContext;
  /** Elite Four stage index (0 for a Gym battle). */
  eliteStage?: number;
  /** Extra levels added on top of avg party scaling (e.g. Rival +2). */
  levelBonus?: number;
  /** Append one random regional enemy (Bigger = Better). Not used for Team Rocket. */
  appendExtraEnemy?: boolean;
  /** When false, defeat does not cost a life (Team Rocket). Default true. */
  loseLifeOnDefeat?: boolean;
  /** When false, defeat does not full-heal the party (Team Rocket). Default true. */
  healAllOnDefeat?: boolean;
  /** Called on defeat before returning to hub (e.g. restore HP snapshot, steal Pokémon). */
  onBeforeDefeatExit?: () => void;
  /**
   * Called when the player pays to flee (trainer / rival / Team Rocket).
   * Restore HP here; do not apply defeat penalties (e.g. Team Rocket steal).
   */
  onFlee?: () => void;
}

const PAID_FLEE_CONTEXTS = new Set<import('../types/game').BattleContext>([
  'trainer',
  'rival',
  'teamrocket',
]);
const FLEE_COST = 50;

type BattlePhase =
  | 'prep'
  | 'intro'
  | 'choose'
  | 'between'
  | 'forcedSwap'
  | 'victory'
  | 'result';

type PlayerAttackResult = 'enemy_fainted' | 'continue' | 'abort';
type PendingTurn = { kind: 'solar-charge' | 'hyper-recharge' | 'charge'; move: BattleMove };
type EnemyPendingTurn = { kind: 'solar-charge' | 'hyper-recharge' | 'charge'; move: StoredMove };

const ZERO_STAGES: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function introWait(ms: number): Promise<void> {
  return delay(prefersReducedMotion() ? Math.min(ms, 180) : ms);
}

function challengeLine(ctx: BattleContext, name: string): string {
  switch (ctx) {
    case 'gym':
      return `You are challenged by Gym Leader ${name}!`;
    case 'elite':
      return `You are challenged by ${name}!`;
    case 'rival':
      return `${name} wants to battle!`;
    case 'teamrocket':
      return `You are challenged by ${name}!`;
    case 'giovanni':
      return `${name} wants to battle!`;
    case 'trainer':
    default:
      return `You are challenged by ${name}!`;
  }
}

function pickEnemyMove(
  enemyMon: CaughtPokemon,
  volatiles: BattleVolatiles,
  lastSlug?: string | null,
): StoredMove | null {
  if (volatiles.encoreMoveSlug) {
    const encore = enemyMon.moves.find((m) => m.slug === volatiles.encoreMoveSlug);
    if (encore) return encore;
  }
  if (volatiles.thrashLock) {
    const thrash = enemyMon.moves.find((m) => m.slug === volatiles.thrashLock!.slug);
    if (thrash) return thrash;
  }
  if (volatiles.rolloutLock) {
    const rollout = enemyMon.moves.find((m) => m.slug === 'rollout');
    if (rollout) return rollout;
  }
  const pool = enemyMon.moves.filter((m) => {
    if (m.slug === volatiles.disabledMoveSlug) return false;
    if (volatiles.torment && lastSlug && m.slug === lastSlug) return false;
    if (isTaunted(volatiles) && m.category === 'status') return false;
    return true;
  });
  // Untransformed Ditto should open with Transform
  if (enemyMon.id === 132) {
    const transform = pool.find((m) => m.slug === 'transform');
    if (transform) return transform;
  }
  if (isAsleep(enemyMon.status)) {
    const sleeper = pool.find((m) => m.slug === 'snore' || m.slug === 'sleep-talk');
    if (sleeper) return sleeper;
  }
  const damaging = pool.filter((m) => m.category !== 'status' && m.power > 0);
  const picks = damaging.length > 0 ? damaging : pool;
  if (picks.length === 0) return null;
  return picks[Math.floor(Math.random() * picks.length)];
}

function applyExtendedStatusResult(
  result: StatusMoveResult,
  attackerIsPlayer: boolean,
  attacker: CaughtPokemon,
  defender: CaughtPokemon,
  attackerStages: StatStages,
  defenderStages: StatStages,
  setters: {
    setPlayerStages: (fn: (s: StatStages) => StatStages) => void;
    setEnemyStages: (fn: (s: StatStages) => StatStages) => void;
    setPlayerVolatiles: (fn: (v: BattleVolatiles) => BattleVolatiles) => void;
    setEnemyVolatiles: (fn: (v: BattleVolatiles) => BattleVolatiles) => void;
    patchPartyMember: (caughtAt: number, patch: Partial<CaughtPokemon>) => void;
    patchEnemy: (patch: Partial<CaughtPokemon>) => void;
    setEnemyTeam: (fn: (team: CaughtPokemon[]) => CaughtPokemon[]) => void;
    setPartyMemberStatus: (caughtAt: number, status: CaughtPokemon['status']) => void;
    restoreMemberPp: (caughtAt: number) => boolean;
    party: CaughtPokemon[];
  },
) {
  if (result.haze) {
    setters.setPlayerStages(() => ({ ...ZERO_STAGES }));
    setters.setEnemyStages(() => ({ ...ZERO_STAGES }));
  }
  if (result.copyFoeStages) {
    if (attackerIsPlayer) setters.setPlayerStages(() => ({ ...defenderStages }));
    else setters.setEnemyStages(() => ({ ...defenderStages }));
  }
  if (result.swapStages) {
    if (attackerIsPlayer) {
      setters.setPlayerStages(() => ({ ...defenderStages }));
      setters.setEnemyStages(() => ({ ...attackerStages }));
    } else {
      setters.setEnemyStages(() => ({ ...defenderStages }));
      setters.setPlayerStages(() => ({ ...attackerStages }));
    }
  }
  if (result.healPartyStatus) {
    if (attackerIsPlayer) {
      for (const mon of setters.party) setters.setPartyMemberStatus(mon.caughtAt, undefined);
    } else {
      setters.setEnemyTeam((team) => team.map((m) => ({ ...m, status: undefined })));
    }
  }
  if (result.restorePp) {
    if (attackerIsPlayer) setters.restoreMemberPp(attacker.caughtAt);
    else setters.patchEnemy({ pp: {} });
  }
  if (result.cutPpSlug) {
    const slug = result.cutPpSlug;
    const max = defender.moves.find((m) => m.slug === slug)?.maxPp ?? 0;
    const next = Math.max(0, (defender.pp?.[slug] ?? max) - 4);
    if (attackerIsPlayer) setters.patchEnemy({ pp: { ...(defender.pp ?? {}), [slug]: next } });
    else setters.patchPartyMember(defender.caughtAt, { pp: { ...(defender.pp ?? {}), [slug]: next } });
  }
  if (result.attackerTypes) {
    if (attackerIsPlayer) setters.patchPartyMember(attacker.caughtAt, { types: result.attackerTypes });
    else setters.patchEnemy({ types: result.attackerTypes });
  }
  if (result.attackerAbility) {
    if (attackerIsPlayer) setters.patchPartyMember(attacker.caughtAt, { ability: result.attackerAbility });
    else setters.patchEnemy({ ability: result.attackerAbility });
  }
  if (result.defenderAbility) {
    if (attackerIsPlayer) setters.patchEnemy({ ability: result.defenderAbility });
    else setters.patchPartyMember(defender.caughtAt, { ability: result.defenderAbility });
  }
  if (result.clearTrap) {
    if (attackerIsPlayer) setters.setPlayerVolatiles((v) => ({ ...v, trappedTurns: 0 }));
    else setters.setEnemyVolatiles((v) => ({ ...v, trappedTurns: 0 }));
  }
}

function defenseBlocksMove(
  slug: string,
  category: string,
  defenderVolatiles: BattleVolatiles,
): 'protect' | 'substitute' | null {
  if (isSelfStatusMove(slug)) return null;
  if (isProtected(defenderVolatiles)) return 'protect';
  if (category === 'status' && hasSubstitute(defenderVolatiles) && statusBlockedBySubstitute(slug)) {
    return 'substitute';
  }
  return null;
}

export function BattleArena({
  title,
  leader,
  onWin,
  onLose,
  winBadge,
  finalVictory = false,
  battleContext,
  eliteStage = 0,
  levelBonus = 0,
  appendExtraEnemy = false,
  loseLifeOnDefeat = true,
  healAllOnDefeat = true,
  onBeforeDefeatExit,
  onFlee,
}: BattleArenaProps) {
  const muted = useGameStore((s) => s.muted);
  const showTypeEffectiveness = useGameStore((s) => s.showTypeEffectiveness);
  const lives = useGameStore((s) => s.lives);
  const money = useGameStore((s) => s.money);
  const party = useGameStore((s) => s.party);
  const bag = useGameStore((s) => s.bag);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const spendMoney = useGameStore((s) => s.spendMoney);
  const loseLife = useGameStore((s) => s.loseLife);
  const earnBadge = useGameStore((s) => s.earnBadge);
  const addMoney = useGameStore((s) => s.addMoney);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const damagePartyMember = useGameStore((s) => s.damagePartyMember);
  const setActivePartyMember = useGameStore((s) => s.setActivePartyMember);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const useMovePp = useGameStore((s) => s.useMovePp);
  const setScreen = useGameStore((s) => s.setScreen);
  const saveBattleSnapshot = useGameStore((s) => s.saveBattleSnapshot);
  const clearBattleSnapshot = useGameStore((s) => s.clearBattleSnapshot);
  const setFullHealUsedInBattle = useGameStore((s) => s.setFullHealUsedInBattle);
  const resetFullHealBattle = useGameStore((s) => s.resetFullHealBattle);
  const fullHealUsedInBattle = useGameStore((s) => s.fullHealUsedInBattle);
  const grantXpAllPartyAndPc = useGameStore((s) => s.grantXpAllPartyAndPc);
  const markSeen = useGameStore((s) => s.markSeen);
  const trainer = useGameStore((s) => s.trainer);
  const battleRegion = useGameStore((s) => resolveRegionId(s.trainer?.region));

  const [enemyTeam, setEnemyTeam] = useState<CaughtPokemon[]>([]);
  const [enemySpeciesById, setEnemySpeciesById] = useState<Record<number, PokemonData>>({});
  const [loading, setLoading] = useState(true);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [enemyHp, setEnemyHpRaw] = useState(0);
  // Always-current mirror of enemyHp so effects that run within the same turn
  // (attack -> enemy attack -> end-of-turn status tick) don't read a stale
  // closure value and accidentally overwrite (heal) damage already dealt.
  const enemyHpRef = useRef(0);
  const commitEnemyHp = useCallback((hp: number) => {
    enemyHpRef.current = hp;
    setEnemyHpRaw(hp);
  }, []);
  const [phase, setPhase] = useState<BattlePhase>('prep');
  const [message, setMessage] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedEnemyDetail, setSelectedEnemyDetail] = useState<CaughtPokemon | null>(null);
  const [xAttackPhysical, setXAttackPhysical] = useState(false);
  const [xAttackSpecial, setXAttackSpecial] = useState(false);
  const [shake, setShake] = useState(false);
  const [critFlash, setCritFlash] = useState(false);
  const [hitFx, setHitFx] = useState<{
    side: 'player' | 'enemy';
    mode: 'damage' | 'status' | 'buff';
    type: string;
    id: number;
  } | null>(null);
  const hitFxIdRef = useRef(0);
  const [damagePopup, setDamagePopup] = useState<{ text: string; side: 'player' | 'enemy' } | null>(
    null,
  );
  const damagePopupTimerRef = useRef<number | null>(null);
  const [splashGag, setSplashGag] = useState<{ sprite: string; name: string } | null>(null);
  const [hollowPurple, setHollowPurple] = useState(false);
  const [playerPendingTurn, setPlayerPendingTurn] = useState<PendingTurn | null>(null);
  const [enemyPendingTurn, setEnemyPendingTurn] = useState<EnemyPendingTurn | null>(null);
  const [playerStages, setPlayerStages] = useState<StatStages>(ZERO_STAGES);
  const [enemyStages, setEnemyStages] = useState<StatStages>(ZERO_STAGES);
  const [playerVolatiles, setPlayerVolatilesRaw] = useState<BattleVolatiles>(EMPTY_VOLATILES);
  const [enemyVolatiles, setEnemyVolatilesRaw] = useState<BattleVolatiles>(EMPTY_VOLATILES);
  // Same-turn attacks must see Substitute/Protect immediately. React state from
  // this render is stale after the other battler already moved.
  const playerVolatilesRef = useRef(playerVolatiles);
  const enemyVolatilesRef = useRef(enemyVolatiles);
  const setPlayerVolatiles = useCallback((update: SetStateAction<BattleVolatiles>) => {
    const prev = playerVolatilesRef.current;
    const next = typeof update === 'function' ? update(prev) : update;
    playerVolatilesRef.current = next;
    setPlayerVolatilesRaw(next);
  }, []);
  const pickupUsedRef = useRef(new Set<number>());
  const gluttonyUsedRef = useRef(new Set<number>());
  const friskUsedRef = useRef(new Set<number>());
  const unburdenRef = useRef(new Set<number>());

  const resetCombatAbilityFlags = useCallback(() => {
    pickupUsedRef.current = new Set();
    gluttonyUsedRef.current = new Set();
    friskUsedRef.current = new Set();
    unburdenRef.current = new Set();
  }, []);

  const setEnemyVolatiles = useCallback((update: SetStateAction<BattleVolatiles>) => {
    const prev = enemyVolatilesRef.current;
    const next = typeof update === 'function' ? update(prev) : update;
    enemyVolatilesRef.current = next;
    setEnemyVolatilesRaw(next);
  }, []);
  const [transformSnapshot, setTransformSnapshot] = useState<TransformSnapshot | null>(null);
  const [enemyTransformPhase, setEnemyTransformPhase] = useState<'out' | 'in' | null>(null);
  const [playerLastMoveSlug, setPlayerLastMoveSlug] = useState<string | null>(null);
  const [enemyLastMoveSlug, setEnemyLastMoveSlug] = useState<string | null>(null);
  const [battleField, setBattleField] = useState<BattleField>(EMPTY_BATTLE_FIELD);
  const [showVsIntro, setShowVsIntro] = useState(false);
  const [trainerSlide, setTrainerSlide] = useState<TrainerSlideState>('hidden');
  const [enemyVisible, setEnemyVisible] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [ballThrow, setBallThrow] = useState<BallThrowSide>(null);
  const [ballBurst, setBallBurst] = useState<BallThrowSide>(null);
  const [enemyFaintAnim, setEnemyFaintAnim] = useState(false);
  const [playerFaintAnim, setPlayerFaintAnim] = useState(false);

  const logRef = useRef<HTMLDivElement | null>(null);
  const onMoveClickRef = useRef<(move: BattleMove) => Promise<void>>(async () => {});
  const enemyAttackRef = useRef<() => Promise<boolean>>(async () => false);
  const executePlayerSwitchRef = useRef<(caughtAt: number) => Promise<void>>(async () => {});
  const resolveTurnRef = useRef<(move: BattleMove, hostUsedAttack: boolean) => Promise<void>>(async () => {});
  const pendingAutoRunRef = useRef(false);
  const thrashAutoRunRef = useRef<string | null>(null);
  const counterReleaseRef = useRef(false);
  /** True when a faint ended the turn before end-of-turn effects ran (Gen V+ forced swap). */
  const pendingEndOfTurnRef = useRef(false);
  /** Explosion / Self-Destruct KO'd both sides: send the next foe after the player replaces. */
  const pendingEnemyAdvanceRef = useRef(false);
  /** Bumped on each send-out so leftover HP writes cannot KO the next Pokémon. */
  const enemyGenRef = useRef(0);
  const continueNextLockRef = useRef(false);
  /** Set immediately on paid flee so in-flight turns cannot still hit the player. */
  const fledRef = useRef(false);
  const enemyMoveThisTurnRef = useRef<StoredMove | null>(null);
  const phaseRef = useRef<BattlePhase>(phase);
  phaseRef.current = phase;

  const mpConnected = useMultiplayerStore((s) => s.role === 'host' && s.connectionStatus === 'connected');
  const awaitingGuest = useMultiplayerStore((s) => s.awaitingGuest);
  const outcome = useMultiplayerStore((s) => s.outcome);
  const xAttackAllActive = useMultiplayerStore((s) => s.xAttackAllActive);

  const say = useCallback((msg: string) => {
    setMessage(msg);
    setLog((prev) => [...prev, msg]);
  }, []);

  const enemy = enemyTeam[enemyIndex] ?? null;
  const enemyMaxHp = enemy ? maxHpForMon(enemy) : 0;
  const activeMember = party[0];
  const guestControlsActive = !!(
    mpConnected &&
    activeMember?.guestOwned &&
    !activeMember.guestLocked &&
    activeMember &&
    !isFainted(activeMember)
  );
  const hostInputLocked =
    guestControlsActive || awaitingGuest != null || !!outcome;

  const xAttackItem = bag.find((item) => item.id === 'xattack');
  const xAttackCount = xAttackItem?.quantity ?? 0;

  const activeMoves = useMemo(
    () => (activeMember ? buildActiveMoves(activeMember) : []),
    [activeMember],
  );

  const hasUsablePokemon = party.some((m) => !isFainted(m));
  const hasBenchSwitch = party.some((m, i) => i !== 0 && !isFainted(m) && !m.guestLocked);

  const hasAnyPpMove = activeMoves.some((m) => m.currentPp > 0);

  const patchEnemy = useCallback(
    (patch: Partial<CaughtPokemon>) => {
      setEnemyTeam((prev) =>
        prev.map((m, i) => (i === enemyIndex ? { ...m, ...patch } : m)),
      );
    },
    [enemyIndex],
  );

  const setPartyMemberStatus = useCallback((caughtAt: number, status: CaughtPokemon['status']) => {
    useGameStore.setState((s) => ({
      party: s.party.map((m) => (m.caughtAt === caughtAt ? { ...m, status } : m)),
    }));
  }, []);

  const patchPartyMember = useCallback((caughtAt: number, patch: Partial<CaughtPokemon>) => {
    useGameStore.setState((s) => ({
      party: s.party.map((m) => (m.caughtAt === caughtAt ? { ...m, ...patch } : m)),
    }));
  }, []);

  const applyForecastToField = useCallback(
    (weather: BattleWeather) => {
      const partyNow = useGameStore.getState().party;
      const suppressed = weatherIsSuppressed([
        getMonAbility(partyNow[0]),
        getMonAbility(enemyTeam[enemyIndex] ?? enemy),
      ]);
      const types = forecastTypesForWeather(weather, suppressed);
      for (const m of partyNow) {
        if (m.id === 351 && monHasAbility(m, 'forecast')) {
          patchPartyMember(m.caughtAt, { types });
        }
      }
      setEnemyTeam((team) =>
        team.map((m) => (m.id === 351 && monHasAbility(m, 'forecast') ? { ...m, types } : m)),
      );
    },
    [enemy, enemyIndex, enemyTeam, patchPartyMember],
  );

  const tryImposterCopy = useCallback(
    (user: CaughtPokemon, foe: CaughtPokemon | null, side: 'player' | 'enemy') => {
      if (!shouldAutoImposter(user) || !foe || foe.id === user.id) return;
      const { patch, snapshot } = buildTransformPatch(user, foe);
      say(`${user.displayName}'s Imposter copied ${foe.displayName}!`);
      if (side === 'player') {
        patchPartyMember(user.caughtAt, patch);
        setTransformSnapshot(snapshot);
      } else {
        setEnemyTeam((team) =>
          team.map((m) => (m.caughtAt === user.caughtAt ? { ...m, ...patch } : m)),
        );
        setEnemyTransformPhase('in');
      }
    },
    [patchPartyMember, say],
  );

  const applyIncomingAbility = useCallback(
    (incoming: CaughtPokemon, foe: CaughtPokemon | null, side: 'player' | 'enemy') => {
      const foeStats = foe ? getComputedStats(foe) : undefined;
      const switchIn = describeSwitchInAbility(getMonAbility(incoming), incoming.displayName, {
        selfTypes: incoming.types,
        region: battleRegion,
        foe,
        foeDefense: foeStats?.defense,
        foeSpDefense: foeStats?.specialDefense,
      });
      for (const msg of switchIn.messages) say(msg);
      if (switchIn.weather) {
        setBattleField((f) => ({ ...f, weather: switchIn.weather!, weatherTurns: 5 }));
        applyForecastToField(switchIn.weather);
      }
      if (switchIn.intimidate && foe) {
        const foeAbility = getMonAbility(foe);
        if (!abilityPreventsStatDrop(foeAbility, 'atk')) {
          const drop = abilityRewriteStageDelta(foeAbility, { atk: -1 });
          const applyFoe = side === 'enemy' ? setPlayerStages : setEnemyStages;
          applyFoe((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...drop }));
          const retaliate = abilityRetaliateStatDrop(foeAbility, (drop.atk ?? 0) < 0);
          if (retaliate) {
            applyFoe((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...retaliate }));
            say(`${foe.displayName}'s ${abilityLabel(foeAbility)} raised its stats!`);
          }
        }
      }
      if (switchIn.download) {
        const applySelf = side === 'player' ? setPlayerStages : setEnemyStages;
        applySelf((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...switchIn.download }));
      }
      if (switchIn.tracedAbility) {
        if (side === 'player') {
          patchPartyMember(incoming.caughtAt, { ability: switchIn.tracedAbility });
        } else {
          setEnemyTeam((team) =>
            team.map((m) => (m.caughtAt === incoming.caughtAt ? { ...m, ability: switchIn.tracedAbility } : m)),
          );
        }
      }
      applyForecastToField(switchIn.weather ?? battleField.weather);
    },
    [applyForecastToField, battleField.weather, battleRegion, patchPartyMember, say],
  );

  const tryCombatSteal = useCallback(
    (attacker: CaughtPokemon, defender: CaughtPokemon | null, attackerSide: 'player' | 'enemy') => {
      if (!isStealAbility(getMonAbility(attacker)) || friskUsedRef.current.has(attacker.caughtAt)) return;
      if (stickyHoldBlocksSteal(getMonAbility(defender))) {
        say(`${defender?.displayName ?? 'The foe'}'s Sticky Hold kept its items safe!`);
        friskUsedRef.current.add(attacker.caughtAt);
        return;
      }
      if (attackerSide === 'player') {
        const stolen = pickStolenCommonItem([...COMMON_STEAL_ITEM_IDS]);
        if (!stolen) return;
        friskUsedRef.current.add(attacker.caughtAt);
        useGameStore.getState().addItem(stolen, 1);
        say(`${attacker.displayName} stole an item!`);
        return;
      }
      const bag = useGameStore.getState().bag;
      const stolen = pickStolenCommonItem(bag.flatMap((item) => Array(item.quantity).fill(item.id)));
      if (!stolen) return;
      if (!useGameStore.getState().consumeItem(stolen, 1)) return;
      friskUsedRef.current.add(attacker.caughtAt);
      say(`${attacker.displayName} stole an item!`);
    },
    [say],
  );

  const tryGluttonyHeal = useCallback(
    (mon: CaughtPokemon | null, side: 'player' | 'enemy') => {
      if (!mon) return;
      const hp = side === 'player' ? currentHp(mon) : enemyHpRef.current;
      const max = maxHpForMon(mon);
      if (!gluttonyShouldHeal(getMonAbility(mon), hp, max, gluttonyUsedRef.current.has(mon.caughtAt))) return;
      gluttonyUsedRef.current.add(mon.caughtAt);
      const heal = Math.round(max / 2);
      if (side === 'player') {
        useGameStore.getState().healPartyMember(mon.caughtAt, heal);
      } else {
        const next = Math.min(max, enemyHpRef.current + heal);
        commitEnemyHp(next);
        patchEnemy({ hp: next });
      }
      say(`${mon.displayName}'s Gluttony restored its HP!`);
    },
    [commitEnemyHp, patchEnemy, say],
  );

  const revertActiveTransformIfNeeded = useCallback(() => {
    const outgoing = useGameStore.getState().party[0];
    if (outgoing && transformSnapshot) {
      patchPartyMember(outgoing.caughtAt, revertTransform(outgoing, transformSnapshot));
      setTransformSnapshot(null);
    }
  }, [patchPartyMember, transformSnapshot]);

  // Load the enemy team once per leader. This must NOT depend on party state,
  // otherwise taking damage would re-run it and reset the enemy's HP/index.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const enemyIds = leader.pokemon.map((p) => p.id);
    const partyAtBattleStart = useGameStore.getState().party;
    const avgPartyLevel =
      partyAtBattleStart.length > 0
        ? Math.round(
            partyAtBattleStart.reduce((sum, member) => sum + member.level, 0) / partyAtBattleStart.length,
          )
        : null;
    const eliteBonus = leader.id === 'champion' ? 5 : 2;
    const contextBonus =
      (battleContext === 'elite' ? eliteBonus : 0) +
      (battleContext === 'rival' ? 2 : 0) +
      levelBonus;
    const scaledLevel =
      avgPartyLevel == null
        ? null
        : Math.max(1, Math.min(100, avgPartyLevel + contextBonus));
    const load = async () => {
      let ids = [...enemyIds];
      if (appendExtraEnemy && battleContext !== 'teamrocket') {
        const { getRegionAllPokemonPool } = await import('../data/pools');
        const pool = getRegionAllPokemonPool(battleRegion);
        const extra = pool[Math.floor(Math.random() * pool.length)];
        if (extra != null) ids = [...ids, extra];
      }
      const speciesData = await fetchPokemonBatch(ids);
      if (!active) return;
      const speciesMap: Record<number, PokemonData> = {};
      for (const species of speciesData) {
        speciesMap[species.id] = species;
      }
      setEnemySpeciesById(speciesMap);
      const teamLevels =
        scaledLevel == null
          ? ids.map((_, i) => leader.pokemon[i]?.level ?? 10)
          : ids.map(() => scaledLevel);
      const team = buildEnemyTeam(speciesData, teamLevels);
      setEnemyTeam(team);

      const snap = useGameStore.getState().battleSnapshot;
      const canResume =
        !!snap &&
        snap.context === battleContext &&
        snap.leaderId === leader.id &&
        snap.eliteStage === eliteStage;

      const startFresh = () => {
        setEnemyIndex(0);
        commitEnemyHp(team[0] ? maxHpForMon(team[0]) : 0);
        setXAttackPhysical(false);
        setXAttackSpecial(false);
        setPlayerPendingTurn(null);
        setEnemyPendingTurn(null);
        setPlayerStages(ZERO_STAGES);
        setEnemyStages(ZERO_STAGES);
        setPlayerVolatiles(volatilesOnSendOut());
        setEnemyVolatiles(volatilesOnSendOut());
        setTransformSnapshot(null);
        setPlayerLastMoveSlug(null);
        setEnemyLastMoveSlug(null);
        setBattleField({
          ...clearBattleField(),
          hiddenPowerTypes: initBattleHiddenPowerTypes(useGameStore.getState().party, team),
        });
        setPhase('prep');
        setMessage('');
        setLog([]);
        setProcessing(false);
        setShowVsIntro(false);
        setTrainerSlide('hidden');
        setEnemyVisible(false);
        setPlayerVisible(false);
        setBallThrow(null);
        setBallBurst(null);
        setEnemyFaintAnim(false);
        setPlayerFaintAnim(false);
        if (battleContext === 'gym' || eliteStage === 0) resetFullHealBattle();
      };

      if (canResume && snap) {
        let idx = snap.enemyIndex;
        let hp = snap.enemyHp;
        if (hp <= 0) {
          idx += 1;
          hp = maxHpForMon(team[idx] ?? team[0]);
        }
        if (idx >= team.length) {
          startFresh();
        } else {
          setEnemyIndex(idx);
          commitEnemyHp(hp);
          setLog(snap.log);
          setFullHealUsedInBattle(snap.fullHealUsed);
          setXAttackPhysical(!!snap.xAttackPhysical);
          setXAttackSpecial(!!snap.xAttackSpecial);
          setPlayerStages(snap.playerStages ?? ZERO_STAGES);
          setEnemyStages(snap.enemyStages ?? ZERO_STAGES);
          setPlayerVolatiles(snap.playerVolatiles ?? clearVolatiles());
          setEnemyVolatiles(snap.enemyVolatiles ?? clearVolatiles());
          setTransformSnapshot(snap.transformSnapshot ?? null);
          setPlayerLastMoveSlug(snap.playerLastMoveSlug ?? null);
          setEnemyLastMoveSlug(snap.enemyLastMoveSlug ?? null);
          setBattleField(
            snap.battleField ?? {
              ...clearBattleField(),
              hiddenPowerTypes: initBattleHiddenPowerTypes(useGameStore.getState().party, team),
            },
          );
          setPhase(
            snap.phase === 'choose' ||
              snap.phase === 'prep' ||
              snap.phase === 'between' ||
              snap.phase === 'forcedSwap'
              ? snap.phase
              : 'choose',
          );
          if (snap.message) setMessage(snap.message);
          setShowVsIntro(false);
          setTrainerSlide('hidden');
          setEnemyVisible(true);
          setPlayerVisible(true);
          setBallThrow(null);
          setBallBurst(null);
          setEnemyFaintAnim(false);
          setPlayerFaintAnim(false);
          const active = useGameStore.getState().party[0];
          if (snap.playerPendingTurn && active) {
            const pendingMove = active.moves.find((m) => m.slug === snap.playerPendingTurn!.slug);
            if (pendingMove) {
              setPlayerPendingTurn({
                kind: snap.playerPendingTurn.kind,
                move: {
                  ...pendingMove,
                  ownerCaughtAt: active.caughtAt,
                  ownerDisplayName: active.nickname ?? active.displayName,
                  fromActive: true,
                  currentPp: active.pp?.[pendingMove.slug] ?? pendingMove.maxPp,
                  maxPp: pendingMove.maxPp,
                },
              });
            }
          } else {
            setPlayerPendingTurn(null);
          }
          const resumedEnemy = team[idx];
          if (snap.enemyPendingTurn && resumedEnemy) {
            const pendingMove = resumedEnemy.moves.find((m) => m.slug === snap.enemyPendingTurn!.slug);
            if (pendingMove) {
              setEnemyPendingTurn({ kind: snap.enemyPendingTurn.kind, move: pendingMove });
            }
          } else {
            setEnemyPendingTurn(null);
          }
          const resumed = team[idx];
          const resumedSpecies = resumed ? speciesMap[resumed.id] : null;
          if (resumedSpecies) markSeen(resumedSpecies);
        }
      } else {
        startFresh();
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    leader,
    battleContext,
    eliteStage,
    levelBonus,
    appendExtraEnemy,
    battleRegion,
    resetFullHealBattle,
    setFullHealUsedInBattle,
    markSeen,
    commitEnemyHp,
  ]);

  useEffect(() => {
    if (loading || phase === 'victory' || phase === 'result') return;
    saveBattleSnapshot({
      context: battleContext,
      leaderId: leader.id,
      eliteStage,
      enemyIndex,
      enemyHp,
      fullHealUsed: fullHealUsedInBattle,
      xAttackPhysical,
      xAttackSpecial,
      log,
      phase: phase === 'intro' ? 'choose' : phase,
      battleField,
      playerVolatiles,
      enemyVolatiles,
      playerStages,
      enemyStages,
      transformSnapshot,
      playerPendingTurn: playerPendingTurn
        ? { kind: playerPendingTurn.kind, slug: playerPendingTurn.move.slug }
        : null,
      enemyPendingTurn: enemyPendingTurn
        ? { kind: enemyPendingTurn.kind, slug: enemyPendingTurn.move.slug }
        : null,
      playerLastMoveSlug,
      enemyLastMoveSlug,
      message,
    });
  }, [
    loading,
    phase,
    enemyIndex,
    enemyHp,
    log,
    fullHealUsedInBattle,
    xAttackPhysical,
    xAttackSpecial,
    battleContext,
    eliteStage,
    leader.id,
    saveBattleSnapshot,
    battleField,
    playerVolatiles,
    enemyVolatiles,
    playerStages,
    enemyStages,
    transformSnapshot,
    playerPendingTurn,
    enemyPendingTurn,
    playerLastMoveSlug,
    enemyLastMoveSlug,
    message,
  ]);

  useEffect(() => () => stopClips(), []);

  useEffect(() => {
    preloadBattleBallSfx();
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // When the player reorders their party during prep/between (a plain slot swap
  // rather than a battle send-out), the incoming active Pokémon must not inherit
  // the previous mon's volatiles (confusion/leech/trap) or stat stages.
  const activeCaughtAtRef = useRef<number | null>(party[0]?.caughtAt ?? null);
  useEffect(() => {
    const activeCaughtAt = party[0]?.caughtAt ?? null;
    if (activeCaughtAt === activeCaughtAtRef.current) return;
    activeCaughtAtRef.current = activeCaughtAt;
    if (phase === 'prep' || phase === 'between') {
      setPlayerStages(ZERO_STAGES);
      setPlayerVolatiles(volatilesOnSendOut());
    }
  }, [party, phase]);

  const sendOutNextEnemy = useCallback(
    (index: number, team: CaughtPokemon[], options?: { silent?: boolean }) => {
      const mon = team[index];
      if (!mon) return;
      const max = maxHpForMon(mon);
      let hp = max;
      if (battleField.spikesActive && !abilityIgnoresSpikes(getMonAbility(mon), mon.types)) {
        const chip = spikesChipDamage(max, mon.types, getMonAbility(mon));
        hp = Math.max(1, max - chip);
        if (chip > 0) {
          say(`Spikes dug into ${mon.displayName}!`);
        }
      }

      const finalMon: CaughtPokemon = { ...mon, status: undefined, hp };

      enemyGenRef.current += 1;
      pendingEnemyAdvanceRef.current = false;
      setEnemyIndex(index);
      commitEnemyHp(hp);
      setXAttackPhysical(false);
      setXAttackSpecial(false);
      setEnemyPendingTurn(null);
      setEnemyStages(ZERO_STAGES);
      setEnemyVolatiles(volatilesOnSendOut());
      setEnemyLastMoveSlug(null);
      setEnemyTransformPhase(null);
      setEnemyFaintAnim(false);
      setEnemyTeam((prev) => prev.map((m, i) => (i === index ? finalMon : m)));
      const species = enemySpeciesById[finalMon.id] ?? enemySpeciesById[mon.id];
      if (species) markSeen(species);
      if (!options?.silent) {
        say(`${leader.name} sent out ${mon.displayName}!`);
        playSfx('battle', muted);
      }
      const playerLead = useGameStore.getState().party[0];
      applyIncomingAbility(finalMon, playerLead ?? null, 'enemy');
      tryImposterCopy(finalMon, playerLead ?? null, 'enemy');
    },
    [applyIncomingAbility, battleField.spikesActive, commitEnemyHp, enemySpeciesById, leader.name, markSeen, muted, say],
  );

  const animateEnemySendOut = useCallback(
    async (mon: CaughtPokemon, options?: { announce?: boolean }) => {
      setEnemyFaintAnim(false);
      setEnemyVisible(false);
      setBallBurst(null);
      setBallThrow('enemy');
      const audioDone = playPokemonBallSfx('out', muted);
      await introWait(590);
      setBallThrow(null);
      setBallBurst('enemy');
      setEnemyVisible(true);
      if (options?.announce !== false) {
        say(`${leader.name} sent out ${mon.displayName}!`);
      }
      await introWait(170);
      setBallBurst(null);
      // Hold until pokemon_out has faded and stopped (not the full file tail).
      await audioDone;
    },
    [leader.name, muted, say],
  );

  const animatePlayerRecall = useCallback(async () => {
    setBallBurst(null);
    setBallThrow('player-recall');
    const audioDone = playPokemonBallSfx('return', muted);
    await introWait(430);
    setPlayerVisible(false);
    setBallThrow(null);
    await audioDone;
  }, [muted]);

  const animatePlayerSendOut = useCallback(
    async (mon: CaughtPokemon, options?: { announce?: boolean }) => {
      setPlayerFaintAnim(false);
      setPlayerVisible(false);
      setBallBurst(null);
      setBallThrow('player');
      const audioDone = playPokemonBallSfx('out', muted);
      await introWait(590);
      setBallThrow(null);
      setBallBurst('player');
      setPlayerVisible(true);
      if (options?.announce !== false) {
        say(`Go, ${mon.nickname ?? mon.displayName}!`);
      }
      await introWait(170);
      setBallBurst(null);
      await audioDone;
    },
    [muted, say],
  );

  const runFieldIntro = useCallback(async () => {
    const currentEnemy = enemyTeam[enemyIndex] ?? enemyTeam[0];
    const playerMon = useGameStore.getState().party[0];
    setEnemyVisible(false);
    setPlayerVisible(false);
    setEnemyFaintAnim(false);
    setPlayerFaintAnim(false);

    setTrainerSlide('enter');
    say(challengeLine(battleContext, leader.name));
    await introWait(650);
    setTrainerSlide('present');
    await introWait(850);

    if (currentEnemy) {
      await animateEnemySendOut(currentEnemy, { announce: true });
    }

    setTrainerSlide('exit');
    await introWait(520);
    setTrainerSlide('hidden');

    if (playerMon && !isFainted(playerMon)) {
      await animatePlayerSendOut(playerMon, { announce: true });
      const lead = useGameStore.getState().party[0] ?? playerMon;
      applyIncomingAbility(lead, currentEnemy ?? null, 'player');
      tryImposterCopy(lead, currentEnemy ?? null, 'player');
    } else {
      setPlayerVisible(true);
    }

    if (!fledRef.current) {
      setPhase('choose');
      setProcessing(false);
    }
  }, [
    animateEnemySendOut,
    animatePlayerSendOut,
    applyIncomingAbility,
    battleContext,
    enemyIndex,
    enemyTeam,
    leader.name,
    say,
  ]);

  const onVsIntroDone = useCallback(() => {
    setShowVsIntro(false);
    void runFieldIntro();
  }, [runFieldIntro]);

  const startBattleIntro = useCallback(() => {
    resetCombatAbilityFlags();
    sendOutNextEnemy(0, enemyTeam, { silent: true });
    setPhase('intro');
    setProcessing(true);
    setShowVsIntro(true);
    setTrainerSlide('hidden');
    setEnemyVisible(false);
    setPlayerVisible(false);
  }, [enemyTeam, resetCombatAbilityFlags, sendOutNextEnemy]);

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  };

  const triggerHitFx = useCallback(
    (side: 'player' | 'enemy', mode: 'damage' | 'status' | 'buff', type: string) => {
      const id = ++hitFxIdRef.current;
      setHitFx({ side, mode, type: type.toLowerCase(), id });
      window.setTimeout(() => {
        setHitFx((cur) => (cur?.id === id ? null : cur));
      }, mode === 'buff' ? 720 : mode === 'status' ? 700 : 520);
    },
    [],
  );

  const showDamage = (text: string, side: 'player' | 'enemy') => {
    setDamagePopup({ text, side });
    if (damagePopupTimerRef.current != null) window.clearTimeout(damagePopupTimerRef.current);
    damagePopupTimerRef.current = window.setTimeout(() => setDamagePopup(null), 700);
  };

  const moveTypeForFx = useCallback(
    (move: { slug: string; type: string }, ownerCaughtAt?: number) => {
      if (move.slug === 'hidden-power' && ownerCaughtAt != null) {
        return battleField.hiddenPowerTypes[ownerCaughtAt] ?? move.type;
      }
      return applyRegionMoveType(move.slug, move.type, battleRegion);
    },
    [battleField.hiddenPowerTypes, battleRegion],
  );

  const handlePartyWipe = useCallback(async () => {
    clearBattleSnapshot();
    setPhase('result');
    say('Your whole party fainted!');
    playSfx('fail', muted);
    onBeforeDefeatExit?.();
    let nextLives = lives;
    if (loseLifeOnDefeat) {
      nextLives = loseLife();
      if (healAllOnDefeat) reviveHealAllParty();
    }
    setLastResult({
      type: 'gym',
      success: false,
      message:
        !loseLifeOnDefeat
          ? `Team Rocket got away with one of your Pokémon!`
          : nextLives <= 0
            ? `You ran out of lives against ${leader.name}.`
            : `Your party was wiped. ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} remain.`,
    });
    await delay(1400);
    onLose();
  }, [
    clearBattleSnapshot,
    healAllOnDefeat,
    leader.name,
    lives,
    loseLife,
    loseLifeOnDefeat,
    muted,
    onBeforeDefeatExit,
    onLose,
    reviveHealAllParty,
    setLastResult,
    say,
  ]);

  const handleOutOfPp = useCallback(async () => {
    clearBattleSnapshot();
    setPhase('result');
    say('Your Pokémon are all out of PP and can no longer fight!');
    playSfx('fail', muted);
    onBeforeDefeatExit?.();
    let nextLives = lives;
    if (loseLifeOnDefeat) {
      nextLives = loseLife();
      if (healAllOnDefeat) reviveHealAllParty();
    }
    setLastResult({
      type: 'gym',
      success: false,
      message:
        !loseLifeOnDefeat
          ? `Team Rocket got away with one of your Pokémon!`
          : nextLives <= 0
            ? `You ran out of lives against ${leader.name}.`
            : `Out of PP against ${leader.name}! ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} remain.`,
    });
    await delay(1400);
    onLose();
  }, [
    clearBattleSnapshot,
    healAllOnDefeat,
    leader.name,
    lives,
    loseLife,
    loseLifeOnDefeat,
    muted,
    onBeforeDefeatExit,
    onLose,
    reviveHealAllParty,
    setLastResult,
    say,
  ]);

  const allowPaidFlee = PAID_FLEE_CONTEXTS.has(battleContext);
  const runAwayFree = partyHasAbility(party, 'run-away');
  const canAffordFlee = runAwayFree || money >= FLEE_COST;

  const handleFlee = useCallback(async () => {
    if (!allowPaidFlee || processing || fledRef.current) return;
    const playerLead = useGameStore.getState().party[0];
    if (
      !runAwayFree &&
      enemy &&
      playerLead &&
      abilityTrapsFoe(getMonAbility(enemy), playerLead.types, getMonAbility(playerLead))
    ) {
      say(`${enemy.displayName}'s ${abilityLabel(getMonAbility(enemy))} prevents escape!`);
      return;
    }
    if (!runAwayFree && money < FLEE_COST) {
      say(`You need ¥${FLEE_COST} to run away!`);
      return;
    }
    // Lock combat out before any await so a pending enemy turn cannot land.
    fledRef.current = true;
    setProcessing(true);
    setPhase('result');
    setDamagePopup(null);
    setShake(false);
    if (!runAwayFree && !spendMoney(FLEE_COST)) {
      fledRef.current = false;
      setProcessing(false);
      setPhase('choose');
      say(`You need ¥${FLEE_COST} to run away!`);
      return;
    }
    clearBattleSnapshot();
    say(runAwayFree ? 'Got away safely!' : `You paid ¥${FLEE_COST} and ran away!`);
    playSfx('fail', muted);
    onFlee?.();
    setLastResult({
      type: 'gym',
      success: false,
      message: runAwayFree
        ? `You fled from ${leader.name}.`
        : `You paid ¥${FLEE_COST} and fled from ${leader.name}.`,
    });
    await delay(1400);
    onLose();
  }, [
    allowPaidFlee,
    clearBattleSnapshot,
    leader.name,
    money,
    muted,
    onFlee,
    onLose,
    processing,
    runAwayFree,
    say,
    setLastResult,
    spendMoney,
  ]);

  useEffect(() => {
    if (phase !== 'choose' || processing) return;
    if (!hasUsablePokemon || hasAnyPpMove || hasBenchSwitch) return;
    handleOutOfPp();
  }, [phase, processing, hasUsablePokemon, hasAnyPpMove, hasBenchSwitch, handleOutOfPp]);

  const handleVictory = useCallback(async () => {
    if (transformSnapshot) {
      const active = useGameStore.getState().party[0];
      if (active) patchPartyMember(active.caughtAt, revertTransform(active, transformSnapshot));
      setTransformSnapshot(null);
    }
    clearBattleSnapshot();
    if (battleContext === 'gym') {
      grantXpAllPartyAndPc(300);
    } else if (battleContext === 'elite') {
      grantXpAllPartyAndPc(350);
    } else if (battleContext === 'teamrocket') {
      grantXpAllPartyAndPc(100);
    }
    if (battleContext === 'gym' && winBadge) {
      useGameStore.setState((s) => ({ party: clearAllStatuses(s.party) }));
    }
    if (winBadge) {
      earnBadge(winBadge);
      if (!finalVictory) addMoney(100);
    }
    if (partyHasAbility(useGameStore.getState().party, 'honey-gather') && rollHoneyGather()) {
      useGameStore.getState().addItem('honey', 1);
      say('Honey was gathered!');
    }
    setLastResult({
      type: 'gym',
      success: true,
      badge: winBadge,
      message: finalVictory
        ? `You defeated ${leader.name} and claimed the title!`
        : `You defeated ${leader.name}!`,
    });

    if (winBadge && !finalVictory) {
      playClip(asset('sounds/gym_victory.mp3'));
      setPhase('victory');
      say(`You won the ${leader.badgeName}!`);
      return;
    }

    // Modal battles play their own victory music — skip the short win SFX.
    if (
      battleContext !== 'teamrocket' &&
      battleContext !== 'trainer' &&
      battleContext !== 'rival' &&
      battleContext !== 'giovanni'
    ) {
      playSfx('win', muted);
    }
    setPhase('result');
    const victoryMessage = finalVictory
      ? 'Champion victory!'
      : leader.badgeName
        ? `${leader.badgeName} earned!`
        : `You defeated ${leader.name}!`;
    say(victoryMessage);
    await delay(1400);
    onWin();
  }, [
    addMoney,
    battleContext,
    clearBattleSnapshot,
    earnBadge,
    finalVictory,
    grantXpAllPartyAndPc,
    leader.badgeName,
    leader.name,
    muted,
    onWin,
    setLastResult,
    winBadge,
    patchPartyMember,
    transformSnapshot,
    say,
  ]);

  const advanceAfterEnemyFaint = useCallback(async () => {
    playSfx('win', muted);
    setEnemyFaintAnim(true);
    await introWait(700);
    // Petal Dance / Thrash / Rollout must not auto-continue into the next opponent.
    setPlayerVolatiles((v) => ({ ...clearMoveLocks(v), counterPending: undefined }));
    thrashAutoRunRef.current = null;
    counterReleaseRef.current = false;
    const nextIndex = enemyIndex + 1;
    if (nextIndex >= enemyTeam.length) {
      await handleVictory();
      return;
    }
    setPhase('between');
    const next = enemyTeam[nextIndex];
    say(
      `${enemy?.displayName ?? 'The Pokémon'} fainted! Up next: ${leader.name}'s ${next.displayName}. Swap if you need to, then continue.`,
    );
    await delay(900);
  }, [enemy?.displayName, enemyIndex, enemyTeam, handleVictory, leader.name, muted, say]);

  const faintEnemyFromSelfDestruct = useCallback(async (): Promise<true> => {
    const gen = enemyGenRef.current;
    patchEnemy({ hp: 0 });
    if (gen === enemyGenRef.current) commitEnemyHp(0);
    const updated = useGameStore.getState().party[0];
    if (!updated || isFainted(updated)) {
      const alive = useGameStore.getState().party.some((m) => !isFainted(m));
      if (!alive) {
        await handlePartyWipe();
        return true;
      }
      revertActiveTransformIfNeeded();
      pendingEndOfTurnRef.current = true;
      pendingEnemyAdvanceRef.current = true;
      setPhase('forcedSwap');
      setPlayerFaintAnim(true);
      say(`${updated?.nickname ?? updated?.displayName ?? 'Your Pokémon'} fainted! Choose a replacement.`);
      playSfx('fail', muted);
      return true;
    }
    await advanceAfterEnemyFaint();
    return true;
  }, [advanceAfterEnemyFaint, handlePartyWipe, muted, patchEnemy, revertActiveTransformIfNeeded, say]);

  const tickEndOfTurnStatus = useCallback(async () => {
    const playerVolatiles = playerVolatilesRef.current;
    const enemyVolatiles = enemyVolatilesRef.current;
    const player = useGameStore.getState().party[0];
    if (player && player.status) {
      const ticked = tickStatusDamage(player);
      if (ticked.damage !== 0) {
        useGameStore.setState((s) => ({
          party: s.party.map((m) => (m.caughtAt === player.caughtAt ? ticked.mon : m)),
        }));
        say(ticked.message);
        showDamage(`-${ticked.damage}`, 'player');
        await delay(900);
        const updated = useGameStore.getState().party[0];
        if (!updated || isFainted(updated)) {
          useGameStore.getState().recordFaint();
          const alive = useGameStore.getState().party.some((m) => !isFainted(m));
          if (!alive) {
            await handlePartyWipe();
            return;
          }
          revertActiveTransformIfNeeded();
          setPhase('forcedSwap');
          setPlayerFaintAnim(true);
          say(`${updated?.nickname ?? updated?.displayName ?? 'Your Pokémon'} fainted! Choose a replacement.`);
          playSfx('fail', muted);
        }
      }
    }

    // Track the enemy's HP locally so each end-of-turn effect works off the
    // running value rather than a stale closure. We seed from enemyHpRef (which
    // is updated synchronously on every HP change) instead of the enemyHp state
    // captured in this callback's closure, otherwise damage dealt earlier this
    // turn would be "undone" when we re-apply status/DoT HP here.
    let currentEnemyHp = enemyHpRef.current;

    if (enemy?.status) {
      const ticked = tickStatusDamage({ ...enemy, hp: currentEnemyHp });
      if (ticked.damage !== 0) {
        currentEnemyHp = Math.max(0, currentEnemyHp - ticked.damage);
        commitEnemyHp(currentEnemyHp);
        patchEnemy({ hp: currentEnemyHp, status: ticked.mon.status });
        say(ticked.message);
        showDamage(`-${ticked.damage}`, 'enemy');
        await delay(900);
        if (currentEnemyHp <= 0) {
          await advanceAfterEnemyFaint();
        }
      }
    }

    setPlayerVolatiles((v) => tickVolatileTurns(v));
    setEnemyVolatiles((v) => tickVolatileTurns(v));

    setBattleField((field) => {
      const ticked = tickWeather(field.weather, field.weatherTurns);
      applyForecastToField(ticked.weather);
      return { ...field, weather: ticked.weather, weatherTurns: ticked.turns };
    });

    const playerAfterCurse = useGameStore.getState().party[0];
    if (playerAfterCurse && playerVolatiles.cursed && !isFainted(playerAfterCurse)) {
      const curseDmg = Math.max(1, Math.floor(maxHpForMon(playerAfterCurse) / 4));
      damagePartyMember(playerAfterCurse.caughtAt, curseDmg);
      say(`${playerAfterCurse.displayName} is afflicted by the curse!`);
      showDamage(`-${curseDmg}`, 'player');
      await delay(700);
    }
    if (enemy && enemyVolatiles.cursed && currentEnemyHp > 0) {
      const curseDmg = Math.max(1, Math.floor(maxHpForMon(enemy) / 4));
      currentEnemyHp = Math.max(0, currentEnemyHp - curseDmg);
      commitEnemyHp(currentEnemyHp);
      patchEnemy({ hp: currentEnemyHp });
      say(`${enemy.displayName} is afflicted by the curse!`);
      showDamage(`-${curseDmg}`, 'enemy');
      await delay(700);
      if (currentEnemyHp <= 0) await advanceAfterEnemyFaint();
    }

    const playerAfter = useGameStore.getState().party[0];
    if (playerAfter && playerVolatiles.leechSeeded && enemy && currentEnemyHp > 0) {
      const drain = Math.max(1, Math.floor(maxHpForMon(playerAfter) / 8));
      damagePartyMember(playerAfter.caughtAt, drain);
      currentEnemyHp = Math.min(maxHpForMon(enemy), currentEnemyHp + drain);
      commitEnemyHp(currentEnemyHp);
      patchEnemy({ hp: currentEnemyHp });
      say(`${playerAfter.displayName}'s health is sapped by Leech Seed!`);
      showDamage(`-${drain}`, 'player');
      await delay(700);
    }
    if (enemy && enemyVolatiles.leechSeeded && playerAfter && !isFainted(playerAfter) && currentEnemyHp > 0) {
      const drain = Math.max(1, Math.floor(maxHpForMon(enemy) / 8));
      currentEnemyHp = Math.max(0, currentEnemyHp - drain);
      commitEnemyHp(currentEnemyHp);
      patchEnemy({ hp: currentEnemyHp });
      useGameStore.getState().healPartyMember(playerAfter.caughtAt, drain);
      say(`Leech Seed sapped ${enemy.displayName}!`);
      showDamage(`-${drain}`, 'enemy');
      await delay(700);
      if (currentEnemyHp <= 0) await advanceAfterEnemyFaint();
    }

    const ingrainPlayer = useGameStore.getState().party[0];
    if (ingrainPlayer && playerVolatiles.ingrained && !isFainted(ingrainPlayer)) {
      const heal = Math.max(1, Math.floor(maxHpForMon(ingrainPlayer) / 16));
      useGameStore.getState().healPartyMember(ingrainPlayer.caughtAt, heal);
      say(`${ingrainPlayer.displayName} absorbed nutrients with its roots!`);
      await delay(500);
    }
    if (enemy && enemyVolatiles.ingrained && currentEnemyHp > 0) {
      const heal = Math.max(1, Math.floor(maxHpForMon(enemy) / 16));
      currentEnemyHp = Math.min(maxHpForMon(enemy), currentEnemyHp + heal);
      commitEnemyHp(currentEnemyHp);
      patchEnemy({ hp: currentEnemyHp });
      say(`${enemy.displayName} absorbed nutrients with its roots!`);
      await delay(500);
    }

    const nightmarePlayer = useGameStore.getState().party[0];
    if (
      nightmarePlayer &&
      playerVolatiles.nightmared &&
      isAsleep(nightmarePlayer.status) &&
      !isFainted(nightmarePlayer) &&
      !abilityBlocksIndirectDamage(getMonAbility(nightmarePlayer))
    ) {
      const drain = Math.max(1, Math.floor(maxHpForMon(nightmarePlayer) / 4));
      damagePartyMember(nightmarePlayer.caughtAt, drain);
      say(`${nightmarePlayer.displayName} is locked in a nightmare!`);
      showDamage(`-${drain}`, 'player');
      await delay(700);
    }
    if (
      enemy &&
      enemyVolatiles.nightmared &&
      isAsleep(enemy.status) &&
      currentEnemyHp > 0 &&
      !abilityBlocksIndirectDamage(getMonAbility(enemy))
    ) {
      const drain = Math.max(1, Math.floor(maxHpForMon(enemy) / 4));
      currentEnemyHp = Math.max(0, currentEnemyHp - drain);
      commitEnemyHp(currentEnemyHp);
      patchEnemy({ hp: currentEnemyHp });
      say(`${enemy.displayName} is locked in a nightmare!`);
      showDamage(`-${drain}`, 'enemy');
      await delay(700);
      if (currentEnemyHp <= 0) await advanceAfterEnemyFaint();
    }

    const weather = battleField.weather;
    const wxOff = weatherIsSuppressed([
      getMonAbility(useGameStore.getState().party[0]),
      getMonAbility(enemy),
    ]);
    if (!wxOff && (weather === 'hail' || weather === 'sandstorm')) {
      const playerWx = useGameStore.getState().party[0];
      if (
        playerWx &&
        !isFainted(playerWx) &&
        !abilityBlocksWeatherChip(getMonAbility(playerWx), weather) &&
        !isWeatherResidualImmune(playerWx.types, weather)
      ) {
        const chip = weatherResidualDamage(maxHpForMon(playerWx));
        damagePartyMember(playerWx.caughtAt, chip);
        say(`${playerWx.displayName} is buffeted by the ${weather}!`);
        showDamage(`-${chip}`, 'player');
        await delay(600);
      }
      if (
        enemy &&
        currentEnemyHp > 0 &&
        !abilityBlocksWeatherChip(getMonAbility(enemy), weather) &&
        !isWeatherResidualImmune(enemy.types, weather)
      ) {
        const chip = weatherResidualDamage(maxHpForMon(enemy));
        currentEnemyHp = Math.max(0, currentEnemyHp - chip);
        commitEnemyHp(currentEnemyHp);
        patchEnemy({ hp: currentEnemyHp });
        say(`${enemy.displayName} is buffeted by the ${weather}!`);
        showDamage(`-${chip}`, 'enemy');
        await delay(600);
        if (currentEnemyHp <= 0) await advanceAfterEnemyFaint();
      }
    }

    const applyEotAbility = async (side: 'player' | 'enemy') => {
      if (side === 'player') {
        const mon = useGameStore.getState().party[0];
        if (!mon || isFainted(mon)) return;
        const eot = resolveEndOfTurnAbility({
          ability: getMonAbility(mon),
          displayName: mon.displayName,
          weather,
          weatherSuppressed: wxOff,
          hasStatus: !!mon.status,
        });
        for (const msg of eot.messages) say(msg);
        if (eot.clearStatus) setPartyMemberStatus(mon.caughtAt, undefined);
        if (eot.healFraction) {
          const amount = Math.max(1, Math.floor(maxHpForMon(mon) * Math.abs(eot.healFraction)));
          if (eot.healFraction > 0) {
            useGameStore.getState().healPartyMember(mon.caughtAt, amount);
            showDamage(`+${amount}`, 'player');
          } else if (!abilityBlocksIndirectDamage(getMonAbility(mon))) {
            damagePartyMember(mon.caughtAt, amount);
            showDamage(`-${amount}`, 'player');
          }
          await delay(500);
        }
        if (eot.speedBoost) {
          setPlayerStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, spe: 1 }));
        }
        if (eot.moody) {
          setPlayerStages((s) =>
            mergeStageDelta(s, { ...ZERO_STAGES, [eot.moody!.plus]: 2, [eot.moody!.minus]: -1 }),
          );
        }
      } else if (enemy && currentEnemyHp > 0) {
        const eot = resolveEndOfTurnAbility({
          ability: getMonAbility(enemy),
          displayName: enemy.displayName,
          weather,
          weatherSuppressed: wxOff,
          hasStatus: !!enemy.status,
        });
        for (const msg of eot.messages) say(msg);
        if (eot.clearStatus) patchEnemy({ status: undefined });
        if (eot.healFraction) {
          const amount = Math.max(1, Math.floor(maxHpForMon(enemy) * Math.abs(eot.healFraction)));
          if (eot.healFraction > 0) {
            currentEnemyHp = Math.min(maxHpForMon(enemy), currentEnemyHp + amount);
            showDamage(`+${amount}`, 'enemy');
          } else if (!abilityBlocksIndirectDamage(getMonAbility(enemy))) {
            currentEnemyHp = Math.max(0, currentEnemyHp - amount);
            showDamage(`-${amount}`, 'enemy');
          }
          commitEnemyHp(currentEnemyHp);
          patchEnemy({ hp: currentEnemyHp });
          await delay(500);
          if (currentEnemyHp <= 0) await advanceAfterEnemyFaint();
        }
        if (eot.speedBoost) {
          setEnemyStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, spe: 1 }));
        }
        if (eot.moody) {
          setEnemyStages((s) =>
            mergeStageDelta(s, { ...ZERO_STAGES, [eot.moody!.plus]: 2, [eot.moody!.minus]: -1 }),
          );
        }
      }
    };
    await applyEotAbility('player');
    await applyEotAbility('enemy');

    const applyWish = async (side: 'player' | 'enemy', turns?: number) => {
      if ((turns ?? 0) !== 1) return;
      if (side === 'player') {
        const mon = useGameStore.getState().party[0];
        if (!mon || isFainted(mon)) return;
        const heal = Math.max(1, Math.floor(maxHpForMon(mon) / 2));
        useGameStore.getState().healPartyMember(mon.caughtAt, heal);
        say(`${mon.displayName}'s wish came true!`);
        await delay(600);
      } else if (enemy && currentEnemyHp > 0) {
        const heal = Math.max(1, Math.floor(maxHpForMon(enemy) / 2));
        currentEnemyHp = Math.min(maxHpForMon(enemy), currentEnemyHp + heal);
        commitEnemyHp(currentEnemyHp);
        patchEnemy({ hp: currentEnemyHp });
        say(`${enemy.displayName}'s wish came true!`);
        await delay(600);
      }
    };
    await applyWish('player', playerVolatiles.wishTurns);
    await applyWish('enemy', enemyVolatiles.wishTurns);

    const tickYawn = async (side: 'player' | 'enemy', turns?: number) => {
      if ((turns ?? 0) !== 1) return;
      if (side === 'player') {
        const mon = useGameStore.getState().party[0];
        if (!mon || isFainted(mon) || mon.status) return;
        if (!canApplyStatus(mon, 'sleep', weather, wxOff)) return;
        const sleep = createStatus('sleep');
        setPartyMemberStatus(mon.caughtAt, sleep);
        setPlayerVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
        say(`${mon.displayName} fell asleep!`);
        await delay(600);
      } else if (enemy && currentEnemyHp > 0 && !enemy.status && canApplyStatus(enemy, 'sleep', weather, wxOff)) {
        const sleep = createStatus('sleep');
        patchEnemy({ status: sleep });
        setEnemyVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
        say(`${enemy.displayName} fell asleep!`);
        await delay(600);
      }
    };
    await tickYawn('player', playerVolatiles.yawnTurns);
    await tickYawn('enemy', enemyVolatiles.yawnTurns);

    const tickPerish = async (side: 'player' | 'enemy', turns?: number) => {
      if (!turns || turns <= 0) return;
      const next = turns - 1;
      if (side === 'player') {
        const mon = useGameStore.getState().party[0];
        if (!mon || isFainted(mon)) return;
        say(`${mon.displayName}'s perish count fell to ${next}!`);
        await delay(500);
        if (next <= 0) {
          damagePartyMember(mon.caughtAt, maxHpForMon(mon));
          say(`${mon.displayName} succumbed to Perish Song!`);
        }
      } else if (enemy && currentEnemyHp > 0) {
        say(`${enemy.displayName}'s perish count fell to ${next}!`);
        await delay(500);
        if (next <= 0) {
          currentEnemyHp = 0;
          commitEnemyHp(0);
          patchEnemy({ hp: 0 });
          say(`${enemy.displayName} succumbed to Perish Song!`);
          await advanceAfterEnemyFaint();
        }
      }
    };
    await tickPerish('player', playerVolatiles.perishTurns);
    await tickPerish('enemy', enemyVolatiles.perishTurns);
    setPlayerVolatiles((v) => ({
      ...v,
      wishTurns: v.wishTurns && v.wishTurns > 0 ? v.wishTurns - 1 : undefined,
      yawnTurns: v.yawnTurns && v.yawnTurns > 0 ? v.yawnTurns - 1 : undefined,
      perishTurns: v.perishTurns && v.perishTurns > 0 ? v.perishTurns - 1 : undefined,
    }));
    setEnemyVolatiles((v) => ({
      ...v,
      wishTurns: v.wishTurns && v.wishTurns > 0 ? v.wishTurns - 1 : undefined,
      yawnTurns: v.yawnTurns && v.yawnTurns > 0 ? v.yawnTurns - 1 : undefined,
      perishTurns: v.perishTurns && v.perishTurns > 0 ? v.perishTurns - 1 : undefined,
    }));

    const pendingHits = [...(battleField.delayedHits ?? [])];
    const remainingHits: DelayedHit[] = [];
    for (const hit of pendingHits) {
      const nextTurns = hit.turnsLeft - 1;
      if (nextTurns > 0) {
        remainingHits.push({ ...hit, turnsLeft: nextTurns });
        continue;
      }
      say(`${hit.name} struck!`);
      if (hit.target === 'player') {
        const mon = useGameStore.getState().party[0];
        if (mon && !isFainted(mon)) {
          damagePartyMember(mon.caughtAt, hit.damage);
          showDamage(`-${hit.damage}`, 'player');
          await delay(700);
        }
      } else if (enemy && currentEnemyHp > 0) {
        currentEnemyHp = Math.max(0, currentEnemyHp - hit.damage);
        commitEnemyHp(currentEnemyHp);
        patchEnemy({ hp: currentEnemyHp });
        showDamage(`-${hit.damage}`, 'enemy');
        await delay(700);
        if (currentEnemyHp <= 0) await advanceAfterEnemyFaint();
      }
    }
    setBattleField((f) => ({ ...f, delayedHits: remainingHits }));

    setPlayerVolatiles((v) => endOfTurnProtectReset(v));
    setEnemyVolatiles((v) => endOfTurnProtectReset(v));

    if (partyHasAbilityAlive(useGameStore.getState().party, 'healer') && Math.random() < 0.3) {
      const active = useGameStore.getState().party[0];
      if (active?.status) {
        setPartyMemberStatus(active.caughtAt, undefined);
        say(`${active.displayName}'s status was cured by Healer!`);
        await delay(500);
      }
    }
    if (enemy && partyHasAbilityAlive(enemyTeam, 'healer') && Math.random() < 0.3 && enemy.status) {
      patchEnemy({ status: undefined });
      say(`${enemy.displayName}'s status was cured by Healer!`);
      await delay(500);
    }

    pendingEndOfTurnRef.current = false;
  }, [advanceAfterEnemyFaint, battleField.weatherTurns, damagePartyMember, enemy, enemyHp, enemyVolatiles, handlePartyWipe, muted, patchEnemy, playerVolatiles.cursed, playerVolatiles.leechSeeded, say]);

  const canAct = useCallback(
    (
      mon: CaughtPokemon,
      side: 'player' | 'enemy',
      volatiles: BattleVolatiles,
      chosenSlug?: string,
    ): { canAct: boolean; message?: string; statusAfter?: CaughtPokemon['status'] } => {
      if (isFainted(mon)) return { canAct: false };
      const setVol = side === 'player' ? setPlayerVolatiles : setEnemyVolatiles;
      if (volatiles.flinched) {
        setVol((v) => ({ ...v, flinched: false }));
        if (!abilityBlocksFlinch(getMonAbility(mon))) {
          if (monHasAbility(mon, 'steadfast')) {
            if (side === 'player') setPlayerStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, spe: 1 }));
            else setEnemyStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, spe: 1 }));
            say(`${mon.displayName}'s Steadfast raised its Speed!`);
          }
          return { canAct: false, message: `${mon.displayName} flinched!` };
        }
      }
      if (abilityIsTruant(getMonAbility(mon))) {
        if (volatiles.truantLoafing) {
          setVol((v) => ({ ...v, truantLoafing: false }));
          return { canAct: false, message: `${mon.displayName} is loafing around!` };
        }
        setVol((v) => ({ ...v, truantLoafing: true }));
      }
      if (isAsleep(mon.status)) {
        let after = tickSleep(mon.status!);
        if (after && abilitySleepTickCount(getMonAbility(mon)) > 1) {
          after = tickSleep(after);
        }
        if (side === 'player') setPartyMemberStatus(mon.caughtAt, after);
        else patchEnemy({ status: after });
        // Waking no longer grants a free attack. Snore and Sleep Talk can still be used while asleep.
        if (!after) {
          return { canAct: false, message: `${mon.displayName} woke up!`, statusAfter: undefined };
        }
        if (chosenSlug === 'snore' || chosenSlug === 'sleep-talk') {
          return { canAct: true, message: `${mon.displayName} is fast asleep!`, statusAfter: after };
        }
        return { canAct: false, message: `${mon.displayName} is fast asleep!`, statusAfter: after };
      }
      if (isFrozen(mon.status)) {
        const thawed = tryThaw(mon.status);
        if (thawed) {
          if (side === 'player') setPartyMemberStatus(mon.caughtAt, thawed);
          else patchEnemy({ status: thawed });
          return { canAct: false, message: `${mon.displayName} is frozen solid!`, statusAfter: thawed };
        }
        if (side === 'player') setPartyMemberStatus(mon.caughtAt, undefined);
        else patchEnemy({ status: undefined });
        return { canAct: true, message: `${mon.displayName} thawed out!`, statusAfter: undefined };
      }
      if (isFullyParalyzed(mon.status)) {
        return { canAct: false, message: `${mon.displayName} is fully paralyzed!` };
      }
      const mentalParty = side === 'player' ? useGameStore.getState().party : enemyTeam;
      if (partyHasAbilityAlive(mentalParty, 'telepathy')) {
        if (volatiles.confusionTurns > 0) {
          const setVol = side === 'player' ? setPlayerVolatiles : setEnemyVolatiles;
          setVol((v) => ({ ...v, confusionTurns: 0, infatuated: false }));
        }
      } else if (isConfused(volatiles)) {
        const setVol = side === 'player' ? setPlayerVolatiles : setEnemyVolatiles;
        const nextTurns = Math.max(0, volatiles.confusionTurns - 1);
        setVol((v) => ({ ...v, confusionTurns: nextTurns }));
        if (rollConfusionSelfHit()) {
          const selfDmg = computeDamage({
            movePower: confusionSelfDamagePower(),
            moveType: 'normal',
            category: 'physical',
            effectiveness: 1,
            attacker: mon,
            defender: mon,
            crit: false,
            attackMultiplier: 1,
            defenseMultiplier: 1,
          });
          if (side === 'player') {
            damagePartyMember(mon.caughtAt, selfDmg);
            showDamage(`-${selfDmg}`, 'player');
          } else {
            const newHp = Math.max(0, enemyHpRef.current - selfDmg);
            commitEnemyHp(newHp);
            patchEnemy({ hp: newHp });
            showDamage(`-${selfDmg}`, 'enemy');
          }
          return { canAct: false, message: `${mon.displayName} hurt itself in its confusion!` };
        }
        return { canAct: true, message: `${mon.displayName} is confused!` };
      }
      if (
        volatiles.infatuated &&
        !abilityBlocksAttract(getMonAbility(mon)) &&
        !partyHasAbilityAlive(side === 'player' ? useGameStore.getState().party : enemyTeam, 'telepathy') &&
        Math.random() < 0.5
      ) {
        return { canAct: false, message: `${mon.displayName} is immobilized by love!` };
      }
      return { canAct: true };
    },
    [damagePartyMember, enemyHp, patchEnemy, setPartyMemberStatus],
  );

  const executeEnemyAttack = useCallback(async (): Promise<boolean> => {
    if (fledRef.current || phaseRef.current === 'result' || phaseRef.current === 'victory') {
      return false;
    }
    if (!enemy) return false;
    const target = useGameStore.getState().party[0];
    if (!target || isFainted(target)) return false;

    const playerVolatiles = playerVolatilesRef.current;
    const enemyVolatiles = enemyVolatilesRef.current;

    if (enemyVolatiles.counterPending?.releaseNextTurn) {
      const pending = enemyVolatiles.counterPending;
      const counterDmg = counterReleaseDamage(pending);
      if (counterDmg > 0) {
        damagePartyMember(target.caughtAt, counterDmg);
        triggerShake();
        playHitSfx('physical', muted);
        showDamage(`-${counterDmg}`, 'player');
        say(`${leader.name}'s ${enemy.displayName} countered the attack!`);
        await delay(900);
      } else {
        say(`But it failed!`);
        await delay(600);
      }
      setEnemyVolatiles((v) => ({ ...v, counterPending: undefined }));
    }

    if (enemyPendingTurn?.kind === 'hyper-recharge') {
      setEnemyPendingTurn(null);
      say(`${leader.name}'s ${enemy.displayName} must recharge!`);
      await delay(900);
      return false;
    }

    const stored =
      enemyPendingTurn?.kind === 'solar-charge' || enemyPendingTurn?.kind === 'charge'
        ? enemyPendingTurn.move
        : enemyMoveThisTurnRef.current ?? pickEnemyMove(enemy, enemyVolatiles, enemyLastMoveSlug);
    if (!stored) return false;

    const actCheck = canAct(enemy, 'enemy', enemyVolatiles, stored.slug);
    if (actCheck.message) say(actCheck.message);
    if (!actCheck.canAct) return false;
    enemyMoveThisTurnRef.current = null;

    if (enemyPendingTurn?.kind === 'solar-charge' || enemyPendingTurn?.kind === 'charge') {
      setEnemyPendingTurn(null);
      setEnemyVolatiles((v) => ({ ...v, semiInvulnerable: undefined }));
      say(`${leader.name}'s ${enemy.displayName} unleashed ${stored.name}!`);
    } else if (stored.slug === 'solar-beam' && !isSunny(battleField.weather)) {
      setEnemyPendingTurn({ kind: 'solar-charge', move: stored });
      say(chargeMoveMessage(`${leader.name}'s ${enemy.displayName}`, stored.slug, stored.name));
      await delay(900);
      return false;
    } else if (CHARGE_MOVE_SLUGS.has(stored.slug)) {
      setEnemyPendingTurn({ kind: 'charge', move: stored });
      if (isSemiInvulnerableMove(stored.slug)) {
        setEnemyVolatiles((v) => ({ ...v, semiInvulnerable: stored.slug }));
      }
      say(chargeMoveMessage(`${leader.name}'s ${enemy.displayName}`, stored.slug, stored.name));
      await delay(900);
      return false;
    }

    setEnemyLastMoveSlug(stored.slug);

    if (isCounterMove(stored.slug)) {
      const counterResult = resolveCounterMove(stored.slug, `${leader.name}'s ${enemy.displayName}`, stored.name);
      for (const msg of counterResult.messages) say(msg);
      setEnemyVolatiles((v) => applyVolatilesPatch(v, counterResult.attackerVolatilesPatch));
      await delay(900);
      return false;
    }

    if (stored.slug === 'focus-punch' && enemyVolatiles.tookDamageThisTurn) {
      say(`${leader.name}'s ${enemy.displayName} lost its focus!`);
      await delay(900);
      return false;
    }
    if (isTaunted(enemyVolatiles) && stored.category === 'status') {
      say(`${leader.name}'s ${enemy.displayName} can't use ${stored.name} after the taunt!`);
      await delay(900);
      return false;
    }
    if (enemyVolatiles.torment && stored.slug === enemyLastMoveSlug) {
      say(`${leader.name}'s ${enemy.displayName} can't use ${stored.name} after the torment!`);
      await delay(900);
      return false;
    }
    const enemyFail = getDamagingMoveFailReason(stored.slug, {
      enteredThisTurn: enemyVolatiles.enteredThisTurn,
      asleep: isAsleep(enemy.status) || isAsleep(actCheck.statusAfter),
      stockpileCount: enemyVolatiles.stockpileCount,
    });
    if (enemyFail) {
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! ${enemyFail}`);
      await delay(900);
      return false;
    }

    // Fly / Dig charge turn: attacks against the user can't connect.
    if (
      isSemiInvulnerable(playerVolatiles) &&
      !isSelfStatusMove(stored.slug) &&
      !canHitSemiInvulnerable(stored.slug, playerVolatiles.semiInvulnerable)
    ) {
      say(
        `${leader.name}'s ${enemy.displayName} used ${stored.name}! ${target.nickname ?? target.displayName} avoided the attack!`,
      );
      playSfx('fail', muted);
      if (isSelfFaintMove(stored.slug)) {
        return faintEnemyFromSelfDestruct();
      }
      await delay(900);
      return false;
    }

    const rawAcc = effectiveAccuracy(stored.slug, stored.accuracy, enemyVolatiles, battleField.weather);
    const hitAccuracy = abilityNeverMisses(getMonAbility(enemy), getMonAbility(target))
      ? 100
      : Math.max(
          1,
          Math.min(
            100,
            abilityStatusAccuracyCap(
              stored.category === 'status' ? getMonAbility(target) : undefined,
              rawAcc,
            ) * (stageMult(enemyStages.acc) / stageMult(playerVolatiles.identified ? 0 : playerStages.eva)),
          ),
        );

    if (stored.category === 'status') {
      if (!rollHit(hitAccuracy)) {
        say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! But it missed!`);
        await delay(900);
        return false;
      }
      const blocked = defenseBlocksMove(stored.slug, stored.category, playerVolatiles);
      if (blocked) {
        say(
          blocked === 'protect'
            ? `${leader.name}'s ${enemy.displayName} used ${stored.name}! ${target.displayName} protected itself!`
            : `${leader.name}'s ${enemy.displayName} used ${stored.name}! The substitute blocked it!`,
        );
        await delay(900);
        return false;
      }
      tryCombatSteal(enemy, target, 'enemy');
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}!`);
      const transformTarget =
        stored.slug === 'transform'
          ? pickRandomTransformTarget(useGameStore.getState().party) ?? target
          : undefined;
      if (!isSelfStatusMove(stored.slug) && (abilityBouncesStatus(getMonAbility(target)) || playerVolatiles.magicCoat)) {
        say(`${leader.name}'s ${enemy.displayName} used ${stored.name}!`);
        say(
          playerVolatiles.magicCoat
            ? `${target.displayName} bounced the move with Magic Coat!`
            : `${target.displayName} bounced the move with Magic Bounce!`,
        );
        await delay(900);
        return false;
      }
      const statusResult = resolveStatusMove({
        slug: stored.slug,
        move: stored,
        attacker: enemy,
        defender: target,
        attackerVolatiles: enemyVolatiles,
        defenderVolatiles: playerVolatiles,
        defenderLastMoveSlug: playerLastMoveSlug,
        attackerParty: enemyTeam,
        attackerStages: enemyStages,
        defenderStages: playerStages,
        transformTarget,
        weather: battleField.weather,
      });
      for (const msg of statusResult.messages) say(msg);
      if (statusResult.failed) {
        await delay(900);
        return false;
      }
      {
        const moveType = moveTypeForFx(stored);
        if (isSelfStatusMove(stored.slug)) {
          playSfx('buff', muted);
          triggerHitFx('enemy', 'buff', moveType);
        } else {
          playSfx('statusHit', muted);
          triggerHitFx('player', 'status', moveType);
        }
      }
      if (statusResult.attackerStageDelta) {
        setEnemyStages((s) => mergeStageDelta(s, statusResult.attackerStageDelta));
      }
      if (statusResult.defenderStageDelta) {
        setPlayerStages((s) => mergeStageDelta(s, statusResult.defenderStageDelta));
      }
      if (statusResult.attackerVolatilesPatch) {
        setEnemyVolatiles((v) => applyVolatilesPatch(v, statusResult.attackerVolatilesPatch));
      }
      if (statusResult.defenderVolatilesPatch) {
        setPlayerVolatiles((v) => applyVolatilesPatch(v, statusResult.defenderVolatilesPatch));
      }
      if (statusResult.defenderStatus) {
        setPartyMemberStatus(target.caughtAt, statusResult.defenderStatus);
        if (statusResult.defenderStatus.kind === 'sleep') {
          setPlayerVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
        }
      }
      if (statusResult.fieldPatch) {
        setBattleField((f) => {
          const next = mergeFieldPatch(f, statusResult.fieldPatch);
          if (next.weather !== f.weather) applyForecastToField(next.weather);
          return next;
        });
      }
      if (statusResult.transform) {
        // Morph: collapse Ditto, swap into the copy, then bloom the new form
        setEnemyTransformPhase('out');
        await delay(480);
        patchEnemy(statusResult.transform.patch);
        if (typeof statusResult.transform.patch.hp === 'number') {
          commitEnemyHp(statusResult.transform.patch.hp);
        }
        const copiedId = statusResult.transform.patch.id;
        if (typeof copiedId === 'number') {
          const species = enemySpeciesById[copiedId];
          if (species) markSeen(species);
        }
        setEnemyTransformPhase('in');
        await delay(560);
        setEnemyTransformPhase(null);
      }
      if (statusResult.healFraction != null || HALF_HEAL_MOVES.has(stored.slug)) {
        const frac = healFractionForMove(
          stored.slug,
          battleField.weather,
          statusResult.healFraction,
        );
        const max = maxHpForMon({ ...enemy, ...statusResult.transform?.patch });
        const healed = Math.min(max, enemyHpRef.current + Math.max(1, Math.floor(max * frac)));
        commitEnemyHp(healed);
        patchEnemy({ hp: healed });
      }
      if (statusResult.sleepTalkMove) {
        const { move: talked, powerMultiplier } = statusResult.sleepTalkMove;
        const talkDmg = calculateMoveDamage({
          move: talked,
          attacker: enemy,
          defender: target,
          defenderHp: currentHp(target),
          attackerVolatiles: enemyVolatiles,
          defenderVolatiles: playerVolatiles,
          attackerStages: enemyStages,
          defenderStages: playerStages,
          region: battleRegion,
          weather: battleField.weather,
          powerMultiplier,
          attackerParty: enemyTeam,
          defenderParty: useGameStore.getState().party,
        });
        if (talkDmg.damage > 0) {
          damagePartyMember(target.caughtAt, talkDmg.damage);
          playHitSfx(talked.category, muted, moveTypeForFx(talked));
          triggerHitFx('player', 'damage', moveTypeForFx(talked));
          showDamage(`-${talkDmg.damage}`, 'player');
        }
        say(`${enemy.displayName} used ${talked.name} in its sleep!`);
      }
      if (statusResult.attackerStatus) {
        const max = maxHpForMon(enemy);
        patchEnemy({ status: statusResult.attackerStatus, hp: max });
        commitEnemyHp(max);
      }
      if (statusResult.clearAttackerStatus) {
        patchEnemy({ status: undefined });
      }
      if (statusResult.attackerHpCost) {
        const newHp = Math.max(1, enemyHpRef.current - statusResult.attackerHpCost);
        commitEnemyHp(newHp);
        patchEnemy({ hp: newHp });
      }
      if (statusResult.attackerStageSet) {
        setEnemyStages((s) => ({ ...s, ...statusResult.attackerStageSet }));
      }
      if (statusResult.painSplitHp) {
        commitEnemyHp(statusResult.painSplitHp.attackerHp);
        patchEnemy({ hp: statusResult.painSplitHp.attackerHp });
        const playerMax = maxHpForMon(target);
        const playerHp = Math.min(playerMax, statusResult.painSplitHp.defenderHp);
        const cur = currentHp(target);
        if (playerHp < cur) damagePartyMember(target.caughtAt, cur - playerHp);
        else if (playerHp > cur) useGameStore.getState().healPartyMember(target.caughtAt, playerHp - cur);
      }
      if (HALF_HEAL_MOVES.has(stored.slug) && statusResult.healFraction == null && !WEATHER_HEAL_MOVES.has(stored.slug)) {
        const max = maxHpForMon(enemy);
        const healed = Math.min(max, enemyHpRef.current + Math.max(1, Math.floor(max / 2)));
        commitEnemyHp(healed);
        patchEnemy({ hp: healed });
      }
      applyExtendedStatusResult(statusResult, false, enemy, target, enemyStages, playerStages, {
        setPlayerStages,
        setEnemyStages,
        setPlayerVolatiles,
        setEnemyVolatiles,
        patchPartyMember,
        patchEnemy,
        setEnemyTeam,
        setPartyMemberStatus,
        restoreMemberPp: useGameStore.getState().restoreMemberPp,
        party: useGameStore.getState().party,
      });
      if (statusResult.metronomeSlug) {
        const mimicked = storedMoveFromSlug(statusResult.metronomeSlug);
        if (mimicked && mimicked.category !== 'status') {
          if (stored.slug === 'metronome') say(`Metronome called ${mimicked.name}!`);
          const metroDmg = calculateMoveDamage({
            move: mimicked,
            attacker: enemy,
            defender: target,
            defenderHp: currentHp(target),
            attackerVolatiles: enemyVolatiles,
            defenderVolatiles: playerVolatiles,
            attackerStages: enemyStages,
            defenderStages: playerStages,
            region: battleRegion,
            weather: battleField.weather,
            mudSport: battleField.mudSport,
            waterSport: battleField.waterSport,
            attackerParty: enemyTeam,
            defenderParty: useGameStore.getState().party,
          });
          if (metroDmg.damage > 0) {
            damagePartyMember(target.caughtAt, metroDmg.damage);
            playHitSfx(mimicked.category, muted, moveTypeForFx(mimicked));
            triggerHitFx('player', 'damage', moveTypeForFx(mimicked));
            showDamage(`-${metroDmg.damage}`, 'player');
          }
        }
      }
      if (statusResult.selfFaint) {
        await delay(900);
        return faintEnemyFromSelfDestruct();
      }
      await delay(900);
      return false;
    }

    if (isProtected(playerVolatiles) && !isSelfStatusMove(stored.slug)) {
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! ${target.displayName} protected itself!`);
      if (isSelfFaintMove(stored.slug)) {
        return faintEnemyFromSelfDestruct();
      }
      await delay(900);
      return false;
    }

    if (isSelfFaintMove(stored.slug) && abilityBlocksExplosion([getMonAbility(enemy), getMonAbility(target)])) {
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}!`);
      say('A Pokémon\'s Damp prevented the explosion!');
      await delay(900);
      return false;
    }
    if (abilityIsProtean(getMonAbility(enemy))) {
      const pType = moveTypeForFx(stored);
      patchEnemy({ types: [pType] });
      say(`${enemy.displayName}'s Protean made it ${pType}!`);
    }
    tryCombatSteal(enemy, target, 'enemy');
    const weatherOffEnemy = weatherIsSuppressed([getMonAbility(enemy), getMonAbility(target)]);
    const dmgResult = resolveDamageHits({
      move: stored,
      attacker: { ...enemy, types: abilityIsProtean(getMonAbility(enemy)) ? [moveTypeForFx(stored)] : enemy.types },
      defender: target,
      defenderHp: currentHp(target),
      attackerVolatiles: enemyVolatiles,
      defenderVolatiles: playerVolatiles,
      attackerStages: enemyStages,
      defenderStages: playerStages,
      region: battleRegion,
      weather: battleField.weather,
      hitAccuracy,
      mudSport: battleField.mudSport,
      waterSport: battleField.waterSport,
      attackerParty: enemyTeam,
      defenderParty: useGameStore.getState().party,
      attackerSlower:
        effectiveSpeed(enemy, battleField.weather, weatherOffEnemy) <
        effectiveSpeed(target, battleField.weather, weatherOffEnemy),
    });

    if (dmgResult.missed) {
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! But it missed!`);
      if (isCrashMove(stored.slug)) {
        const crash = getCrashDamage(maxHpForMon(enemy));
        const newHp = Math.max(0, enemyHpRef.current - crash);
        commitEnemyHp(newHp);
        patchEnemy({ hp: newHp });
        say(`${enemy.displayName} kept going and crashed!`);
        showDamage(`-${crash}`, 'enemy');
        if (newHp <= 0) return faintEnemyFromSelfDestruct();
      }
      if (isSelfFaintMove(stored.slug)) {
        return faintEnemyFromSelfDestruct();
      }
      await delay(900);
      return false;
    }

    const totalDamage = dmgResult.totalDamage;
    const lastCrit = dmgResult.lastCrit;
    const lastEffectiveness = dmgResult.lastEffectiveness;

    if (dmgResult.abilityAbsorb) {
      const defAbility = getMonAbility(target);
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}!`);
      say(abilityAbsorbMessage(defAbility, target.displayName, dmgResult.abilityAbsorb));
      if (dmgResult.abilityAbsorb === 'heal') {
        useGameStore.getState().healPartyMember(target.caughtAt, Math.max(1, Math.floor(maxHpForMon(target) / 4)));
      }
      if (dmgResult.abilityAbsorb === 'boost') {
        const delta = abilityAbsorbBoostDelta(defAbility);
        if (delta) setPlayerStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...delta }));
      }
      await delay(900);
      return false;
    }

    if (fledRef.current) return false;

    if (dmgResult.presentHeal) {
      useGameStore.getState().healPartyMember(target.caughtAt, dmgResult.presentHeal);
      say(`${leader.name}'s ${enemy.displayName} used Present! ${target.displayName} recovered HP!`);
      await delay(900);
      return false;
    }

    if (DELAYED_ATTACK_SLUGS.has(stored.slug)) {
      setBattleField((f) => ({
        ...f,
        delayedHits: [...(f.delayedHits ?? []), { target: 'player', turnsLeft: 2, damage: totalDamage, name: stored.name }],
      }));
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! It locked onto ${target.displayName}!`);
      await delay(900);
      return false;
    }

    const strikeResults = dmgResult.hitResults.length > 0
      ? dmgResult.hitResults
      : totalDamage > 0
        ? [{ damage: totalDamage, crit: lastCrit, effectiveness: lastEffectiveness }]
        : [];
    let appliedDamage = 0;
    let hitSubstitute = false;
    let subBroke = false;
    let anyCrit = false;
    let lastStrikeEffectiveness = lastEffectiveness;
    let connectingHits = 0;
    let currentPlayerVolatiles = playerVolatiles;

    say(`${leader.name}'s ${enemy.displayName} used ${stored.name}!`);
    if (strikeResults.length === 0) {
      playSfx('fail', muted);
    }
    for (let i = 0; i < strikeResults.length; i++) {
      const strike = strikeResults[i]!;
      let thisApplied = strike.damage;
      if (thisApplied > 0 && hasSubstitute(currentPlayerVolatiles)) {
        const absorbed = absorbSubstituteHit(currentPlayerVolatiles, thisApplied);
        currentPlayerVolatiles = absorbed.volatiles;
        setPlayerVolatiles(absorbed.volatiles);
        thisApplied = absorbed.damageToMon;
        hitSubstitute = true;
        if (absorbed.broke) subBroke = true;
      }
      if (thisApplied > 0) {
        damagePartyMember(target.caughtAt, thisApplied);
        appliedDamage += thisApplied;
        connectingHits += 1;
        anyCrit = anyCrit || strike.crit;
        lastStrikeEffectiveness = strike.effectiveness;
        tryGluttonyHeal(useGameStore.getState().party[0] ?? target, 'player');
        setPlayerVolatiles((v) => ({ ...v, tookDamageThisTurn: true }));
        const cat = stored.category === 'physical' ? 'physical' : 'special';
        setPlayerVolatiles((v) => accumulateCounterDamage(v, strike.damage, cat));
        triggerShake();
        playHitSfx(stored.category, muted, moveTypeForFx(stored));
        triggerHitFx('player', 'damage', moveTypeForFx(stored));
        showDamage(`-${thisApplied}`, 'player');
        if (strike.crit) {
          setCritFlash(true);
          window.setTimeout(() => setCritFlash(false), 400);
        }
      } else if (hitSubstitute) {
        triggerShake();
        playHitSfx(stored.category, muted, moveTypeForFx(stored));
        triggerHitFx('player', 'damage', moveTypeForFx(stored));
        showDamage(`-${strike.damage}`, 'player');
      }
      if (currentHp(useGameStore.getState().party[0] ?? target) <= 0) break;
      if (strikeResults.length > 1 && i < strikeResults.length - 1) await delay(380);
    }

    if (appliedDamage > 0) {
      if (isContactMove(stored.slug)) {
        const contact = abilityOnContact(getMonAbility(target));
        if (contact?.kind === 'status' && Math.random() < contact.chance && canApplyStatus(enemy, contact.status, battleField.weather, weatherOffEnemy)) {
          patchEnemy({ status: createStatus(contact.status) });
          say(`${enemy.displayName} was ${contact.status === 'paralysis' ? 'paralyzed' : contact.status === 'burn' ? 'burned' : 'poisoned'} by ${abilityLabel(getMonAbility(target))}!`);
        } else if (contact?.kind === 'damage') {
          const chip = Math.max(1, Math.floor(maxHpForMon(enemy) * contact.fraction));
          const newHp = Math.max(0, enemyHpRef.current - chip);
          commitEnemyHp(newHp);
          patchEnemy({ hp: newHp });
          say(`${enemy.displayName} was hurt by ${abilityLabel(getMonAbility(target))}!`);
        }
        const touch = abilityOnContactAttack(getMonAbility(enemy));
        if (touch?.kind === 'status' && Math.random() < touch.chance && canApplyStatus(target, touch.status, battleField.weather, weatherOffEnemy)) {
          setPartyMemberStatus(target.caughtAt, createStatus(touch.status));
          say(`${target.displayName} was poisoned by Poison Touch!`);
        }
      }
      const afterHit = abilityAfterBeingHit({
        defenderAbility: getMonAbility(target),
        attackerAbility: getMonAbility(enemy),
        defenderName: target.displayName,
        moveType: moveTypeForFx(stored),
        moveSlug: stored.slug,
        category: stored.category,
        crit: anyCrit,
        damage: appliedDamage,
      });
      for (const msg of afterHit.messages) say(msg);
      if (afterHit.defenderStageDelta) {
        setPlayerStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...afterHit.defenderStageDelta }));
      }
      if (afterHit.defenderTypes) {
        patchPartyMember(target.caughtAt, { types: afterHit.defenderTypes });
      }
      if (afterHit.disableAttackerMove) {
        setEnemyVolatiles((v) => ({ ...v, disabledMoveSlug: stored.slug, disableTurns: 4 }));
      }
      if (afterHit.flinchDefender && !abilityBlocksFlinch(getMonAbility(target))) {
        setPlayerVolatiles((v) => ({ ...v, flinched: true }));
      }
    } else if (!hitSubstitute && strikeResults.length === 0) {
      playSfx('fail', muted);
    }
    if (hitSubstitute) {
      say(subBroke ? `${target.displayName}'s substitute faded!` : 'The substitute took the hit!');
    } else if (appliedDamage > 0) {
      if (anyCrit) say('A critical hit!');
      const times = hitTimesMessage(connectingHits);
      if (times) say(times);
      else say(`Dealt ${appliedDamage} damage!`);
      const note = getEffectivenessLabel(lastStrikeEffectiveness);
      if (note) say(note);
    }
    await delay(strikeResults.length > 1 ? 700 : 1200);

    const post = resolvePostDamage({
      slug: stored.slug,
      move: stored,
      attacker: enemy,
      defender: target,
      damageDealt: totalDamage,
      damageToMon: appliedDamage,
      connectingHits,
      attackerVolatiles: enemyVolatiles,
      defenderVolatiles: playerVolatiles,
      weather: battleField.weather,
    });
    for (const msg of post.messages) say(msg);
    if (post.defenderStatus) {
      setPartyMemberStatus(target.caughtAt, post.defenderStatus);
      if (post.defenderStatus.kind === 'sleep') {
        setPlayerVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
      }
      if (
        monHasAbility(target, 'synchronize') &&
        (post.defenderStatus.kind === 'poison' || post.defenderStatus.kind === 'burn' || post.defenderStatus.kind === 'paralysis') &&
        canApplyStatus(enemy, post.defenderStatus.kind, battleField.weather, weatherOffEnemy)
      ) {
        patchEnemy({ status: createStatus(post.defenderStatus.kind) });
        say(`${enemy.displayName} was hit by Synchronize!`);
      }
    }
    if (post.defenderVolatilesPatch) {
      setPlayerVolatiles((v) => applyVolatilesPatch(v, post.defenderVolatilesPatch));
    }
    if (post.attackerVolatilesPatch) {
      setEnemyVolatiles((v) => applyVolatilesPatch(v, post.attackerVolatilesPatch));
    }
    if (post.defenderStageDelta) {
      setPlayerStages((s) => mergeStageDelta(s, post.defenderStageDelta));
      const dropped = Object.values(post.defenderStageDelta).some((v) => (v ?? 0) < 0);
      const retaliate = abilityRetaliateStatDrop(getMonAbility(target), dropped);
      if (retaliate) {
        setPlayerStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...retaliate }));
        say(`${target.displayName}'s ${abilityLabel(getMonAbility(target))} raised its stats!`);
      }
    }
    if (post.attackerStageDelta) {
      setEnemyStages((s) => mergeStageDelta(s, post.attackerStageDelta));
    }
    if (post.recoilDamage) {
      const newHp = Math.max(0, enemyHpRef.current - post.recoilDamage);
      commitEnemyHp(newHp);
      patchEnemy({ hp: newHp });
      showDamage(`-${post.recoilDamage}`, 'enemy');
    }
    if (post.drainHeal) {
      const healed = Math.min(maxHpForMon(enemy), enemyHpRef.current + post.drainHeal);
      commitEnemyHp(healed);
      patchEnemy({ hp: healed });
    }
    if (post.clearSpikes) {
      setBattleField((f) => ({ ...f, spikesActive: false }));
    }

    const updated = useGameStore.getState().party[0];
    if (RECHARGE_MOVE_SLUGS.has(stored.slug) && totalDamage > 0 && updated && !isFainted(updated)) {
      setEnemyPendingTurn({ kind: 'hyper-recharge', move: stored });
    }
    if (post.selfFaint) {
      return faintEnemyFromSelfDestruct();
    }
    if (!updated || isFainted(updated)) {
      const ko = abilityOnKnockOut({
        attackerAbility: getMonAbility(enemy),
        defenderAbility: getMonAbility(target),
        contact: isContactMove(stored.slug),
        attackerMaxHp: maxHpForMon(enemy),
      });
      if (ko.aftermathDamage > 0) {
        const newHp = Math.max(0, enemyHpRef.current - ko.aftermathDamage);
        commitEnemyHp(newHp);
        patchEnemy({ hp: newHp });
        say(`${enemy.displayName} was hurt by Aftermath!`);
        if (newHp <= 0) return faintEnemyFromSelfDestruct();
      }
      if (playerVolatiles.grudge) {
        patchEnemy({ pp: { ...(enemy.pp ?? {}), [stored.slug]: 0 } });
        say(`${target.displayName}'s grudge took ${stored.name}'s PP!`);
      }
      if (ko.moxie) {
        setEnemyStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, atk: 1 }));
        say(`${enemy.displayName}'s Moxie raised its Attack!`);
      }
      if (playerVolatiles.destinyBond) {
        say(`${target.displayName} took ${enemy.displayName} down with it!`);
        return faintEnemyFromSelfDestruct();
      }
      const alive = useGameStore.getState().party.some((m) => !isFainted(m));
      if (!alive) {
        await handlePartyWipe();
        return true;
      }
      revertActiveTransformIfNeeded();
      pendingEndOfTurnRef.current = true;
      setPhase('forcedSwap');
      setPlayerFaintAnim(true);
      say(`${target.nickname ?? target.displayName} fainted! Choose a replacement.`);
      playSfx('fail', muted);
      return true;
    }
    return false;
  }, [advanceAfterEnemyFaint, canAct, damagePartyMember, enemy, enemyHp, enemyPendingTurn, enemyStages.atk, enemyStages.spa, enemySpeciesById, faintEnemyFromSelfDestruct, handlePartyWipe, leader.name, markSeen, moveTypeForFx, muted, patchEnemy, playerStages.def, playerStages.spd, say, setPartyMemberStatus, triggerHitFx]);

  enemyAttackRef.current = executeEnemyAttack;

  const waitForOutcomeClear = useCallback((): Promise<void> => {
    if (!useMultiplayerStore.getState().outcome) return Promise.resolve();
    return new Promise((resolve) => {
      const unsub = useMultiplayerStore.subscribe((state, prev) => {
        if (prev.outcome && !state.outcome) {
          unsub();
          resolve();
        }
      });
    });
  }, []);

  const runChaosIfNeeded = useCallback(
    async (hostUsedAttack: boolean) => {
      if (!hostUsedAttack || !mpConnected) return;
      const active = useGameStore.getState().party[0];
      if (active?.guestOwned) return;
      if (Math.random() >= 0.25) return;

      const effect = await new Promise<ChaosEffectId>((resolve) => {
        useMultiplayerStore.getState().setChaosApplyHandler((result) => {
          useMultiplayerStore.getState().setChaosApplyHandler(null);
          resolve(result);
        });
        useMultiplayerStore.getState().requestChaosWheel();
      });

      const game = useGameStore.getState();
      const mp = useMultiplayerStore.getState();
      let label = chaosOutcomeLabel(effect);

      switch (effect) {
        case 'rarecandy':
          game.addItem('rarecandy', 1);
          break;
        case 'lose_potion':
          if (!game.consumeItem('potion', 1)) {
            label = 'Chaos: No potions to lose!';
          }
          break;
        case 'xattack_both':
          mp.setXAttackAllActive(true);
          break;
        case 'skip_turn':
          mp.setSkipNextPlayerTurn(true);
          break;
        case 'random_swap': {
          const activeCaughtAt = game.party[0]?.caughtAt;
          const candidates = game.party.filter(
            (m) => m.caughtAt !== activeCaughtAt && !isFainted(m) && !m.guestLocked,
          );
          if (candidates.length === 0) {
            label = 'Chaos: No Pokémon to swap to!';
          } else {
            const pick = pickRandom(candidates);
            game.setActivePartyMember(pick.caughtAt);
            // New Pokémon enters clean — don't inherit the previous mon's
            // confusion/leech/trap or stat stage changes.
            setPlayerStages(ZERO_STAGES);
            setPlayerVolatiles(volatilesOnSendOut());
          }
          break;
        }
        case 'elixir': {
          const activeCaughtAt = game.party[0]?.caughtAt;
          if (activeCaughtAt != null) {
            game.restoreMemberPp(activeCaughtAt);
          }
          break;
        }
        default:
          break;
      }

      mp.setOutcome(label);
      mp.setAwaitingGuest(null);
      await waitForOutcomeClear();
    },
    [mpConnected, waitForOutcomeClear],
  );

  const executePlayerAttack = useCallback(
    async (move: BattleMove): Promise<PlayerAttackResult> => {
      if (!enemy) return 'abort';
      if (enemyHpRef.current <= 0) {
        if (phaseRef.current === 'choose') await advanceAfterEnemyFaint();
        return 'enemy_fainted';
      }
      const attackGen = enemyGenRef.current;
      const attacker = useGameStore.getState().party[0];
      if (!attacker || isFainted(attacker)) return 'abort';

      const playerVolatiles = playerVolatilesRef.current;
      const enemyVolatiles = enemyVolatilesRef.current;

      const actCheck = canAct(attacker, 'player', playerVolatiles, move.slug);
      if (actCheck.message) say(actCheck.message);
      if (!actCheck.canAct) return 'continue';

      if (playerPendingTurn?.kind === 'hyper-recharge') {
        setPlayerPendingTurn(null);
        say(`${attacker.nickname ?? attacker.displayName} must recharge!`);
        await delay(900);
        return 'continue';
      }

      const pending = playerPendingTurn;
      const isChargeRelease = pending?.kind === 'solar-charge' || pending?.kind === 'charge';

      const rolloutSlug = playerVolatiles.rolloutLock ? 'rollout' : null;
      const thrashSlug = playerVolatiles.thrashLock?.slug;
      const forcedSlug = thrashSlug ?? rolloutSlug;
      const forcedStored = forcedSlug ? attacker.moves.find((m) => m.slug === forcedSlug) : null;

      let releaseMove: BattleMove;
      if (isChargeRelease && pending) {
        releaseMove = {
          ...pending.move,
          ...move,
          ownerCaughtAt: attacker.caughtAt,
          ownerDisplayName: attacker.nickname ?? attacker.displayName,
          fromActive: true,
          currentPp: move.currentPp ?? pending.move.currentPp,
        };
        setPlayerPendingTurn(null);
        setPlayerVolatiles((v) => ({ ...v, semiInvulnerable: undefined }));
        say(`${attacker.nickname ?? attacker.displayName} unleashed ${releaseMove.name}!`);
      } else if (forcedStored) {
        releaseMove = {
          ...move,
          ...forcedStored,
          name: forcedStored.name,
          slug: forcedStored.slug,
          ownerCaughtAt: attacker.caughtAt,
          ownerDisplayName: attacker.nickname ?? attacker.displayName,
          fromActive: true,
          currentPp: attacker.pp?.[forcedStored.slug] ?? forcedStored.maxPp,
          maxPp: forcedStored.maxPp,
        };
      } else {
        releaseMove = move;
      }

      if (!isChargeRelease && !playerPendingTurn) {
        if (releaseMove.slug === 'solar-beam' && !isSunny(battleField.weather)) {
          setPlayerPendingTurn({ kind: 'solar-charge', move: releaseMove });
          say(chargeMoveMessage(attacker.nickname ?? attacker.displayName, releaseMove.slug, releaseMove.name));
          await delay(900);
          return 'continue';
        }
        if (releaseMove.slug === 'solar-beam' && isSunny(battleField.weather)) {
          // instant in sun
        } else if (CHARGE_MOVE_SLUGS.has(releaseMove.slug) && releaseMove.slug !== 'solar-beam') {
          setPlayerPendingTurn({ kind: 'charge', move: releaseMove });
          if (isSemiInvulnerableMove(releaseMove.slug)) {
            setPlayerVolatiles((v) => ({ ...v, semiInvulnerable: releaseMove.slug }));
          }
          say(chargeMoveMessage(attacker.nickname ?? attacker.displayName, releaseMove.slug, releaseMove.name));
          await delay(900);
          return 'continue';
        }
      }

      if (playerVolatiles.disabledMoveSlug === releaseMove.slug) {
        say(`${releaseMove.name} is disabled!`);
        await delay(900);
        return 'continue';
      }

      if (releaseMove.slug === 'focus-punch' && playerVolatiles.tookDamageThisTurn) {
        say(`${attacker.nickname ?? attacker.displayName} lost its focus!`);
        await delay(900);
        return 'continue';
      }
      if (isTaunted(playerVolatiles) && releaseMove.category === 'status') {
        say(`${attacker.nickname ?? attacker.displayName} can't use ${releaseMove.name} after the taunt!`);
        await delay(900);
        return 'continue';
      }
      if (playerVolatiles.torment && releaseMove.slug === playerLastMoveSlug) {
        say(`${attacker.nickname ?? attacker.displayName} can't use ${releaseMove.name} after the torment!`);
        await delay(900);
        return 'continue';
      }
      const playerFail = getDamagingMoveFailReason(releaseMove.slug, {
        enteredThisTurn: playerVolatiles.enteredThisTurn,
        asleep: isAsleep(attacker.status) || isAsleep(actCheck.statusAfter),
        stockpileCount: playerVolatiles.stockpileCount,
      });
      if (playerFail) {
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! ${playerFail}`);
        await delay(900);
        return 'continue';
      }

      // Fly / Dig charge turn: foe is untargetable until they come down / up.
      if (
        isSemiInvulnerable(enemyVolatiles) &&
        !isSelfStatusMove(releaseMove.slug) &&
        !canHitSemiInvulnerable(releaseMove.slug, enemyVolatiles.semiInvulnerable)
      ) {
        say(
          `${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! ${enemy.displayName} avoided the attack!`,
        );
        playSfx('fail', muted);
        await delay(900);
        return 'continue';
      }

      if (releaseMove.currentPp > 0 && !forcedSlug) {
        useMovePp(releaseMove.ownerCaughtAt, releaseMove.slug, releaseMove.maxPp);
      } else if (releaseMove.currentPp > 0 && forcedSlug && releaseMove.slug !== forcedSlug) {
        useMovePp(releaseMove.ownerCaughtAt, releaseMove.slug, releaseMove.maxPp);
      } else if (forcedSlug && releaseMove.slug === forcedSlug && releaseMove.currentPp > 0) {
        useMovePp(releaseMove.ownerCaughtAt, releaseMove.slug, releaseMove.maxPp);
      }
      if (abilityExtraPpCost(getMonAbility(enemy)) > 0 && releaseMove.currentPp > 0) {
        useMovePp(releaseMove.ownerCaughtAt, releaseMove.slug, releaseMove.maxPp);
      }

      setPlayerLastMoveSlug(releaseMove.slug);

      if (isCounterMove(releaseMove.slug)) {
        const counterResult = resolveCounterMove(
          releaseMove.slug,
          attacker.nickname ?? attacker.displayName,
          releaseMove.name,
        );
        for (const msg of counterResult.messages) say(msg);
        setPlayerVolatiles((v) => applyVolatilesPatch(v, counterResult.attackerVolatilesPatch));
        await delay(900);
        return 'continue';
      }

      const rawPlayerAcc = effectiveAccuracy(
        releaseMove.slug,
        releaseMove.accuracy,
        playerVolatiles,
        battleField.weather,
      );
      const hitAccuracy = abilityNeverMisses(getMonAbility(attacker), getMonAbility(enemy))
        ? 100
        : Math.max(
            1,
            Math.min(
              100,
              abilityStatusAccuracyCap(
                releaseMove.category === 'status' ? getMonAbility(enemy) : undefined,
                rawPlayerAcc,
              ) * (stageMult(playerStages.acc) / stageMult(enemyVolatiles.identified ? 0 : enemyStages.eva)),
            ),
          );

      if (releaseMove.category === 'status') {
        if (!rollHit(hitAccuracy)) {
          say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! But it missed!`);
          await delay(900);
          return 'continue';
        }
        const blocked = defenseBlocksMove(releaseMove.slug, releaseMove.category, enemyVolatiles);
        if (blocked) {
          say(
            blocked === 'protect'
              ? `${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! ${enemy.displayName} protected itself!`
              : `${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! The substitute blocked it!`,
          );
          await delay(900);
          return 'continue';
        }
        if (!isSelfStatusMove(releaseMove.slug) && (abilityBouncesStatus(getMonAbility(enemy)) || enemyVolatiles.magicCoat)) {
          say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}!`);
          say(
            enemyVolatiles.magicCoat
              ? `${enemy.displayName} bounced the move with Magic Coat!`
              : `${enemy.displayName} bounced the move with Magic Bounce!`,
          );
          await delay(900);
          return 'continue';
        }
        tryCombatSteal(attacker, enemy, 'player');
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}!`);
        const statusResult = resolveStatusMove({
          slug: releaseMove.slug,
          move: releaseMove,
          attacker,
          defender: enemy,
          attackerVolatiles: playerVolatiles,
          defenderVolatiles: enemyVolatiles,
          transformTarget: enemy,
          defenderLastMoveSlug: enemyLastMoveSlug,
          attackerParty: useGameStore.getState().party,
          attackerStages: playerStages,
          defenderStages: enemyStages,
          weather: battleField.weather,
        });
      for (const msg of statusResult.messages) say(msg);
      if (statusResult.failed) {
        await delay(900);
        return 'continue';
      }
      {
        const moveType = moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt);
        if (isSelfStatusMove(releaseMove.slug)) {
          playSfx('buff', muted);
          triggerHitFx('player', 'buff', moveType);
        } else {
          playSfx('statusHit', muted);
          triggerHitFx('enemy', 'status', moveType);
        }
      }
      if (statusResult.attackerStageDelta) {
        setPlayerStages((s) => mergeStageDelta(s, statusResult.attackerStageDelta));
      }
      if (statusResult.defenderStageDelta) {
        setEnemyStages((s) => mergeStageDelta(s, statusResult.defenderStageDelta));
      }
      if (statusResult.attackerVolatilesPatch) {
        setPlayerVolatiles((v) => applyVolatilesPatch(v, statusResult.attackerVolatilesPatch));
      }
      if (statusResult.defenderVolatilesPatch) {
        setEnemyVolatiles((v) => applyVolatilesPatch(v, statusResult.defenderVolatilesPatch));
      }
      if (statusResult.defenderStatus) {
        patchEnemy({ status: statusResult.defenderStatus });
          if (statusResult.defenderStatus.kind === 'sleep') {
            setEnemyVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
          }
        }
        if (statusResult.fieldPatch) {
          setBattleField((f) => {
            const next = mergeFieldPatch(f, statusResult.fieldPatch);
            if (next.weather !== f.weather) applyForecastToField(next.weather);
            return next;
          });
        }
        if (statusResult.clearAttackerStatus) {
          setPartyMemberStatus(attacker.caughtAt, undefined);
        }
        if (statusResult.attackerHpCost) {
          damagePartyMember(attacker.caughtAt, statusResult.attackerHpCost);
        }
        if (statusResult.attackerStageSet) {
          setPlayerStages((s) => ({ ...s, ...statusResult.attackerStageSet }));
        }
        if (statusResult.painSplitHp) {
          const atkMax = maxHpForMon(attacker);
          const atkHp = Math.min(atkMax, statusResult.painSplitHp.attackerHp);
          const curAtk = currentHp(attacker);
          if (atkHp < curAtk) damagePartyMember(attacker.caughtAt, curAtk - atkHp);
          else if (atkHp > curAtk) useGameStore.getState().healPartyMember(attacker.caughtAt, atkHp - curAtk);
          commitEnemyHp(statusResult.painSplitHp.defenderHp);
          patchEnemy({ hp: statusResult.painSplitHp.defenderHp });
        }
        if (statusResult.attackerStatus) {
          setPartyMemberStatus(attacker.caughtAt, statusResult.attackerStatus);
          const max = maxHpForMon(attacker);
          useGameStore.getState().healPartyMember(attacker.caughtAt, max);
          if (statusResult.attackerStatus.kind === 'sleep') {
            setPlayerVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
          }
        }
        if (statusResult.healFraction != null || HALF_HEAL_MOVES.has(releaseMove.slug)) {
          const max = maxHpForMon(attacker);
          const frac = healFractionForMove(
            releaseMove.slug,
            battleField.weather,
            statusResult.healFraction,
          );
          useGameStore.getState().healPartyMember(attacker.caughtAt, Math.max(1, Math.floor(max * frac)));
        }
        if (statusResult.sleepTalkMove) {
          const { move: talked, powerMultiplier } = statusResult.sleepTalkMove;
          const hpType = battleField.hiddenPowerTypes[attacker.caughtAt];
          const talkDmg = calculateMoveDamage({
            move: talked,
            attacker,
            defender: enemy,
            defenderHp: enemyHpRef.current,
            attackerVolatiles: playerVolatiles,
            defenderVolatiles: enemyVolatiles,
            attackerStages: playerStages,
            defenderStages: enemyStages,
            xAttackPhysical: xAttackPhysical || useMultiplayerStore.getState().xAttackAllActive,
            xAttackSpecial: xAttackSpecial || useMultiplayerStore.getState().xAttackAllActive,
            region: battleRegion,
            weather: battleField.weather,
            hiddenPowerType: talked.slug === 'hidden-power' ? hpType : undefined,
            powerMultiplier,
            attackerParty: useGameStore.getState().party,
            defenderParty: enemyTeam,
          });
          const newHp = Math.max(0, enemyHpRef.current - talkDmg.damage);
          commitEnemyHp(newHp);
          patchEnemy({ hp: newHp });
          if (talkDmg.damage > 0) {
            triggerShake();
            playHitSfx(talked.category, muted, moveTypeForFx(talked, attacker.caughtAt));
            triggerHitFx('enemy', 'damage', moveTypeForFx(talked, attacker.caughtAt));
            showDamage(`-${talkDmg.damage}`, 'enemy');
          }
          say(`${attacker.displayName} used ${talked.name} in its sleep!`);
          if (newHp <= 0) {
            await delay(900);
            await advanceAfterEnemyFaint();
            return 'enemy_fainted';
          }
        }
        if (statusResult.transform) {
          patchPartyMember(attacker.caughtAt, statusResult.transform.patch);
          setTransformSnapshot(statusResult.transform.snapshot);
        }
        applyExtendedStatusResult(statusResult, true, attacker, enemy, playerStages, enemyStages, {
          setPlayerStages,
          setEnemyStages,
          setPlayerVolatiles,
          setEnemyVolatiles,
          patchPartyMember,
          patchEnemy,
          setEnemyTeam,
          setPartyMemberStatus,
          restoreMemberPp: useGameStore.getState().restoreMemberPp,
          party: useGameStore.getState().party,
        });
        if (statusResult.metronomeSlug) {
            const mimicked = storedMoveFromSlug(statusResult.metronomeSlug);
            if (mimicked) {
              if (releaseMove.slug === 'metronome') {
                say(`Metronome called ${mimicked.name}!`);
              }
              await delay(600);
              if (mimicked.category === 'status') {
              const metro = resolveStatusMove({
                slug: mimicked.slug,
                move: mimicked,
                attacker: useGameStore.getState().party[0] ?? attacker,
                defender: enemy,
                attackerVolatiles: playerVolatiles,
                defenderVolatiles: enemyVolatiles,
                transformTarget: enemy,
                defenderLastMoveSlug: enemyLastMoveSlug,
              });
              for (const msg of metro.messages) say(msg);
              if (!metro.failed) {
                const moveType = moveTypeForFx(mimicked, attacker.caughtAt);
                if (isSelfStatusMove(mimicked.slug)) {
                  playSfx('buff', muted);
                  triggerHitFx('player', 'buff', moveType);
                } else {
                  playSfx('statusHit', muted);
                  triggerHitFx('enemy', 'status', moveType);
                }
              }
              if (metro.defenderStatus) patchEnemy({ status: metro.defenderStatus });
            } else {
              const metroDmg = calculateMoveDamage({
                move: mimicked,
                attacker: useGameStore.getState().party[0] ?? attacker,
                defender: enemy,
                defenderHp: enemyHpRef.current,
                attackerVolatiles: playerVolatiles,
                defenderVolatiles: enemyVolatiles,
                attackerStages: playerStages,
                defenderStages: enemyStages,
                xAttackPhysical: xAttackPhysical || useMultiplayerStore.getState().xAttackAllActive,
                xAttackSpecial: xAttackSpecial || useMultiplayerStore.getState().xAttackAllActive,
                region: battleRegion,
                attackerParty: useGameStore.getState().party,
                defenderParty: enemyTeam,
              });
              const newHp = Math.max(0, enemyHpRef.current - metroDmg.damage);
              commitEnemyHp(newHp);
              patchEnemy({ hp: newHp });
              if (metroDmg.damage > 0) {
                triggerShake();
                playHitSfx(mimicked.category, muted, moveTypeForFx(mimicked, attacker.caughtAt));
                triggerHitFx('enemy', 'damage', moveTypeForFx(mimicked, attacker.caughtAt));
                showDamage(`-${metroDmg.damage}`, 'enemy');
              }
              say(
                buildHitBattleMessage(
                  `${attacker.displayName} used ${mimicked.name}!`,
                  metroDmg.effectiveness,
                  metroDmg.damage,
                  metroDmg.crit,
                ),
              );
              if (newHp <= 0) {
                await delay(900);
                await advanceAfterEnemyFaint();
                return 'enemy_fainted';
              }
            }
          }
        }
        if (statusResult.selfFaint) {
          useGameStore.getState().damagePartyMember(attacker.caughtAt, maxHpForMon(attacker));
          revertActiveTransformIfNeeded();
          setPlayerFaintAnim(true);
          const alive = useGameStore.getState().party.some((m) => !isFainted(m));
          if (alive) setPhase('forcedSwap');
          else await handlePartyWipe();
        }
        await delay(900);
        return 'continue';
      }

      const xPhys = xAttackPhysical || useMultiplayerStore.getState().xAttackAllActive;
      const xSpec = xAttackSpecial || useMultiplayerStore.getState().xAttackAllActive;

      let defenderStatus = enemy.status;
      if (releaseMove.type === 'fire') {
        defenderStatus = thawFromFireMove(defenderStatus);
        if (defenderStatus !== enemy.status) patchEnemy({ status: defenderStatus });
      }

      const hpType = battleField.hiddenPowerTypes[attacker.caughtAt];

      if (isProtected(enemyVolatiles) && !isSelfStatusMove(releaseMove.slug)) {
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! ${enemy.displayName} protected itself!`);
        await delay(900);
        return 'continue';
      }

      if (isSelfFaintMove(releaseMove.slug) && abilityBlocksExplosion([getMonAbility(attacker), getMonAbility(enemy)])) {
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}!`);
        say("A Pokémon's Damp prevented the explosion!");
        await delay(900);
        return 'continue';
      }
      if (abilityIsProtean(getMonAbility(attacker))) {
        const pType = moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt);
        patchPartyMember(attacker.caughtAt, { types: [pType] });
        say(`${attacker.displayName}'s Protean made it ${pType}!`);
      }
      tryCombatSteal(attacker, enemy, 'player');
      const weatherOffPlayer = weatherIsSuppressed([getMonAbility(attacker), getMonAbility(enemy)]);
      const dmgResult = resolveDamageHits({
        move: releaseMove,
        attacker: {
          ...attacker,
          types: abilityIsProtean(getMonAbility(attacker))
            ? [moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt)]
            : attacker.types,
        },
        defender: { ...enemy, status: defenderStatus },
        defenderHp: enemyHpRef.current,
        attackerVolatiles: playerVolatiles,
        defenderVolatiles: enemyVolatiles,
        attackerStages: playerStages,
        defenderStages: enemyStages,
        xAttackPhysical: xPhys,
        xAttackSpecial: xSpec,
        region: battleRegion,
        weather: battleField.weather,
        hiddenPowerType: releaseMove.slug === 'hidden-power' ? hpType : undefined,
        hitAccuracy,
        mudSport: battleField.mudSport,
        waterSport: battleField.waterSport,
        attackerParty: useGameStore.getState().party,
        defenderParty: enemyTeam,
        attackerSlower:
          effectiveSpeed(attacker, battleField.weather, weatherOffPlayer) <
          effectiveSpeed(enemy, battleField.weather, weatherOffPlayer),
      });

      if (dmgResult.missed) {
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! But it missed!`);
        if (isCrashMove(releaseMove.slug)) {
          const crash = getCrashDamage(maxHpForMon(attacker));
          damagePartyMember(attacker.caughtAt, crash);
          say(`${attacker.displayName} kept going and crashed!`);
          showDamage(`-${crash}`, 'player');
        }
        if (isSelfFaintMove(releaseMove.slug)) {
          useGameStore.getState().damagePartyMember(attacker.caughtAt, maxHpForMon(attacker));
          revertActiveTransformIfNeeded();
          setPlayerFaintAnim(true);
          setPhase('forcedSwap');
        } else {
          await delay(900);
        }
        return 'continue';
      }

      if (dmgResult.presentHeal) {
        const healed = Math.min(maxHpForMon(enemy), enemyHpRef.current + dmgResult.presentHeal);
        commitEnemyHp(healed);
        patchEnemy({ hp: healed });
        say(`${attacker.nickname ?? attacker.displayName} used Present! The foe recovered HP!`);
        await delay(900);
        return 'continue';
      }

      const totalDamage = dmgResult.totalDamage;
      const lastCrit = dmgResult.lastCrit;
      const lastEffectiveness = dmgResult.lastEffectiveness;

      if (dmgResult.abilityAbsorb) {
        const defAbility = getMonAbility(enemy);
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}!`);
        say(abilityAbsorbMessage(defAbility, enemy.displayName, dmgResult.abilityAbsorb));
        if (dmgResult.abilityAbsorb === 'heal') {
          const healed = Math.min(maxHpForMon(enemy), enemyHpRef.current + Math.max(1, Math.floor(maxHpForMon(enemy) / 4)));
          commitEnemyHp(healed);
          patchEnemy({ hp: healed });
        }
        if (dmgResult.abilityAbsorb === 'boost') {
          const delta = abilityAbsorbBoostDelta(defAbility);
          if (delta) setEnemyStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...delta }));
        }
        await delay(900);
        return 'continue';
      }

      if (DELAYED_ATTACK_SLUGS.has(releaseMove.slug)) {
        setBattleField((f) => ({
          ...f,
          delayedHits: [...(f.delayedHits ?? []), { target: 'enemy', turnsLeft: 2, damage: totalDamage, name: releaseMove.name }],
        }));
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! It locked onto ${enemy.displayName}!`);
        await delay(900);
        return 'continue';
      }

      const strikeResults = dmgResult.hitResults.length > 0
        ? dmgResult.hitResults
        : totalDamage > 0
          ? [{ damage: totalDamage, crit: lastCrit, effectiveness: lastEffectiveness }]
          : [];
      let appliedDamage = 0;
      let hitSubstitute = false;
      let subBroke = false;
      let anyCrit = false;
      let lastStrikeEffectiveness = lastEffectiveness;
      let connectingHits = 0;
      let currentEnemyVolatiles = enemyVolatiles;
      let newEnemyHp = enemyHpRef.current;

      say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}!`);
      if (strikeResults.length === 0) {
        playSfx('fail', muted);
      }
      for (let i = 0; i < strikeResults.length; i++) {
        const strike = strikeResults[i]!;
        let thisApplied = strike.damage;
        if (thisApplied > 0 && hasSubstitute(currentEnemyVolatiles)) {
          const absorbed = absorbSubstituteHit(currentEnemyVolatiles, thisApplied);
          currentEnemyVolatiles = absorbed.volatiles;
          setEnemyVolatiles(absorbed.volatiles);
          thisApplied = absorbed.damageToMon;
          hitSubstitute = true;
          if (absorbed.broke) subBroke = true;
        }
        if (thisApplied > 0) {
          newEnemyHp = Math.max(0, enemyHpRef.current - thisApplied);
          if (attackGen === enemyGenRef.current) {
            commitEnemyHp(newEnemyHp);
            patchEnemy({ hp: newEnemyHp });
          }
          appliedDamage += thisApplied;
          connectingHits += 1;
          anyCrit = anyCrit || strike.crit;
          lastStrikeEffectiveness = strike.effectiveness;
          tryGluttonyHeal({ ...enemy, hp: newEnemyHp }, 'enemy');
          setEnemyVolatiles((v) => ({ ...v, tookDamageThisTurn: true }));
          const cat = releaseMove.category === 'physical' ? 'physical' : 'special';
          setEnemyVolatiles((v) => accumulateCounterDamage(v, strike.damage, cat));
          triggerShake();
          playHitSfx(
            releaseMove.category,
            muted,
            moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt),
          );
          triggerHitFx('enemy', 'damage', moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt));
          showDamage(`-${thisApplied}`, 'enemy');
          if (strike.crit) {
            setCritFlash(true);
            window.setTimeout(() => setCritFlash(false), 400);
          }
        } else if (hitSubstitute) {
          triggerShake();
          playHitSfx(
            releaseMove.category,
            muted,
            moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt),
          );
          triggerHitFx('enemy', 'damage', moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt));
          showDamage(`-${strike.damage}`, 'enemy');
        }
        if (newEnemyHp <= 0) break;
        if (strikeResults.length > 1 && i < strikeResults.length - 1) await delay(380);
      }

      if (appliedDamage > 0) {
        if (isContactMove(releaseMove.slug)) {
          const contact = abilityOnContact(getMonAbility(enemy));
          if (contact?.kind === 'status' && Math.random() < contact.chance && canApplyStatus(attacker, contact.status, battleField.weather, weatherOffPlayer)) {
            setPartyMemberStatus(attacker.caughtAt, createStatus(contact.status));
            say(`${attacker.displayName} was ${contact.status === 'paralysis' ? 'paralyzed' : contact.status === 'burn' ? 'burned' : 'poisoned'} by ${abilityLabel(getMonAbility(enemy))}!`);
          } else if (contact?.kind === 'damage') {
            const chip = Math.max(1, Math.floor(maxHpForMon(attacker) * contact.fraction));
            damagePartyMember(attacker.caughtAt, chip);
            say(`${attacker.displayName} was hurt by ${abilityLabel(getMonAbility(enemy))}!`);
          }
          const touch = abilityOnContactAttack(getMonAbility(attacker));
          if (touch?.kind === 'status' && Math.random() < touch.chance && canApplyStatus(enemy, touch.status, battleField.weather, weatherOffPlayer)) {
            patchEnemy({ status: createStatus(touch.status) });
            say(`${enemy.displayName} was poisoned by Poison Touch!`);
          }
        }
        const afterHit = abilityAfterBeingHit({
          defenderAbility: getMonAbility(enemy),
          attackerAbility: getMonAbility(attacker),
          defenderName: enemy.displayName,
          moveType: moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt),
          moveSlug: releaseMove.slug,
          category: releaseMove.category,
          crit: anyCrit,
          damage: appliedDamage,
        });
        for (const msg of afterHit.messages) say(msg);
        if (afterHit.defenderStageDelta) {
          setEnemyStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...afterHit.defenderStageDelta }));
        }
        if (afterHit.defenderTypes) {
          patchEnemy({ types: afterHit.defenderTypes });
        }
        if (afterHit.disableAttackerMove) {
          setPlayerVolatiles((v) => ({ ...v, disabledMoveSlug: releaseMove.slug, disableTurns: 4 }));
        }
        if (afterHit.flinchDefender && !abilityBlocksFlinch(getMonAbility(enemy))) {
          setEnemyVolatiles((v) => ({ ...v, flinched: true }));
        }
      }

      if (hitSubstitute) {
        say(subBroke ? `${enemy.displayName}'s substitute faded!` : 'The substitute took the hit!');
      } else if (appliedDamage > 0) {
        if (anyCrit) say('A critical hit!');
        const times = hitTimesMessage(connectingHits);
        if (times) say(times);
        else say(`Dealt ${appliedDamage} damage!`);
        const note = getEffectivenessLabel(lastStrikeEffectiveness);
        if (note) say(note);
      }
      await delay(strikeResults.length > 1 ? 700 : 1200);

      const post = resolvePostDamage({
        slug: releaseMove.slug,
        move: releaseMove,
        attacker,
        defender: enemy,
        damageDealt: totalDamage,
        damageToMon: appliedDamage,
        connectingHits,
        attackerVolatiles: playerVolatiles,
        defenderVolatiles: enemyVolatiles,
        weather: battleField.weather,
      });
      for (const msg of post.messages) say(msg);
      if (post.defenderStatus) {
        patchEnemy({ status: post.defenderStatus });
        if (post.defenderStatus.kind === 'sleep') {
          setEnemyVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
        }
        if (
          monHasAbility(enemy, 'synchronize') &&
          (post.defenderStatus.kind === 'poison' || post.defenderStatus.kind === 'burn' || post.defenderStatus.kind === 'paralysis') &&
          canApplyStatus(attacker, post.defenderStatus.kind, battleField.weather, weatherOffPlayer)
        ) {
          setPartyMemberStatus(attacker.caughtAt, createStatus(post.defenderStatus.kind));
          say(`${attacker.displayName} was hit by Synchronize!`);
        }
      }
      if (post.defenderVolatilesPatch) {
        setEnemyVolatiles((v) => applyVolatilesPatch(v, post.defenderVolatilesPatch));
      }
      if (post.attackerVolatilesPatch) {
        setPlayerVolatiles((v) => applyVolatilesPatch(v, post.attackerVolatilesPatch));
      }
      if (post.defenderStageDelta) {
        setEnemyStages((s) => mergeStageDelta(s, post.defenderStageDelta));
        const dropped = Object.values(post.defenderStageDelta).some((v) => (v ?? 0) < 0);
        const retaliate = abilityRetaliateStatDrop(getMonAbility(enemy), dropped);
        if (retaliate) {
          setEnemyStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, ...retaliate }));
          say(`${enemy.displayName}'s ${abilityLabel(getMonAbility(enemy))} raised its stats!`);
        }
      }
      if (post.attackerStageDelta) {
        setPlayerStages((s) => mergeStageDelta(s, post.attackerStageDelta));
      }
      if (post.recoilDamage) {
        damagePartyMember(attacker.caughtAt, post.recoilDamage);
        showDamage(`-${post.recoilDamage}`, 'player');
      }
      if (post.drainHeal) {
        useGameStore.getState().healPartyMember(attacker.caughtAt, post.drainHeal);
      }
      if (post.clearSpikes) {
        setBattleField((f) => ({ ...f, spikesActive: false }));
      }

      if (RECHARGE_MOVE_SLUGS.has(releaseMove.slug) && totalDamage > 0 && newEnemyHp > 0) {
        setPlayerPendingTurn({ kind: 'hyper-recharge', move: releaseMove });
      }
      if (post.selfFaint) {
        useGameStore.getState().damagePartyMember(attacker.caughtAt, maxHpForMon(attacker));
        revertActiveTransformIfNeeded();
        setPlayerFaintAnim(true);
      }

      if (newEnemyHp <= 0) {
        const ko = abilityOnKnockOut({
          attackerAbility: getMonAbility(attacker),
          defenderAbility: getMonAbility(enemy),
          contact: isContactMove(releaseMove.slug),
          attackerMaxHp: maxHpForMon(attacker),
        });
        if (ko.aftermathDamage > 0) {
          damagePartyMember(attacker.caughtAt, ko.aftermathDamage);
          say(`${attacker.displayName} was hurt by Aftermath!`);
        }
        if (enemyVolatiles.grudge) {
          patchPartyMember(attacker.caughtAt, {
            pp: { ...(attacker.pp ?? {}), [releaseMove.slug]: 0 },
          });
          say(`${enemy.displayName}'s grudge took ${releaseMove.name}'s PP!`);
        }
        if (ko.moxie) {
          setPlayerStages((s) => mergeStageDelta(s, { ...ZERO_STAGES, atk: 1 }));
          say(`${attacker.displayName}'s Moxie raised its Attack!`);
        }
        if (enemyVolatiles.destinyBond) {
          say(`${enemy.displayName} took ${attacker.displayName} down with it!`);
          useGameStore.getState().damagePartyMember(attacker.caughtAt, maxHpForMon(attacker));
          revertActiveTransformIfNeeded();
          setPlayerFaintAnim(true);
        }
        if (attackGen !== enemyGenRef.current) return 'enemy_fainted';
        await advanceAfterEnemyFaint();
        const selfFainted = post.selfFaint || isFainted(useGameStore.getState().party[0] ?? attacker);
        if (selfFainted) {
          const alive = useGameStore.getState().party.some((m) => !isFainted(m));
          if (alive) setPhase('forcedSwap');
        }
        return 'enemy_fainted';
      }
      if (post.selfFaint) {
        setPhase('forcedSwap');
      }
      return 'continue';
    },
    [
      advanceAfterEnemyFaint,
      canAct,
      enemy,
      enemyHp,
      enemyStages.acc,
      enemyStages.def,
      enemyStages.eva,
      enemyStages.spd,
      moveTypeForFx,
      muted,
      patchEnemy,
      playerStages.acc,
      playerStages.atk,
      playerPendingTurn,
      playerStages.spa,
      say,
      triggerHitFx,
      useMovePp,
      xAttackPhysical,
      xAttackSpecial,
    ],
  );

  const resolveTurn = useCallback(
    async (move: BattleMove, hostUsedAttack: boolean) => {
      const playerMon = useGameStore.getState().party[0];
      if (!playerMon || !enemy) return;

      const playerPriority =
        getMovePriority(move.slug) + abilityPriorityBonus(getMonAbility(playerMon), move.category);
      const weatherOff = weatherIsSuppressed([getMonAbility(playerMon), getMonAbility(enemy)]);
      let playerSpeed =
        effectiveSpeed(playerMon, battleField.weather, weatherOff, {
          unburden: unburdenRef.current.has(playerMon.caughtAt),
        }) * stageMult(playerStages.spe);
      let enemySpeed =
        effectiveSpeed(enemy, battleField.weather, weatherOff, {
          unburden: unburdenRef.current.has(enemy.caughtAt),
        }) * stageMult(enemyStages.spe);
      if (abilityMovesLast(getMonAbility(playerMon)) && !abilityMovesLast(getMonAbility(enemy))) {
        playerSpeed = 0;
      }
      if (abilityMovesLast(getMonAbility(enemy)) && !abilityMovesLast(getMonAbility(playerMon))) {
        enemySpeed = 0;
      }
      const enemyChosen =
        enemyPendingTurn?.kind === 'solar-charge' || enemyPendingTurn?.kind === 'charge'
          ? enemyPendingTurn.move
          : pickEnemyMove(enemy, enemyVolatiles, enemyLastMoveSlug);
      enemyMoveThisTurnRef.current = enemyChosen;
      const enemyPriority = enemyChosen
        ? getMovePriority(enemyChosen.slug) +
          abilityPriorityBonus(getMonAbility(enemy), enemyChosen.category)
        : 0;
      const playerFirst =
        playerPriority !== enemyPriority
          ? playerPriority > enemyPriority
          : playerSpeed >= enemySpeed;

      const runPlayer = async () => {
        const result = await executePlayerAttack(move);
        return result;
      };
      const runEnemy = async () => {
        if (fledRef.current || phaseRef.current === 'result') return false;
        return executeEnemyAttack();
      };
      const battleOver = () => {
        const p = phaseRef.current;
        return p === 'between' || p === 'forcedSwap' || p === 'result' || p === 'victory';
      };

      if (playerFirst) {
        const result = await runPlayer();
        if (result === 'enemy_fainted' || result === 'abort' || fledRef.current || battleOver()) return;
        const wiped = await runEnemy();
        if (wiped || fledRef.current || battleOver()) return;
      } else {
        const wiped = await runEnemy();
        if (wiped || fledRef.current || battleOver()) return;
        const result = await runPlayer();
        if (result === 'enemy_fainted' || result === 'abort' || fledRef.current || battleOver()) return;
      }

      if (fledRef.current) return;
      await tickEndOfTurnStatus();
      if (fledRef.current) return;
      await runChaosIfNeeded(hostUsedAttack);

      setPlayerVolatiles((v) =>
        v.counterPending && !v.counterPending.releaseNextTurn
          ? { ...v, counterPending: { ...v.counterPending, releaseNextTurn: true } }
          : v,
      );
      setEnemyVolatiles((v) =>
        v.counterPending && !v.counterPending.releaseNextTurn
          ? { ...v, counterPending: { ...v.counterPending, releaseNextTurn: true } }
          : v,
      );
    },
    [enemy, enemyPendingTurn, enemyStages.spe, enemyVolatiles, executeEnemyAttack, executePlayerAttack, playerStages.spe, runChaosIfNeeded, tickEndOfTurnStatus],
  );

  resolveTurnRef.current = resolveTurn;

  const onMoveClick = async (move: BattleMove) => {
    if (processing || phase !== 'choose' || !enemy) return;
    if (awaitingGuest != null || outcome) return;

    const owner = party.find((m) => m.caughtAt === move.ownerCaughtAt);
    if (!owner || isFainted(owner)) return;
    if (move.currentPp <= 0) return;
    if (owner.guestLocked) return;

    const activeNow = useGameStore.getState().party[0];

    if (move.splashGag && move.fromActive) {
      const sprite = owner.shiny && owner.shinySprite ? owner.shinySprite : owner.sprite;
      setProcessing(true);
      setSplashGag({ sprite, name: owner.nickname ?? owner.displayName });
      return;
    }

    if (move.hollowPurple && move.fromActive) {
      setProcessing(true);
      setHollowPurple(true);
      return;
    }

    setProcessing(true);
    useMultiplayerStore.getState().setGuestBattlePending(false);

    const hostControlledAttack =
      move.fromActive && !(activeNow?.guestOwned && !activeNow.guestLocked);

    await resolveTurn(move, hostControlledAttack);
    setPhase((p) => (p === 'forcedSwap' || p === 'between' || p === 'result' || p === 'victory' ? p : 'choose'));
    setProcessing(false);
  };

  onMoveClickRef.current = onMoveClick;

  useEffect(() => {
    const pending = playerVolatiles.counterPending;
    if (
      phase !== 'choose' ||
      processing ||
      loading ||
      awaitingGuest ||
      outcome ||
      !pending?.releaseNextTurn ||
      counterReleaseRef.current
    ) {
      return;
    }
    counterReleaseRef.current = true;

    void (async () => {
      setProcessing(true);
      const counterDmg = counterReleaseDamage(pending);
      if (counterDmg > 0 && enemy) {
        const newHp = Math.max(0, enemyHpRef.current - counterDmg);
        commitEnemyHp(newHp);
        patchEnemy({ hp: newHp });
        triggerShake();
        playHitSfx('physical', muted);
        showDamage(`-${counterDmg}`, 'enemy');
        say(`${activeMember?.nickname ?? activeMember?.displayName ?? 'Your Pokémon'} countered the attack!`);
        await delay(900);
        if (newHp <= 0) {
          await advanceAfterEnemyFaint();
        }
      } else {
        say('But it failed!');
        await delay(600);
      }
      setPlayerVolatiles((v) => ({ ...v, counterPending: undefined }));
      setProcessing(false);
      counterReleaseRef.current = false;
    })();
  }, [
    activeMember?.caughtAt,
    activeMember?.displayName,
    activeMember?.nickname,
    advanceAfterEnemyFaint,
    awaitingGuest,
    enemy,
    enemyHp,
    loading,
    muted,
    outcome,
    patchEnemy,
    phase,
    playerVolatiles.counterPending,
    processing,
    say,
  ]);

  useEffect(() => {
    const lock = playerVolatiles.thrashLock ?? (playerVolatiles.rolloutLock ? { slug: 'rollout', turnsLeft: playerVolatiles.rolloutLock.turnsLeft } : null);
    if (!lock || phase !== 'choose' || processing || loading || awaitingGuest || outcome) return;
    if (playerVolatiles.counterPending?.releaseNextTurn) return;
    const active = useGameStore.getState().party[0];
    if (!active || isFainted(active)) return;
    const thrashMove = active.moves.find((m) => m.slug === lock.slug);
    if (!thrashMove) return;

    const runKey = `${lock.slug}:${lock.turnsLeft}`;
    if (thrashAutoRunRef.current === runKey) return;
    thrashAutoRunRef.current = runKey;

    const pendingMove: BattleMove = {
      ...thrashMove,
      ownerCaughtAt: active.caughtAt,
      ownerDisplayName: active.nickname ?? active.displayName,
      fromActive: true,
      currentPp: active.pp?.[thrashMove.slug] ?? thrashMove.maxPp,
      maxPp: thrashMove.maxPp,
    };

    void (async () => {
      setProcessing(true);
      try {
        await resolveTurnRef.current(pendingMove, !(active.guestOwned && !active.guestLocked));
        setPhase((p) => (p === 'forcedSwap' || p === 'between' || p === 'result' || p === 'victory' ? p : 'choose'));
      } finally {
        setProcessing(false);
        thrashAutoRunRef.current = null;
      }
    })();
  }, [
    awaitingGuest,
    loading,
    outcome,
    phase,
    processing,
    playerVolatiles.thrashLock?.slug,
    playerVolatiles.thrashLock?.turnsLeft,
    playerVolatiles.rolloutLock?.turnsLeft,
    playerVolatiles.counterPending?.releaseNextTurn,
  ]);

  useEffect(() => {
    const pending = playerPendingTurn;
    if (!pending || phase !== 'choose' || processing || loading || awaitingGuest || outcome) return;
    if (
      pending.kind !== 'solar-charge' &&
      pending.kind !== 'charge' &&
      pending.kind !== 'hyper-recharge'
    ) {
      return;
    }
    if (pendingAutoRunRef.current) return;

    const active = useGameStore.getState().party[0];
    if (!active || isFainted(active)) return;

    pendingAutoRunRef.current = true;

    const pendingMove: BattleMove = {
      ...pending.move,
      ownerCaughtAt: active.caughtAt,
      ownerDisplayName: active.nickname ?? active.displayName,
      fromActive: true,
      currentPp: active.pp?.[pending.move.slug] ?? pending.move.currentPp,
    };

    void (async () => {
      setProcessing(true);
      try {
        const hostControlledAttack = !(active.guestOwned && !active.guestLocked);
        await resolveTurnRef.current(pendingMove, hostControlledAttack);
        setPhase((p) => (p === 'forcedSwap' || p === 'between' || p === 'result' || p === 'victory' ? p : 'choose'));
      } finally {
        setProcessing(false);
        pendingAutoRunRef.current = false;
      }
    })();
  }, [
    awaitingGuest,
    loading,
    outcome,
    phase,
    processing,
    playerPendingTurn?.kind,
    playerPendingTurn?.move.slug,
  ]);

  useEffect(() => {
    if (!mpConnected) {
      useMultiplayerStore.getState().setBattleHandlers(null, null);
      return;
    }
    useMultiplayerStore.getState().setBattleHandlers(
      (move) => {
        void onMoveClickRef.current(move);
      },
      (caughtAt) => {
        void executePlayerSwitchRef.current(caughtAt);
      },
    );
    return () => useMultiplayerStore.getState().setBattleHandlers(null, null);
  }, [mpConnected]);

  useEffect(() => {
    if (!mpConnected) return;
    const pending =
      guestControlsActive && phase === 'choose' && !processing && !awaitingGuest && !outcome;
    useMultiplayerStore.getState().setGuestBattlePending(pending);
  }, [mpConnected, guestControlsActive, phase, processing, awaitingGuest, outcome]);

  useEffect(() => {
    if (!mpConnected) {
      useMultiplayerStore.getState().setHostBattleSnapshot(null);
      return;
    }
    if (loading || phase === 'prep' || phase === 'intro' || phase === 'victory' || phase === 'result') {
      useMultiplayerStore.getState().setHostBattleSnapshot(null);
      return;
    }
    if (!enemy) return;

    const moves: SpectateBattleMove[] = activeMoves
      .filter((m) => {
        const owner = party.find((p) => p.caughtAt === m.ownerCaughtAt);
        return owner && !owner.guestLocked && !isFainted(owner);
      })
      .map((m) => ({
        slug: m.slug,
        name: m.name,
        type: m.type,
        power: m.power,
        ownerCaughtAt: m.ownerCaughtAt,
        ownerDisplayName: m.ownerDisplayName,
        fromActive: m.fromActive,
        maxPp: m.maxPp,
        currentPp: m.currentPp,
        splashGag: m.splashGag,
        hollowPurple: m.hollowPurple,
      }));

    useMultiplayerStore.getState().setHostBattleSnapshot({
      title,
      phase,
      message,
      enemyName: enemy.displayName,
      enemyId: enemy.id,
      enemyHp,
      enemyMaxHp,
      enemyPower: enemy.level,
      enemyTypes: enemy.types,
      guestControlsActive:
        guestControlsActive && phase === 'choose' && !processing && !awaitingGuest && !outcome,
      moves,
      processing,
    });
  }, [
    mpConnected,
    loading,
    phase,
    enemy,
    enemyHp,
    enemyMaxHp,
    message,
    title,
    activeMoves,
    party,
    guestControlsActive,
    processing,
    awaitingGuest,
    outcome,
  ]);

  useEffect(() => {
    return () => {
      useMultiplayerStore.getState().setHostBattleSnapshot(null);
      useMultiplayerStore.getState().setXAttackAllActive(false);
      useMultiplayerStore.getState().setSkipNextPlayerTurn(false);
      useMultiplayerStore.getState().setGuestBattlePending(false);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'choose' || processing || loading || awaitingGuest || outcome) return;
    if (guestControlsActive) return;
    if (!useMultiplayerStore.getState().skipNextPlayerTurn) return;

    let cancelled = false;
    void (async () => {
      useMultiplayerStore.getState().setSkipNextPlayerTurn(false);
      setProcessing(true);
      say('Chaos forces you to skip your turn!');
      await delay(700);
      if (cancelled || fledRef.current) return;
      const wiped = await enemyAttackRef.current();
      if (!cancelled && !fledRef.current && !wiped) setPhase('choose');
      if (!cancelled && !fledRef.current) setProcessing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, processing, loading, awaitingGuest, outcome, guestControlsActive, say]);

  const spendItemTurn = useCallback(
    async (msg: string) => {
      if (phase !== 'choose' || processing || fledRef.current) return;
      setProcessing(true);
      say(msg);
      await delay(900);
      if (fledRef.current) {
        setProcessing(false);
        return;
      }
      const wiped = await executeEnemyAttack();
      if (!wiped && !fledRef.current) setPhase('choose');
      setProcessing(false);
    },
    [executeEnemyAttack, phase, processing, say],
  );

  const executePlayerSwitch = useCallback(
    async (caughtAt: number, options?: { afterFaint?: boolean }) => {
      const afterFaint = options?.afterFaint ?? false;
      const member = useGameStore.getState().party.find((m) => m.caughtAt === caughtAt);
      if (!member || isFainted(member) || member.guestLocked) return;
      if (useGameStore.getState().party[0]?.caughtAt === caughtAt) return;
      const outgoing = useGameStore.getState().party[0];
      if (outgoing && transformSnapshot) {
        patchPartyMember(outgoing.caughtAt, revertTransform(outgoing, transformSnapshot));
        setTransformSnapshot(null);
      }

      if (!afterFaint && outgoing && !isFainted(outgoing)) {
        const fresh = useGameStore.getState().party.find((m) => m.caughtAt === outgoing.caughtAt) ?? outgoing;
        const leave = abilityOnSwitchOut(getMonAbility(fresh), currentHp(fresh), maxHpForMon(fresh));
        if (leave.clearStatus && fresh.status) {
          setPartyMemberStatus(fresh.caughtAt, undefined);
          say(`${fresh.displayName}'s Natural Cure cured its status!`);
        }
        if (leave.heal > 0) {
          useGameStore.getState().healPartyMember(fresh.caughtAt, leave.heal);
          say(`${fresh.displayName} recovered HP with Regenerator!`);
        }
      }

      // Recall the outgoing mon (and finish pokemon_return) before swapping party order,
      // so the sprite on-field matches the return SFX.
      if (!afterFaint && outgoing && !isFainted(outgoing)) {
        await animatePlayerRecall();
      }

      if (!setActivePartyMember(caughtAt)) return;

      const incoming = useGameStore.getState().party[0];
      setPlayerFaintAnim(false);
      if (incoming) {
        await animatePlayerSendOut(incoming, { announce: true });
      } else {
        say(`Go, ${member.nickname ?? member.displayName}!`);
        playSfx('click', muted);
        await delay(900);
      }

      if (incoming && battleField.spikesActive && !abilityIgnoresSpikes(getMonAbility(incoming), incoming.types)) {
        const max = maxHpForMon(incoming);
        const chip = spikesChipDamage(max, incoming.types, getMonAbility(incoming));
        if (chip > 0) {
          const hp = Math.max(1, (incoming.hp ?? max) - chip);
          patchPartyMember(incoming.caughtAt, { hp });
          say(`Spikes dug into ${incoming.displayName}!`);
          await delay(600);
        }
      }

      setPlayerStages(ZERO_STAGES);
      setPlayerVolatiles(volatilesOnSendOut());
      setPlayerPendingTurn(null);
      if (incoming) {
        if (unburdenRef.current.has(incoming.caughtAt)) {
          setPlayerVolatiles((v) => ({ ...v, unburdenSpeed: true, enteredThisTurn: true }));
        }
        const foe = enemyTeam[enemyIndex] ?? enemy;
        applyIncomingAbility(incoming, foe, 'player');
        tryImposterCopy(incoming, foe, 'player');
      }

      const finishTurn = async () => {
        pendingEndOfTurnRef.current = false;
        await tickEndOfTurnStatus();
        await runChaosIfNeeded(false);
        const active = useGameStore.getState().party[0];
        if (active && !isFainted(active)) {
          setPhase((p) => (p === 'between' || p === 'result' || p === 'victory' ? p : 'choose'));
        }
      };

      if (afterFaint) {
        const runEot = pendingEndOfTurnRef.current;
        const advanceEnemy = pendingEnemyAdvanceRef.current;
        pendingEnemyAdvanceRef.current = false;
        if (runEot) {
          await finishTurn();
        }
        // EOT clears enteredThisTurn; this send-out still counts as the first turn out.
        setPlayerVolatiles((v) => ({ ...v, enteredThisTurn: true }));
        if (advanceEnemy && phaseRef.current !== 'result' && phaseRef.current !== 'victory') {
          await advanceAfterEnemyFaint();
        } else if (!runEot) {
          const active = useGameStore.getState().party[0];
          if (active && !isFainted(active)) {
            setPhase((p) => (p === 'between' || p === 'result' || p === 'victory' ? p : 'choose'));
          }
        }
      } else {
        if (fledRef.current) return;
        const wiped = await executeEnemyAttack();
        if (!wiped && !fledRef.current) {
          await finishTurn();
        }
      }
    },
    [
      animatePlayerRecall,
      animatePlayerSendOut,
      applyIncomingAbility,
      advanceAfterEnemyFaint,
      battleField.spikesActive,
      executeEnemyAttack,
      muted,
      patchPartyMember,
      runChaosIfNeeded,
      say,
      setActivePartyMember,
      tickEndOfTurnStatus,
      transformSnapshot,
    ],
  );

  const handleBattleSendOut = useCallback(
    async (caughtAt: number) => {
      if (processing || phase !== 'choose' || awaitingGuest != null || outcome) return;
      if (playerPendingTurn) {
        say('You cannot switch while preparing or recharging a move!');
        return;
      }
      if (isThrashLocked(playerVolatiles) || isRolloutLocked(playerVolatiles)) {
        say('You cannot switch while locked into a move!');
        return;
      }
      if (isTrapped(playerVolatiles)) {
        say('You cannot switch while trapped!');
        return;
      }
      const lead = useGameStore.getState().party[0];
      if (enemy && lead && abilityTrapsFoe(getMonAbility(enemy), lead.types, getMonAbility(lead))) {
        say(`${enemy.displayName}'s ${abilityLabel(getMonAbility(enemy))} prevents switching!`);
        return;
      }
      setProcessing(true);
      await executePlayerSwitch(caughtAt);
      setProcessing(false);
    },
    [awaitingGuest, executePlayerSwitch, outcome, phase, playerPendingTurn, playerVolatiles, processing, say],
  );

  executePlayerSwitchRef.current = async (caughtAt: number) => {
    if (processing || outcome) return;
    if (phase === 'forcedSwap') {
      setProcessing(true);
      await executePlayerSwitch(caughtAt, { afterFaint: true });
      setProcessing(false);
      return;
    }
    await handleBattleSendOut(caughtAt);
  };

  const applyXAttack = (move: BattleMove) => {
    const alreadyBoosted =
      (move.category === 'physical' && xAttackPhysical) ||
      (move.category === 'special' && xAttackSpecial) ||
      xAttackAllActive;
    const active = useGameStore.getState().party[0];
    const skipConsume = pickupSkipsConsume(getMonAbility(active), !active || pickupUsedRef.current.has(active.caughtAt));
    if (alreadyBoosted || xAttackCount === 0 || !consumeItem('xattack', 1, { skipConsume })) return;
    if (active && skipConsume) pickupUsedRef.current.add(active.caughtAt);
    if (active && monHasAbility(active, 'unburden')) {
      unburdenRef.current.add(active.caughtAt);
      setPlayerVolatiles((v) => ({ ...v, unburdenSpeed: true }));
    }
    if (move.category === 'physical') setXAttackPhysical(true);
    else if (move.category === 'special') setXAttackSpecial(true);
    say(`X-Attack boosted ${move.category} moves for this battle!`);
    playSfx('item', muted);
  };

  const continueToNextEnemy = () => {
    if (continueNextLockRef.current || processing || phase !== 'between') return;
    const nextIndex = enemyIndex + 1;
    const next = enemyTeam[nextIndex];
    if (!next || isFainted(next)) return;
    continueNextLockRef.current = true;
    setProcessing(true);
    void (async () => {
      setEnemyVisible(false);
      sendOutNextEnemy(nextIndex, enemyTeam, { silent: true });
      await animateEnemySendOut(next, { announce: true });
      if (!fledRef.current) setPhase('choose');
      continueNextLockRef.current = false;
      setProcessing(false);
    })();
  };

  const onForcedSwap = (caughtAt: number) => {
    void (async () => {
      setProcessing(true);
      await executePlayerSwitch(caughtAt, { afterFaint: true });
      setProcessing(false);
    })();
  };

  if (loading) {
    return (
      <div className="battle-layout">
        <div className="battle-main">
          <p className="loading">Preparing battle…</p>
        </div>
      </div>
    );
  }

  const effectivenessClass = (mult: number) =>
    mult >= 4
      ? 'gym-effectiveness--quad'
      : mult >= 2
        ? 'gym-effectiveness--super'
        : mult < 1
          ? 'gym-effectiveness--weak'
          : 'gym-effectiveness--normal';

  const displayPower = (move: BattleMove, level: number, boosted: boolean) =>
    formatMovePowerDisplay(move, level, boosted, {
      defenderSpeciesId: enemy?.id ?? 0,
      defenderHp: enemyHpRef.current,
    });

  return (
    <>
      <div className={`battle-layout${shake ? ' battle-layout--shake' : ''}${critFlash ? ' battle-layout--crit' : ''}`}>
        <div className="battle-main">
          <h2 className="screen-title">{title}</h2>
          <div className="battle-hud">
            <PokeCenterVisits lives={lives} />
            <span>{leader.badgeName}</span>
          </div>

          <div className="gym-leader-info">
            <h3
              className={battleContext === 'giovanni' ? 'gym-leader-info__name--giovanni' : undefined}
              data-text={battleContext === 'giovanni' ? leader.name : undefined}
            >
              {leader.name}
            </h3>
            <TypeBadge type={leader.type} />
          </div>

          <BattleFieldScene
            enemy={enemy}
            enemyHp={enemyHp}
            enemyMaxHp={enemyMaxHp}
            enemyStages={enemyStages}
            enemyVolatiles={enemyVolatiles}
            enemyTransformPhase={enemyTransformPhase}
            enemyVisible={enemyVisible}
            enemyFainted={enemyFaintAnim || (!!enemy && enemyHp <= 0 && phase === 'between')}
            enemyTeamLength={enemyTeam.length}
            enemyIndex={enemyIndex}
            player={activeMember ?? null}
            playerHp={activeMember ? currentHp(activeMember) : 0}
            playerMaxHp={activeMember ? maxHpForMon(activeMember) : 0}
            playerStages={playerStages}
            playerVolatiles={playerVolatiles}
            playerVisible={playerVisible}
            playerFainted={playerFaintAnim}
            trainerSprite={leader.sprite}
            trainerName={leader.name}
            trainerSlide={trainerSlide}
            giovanniVfx={battleContext === 'giovanni'}
            ballThrow={ballThrow}
            ballBurst={ballBurst}
            hitFx={hitFx}
            damagePopup={damagePopup}
            onEnemyClick={setSelectedEnemyDetail}
          />

          {message && phase !== 'prep' && (
            <p className="battle-message battle-message--turn">{message}</p>
          )}
          {battleField.weather !== 'none' && phase !== 'prep' && phase !== 'result' && (
            <p className="battle-message battle-message--weather">
              {weatherLabel(battleField.weather)} ({battleField.weatherTurns} turns left)
            </p>
          )}
          {battleField.spikesActive && phase !== 'prep' && phase !== 'result' && (
            <p className="battle-message battle-message--weather">Spikes are scattered on the field!</p>
          )}

          {phase === 'choose' && enemy && hasUsablePokemon && guestControlsActive && (
            <p className="battle-message">Friend is choosing a move…</p>
          )}

          {phase === 'choose' && enemy && hasUsablePokemon && !guestControlsActive && (
            <div className="battle-move-select">
              <p className="battle-move-select__title">Choose a move</p>
              <div className="battle-move-grid">
                {activeMoves.map((move) => {
                  const owner = party.find((m) => m.caughtAt === move.ownerCaughtAt);
                  const fainted = owner ? isFainted(owner) : true;
                  const locked = !!owner?.guestLocked;
                  const moveType =
                    move.slug === 'weather-ball'
                      ? weatherBallType(battleField.weather)
                      : move.slug === 'hidden-power'
                        ? (battleField.hiddenPowerTypes[move.ownerCaughtAt] ?? move.type)
                        : applyRegionMoveType(move.slug, move.type, battleRegion);
                  const mult = getTypeEffectiveness(moveType, enemy.types, battleRegion);
                  const effChip =
                    move.category !== 'status' && !isFixedDamageMove(move.slug)
                      ? getEffectivenessChipLabel(mult)
                      : null;
                  const key = moveKey(move.ownerCaughtAt, move.slug);
                  const boosted =
                    (move.category === 'physical' && (xAttackPhysical || xAttackAllActive)) ||
                    (move.category === 'special' && (xAttackSpecial || xAttackAllActive));
                  const taunted = isTaunted(playerVolatiles) && move.category === 'status';
                  const tormented =
                    !!playerVolatiles.torment && !!move.fromActive && move.slug === playerLastMoveSlug;
                  const ppDepleted = move.currentPp <= 0 || taunted || tormented;
                  const ppLow = move.currentPp <= Math.max(1, Math.floor(move.maxPp * 0.25));
                  const inputBlocked = hostInputLocked || processing;
                  if (move.hollowPurple) {
                    return (
                      <div key={key} className="battle-move-cell">
                        <button
                          type="button"
                          className="battle-move-btn battle-move-btn--hollow"
                          disabled={fainted || locked || inputBlocked}
                          onClick={() => onMoveClick(move)}
                        >
                          <span className="battle-move-btn__cosmic" aria-hidden />
                          <span className="battle-move-btn__name">{move.name}</span>
                          {showTypeEffectiveness && (
                            <span className="gym-effectiveness gym-effectiveness--godlike">GODLIKE</span>
                          )}
                          <span className="battle-move-btn__meta">{move.ownerDisplayName}</span>
                          <span className="battle-move-btn__footer">
                            <span className="battle-move-btn__power">Pwr ∞</span>
                            <span className="battle-move-btn__pp">PP ∞/∞</span>
                          </span>
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="battle-move-cell">
                      <button
                        type="button"
                        className={`battle-move-btn${fainted || ppDepleted || locked ? ' battle-move-btn--disabled' : ''}`}
                        style={{ backgroundColor: TYPE_COLORS[moveType] ?? '#888' }}
                        disabled={fainted || ppDepleted || locked || inputBlocked}
                        onClick={() => onMoveClick(move)}
                      >
                        <span className="battle-move-btn__name">{move.name}</span>
                        {showTypeEffectiveness && effChip && (
                          <span className={`gym-effectiveness ${effectivenessClass(mult)}`}>{effChip}</span>
                        )}
                        <span className="battle-move-btn__meta">
                          {move.ownerDisplayName}
                          {owner?.guestOwned ? ' · friend' : ''}
                          {locked ? ' · locked' : ''}
                        </span>
                        <span className="battle-move-btn__footer">
                          <span className="battle-move-btn__power">
                            Pwr {move.category === 'status' ? '—' : displayPower(move, owner?.level ?? 5, boosted)}
                          </span>
                          <span className={`battle-move-btn__pp${ppLow ? ' battle-move-btn__pp--low' : ''}`}>
                            PP {move.currentPp}/{move.maxPp}
                          </span>
                        </span>
                      </button>
                      {move.category !== 'status' && !fainted && (
                        <button
                          type="button"
                          className="battle-move-xattack"
                          title="Use X-Attack on this move"
                          disabled={
                            (move.category === 'physical' && xAttackPhysical) ||
                            (move.category === 'special' && xAttackSpecial) ||
                            xAttackAllActive ||
                            xAttackCount === 0 ||
                            inputBlocked
                          }
                          onClick={() => applyXAttack(move)}
                        >
                          <ItemIcon
                            id="xattack"
                            icon={xAttackItem?.icon ?? '⚔️'}
                            name="X-Attack"
                            className="battle-move-xattack__icon"
                          />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {allowPaidFlee && (
                <button
                  type="button"
                  className="btn btn--ghost battle-flee-btn"
                  disabled={processing || hostInputLocked || !canAffordFlee}
                  title={
                    runAwayFree
                      ? 'Run Away is free'
                      : canAffordFlee
                        ? `Pay ¥${FLEE_COST} to flee this battle`
                        : `Need ¥${FLEE_COST} to run away`
                  }
                  onClick={() => void handleFlee()}
                >
                  {runAwayFree ? 'Run Away' : `Run Away (¥${FLEE_COST})`}
                </button>
              )}
            </div>
          )}

          {phase === 'between' && !processing && (
            <div className="battle-between">
              <button type="button" className="btn btn--primary" onClick={continueToNextEnemy}>
                Send out next Pokémon
              </button>
            </div>
          )}

          {phase === 'forcedSwap' && (
            <div className="battle-forced-swap">
              <p>Choose a Pokémon to send out:</p>
              <div className="battle-forced-swap__grid">
                {party
                  .filter((m, i) => i !== 0 && !isFainted(m) && !m.guestLocked)
                  .map((m) => (
                    <button
                      key={m.caughtAt}
                      type="button"
                      className="battle-forced-swap__btn"
                      onClick={() => onForcedSwap(m.caughtAt)}
                    >
                      <img src={m.sprite} alt={m.displayName} />
                      {m.nickname ?? m.displayName}
                      {m.guestOwned ? ' ★' : ''}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {phase === 'result' && <p className="battle-message battle-message--result">{message}</p>}
        </div>

        <div className="battle-side">
          <SidePanel
            compact
            allowSwap={
              ((phase === 'prep' || phase === 'between') ||
                (phase === 'choose' && !processing && !playerPendingTurn && !hostInputLocked)) &&
              !guestControlsActive
            }
            battleSendOutOnly={phase === 'choose'}
            onBattleSendOut={handleBattleSendOut}
            allowItems={
              (phase === 'choose' || phase === 'between' || phase === 'forcedSwap') &&
              !processing &&
              !playerPendingTurn &&
              !hostInputLocked &&
              !guestControlsActive
            }
            highlightActive={phase !== 'prep'}
            activeBattlerVolatiles={playerVolatiles}
            activeBattlerStages={playerStages}
            activeHitFx={hitFx?.side === 'player' ? hitFx : null}
            inBattle
            onPotionUsed={() => spendItemTurn('You used a Potion!')}
            onHoneyUsed={() => spendItemTurn('You used Honey!')}
            onElixirUsed={() => spendItemTurn('You used a Max Elixir!')}
            onFullHealUsed={() => spendItemTurn('You used a Full Heal!')}
            shouldSkipItemConsume={(caughtAt) => {
              const mon = useGameStore.getState().party.find((m) => m.caughtAt === caughtAt);
              return pickupSkipsConsume(getMonAbility(mon), !mon || pickupUsedRef.current.has(caughtAt));
            }}
            onItemUsedOnMon={(caughtAt) => {
              const mon = useGameStore.getState().party.find((m) => m.caughtAt === caughtAt);
              if (mon && isPickupStyleAbility(getMonAbility(mon))) {
                pickupUsedRef.current.add(caughtAt);
              }
              if (mon && monHasAbility(mon, 'unburden')) {
                unburdenRef.current.add(caughtAt);
                if (useGameStore.getState().party[0]?.caughtAt === caughtAt) {
                  setPlayerVolatiles((v) => ({ ...v, unburdenSpeed: true }));
                }
              }
            }}
            shouldSkipPotionTurn={(caughtAt) => {
              const mon = useGameStore.getState().party.find((m) => m.caughtAt === caughtAt);
              return monHasAbility(mon, 'unnerve');
            }}
          />
          {phase !== 'prep' && (
            <div className="battle-log">
              <p className="battle-log__title">Battle Log</p>
              <div className="battle-log__entries" ref={logRef}>
                {log.length === 0 ? (
                  <p className="battle-log__empty">The battle is about to begin…</p>
                ) : (
                  log.map((entry, i) => (
                    <p key={i} className="battle-log__entry">
                      {entry}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {phase === 'prep' && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal battle-prep">
            <h3 className="battle-modal__title">Prepare for Battle</h3>
            <p className="battle-modal__subtitle">
              Swap your party before you face {leader.name}. HP carries over between fights — plan
              ahead!
            </p>
            <div className="battle-prep__gym-type">
              <span>Specialty:</span>
              <TypeBadge type={leader.type} />
            </div>
            <p className="battle-prep__team">
              {leader.name} has {leader.pokemon.length} Pokémon
            </p>
            <SidePanel allowSwap highlightActive={false} />
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                startBattleIntro();
              }}
            >
              Start Battle
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showVsIntro && (
          <BattleVsIntro
            key="battle-vs"
            playerName={trainer?.name ?? 'You'}
            playerSprite={trainer?.avatar}
            opponentName={leader.name}
            opponentSprite={leader.sprite}
            battleContext={battleContext}
            muted={muted}
            onDone={onVsIntroDone}
          />
        )}
      </AnimatePresence>

      {phase === 'victory' && winBadge && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal gym-victory">
            <p className="gym-victory__eyebrow">Gym defeated!</p>
            <h3 className="gym-victory__title">You won the {leader.badgeName}!</h3>
            {winBadge.image && (
              <img
                src={winBadge.image}
                alt={winBadge.name}
                className="gym-victory__badge"
                onError={(e) => {
                  const match = winBadge.image?.match(/badges\/(\d+)\.png/);
                  const badgeNum = match ? Number(match[1]) : 0;
                  imgFallback(e, badgeNum > 0 ? remoteBadge(badgeNum) : undefined, PLACEHOLDER_SPRITE);
                }}
              />
            )}
            <p className="gym-victory__subtitle">You defeated {leader.name} and earned a new badge.</p>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                stopClips();
                onWin();
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {splashGag && (
        <MagikarpSplashModal
          sprite={splashGag.sprite}
          name={splashGag.name}
          onDone={() => {
            setSplashGag(null);
            setProcessing(false);
          }}
        />
      )}

      {hollowPurple && (
        <HollowPurpleCinematic
          onComplete={() => {
            stopClips();
            useGameStore.getState().recordChampion();
            setScreen('chadpion');
          }}
        />
      )}

      {selectedEnemyDetail && (
        <PokemonDetailModal
          id={selectedEnemyDetail.id}
          name={selectedEnemyDetail.displayName}
          types={selectedEnemyDetail.types}
          shiny={selectedEnemyDetail.shiny ?? false}
          level={selectedEnemyDetail.level}
          ivs={selectedEnemyDetail.ivs}
          evs={selectedEnemyDetail.evs}
          nature={selectedEnemyDetail.nature}
          moves={selectedEnemyDetail.moves}
          pp={selectedEnemyDetail.pp}
          ability={selectedEnemyDetail.ability}
          gender={selectedEnemyDetail.gender}
          onClose={() => setSelectedEnemyDetail(null)}
        />
      )}
    </>
  );
}
