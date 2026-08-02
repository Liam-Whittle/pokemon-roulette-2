import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
} from '../data/battleMoveResolver';
import {
  clearBattleField,
  EMPTY_BATTLE_FIELD,
  initBattleHiddenPowerTypes,
  spikesChipDamage,
  type BattleField,
} from '../data/battleField';
import { isSunny, tickWeather, weatherLabel } from '../data/battleWeather';
import {
  CHARGE_MOVE_SLUGS,
  chargeMoveMessage,
  confusionSelfDamagePower,
  getMovePriority,
  HALF_HEAL_MOVES,
  isConfused,
  isRolloutLocked,
  isSemiInvulnerableMove,
  pickRandomTransformTarget,
  revertTransform,
  rollConfusionSelfHit,
  storedMoveFromSlug,
  WEATHER_HEAL_MOVES,
  type TransformSnapshot,
} from '../data/moveEffects';
import {
  accumulateCounterDamage,
  clearMoveLocks,
  clearVolatiles,
  EMPTY_VOLATILES,
  isSemiInvulnerable,
  isThrashLocked,
  isTrapped,
  tickVolatileTurns,
  type BattleVolatiles,
} from '../data/battleVolatiles';
import { healFractionForMove, mergeFieldPatch } from '../utils/battleStatusApply';
import { getTypeEffectiveness, getEffectivenessChipLabel, buildHitBattleMessage, TYPE_COLORS } from '../data/typeChart';
import { applyRegionMoveType } from '../data/gen2MoveTypes';
import { SidePanel } from './SidePanel';
import { isSelfStatusMove } from '../data/statusMoveTarget';
import { BattleEffectBadges, hasVisibleBattleEffects, StageBadges, hasVisibleStageChanges } from './StatusBadge';
import { TypeBadge } from './TypeBadge';
import { ItemIcon } from './ItemIcon';
import { MagikarpSplashModal } from './MagikarpSplashModal';
import { HollowPurpleCinematic } from './HollowPurpleCinematic';
import { PokemonDetailModal } from './PokemonDetailModal';
import { useGameStore } from '../store/useGameStore';
import { playHitSfx, playSfx } from '../utils/sound';
import { playClip, stopClips } from '../utils/music';
import { PokeCenterVisits } from './PokeDollar';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import {
  battleGifOnError,
  imgFallback,
  localBattleGif,
  remoteBadge,
  remoteTrainerSprite,
} from '../utils/localAssets';
import { buildEnemyTeam } from '../utils/enemyMon';
import { currentHp, effectiveSpeed, isFainted, maxHpForMon } from '../utils/stats';
import {
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
import { pickRandom } from '../data/pools';
import type { Badge, BattleMove, CaughtPokemon, GymLeader, PokemonData, StoredMove } from '../types/game';

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

function HpBar({ current, max, label }: { current: number; max: number; label?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const tone = ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low';
  return (
    <div className="hp-bar-wrap">
      {label && <span className="hp-bar__label">{label}</span>}
      <div className={`hp-bar hp-bar--${tone}${ratio <= 0.2 && ratio > 0 ? ' hp-bar--pulse' : ''}`}>
        <div className="hp-bar__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="hp-bar__text">
        {current}/{max}
      </span>
    </div>
  );
}

function pickEnemyMove(enemyMon: CaughtPokemon, volatiles: BattleVolatiles): StoredMove | null {
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
  const pool = enemyMon.moves.filter((m) => m.slug !== volatiles.disabledMoveSlug);
  // Untransformed Ditto should open with Transform
  if (enemyMon.id === 132) {
    const transform = pool.find((m) => m.slug === 'transform');
    if (transform) return transform;
  }
  const damaging = pool.filter((m) => m.category !== 'status' && m.power > 0);
  const picks = damaging.length > 0 ? damaging : pool;
  if (picks.length === 0) return null;
  return picks[Math.floor(Math.random() * picks.length)];
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
  const battleRegion = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));

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
  const [splashGag, setSplashGag] = useState<{ sprite: string; name: string } | null>(null);
  const [hollowPurple, setHollowPurple] = useState(false);
  const [playerPendingTurn, setPlayerPendingTurn] = useState<PendingTurn | null>(null);
  const [enemyPendingTurn, setEnemyPendingTurn] = useState<EnemyPendingTurn | null>(null);
  const [playerStages, setPlayerStages] = useState<StatStages>(ZERO_STAGES);
  const [enemyStages, setEnemyStages] = useState<StatStages>(ZERO_STAGES);
  const [playerVolatiles, setPlayerVolatiles] = useState<BattleVolatiles>(EMPTY_VOLATILES);
  const [enemyVolatiles, setEnemyVolatiles] = useState<BattleVolatiles>(EMPTY_VOLATILES);
  const [transformSnapshot, setTransformSnapshot] = useState<TransformSnapshot | null>(null);
  const [enemyTransformPhase, setEnemyTransformPhase] = useState<'out' | 'in' | null>(null);
  const [playerLastMoveSlug, setPlayerLastMoveSlug] = useState<string | null>(null);
  const [enemyLastMoveSlug, setEnemyLastMoveSlug] = useState<string | null>(null);
  const [battleField, setBattleField] = useState<BattleField>(EMPTY_BATTLE_FIELD);

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
  /** Set immediately on paid flee so in-flight turns cannot still hit the player. */
  const fledRef = useRef(false);
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
        setPlayerVolatiles(clearVolatiles());
        setEnemyVolatiles(clearVolatiles());
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
          setPhase(snap.phase ?? 'choose');
          if (snap.message) setMessage(snap.message);
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
      phase,
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
      setPlayerVolatiles(clearVolatiles());
    }
  }, [party, phase]);

  const sendOutNextEnemy = useCallback(
    (index: number, team: CaughtPokemon[]) => {
      const mon = team[index];
      if (!mon) return;
      const max = maxHpForMon(mon);
      let hp = max;
      if (battleField.spikesActive && !mon.types.includes('flying')) {
        const chip = spikesChipDamage(max, mon.types);
        hp = Math.max(1, max - chip);
        if (chip > 0) {
          say(`Spikes dug into ${mon.displayName}!`);
        }
      }

      const finalMon: CaughtPokemon = { ...mon, status: undefined, hp };

      setEnemyIndex(index);
      commitEnemyHp(hp);
      setXAttackPhysical(false);
      setXAttackSpecial(false);
      setEnemyPendingTurn(null);
      setEnemyStages(ZERO_STAGES);
      setEnemyVolatiles(clearVolatiles());
      setEnemyLastMoveSlug(null);
      setEnemyTransformPhase(null);
      setEnemyTeam((prev) => prev.map((m, i) => (i === index ? finalMon : m)));
      const species = enemySpeciesById[finalMon.id] ?? enemySpeciesById[mon.id];
      if (species) markSeen(species);
      say(`${leader.name} sent out ${mon.displayName}!`);
      playSfx('battle', muted);
    },
    [battleField.spikesActive, enemySpeciesById, leader.name, markSeen, muted, say],
  );

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
    window.setTimeout(() => setDamagePopup(null), 900);
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
  const canAffordFlee = money >= FLEE_COST;

  const handleFlee = useCallback(async () => {
    if (!allowPaidFlee || processing || fledRef.current) return;
    if (money < FLEE_COST) {
      say(`You need ¥${FLEE_COST} to run away!`);
      return;
    }
    // Lock combat out before any await so a pending enemy turn cannot land.
    fledRef.current = true;
    setProcessing(true);
    setPhase('result');
    setDamagePopup(null);
    setShake(false);
    if (!spendMoney(FLEE_COST)) {
      fledRef.current = false;
      setProcessing(false);
      setPhase('choose');
      say(`You need ¥${FLEE_COST} to run away!`);
      return;
    }
    clearBattleSnapshot();
    say(`You paid ¥${FLEE_COST} and ran away!`);
    playSfx('fail', muted);
    onFlee?.();
    setLastResult({
      type: 'gym',
      success: false,
      message: `You paid ¥${FLEE_COST} and fled from ${leader.name}.`,
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
    setLastResult({
      type: 'gym',
      success: true,
      badge: winBadge,
      message: finalVictory
        ? `You defeated ${leader.name} and claimed the title!`
        : `You defeated ${leader.name}!`,
    });

    if (winBadge && !finalVictory) {
      playClip(asset('sounds/gym_victory.mp3'), 0.4);
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
    // Petal Dance / Thrash / Rollout must not auto-continue into the next opponent.
    setPlayerVolatiles((v) => clearMoveLocks(v));
    thrashAutoRunRef.current = null;
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

  const tickEndOfTurnStatus = useCallback(async () => {
    const player = useGameStore.getState().party[0];
    if (player && player.status) {
      const ticked = tickStatusDamage(player);
      if (ticked.damage > 0) {
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
      if (ticked.damage > 0) {
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
    pendingEndOfTurnRef.current = false;
  }, [advanceAfterEnemyFaint, battleField.weatherTurns, damagePartyMember, enemy, enemyHp, enemyVolatiles, handlePartyWipe, muted, patchEnemy, playerVolatiles.cursed, playerVolatiles.leechSeeded, say]);

  const canAct = useCallback(
    (
      mon: CaughtPokemon,
      side: 'player' | 'enemy',
      volatiles: BattleVolatiles,
    ): { canAct: boolean; message?: string; statusAfter?: CaughtPokemon['status'] } => {
      if (isFainted(mon)) return { canAct: false };
      if (isAsleep(mon.status)) {
        const after = tickSleep(mon.status!);
        if (side === 'player') setPartyMemberStatus(mon.caughtAt, after);
        else patchEnemy({ status: after });
        // Whether still asleep or just waking this turn, the Pokémon cannot act.
        // (Waking no longer grants a free attack on the same turn.)
        return after
          ? { canAct: false, message: `${mon.displayName} is fast asleep!`, statusAfter: after }
          : { canAct: false, message: `${mon.displayName} woke up!`, statusAfter: undefined };
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
      if (isConfused(volatiles)) {
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

    const actCheck = canAct(enemy, 'enemy', enemyVolatiles);
    if (actCheck.message) say(actCheck.message);
    if (!actCheck.canAct) return false;

    if (enemyPendingTurn?.kind === 'hyper-recharge') {
      setEnemyPendingTurn(null);
      say(`${leader.name}'s ${enemy.displayName} must recharge!`);
      await delay(900);
      return false;
    }

    const stored =
      enemyPendingTurn?.kind === 'solar-charge' || enemyPendingTurn?.kind === 'charge'
        ? enemyPendingTurn.move
        : pickEnemyMove(enemy, enemyVolatiles);
    if (!stored) return false;

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

    // Fly / Dig charge turn: attacks against the user can't connect.
    if (isSemiInvulnerable(playerVolatiles) && !isSelfStatusMove(stored.slug)) {
      say(
        `${leader.name}'s ${enemy.displayName} used ${stored.name}! ${target.nickname ?? target.displayName} avoided the attack!`,
      );
      playSfx('fail', muted);
      await delay(900);
      return false;
    }

    const hitAccuracy = Math.max(
      1,
      Math.min(
        100,
        effectiveAccuracy(stored.slug, stored.accuracy, enemyVolatiles, battleField.weather) *
          (stageMult(enemyStages.acc) / stageMult(playerStages.eva)),
      ),
    );

    if (stored.category === 'status') {
      if (!rollHit(hitAccuracy)) {
        say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! But it missed!`);
        await delay(900);
        return false;
      }
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}!`);
      const transformTarget =
        stored.slug === 'transform'
          ? pickRandomTransformTarget(useGameStore.getState().party) ?? target
          : undefined;
      const statusResult = resolveStatusMove({
        slug: stored.slug,
        move: stored,
        attacker: enemy,
        defender: target,
        attackerVolatiles: enemyVolatiles,
        defenderVolatiles: playerVolatiles,
        defenderLastMoveSlug: playerLastMoveSlug,
        transformTarget,
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
        setBattleField((f) => mergeFieldPatch(f, statusResult.fieldPatch));
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
      if (HALF_HEAL_MOVES.has(stored.slug) && statusResult.healFraction == null && !WEATHER_HEAL_MOVES.has(stored.slug)) {
        const max = maxHpForMon(enemy);
        const healed = Math.min(max, enemyHpRef.current + Math.max(1, Math.floor(max / 2)));
        commitEnemyHp(healed);
        patchEnemy({ hp: healed });
      }
      await delay(900);
      return false;
    }

    const dmgResult = resolveDamageHits({
      move: stored,
      attacker: enemy,
      defender: target,
      defenderHp: currentHp(target),
      attackerVolatiles: enemyVolatiles,
      defenderVolatiles: playerVolatiles,
      attackerStages: enemyStages,
      defenderStages: playerStages,
      region: battleRegion,
      weather: battleField.weather,
      hitAccuracy,
    });

    if (dmgResult.missed) {
      say(`${leader.name}'s ${enemy.displayName} used ${stored.name}! But it missed!`);
      await delay(900);
      return false;
    }

    const totalDamage = dmgResult.totalDamage;
    const lastCrit = dmgResult.lastCrit;
    const lastEffectiveness = dmgResult.lastEffectiveness;

    if (fledRef.current) return false;

    if (dmgResult.presentHeal) {
      useGameStore.getState().healPartyMember(target.caughtAt, dmgResult.presentHeal);
      say(`${leader.name}'s ${enemy.displayName} used Present! ${target.displayName} recovered HP!`);
      await delay(900);
      return false;
    }

    if (totalDamage > 0) {
      damagePartyMember(target.caughtAt, totalDamage);
      const cat = stored.category === 'physical' ? 'physical' : 'special';
      setPlayerVolatiles((v) => accumulateCounterDamage(v, dmgResult.lastHitDamage, cat));
      triggerShake();
      playHitSfx(stored.category, muted, moveTypeForFx(stored));
      triggerHitFx('player', 'damage', moveTypeForFx(stored));
      showDamage(`-${totalDamage}`, 'player');
    } else {
      playSfx('fail', muted);
    }
    say(
      buildHitBattleMessage(
        `${leader.name}'s ${enemy.displayName} used ${stored.name}!`,
        lastEffectiveness,
        totalDamage,
        lastCrit,
      ),
    );
    await delay(1200);

    const post = resolvePostDamage({
      slug: stored.slug,
      move: stored,
      attacker: enemy,
      defender: target,
      damageDealt: totalDamage,
      connectingHits: dmgResult.hits,
      attackerVolatiles: enemyVolatiles,
      defenderVolatiles: playerVolatiles,
    });
    for (const msg of post.messages) say(msg);
    if (post.defenderStatus) {
      setPartyMemberStatus(target.caughtAt, post.defenderStatus);
      if (post.defenderStatus.kind === 'sleep') {
        setPlayerVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
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
    if (stored.slug === 'hyper-beam' && totalDamage > 0 && updated && !isFainted(updated)) {
      setEnemyPendingTurn({ kind: 'hyper-recharge', move: stored });
    }
    if (post.selfFaint && totalDamage > 0) {
      patchEnemy({ hp: 0 });
      commitEnemyHp(0);
      await advanceAfterEnemyFaint();
      return false;
    }
    if (!updated || isFainted(updated)) {
      const alive = useGameStore.getState().party.some((m) => !isFainted(m));
      if (!alive) {
        await handlePartyWipe();
        return true;
      }
      revertActiveTransformIfNeeded();
      pendingEndOfTurnRef.current = true;
      setPhase('forcedSwap');
      say(`${target.nickname ?? target.displayName} fainted! Choose a replacement.`);
      playSfx('fail', muted);
      return true;
    }
    return false;
  }, [advanceAfterEnemyFaint, canAct, damagePartyMember, enemy, enemyHp, enemyPendingTurn, enemyStages.atk, enemyStages.spa, enemySpeciesById, handlePartyWipe, leader.name, markSeen, moveTypeForFx, muted, patchEnemy, playerStages.def, playerStages.spd, say, setPartyMemberStatus, triggerHitFx]);

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
            setPlayerVolatiles(clearVolatiles());
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
      const attacker = useGameStore.getState().party[0];
      if (!attacker || isFainted(attacker)) return 'abort';

      const actCheck = canAct(attacker, 'player', playerVolatiles);
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

      // Fly / Dig charge turn: foe is untargetable until they come down / up.
      if (isSemiInvulnerable(enemyVolatiles) && !isSelfStatusMove(releaseMove.slug)) {
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

      const hitAccuracy = Math.max(
        1,
        Math.min(
          100,
          effectiveAccuracy(releaseMove.slug, releaseMove.accuracy, playerVolatiles, battleField.weather) *
            (stageMult(playerStages.acc) / stageMult(enemyStages.eva)),
        ),
      );

      if (releaseMove.category === 'status') {
        if (!rollHit(hitAccuracy)) {
          say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! But it missed!`);
          await delay(900);
          return 'continue';
        }
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
          setBattleField((f) => mergeFieldPatch(f, statusResult.fieldPatch));
        }
        if (statusResult.clearAttackerStatus) {
          setPartyMemberStatus(attacker.caughtAt, undefined);
        }
        if (statusResult.attackerHpCost) {
          damagePartyMember(attacker.caughtAt, statusResult.attackerHpCost);
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
        if (statusResult.metronomeSlug) {
            const mimicked = storedMoveFromSlug(statusResult.metronomeSlug);
            if (mimicked) {
              say(`Metronome called ${mimicked.name}!`);
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

      const dmgResult = resolveDamageHits({
        move: releaseMove,
        attacker,
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
      });

      if (dmgResult.missed) {
        say(`${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}! But it missed!`);
        await delay(900);
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

      const newEnemyHp = Math.max(0, enemyHpRef.current - totalDamage);
      commitEnemyHp(newEnemyHp);
      patchEnemy({ hp: newEnemyHp });
      if (totalDamage > 0) {
        const cat = releaseMove.category === 'physical' ? 'physical' : 'special';
        setEnemyVolatiles((v) => accumulateCounterDamage(v, dmgResult.lastHitDamage, cat));
        triggerShake();
        playHitSfx(
          releaseMove.category,
          muted,
          moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt),
        );
        triggerHitFx('enemy', 'damage', moveTypeForFx(releaseMove, releaseMove.ownerCaughtAt));
        showDamage(`-${totalDamage}`, 'enemy');
      } else {
        playSfx('fail', muted);
      }
      if (lastCrit && totalDamage > 0) {
        setCritFlash(true);
        window.setTimeout(() => setCritFlash(false), 500);
      }

      say(
        buildHitBattleMessage(
          `${attacker.nickname ?? attacker.displayName} used ${releaseMove.name}!`,
          lastEffectiveness,
          totalDamage,
          lastCrit,
        ),
      );
      await delay(1200);

      const post = resolvePostDamage({
        slug: releaseMove.slug,
        move: releaseMove,
        attacker,
        defender: enemy,
        damageDealt: totalDamage,
        connectingHits: dmgResult.hits,
        attackerVolatiles: playerVolatiles,
        defenderVolatiles: enemyVolatiles,
      });
      for (const msg of post.messages) say(msg);
      if (post.defenderStatus) {
        patchEnemy({ status: post.defenderStatus });
        if (post.defenderStatus.kind === 'sleep') {
          setEnemyVolatiles((v) => applyVolatilesPatch(v, volatilesPatchOnSleep(v)));
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

      if (releaseMove.slug === 'hyper-beam' && totalDamage > 0 && newEnemyHp > 0) {
        setPlayerPendingTurn({ kind: 'hyper-recharge', move: releaseMove });
      }
      if (post.selfFaint && totalDamage > 0) {
        useGameStore.getState().damagePartyMember(attacker.caughtAt, maxHpForMon(attacker));
        revertActiveTransformIfNeeded();
        setPhase('forcedSwap');
      }

      if (newEnemyHp <= 0) {
        await advanceAfterEnemyFaint();
        return 'enemy_fainted';
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

      const playerPriority = getMovePriority(move.slug);
      const playerSpeed = effectiveSpeed(playerMon) * stageMult(playerStages.spe);
      const enemySpeed = effectiveSpeed(enemy) * stageMult(enemyStages.spe);
      const playerFirst = playerPriority > 0 || (playerPriority === 0 && playerSpeed >= enemySpeed);

      const runPlayer = async () => {
        const result = await executePlayerAttack(move);
        return result;
      };
      const runEnemy = async () => {
        if (fledRef.current || phaseRef.current === 'result') return false;
        return executeEnemyAttack();
      };

      if (playerFirst) {
        const result = await runPlayer();
        if (result === 'enemy_fainted' || result === 'abort' || fledRef.current) return;
        const wiped = await runEnemy();
        if (wiped || fledRef.current) return;
      } else {
        const wiped = await runEnemy();
        if (wiped || fledRef.current) return;
        const result = await runPlayer();
        if (result === 'enemy_fainted' || result === 'abort' || fledRef.current) return;
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
    [enemy, enemyStages.spe, executeEnemyAttack, executePlayerAttack, playerStages.spe, runChaosIfNeeded, tickEndOfTurnStatus],
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
    if (loading || phase === 'prep' || phase === 'victory' || phase === 'result') {
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
      if (!setActivePartyMember(caughtAt)) return;

      const incoming = useGameStore.getState().party[0];
      if (incoming && battleField.spikesActive && !incoming.types.includes('flying')) {
        const max = maxHpForMon(incoming);
        const chip = spikesChipDamage(max, incoming.types);
        if (chip > 0) {
          const hp = Math.max(1, (incoming.hp ?? max) - chip);
          patchPartyMember(incoming.caughtAt, { hp });
          say(`Spikes dug into ${incoming.displayName}!`);
          await delay(600);
        }
      }

      setPlayerStages(ZERO_STAGES);
      setPlayerVolatiles(clearVolatiles());
      setPlayerPendingTurn(null);
      say(`Go, ${member.nickname ?? member.displayName}!`);
      playSfx('click', muted);
      await delay(900);

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
        if (pendingEndOfTurnRef.current) {
          await finishTurn();
        } else {
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
    if (alreadyBoosted || xAttackCount === 0 || !consumeItem('xattack', 1)) return;
    if (move.category === 'physical') setXAttackPhysical(true);
    else if (move.category === 'special') setXAttackSpecial(true);
    say(`X-Attack boosted ${move.category} moves for this battle!`);
    playSfx('item', muted);
  };

  const continueToNextEnemy = () => {
    const nextIndex = enemyIndex + 1;
    sendOutNextEnemy(nextIndex, enemyTeam);
    setPhase('choose');
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
      defenderSpeciesId: enemy.id,
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
            {enemyTeam.length > 1 && (
              <span className="battle-team-pips">
                {enemyTeam.map((_, i) => (
                  <span
                    key={i}
                    className={`battle-team-pip${i < enemyIndex ? ' battle-team-pip--done' : ''}${i === enemyIndex ? ' battle-team-pip--active' : ''}`}
                  />
                ))}
              </span>
            )}
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

          {enemy && (
            <div className="battle-scene">
              {leader.sprite && (
                <div
                  className={`battle-trainer__sprite-wrap${
                    battleContext === 'giovanni' ? ' battle-trainer__sprite-wrap--giovanni' : ''
                  }`}
                >
                  <img
                    src={leader.sprite}
                    alt={leader.name}
                    className="battle-trainer__sprite"
                    onError={(e) => {
                      const filename = leader.sprite?.split('/').pop();
                      imgFallback(
                        e,
                        filename ? remoteTrainerSprite(filename) : undefined,
                        PLACEHOLDER_SPRITE,
                      );
                    }}
                  />
                  {battleContext === 'giovanni' && (
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
              <div className="gym-enemy">
                <div
                  className={`gym-enemy__sprite-wrap${
                    enemyTransformPhase ? ' gym-enemy__sprite-wrap--transforming' : ''
                  }`}
                >
                  {enemyTransformPhase && (
                    <span
                      className={`gym-enemy__transform-flash gym-enemy__transform-flash--${enemyTransformPhase}`}
                      aria-hidden
                    />
                  )}
                  {hitFx?.side === 'enemy' && (
                    <span
                      key={`hit-fx-${hitFx.id}`}
                      className={`battle-hit-fx battle-hit-fx--${hitFx.mode} battle-hit-fx--type-${hitFx.type}`}
                      style={
                        {
                          '--hit-color':
                            hitFx.mode === 'buff'
                              ? '#fbbf24'
                              : (TYPE_COLORS[hitFx.type] ?? TYPE_COLORS.normal),
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
                  )}
                  <img
                    key={`enemy-gif-${enemy.id}-${enemyIndex}-${enemy.shiny ? 's' : 'n'}-${enemyTransformPhase ?? 'idle'}`}
                    src={
                      enemy.shiny && enemy.shinySprite
                        ? enemy.shinySprite
                        : localBattleGif(enemy.id)
                    }
                    alt={enemy.displayName}
                    className={`gym-enemy__sprite gym-enemy__sprite--clickable${
                      enemyTransformPhase
                        ? ` gym-enemy__sprite--transform-${enemyTransformPhase}`
                        : ''
                    }${
                      hitFx?.side === 'enemy' && hitFx.mode === 'damage'
                        ? ' gym-enemy__sprite--hit-damage'
                        : ''
                    }${
                      hitFx?.side === 'enemy' && hitFx.mode === 'status'
                        ? ' gym-enemy__sprite--hit-status'
                        : ''
                    }${
                      hitFx?.side === 'enemy' && hitFx.mode === 'buff'
                        ? ' gym-enemy__sprite--hit-buff'
                        : ''
                    }`}
                    title={`View ${enemy.displayName} details`}
                    aria-label={`View ${enemy.displayName} details`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedEnemyDetail(enemy)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedEnemyDetail(enemy);
                      }
                    }}
                    onError={(e) => {
                      const img = e.currentTarget;
                      delete img.dataset.remoteFallback;
                      battleGifOnError(e, enemy.id, enemy.sprite || PLACEHOLDER_SPRITE);
                    }}
                  />
                </div>
                <p className="gym-enemy__name">{enemy.displayName}</p>
                {hasVisibleBattleEffects(enemy.status, enemyVolatiles) && (
                  <div className="gym-enemy__status-row">
                    <BattleEffectBadges
                      status={enemy.status}
                      volatiles={enemyVolatiles}
                      placement="battle-row"
                    />
                  </div>
                )}
                {hasVisibleStageChanges(enemyStages) && (
                  <div className="gym-enemy__status-row">
                    <StageBadges stages={enemyStages} placement="battle-row" />
                  </div>
                )}
                <HpBar current={enemyHp} max={enemyMaxHp} />
                <span className="gym-enemy__power">Lv. {enemy.level}</span>
                <div className="gym-enemy__types">
                  {enemy.types.map((type) => (
                    <TypeBadge key={type} type={type} size="sm" />
                  ))}
                </div>
              </div>
              {damagePopup && (
                <span className={`battle-damage battle-damage--${damagePopup.side}`}>
                  {damagePopup.text}
                </span>
              )}
            </div>
          )}

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
                    move.slug === 'hidden-power'
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
                  const ppDepleted = move.currentPp <= 0;
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
                    canAffordFlee
                      ? `Pay ¥${FLEE_COST} to flee this battle`
                      : `Need ¥${FLEE_COST} to run away`
                  }
                  onClick={() => void handleFlee()}
                >
                  Run Away (¥{FLEE_COST})
                </button>
              )}
            </div>
          )}

          {phase === 'between' && (
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
            onElixirUsed={() => spendItemTurn('You used a Max Elixir!')}
            onFullHealUsed={() => spendItemTurn('You used a Full Heal!')}
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
                sendOutNextEnemy(0, enemyTeam);
                setPhase('choose');
              }}
            >
              Start Battle
            </button>
          </div>
        </div>
      )}

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
          onClose={() => setSelectedEnemyDetail(null)}
        />
      )}
    </>
  );
}
