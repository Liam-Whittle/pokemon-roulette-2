import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Confetti } from '../../components/Confetti';
import { TypeBadge } from '../../components/TypeBadge';
import { battleGifOnError, localBattleGif } from '../../utils/localAssets';
import { playPokemonCry, playSfx, preloadSpireCombatSfx } from '../../utils/sound';
import { useGameStore } from '../../store/useGameStore';
import { CHARACTERS } from '../data/characters';
import { cardNeedsTarget, resolveCard } from '../data/cards';
import { STATUS_TIPS } from '../data/keywordTips';
import { ENEMIES } from '../data/enemies';
import { CardFlightLayer } from '../components/CardFlightLayer';
import {
  STAGGER_MS,
  diffCardZones,
  fallbackHandPose,
  pilePose,
  poseFromEl,
  prefersReducedMotion,
  type CardFlight,
  type CardPose,
  type ZoneSnap,
} from '../components/cardFlight';
import { KIND_LABEL, groupDeck } from '../components/DeckModal';
import { SpireCard } from '../components/SpireCard';
import { EnergyPips, HpBar, PotionBar, RelicBar } from '../components/SpireHud';
import { SpireTip } from '../components/SpireTip';
import { canPlayCard, chargePotency, chargeSlots, displayedIntentAmount, liveCardDescription, previewEnemyActions } from '../engine/combat';
import { mulberry32, shuffle } from '../engine/rng';
import { useSpireStore } from '../store/useSpireStore';
import type { CardDef, CardInstance, CombatEnemy, CombatFx, CombatState, EnemyIntentKind, EnemyIntentPattern } from '../types';
import { handArchDrop, handFanPose } from './handFan';

type PileKind = 'draw' | 'discard' | 'exhaust';

const INTENT: Record<EnemyIntentKind, { icon: string; label: (n: number, intent?: EnemyIntentPattern) => string }> = {
  attack: { icon: '⚔', label: (n) => `Attack ${n}` },
  attackDebuff: { icon: '⚔', label: (n) => `Attack ${n}` },
  multiAttack: { icon: '⚔', label: (n, intent) => `Attack ${n}×${intent?.times ?? 2}` },
  block: { icon: '🛡', label: (n) => `Block ${n}` },
  buff: { icon: '↑', label: (n) => `Buff +${n}` },
  buffAlly: { icon: '↑', label: (n) => `Buff allies +${n}` },
  heal: { icon: '✚', label: (n) => `Heal ${n}` },
  status: {
    icon: '☠',
    label: (_n, intent) => {
      const name = intent?.status ? intent.status[0]!.toUpperCase() + intent.status.slice(1) : 'Status';
      const stacks = intent?.statusStacks;
      return stacks ? `${name} ${stacks}` : name;
    },
  },
  summon: { icon: '+', label: () => 'Summon' },
};

const ACTION_GAP_MS = 720;
const ACTION_WINDUP_MS = 220;
const seenCombatFxIds = new Set<number>();

type FoeVitals = { hp: number; block: number };

function isEnemyHitFx(cue: CombatFx): boolean {
  return cue.kind === 'hitEnemy' || cue.kind === 'petal' || cue.kind === 'flare';
}

function cueDelay(cue: CombatFx): number {
  if (cue.kind === 'surf') return 420;
  if (cue.kind === 'faint') return 360;
  if (cue.kind === 'petal') return 200;
  if (cue.kind === 'relicGlow') return 80;
  return 160;
}

function foeVitalsOf(enemy: CombatEnemy): FoeVitals {
  return { hp: enemy.hp, block: enemy.block };
}

interface DragState {
  card: CardInstance;
  pointerId: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  dragging: boolean;
}

interface FloatHit {
  id: number;
  text: string;
}

function enemyFromPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return el?.closest<HTMLElement>('[data-enemy-id]')?.dataset.enemyId ?? null;
}

function skillGrantsBlock(def: CardDef): boolean {
  return def.effects.some((e) => e.op === 'block' || e.op === 'blockTimes' || e.op === 'blockEqualToStatus');
}

function pointInCombatDock(x: number, y: number): boolean {
  const dock = document.querySelector<HTMLElement>('[data-spire-dock]');
  if (!dock) return false;
  const r = dock.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function isAttackKind(kind: EnemyIntentKind): boolean {
  return kind === 'attack' || kind === 'attackDebuff' || kind === 'multiAttack';
}

function traitPills(enemy: CombatEnemy): { key: string; label: string; body: string }[] {
  const t = enemy.traits;
  if (!t) return [];
  const out: { key: string; label: string; body: string }[] = [];
  if (t.curlUp) out.push({ key: 'curl', label: `Curl Up ${t.curlUp}`, body: 'The first unblocked hit this combat grants Block.' });
  if (t.explodeOnDeath) out.push({ key: 'boom', label: `Explodes ${t.explodeOnDeath}`, body: 'Deals damage to you when it faints, but only if another foe is still standing.' });
  if (t.thorns) out.push({ key: 'thorns', label: `Thorns ${t.thorns}`, body: 'Damages you when it takes HP damage.' });
  if (t.enrageOnSkill) out.push({ key: 'enrage', label: `Enrage ${t.enrageOnSkill}`, body: 'Gains Strength this turn whenever you play a Skill. The bonus fades next turn.' });
  if (t.punishOnPower) out.push({ key: 'punish', label: `Punish ${t.punishOnPower}`, body: 'Deals damage to you whenever you play a Power.' });
  if (t.splitInto?.length) out.push({ key: 'split', label: 'Splits', body: 'Splits into smaller foes when it faints.' });
  if (t.startBlock) out.push({ key: 'shell', label: `Shell ${t.startBlock}`, body: 'Begins combat with Block.' });
  if (t.metallicize) out.push({ key: 'metal', label: `Metallicize ${t.metallicize}`, body: 'Gains Block at the start of its turn.' });
  if (t.phaseAtHp) out.push({ key: 'phase', label: 'Phase', body: 'Changes pattern at half HP.' });
  if (t.reviveOnce) out.push({ key: 'revive', label: 'Revive', body: 'The first time it would faint, it comes back.' });
  return out;
}

function enemyAimPoint(enemyId: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`[data-enemy-id="${enemyId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.38 };
}

function TargetingArrow({
  fromX,
  fromY,
  toX,
  toY,
  hot,
  targetId,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hot: boolean;
  targetId: string | null;
}) {
  const aim = targetId ? enemyAimPoint(targetId) : null;
  const endX = aim?.x ?? toX;
  const endY = aim?.y ?? toY;
  const dist = Math.hypot(endX - fromX, endY - fromY);
  if (dist < 10) return null;
  const pull = Math.min(18, dist * 0.05);
  const cx = (fromX + endX) / 2;
  const cy = (fromY + endY) / 2 - pull;
  const angle = Math.atan2(endY - cy, endX - cx);
  const head = hot ? 18 : 15;
  const backX = endX - Math.cos(angle) * head;
  const backY = endY - Math.sin(angle) * head;
  const leftX = backX + Math.cos(angle + Math.PI / 2) * (head * 0.42);
  const leftY = backY + Math.sin(angle + Math.PI / 2) * (head * 0.42);
  const rightX = backX + Math.cos(angle - Math.PI / 2) * (head * 0.42);
  const rightY = backY + Math.sin(angle - Math.PI / 2) * (head * 0.42);
  const lineX = endX - Math.cos(angle) * (head * 0.55);
  const lineY = endY - Math.sin(angle) * (head * 0.55);
  const color = hot ? '#fde68a' : 'rgba(253, 230, 138, 0.92)';
  const w = window.innerWidth;
  const h = window.innerHeight;
  return createPortal(
    <svg
      className="spire-target-arrow"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      overflow="visible"
      aria-hidden="true"
    >
      <path
        d={`M ${fromX} ${fromY} Q ${cx} ${cy} ${lineX} ${lineY}`}
        fill="none"
        stroke={color}
        strokeWidth={hot ? 5.5 : 4.25}
        strokeLinecap="round"
      />
      <polygon points={`${endX},${endY} ${leftX},${leftY} ${rightX},${rightY}`} fill={color} />
    </svg>,
    document.body,
  );
}

const PILE_COPY: Record<PileKind, { label: string; detail: string; empty: string }> = {
  draw: {
    label: 'Draw',
    detail: 'Cards waiting to be drawn. Click to inspect (order is hidden).',
    empty: 'The draw pile is empty.',
  },
  discard: {
    label: 'Discard',
    detail: 'Played and leftover cards. Shuffled back when the draw pile is empty.',
    empty: 'The discard pile is empty.',
  },
  exhaust: {
    label: 'Exhaust',
    detail: 'Removed from this combat. They will not return to your deck.',
    empty: 'Nothing has been exhausted.',
  },
};

function CombatLog({ lines }: { lines: string[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const stickToEnd = useRef(true);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !stickToEnd.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <aside className="spire-log" aria-label="Combat log">
      <p className="spire-log__title">Log</p>
      <ul
        ref={listRef}
        className="spire-log__lines"
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          stickToEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        {lines.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}

function CombatPile({
  kind,
  count,
  onOpen,
}: {
  kind: PileKind;
  count: number;
  onOpen: (kind: PileKind) => void;
}) {
  const copy = PILE_COPY[kind];
  return (
    <SpireTip title={copy.label} body={copy.detail} side="top">
      <button
        type="button"
        className={`spire-pile spire-pile--${kind}${count === 0 ? ' is-empty' : ''}`}
        data-spire-pile={kind}
        aria-label={`${copy.label} pile, ${count} cards. Open to inspect.`}
        onClick={() => onOpen(kind)}
      >
        <span className="spire-pile__deck" aria-hidden="true" data-depth={count === 0 ? 0 : Math.min(3, count)}>
          <i />
          <i />
          <i />
        </span>
        <span className="spire-pile__face">
          <strong className="spire-pile__count">{count}</strong>
          <span className="spire-pile__label">{copy.label}</span>
        </span>
      </button>
    </SpireTip>
  );
}

function PileModal({
  kind,
  cards,
  combat,
  target,
  onClose,
}: {
  kind: PileKind;
  cards: CardInstance[];
  combat: CombatState;
  target?: CombatEnemy;
  onClose: () => void;
}) {
  const copy = PILE_COPY[kind];
  const groups = groupDeck(cards);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="spire-pile-modal spire-pile-modal--deck" role="presentation" onClick={onClose}>
      <div
        className="spire-pile-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spire-pile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="spire-pile-modal__head">
          <div>
            <p className="spire-kicker">{copy.label} pile</p>
            <h2 id="spire-pile-modal-title">
              {cards.length} card{cards.length === 1 ? '' : 's'}
            </h2>
            <p className="spire-pile-modal__note">{copy.detail}</p>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </header>
        {groups.length === 0 ? (
          <p className="spire-pile-modal__empty">{copy.empty}</p>
        ) : (
          <div className="spire-deck-groups">
            {groups.map((group) => (
              <section key={group.kind} className="spire-deck-group">
                <h3 className="spire-deck-group__title">
                  {KIND_LABEL[group.kind]}
                  <span>{group.cards.length}</span>
                </h3>
                <div className="spire-card-grid">
                  {group.cards.map((card) => (
                    <SpireCard key={card.instanceId} card={card} combat={combat} target={target} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function CombatView() {
  const run = useSpireStore((s) => s.run);
  const playCard = useSpireStore((s) => s.playCard);
  const selectFreePick = useSpireStore((s) => s.selectFreePick);
  const confirmFreePick = useSpireStore((s) => s.confirmFreePick);
  const pickZeroCostCard = useSpireStore((s) => s.pickZeroCostCard);
  const closePlayerTurn = useSpireStore((s) => s.closePlayerTurn);
  const applyEnemyHit = useSpireStore((s) => s.applyEnemyHit);
  const applyEnemyIntentRest = useSpireStore((s) => s.applyEnemyIntentRest);
  const completeEnemyRound = useSpireStore((s) => s.completeEnemyRound);
  const clearCombatFx = useSpireStore((s) => s.clearCombatFx);
  const acknowledgeCombatResult = useSpireStore((s) => s.acknowledgeCombatResult);
  const selectCombatEnemy = useSpireStore((s) => s.selectCombatEnemy);
  const drinkPotion = useSpireStore((s) => s.drinkPotion);
  const discardForPending = useSpireStore((s) => s.discardForPending);
  const toggleChoiceBand = useSpireStore((s) => s.toggleChoiceBand);
  const confirmChoiceBand = useSpireStore((s) => s.confirmChoiceBand);
  const toggleOptionalDiscard = useSpireStore((s) => s.toggleOptionalDiscard);
  const confirmOptionalDiscard = useSpireStore((s) => s.confirmOptionalDiscard);
  const muted = useGameStore((s) => s.muted);
  const combat = run?.combat;

  useEffect(() => {
    preloadSpireCombatSfx();
  }, []);
  const character = run?.characterId ? CHARACTERS[run.characterId] : null;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverEnemy, setHoverEnemy] = useState<string | null>(null);
  const [enemyPhase, setEnemyPhase] = useState(false);
  const [statusTick, setStatusTick] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingKind, setActingKind] = useState<EnemyIntentKind | null>(null);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHitId, setEnemyHitId] = useState<string | null>(null);
  const [specialFx, setSpecialFx] = useState<{ kind: 'surf' | 'petal' | 'flare' | 'charge'; targetId?: string; chargeKind?: 'attack' | 'block' } | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const [flashRelic, setFlashRelic] = useState<string | null>(null);
  const [shownFoe, setShownFoe] = useState<Record<string, FoeVitals>>({});
  const foeSnapRef = useRef<Map<string, FoeVitals>>(new Map());
  const [revealResult, setRevealResult] = useState(false);
  const [floats, setFloats] = useState<FloatHit[]>([]);
  const [openPile, setOpenPile] = useState<PileKind | null>(null);
  const [pileCards, setPileCards] = useState<CardInstance[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const timersRef = useRef<number[]>([]);
  const resultCueRef = useRef<'win' | 'lose' | null>(null);
  const endingRef = useRef(false);
  const prevZonesRef = useRef<ZoneSnap | null>(null);
  const posesRef = useRef<Map<string, CardPose>>(new Map());
  const playOriginRef = useRef<Map<string, CardPose>>(new Map());
  const flightSeqRef = useRef(0);
  const [arriving, setArriving] = useState<Set<string>>(() => new Set());
  const [flights, setFlights] = useState<CardFlight[]>([]);

  const result = run?.combatResult ?? null;
  const locked = enemyPhase || !!result || fxBusy;

  useEffect(() => {
    if (!combat) return;
    if ((combat.pendingDiscard ?? 0) > 0 && combat.hand.length === 0) {
      discardForPending('');
    }
  }, [combat, discardForPending]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const recordCardOrigin = useCallback((card: CardInstance, el?: HTMLElement | null) => {
    const dragNow = dragRef.current;
    if (dragNow?.card.instanceId === card.instanceId) {
      playOriginRef.current.set(card.instanceId, {
        cx: dragNow.x,
        cy: dragNow.y,
        w: 152,
        h: 184,
        rotate: dragNow.dragging ? -4 : 0,
      });
      return;
    }
    const pose = poseFromEl(el);
    if (pose) playOriginRef.current.set(card.instanceId, pose);
  }, []);

  const tryPlay = useCallback(
    (card: CardInstance, enemyId?: string) => {
      if (!combat || locked) return;
      const def = resolveCard(card);
      const pendingDiscard = (combat.pendingDiscard ?? 0) > 0;
      const pendingFree = (combat.pendingFreePick ?? 0) > 0;
      if (combat.pendingChoiceBand) {
        playSfx('click', muted);
        toggleChoiceBand(card.instanceId);
        return;
      }
      if (combat.pendingOptionalDiscard) {
        playSfx('click', muted);
        toggleOptionalDiscard(card.instanceId);
        return;
      }
      if (pendingDiscard) {
        recordCardOrigin(card);
        playSfx('click', muted);
        discardForPending(card.instanceId);
        return;
      }
      if (pendingFree) {
        playSfx('click', muted);
        selectFreePick(card.instanceId);
        return;
      }
      if (!canPlayCard(combat, card.instanceId)) return;
      if (cardNeedsTarget(def)) {
        if (!enemyId) return;
        recordCardOrigin(card);
        if (def.kind === 'skill' && !skillGrantsBlock(def)) playSfx('skill', muted);
        else if (def.kind === 'power') playSfx('power', muted);
        playCard(card.instanceId, enemyId);
        return;
      }
      recordCardOrigin(card);
      if (def.kind === 'skill' && !skillGrantsBlock(def)) playSfx('skill', muted);
      else if (def.kind === 'power') playSfx('power', muted);
      playCard(card.instanceId);
    },
    [combat, discardForPending, locked, muted, playCard, recordCardOrigin, selectFreePick, toggleChoiceBand, toggleOptionalDiscard],
  );

  const onFlightComplete = useCallback((id: string) => {
    setFlights((prev) => {
      const flight = prev.find((item) => item.id === id);
      if (!flight) return prev;
      if (flight.motion === 'draw') {
        const cardId = flight.card.instanceId;
        setArriving((ids) => {
          if (!ids.has(cardId)) return ids;
          const next = new Set(ids);
          next.delete(cardId);
          return next;
        });
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const dist = Math.hypot(event.clientX - current.originX, event.clientY - current.originY);
      setDrag({
        ...current,
        x: event.clientX,
        y: event.clientY,
        dragging: current.dragging || dist > 8,
      });
      setHoverEnemy(enemyFromPoint(event.clientX, event.clientY));
    };
    const cancelDrag = () => {
      setDrag(null);
      setHoverEnemy(null);
    };
    const onUp = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (event.button !== 0) {
        cancelDrag();
        return;
      }
      const droppedOn = enemyFromPoint(event.clientX, event.clientY);
      const inDock = pointInCombatDock(event.clientX, event.clientY);
      const def = resolveCard(current.card);
      cancelDrag();
      if (
        (combat?.pendingDiscard ?? 0) > 0 ||
        (combat?.pendingFreePick ?? 0) > 0 ||
        combat?.pendingChoiceBand ||
        combat?.pendingOptionalDiscard
      ) {
        tryPlay(current.card);
        return;
      }
      if (cardNeedsTarget(def)) {
        if (droppedOn) tryPlay(current.card, droppedOn);
        return;
      }
      if (!inDock) tryPlay(current.card);
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      cancelDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [combat?.pendingChoiceBand, combat?.pendingDiscard, combat?.pendingFreePick, combat?.pendingOptionalDiscard, drag, tryPlay]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    endingRef.current = false;
    setEnemyPhase(false);
    setStatusTick(false);
    setActingId(null);
    setActingKind(null);
    setPlayerHit(false);
  }, [combat?.turn]);

  const playCue = useCallback(
    (cue: CombatFx) => {
      if (cue.kind === 'hitEnemy' || cue.kind === 'petal' || cue.kind === 'flare') {
        playSfx('hit', muted);
        if (cue.targetId) {
          setEnemyHitId(cue.targetId);
          window.setTimeout(() => setEnemyHitId((id) => (id === cue.targetId ? null : id)), 220);
          if (typeof cue.hp === 'number') {
            const targetId = cue.targetId;
            setShownFoe((prev) => ({
              ...prev,
              [targetId]: { hp: cue.hp!, block: cue.block ?? prev[targetId]?.block ?? 0 },
            }));
          }
        }
        if (cue.kind === 'petal' || cue.kind === 'flare') {
          setSpecialFx({ kind: cue.kind, targetId: cue.targetId });
          window.setTimeout(() => setSpecialFx(null), 280);
        }
      } else if (cue.kind === 'hitPlayer') {
        playSfx('hitPhysical', muted);
        playSfx('shake', muted);
        setPlayerHit(true);
        window.setTimeout(() => setPlayerHit(false), 380);
        if ((cue.amount ?? 0) > 0) {
          setFloats((prev) => [...prev, { id: cue.id, text: `-${cue.amount}` }]);
        }
      } else if (cue.kind === 'relicGlow' && cue.relicId) {
        playSfx('item', muted);
        setFlashRelic(cue.relicId);
        window.setTimeout(() => setFlashRelic((id) => (id === cue.relicId ? null : id)), 720);
      } else if (cue.kind === 'blockGain') {
        playSfx('block', muted);
      } else if (cue.kind === 'status') {
        playSfx('statusHit', muted);
      } else if (cue.kind === 'chargeEvoke') {
        playSfx(cue.chargeKind === 'block' ? 'block' : 'item', muted);
        setSpecialFx({ kind: 'charge', chargeKind: cue.chargeKind });
        window.setTimeout(() => setSpecialFx(null), 360);
      } else if (cue.kind === 'surf') {
        playSfx('hit', muted);
        setSpecialFx({ kind: 'surf' });
        window.setTimeout(() => setSpecialFx(null), 700);
      } else if (cue.kind === 'faint') {
        const cryDef = cue.defId ? ENEMIES[cue.defId] : undefined;
        const speciesId = cryDef?.speciesId ?? cue.speciesId;
        const speciesName = cryDef?.name ?? cue.speciesName;
        if (speciesId) playPokemonCry({ id: speciesId, speciesName }, muted);
      }
    },
    [muted],
  );

  useEffect(() => {
    const queued = combat?.combatFx ?? [];
    const cues = queued.filter((cue) => !seenCombatFxIds.has(cue.id));
    if (cues.length === 0) {
      if (queued.length > 0) clearCombatFx();
      setFxBusy(false);
      return undefined;
    }
    let cancelled = false;
    const timers: number[] = [];
    const locksHand = cues.some(
      (cue) => cue.kind !== 'status' && cue.kind !== 'blockGain' && cue.kind !== 'relicGlow',
    );
    if (locksHand) setFxBusy(true);
    const runFx = async () => {
      for (const cue of cues) {
        if (cancelled) return;
        playCue(cue);
        await new Promise<void>((resolve) => {
          const delay = cueDelay(cue);
          timers.push(window.setTimeout(resolve, delay));
        });
        if (!cancelled) seenCombatFxIds.add(cue.id);
      }
      if (cancelled) return;
      clearCombatFx();
      setFxBusy(false);
    };
    void runFx();
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
      setFxBusy(false);
    };
  }, [clearCombatFx, combat?.combatFx, playCue]);

  useLayoutEffect(() => {
    if (!combat) {
      foeSnapRef.current = new Map();
      setShownFoe((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    const pendingHits = (combat.combatFx ?? []).some((cue) => isEnemyHitFx(cue) && !seenCombatFxIds.has(cue.id));
    if (pendingHits || fxBusy) return;
    const next = new Map<string, FoeVitals>();
    for (const enemy of combat.enemies) next.set(enemy.id, foeVitalsOf(enemy));
    foeSnapRef.current = next;
    setShownFoe((prev) => (Object.keys(prev).length ? {} : prev));
  }, [combat, fxBusy]);

  useEffect(() => {
    if (!result) {
      resultCueRef.current = null;
      setRevealResult(false);
      return undefined;
    }
    const pendingFx = (combat?.combatFx ?? []).length > 0 || fxBusy || flights.length > 0;
    if (pendingFx) return undefined;
    if (resultCueRef.current === result) return undefined;
    resultCueRef.current = result;
    if (result === 'win') {
      playSfx('win', muted);
      playSfx('sparkle', muted);
    } else {
      playSfx('fail', muted);
      playSfx('shake', muted);
    }
    setRevealResult(true);
    const t = window.setTimeout(() => acknowledgeCombatResult(), 2400);
    return () => window.clearTimeout(t);
  }, [acknowledgeCombatResult, combat?.combatFx, flights.length, fxBusy, muted, result]);

  const startEnemyPhase = useCallback(() => {
    if (
      !combat ||
      locked ||
      endingRef.current ||
      combat.pendingDiscard > 0 ||
      (combat.pendingFreePick ?? 0) > 0 ||
      combat.pendingChoiceBand ||
      combat.pendingOptionalDiscard
    ) return;
    if ((combat.pendingZeroCostOffer ?? []).length > 0) return;
    if (combat.pendingChoiceBand) return;
    endingRef.current = true;
    const hadToxic = combat.enemies.some((enemy) => (enemy.statuses?.toxic ?? 0) > 0);
    playSfx('click', muted);
    if (hadToxic) playSfx('hit', muted);
    clearTimers();
    setEnemyPhase(true);
    setStatusTick(hadToxic);
    setFloats([]);
    closePlayerTurn();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timersRef.current.push(id);
      });
    const runPhase = async () => {
      await wait(hadToxic ? 420 : ACTION_WINDUP_MS);
      const afterClose = useSpireStore.getState();
      if (afterClose.run?.combatResult || !afterClose.run?.combat) {
        endingRef.current = false;
        setEnemyPhase(false);
        return;
      }
      const actions = previewEnemyActions(afterClose.run.combat);
      if (actions.length === 0) {
        completeEnemyRound();
        endingRef.current = false;
        setEnemyPhase(false);
        return;
      }
      for (const action of actions) {
        const live = useSpireStore.getState().run?.combat;
        const enemy = live?.enemies.find((item) => item.id === action.enemyId);
        if (!live || !enemy || enemy.hp <= 0) continue;
        const intents = [enemy.intent, ...(enemy.extraIntents ?? [])].filter(Boolean);
        for (const intent of intents) {
          const still = useSpireStore.getState().run?.combat?.enemies.find((item) => item.id === action.enemyId);
          if (!still || still.hp <= 0) break;
          setActingId(action.enemyId);
          setActingKind(intent.kind);
          if (isAttackKind(intent.kind)) {
            const hits = intent.kind === 'multiAttack' ? Math.max(1, intent.times ?? 2) : 1;
            for (let i = 0; i < hits; i += 1) {
              applyEnemyHit(action.enemyId, intent);
              await wait(ACTION_GAP_MS);
            }
            applyEnemyIntentRest(action.enemyId, intent);
          } else {
            applyEnemyIntentRest(action.enemyId, intent);
            if (intent.kind === 'heal') playSfx('heal', muted);
            else if (intent.kind !== 'block') playSfx('buff', muted);
            await wait(ACTION_GAP_MS);
          }
        }
      }
      setActingId(null);
      setActingKind(null);
      setEnemyPhase(false);
      completeEnemyRound();
      endingRef.current = false;
    };
    void runPhase();
  }, [
    applyEnemyHit,
    applyEnemyIntentRest,
    clearTimers,
    closePlayerTurn,
    combat,
    completeEnemyRound,
    locked,
    muted,
  ]);

  useEffect(() => {
    if (!combat?.forceEndTurn || enemyPhase || locked) return;
    startEnemyPhase();
  }, [combat?.forceEndTurn, enemyPhase, locked, startEnemyPhase]);

  useLayoutEffect(() => {
    if (!combat) {
      prevZonesRef.current = null;
      posesRef.current = new Map();
      return;
    }
    const next: ZoneSnap = {
      hand: combat.hand,
      discard: combat.discardPile,
      exhaust: combat.exhaustPile,
      draw: combat.drawPile,
      powers: combat.activePowers ?? [],
    };
    const diff = diffCardZones(prevZonesRef.current, next);
    if (!prefersReducedMotion() && (diff.arriving.length > 0 || diff.departing.length > 0)) {
      const spawned: CardFlight[] = [];
      if (diff.arriving.length > 0) {
        setArriving((prev) => {
          const copy = new Set(prev);
          for (const card of diff.arriving) copy.add(card.instanceId);
          return copy;
        });
      }
      diff.departing.forEach((item, index) => {
        flightSeqRef.current += 1;
        const from =
          playOriginRef.current.get(item.card.instanceId)
          ?? posesRef.current.get(item.card.instanceId)
          ?? fallbackHandPose(index, Math.max(1, diff.departing.length));
        playOriginRef.current.delete(item.card.instanceId);
        spawned.push({
          id: `fly-${flightSeqRef.current}`,
          card: item.card,
          motion: item.motion,
          from,
          to: pilePose(item.dest),
          delay: (index * STAGGER_MS) / 1000,
        });
      });
      diff.arriving.forEach((card, index) => {
        flightSeqRef.current += 1;
        const slot = document.querySelector(`[data-hand-id="${card.instanceId}"]`);
        const from = playOriginRef.current.get(card.instanceId) ?? pilePose('draw');
        playOriginRef.current.delete(card.instanceId);
        spawned.push({
          id: `fly-${flightSeqRef.current}`,
          card,
          motion: 'draw',
          from,
          to: poseFromEl(slot) ?? fallbackHandPose(index, next.hand.length),
          delay: (index * STAGGER_MS) / 1000,
        });
      });
      if (spawned.length > 0) setFlights((prev) => [...prev, ...spawned]);
    }

    const measured = new Map<string, CardPose>();
    for (const card of next.hand) {
      const pose = poseFromEl(document.querySelector(`[data-hand-id="${card.instanceId}"]`));
      if (pose) measured.set(card.instanceId, pose);
    }
    posesRef.current = measured;
    prevZonesRef.current = next;
  }, [combat]);

  if (!combat || !character || !run) return null;

  const inspectPile = (kind: PileKind) => {
    const source =
      kind === 'draw'
        ? shuffle(mulberry32(Date.now() >>> 0), [...combat.drawPile])
        : [...combat[`${kind}Pile`]].reverse();
    setPileCards(source);
    setOpenPile(kind);
  };

  const pendingChoiceBand = !!combat.pendingChoiceBand;
  const pendingOptionalDiscard = !!combat.pendingOptionalDiscard;
  const pendingDiscard = (combat.pendingDiscard ?? 0) > 0;
  const pendingFree = (combat.pendingFreePick ?? 0) > 0;
  const pendingZeroCost = (combat.pendingZeroCostOffer ?? []).length > 0;
  const pending = pendingDiscard || pendingFree || pendingZeroCost || pendingChoiceBand || pendingOptionalDiscard;
  const focusStacks = (combat.powers?.focus ?? 0) + (combat.tempFocus ?? 0);
  const focusTarget =
    combat.enemies.find((enemy) => enemy.id === (hoverEnemy ?? combat.selectedEnemyId) && enemy.hp > 0)
    ?? combat.enemies.find((enemy) => enemy.hp > 0);
  const dragDef = drag ? resolveCard(drag.card) : null;
  const showArrow = !!drag?.dragging && !!dragDef && cardNeedsTarget(dragDef);

  return (
    <div
      className={`spire-view spire-view--combat${drag?.dragging ? ' is-targeting' : ''}${enemyPhase ? ' is-enemy-turn' : ''}${pendingDiscard ? ' is-discard-pick' : ''}${pendingChoiceBand || pendingOptionalDiscard || pendingFree ? ' is-hand-confirm' : ''}`}
    >
      <header className="spire-hud">
        <div className="spire-hud__start">
          <div className="spire-hud__meta">
            <p className="spire-kicker">Turn {combat.turn}</p>
            <strong>{character.name}</strong>
          </div>
        </div>
        <RelicBar relics={combat.relics} flashId={flashRelic} />
        <div className="spire-hud__end">
          <PotionBar
            potions={combat.potions}
            onUse={(slot) => {
              if (locked || pendingChoiceBand || pendingOptionalDiscard || pendingDiscard) return;
              playSfx('item', muted);
              drinkPotion(slot, combat.selectedEnemyId ?? undefined);
            }}
          />
        </div>
      </header>

      {enemyPhase && (
        <p className="spire-turn-banner" role="status">
          {statusTick && !actingId ? 'Toxic hits' : 'Enemy turn'}
        </p>
      )}

      <div className="spire-arena">
        <div className="spire-enemies">
          {combat.enemies.map((enemy) => (
            <EnemyCard
              key={enemy.id}
              enemy={enemy}
              combat={combat}
              display={prefersReducedMotion() ? undefined : shownFoe[enemy.id] ?? foeSnapRef.current.get(enemy.id)}
              selected={combat.selectedEnemyId === enemy.id}
              dropTarget={hoverEnemy === enemy.id && !!drag?.dragging}
              acting={actingId === enemy.id}
              actKind={actingId === enemy.id ? actingKind : null}
              hit={enemyHitId === enemy.id}
              onSelect={() => {
                if (locked) return;
                selectCombatEnemy(enemy.id);
              }}
            />
          ))}
        </div>
      </div>

      <footer className="spire-combat-dock" data-spire-dock>
        <div className="spire-combat-main">
          {pendingDiscard && (
            <p className="spire-discard-prompt" role="status">
              {combat.pendingDiscard > 1
                ? `Choose a card to discard (${combat.pendingDiscard} left)`
                : 'Choose a card to discard'}
            </p>
          )}
          {pendingChoiceBand && (
            <p className="spire-banner">
              Choice Band: select any number of cards to discard, then draw that many.
              {(combat.choiceBandPicks ?? []).length > 0
                ? ` ${combat.choiceBandPicks.length} selected.`
                : ''}
            </p>
          )}
          {pendingOptionalDiscard && (
            <p className="spire-banner">
              {combat.optionalDiscardExhaust
                ? `Select any number of ${combat.optionalDiscardFilter === 'seed' ? 'Seeds' : 'cards'} to Exhaust.`
                : 'Select any number of cards to discard.'}
              {(combat.optionalDiscardPicks ?? []).length > 0
                ? ` ${combat.optionalDiscardPicks.length} selected.`
                : ''}
            </p>
          )}
          {pendingFree && <p className="spire-banner">Choose a card to set to 0 this turn.</p>}
          {pendingZeroCost && <p className="spire-banner">Choose a 0-cost card to add to your hand.</p>}
          {!pending && !enemyPhase && !result && (
            <p className="spire-hint">Drag an attack onto a foe, or drag a skill out of the dock.</p>
          )}
          {enemyPhase && (
            <p className="spire-hint">{statusTick && !actingId ? 'Toxic hits HP…' : 'Foes are acting…'}</p>
          )}
          <div
            className={`spire-hand${locked ? ' is-locked' : ''}`}
            style={
              {
                '--overlap': `-${Math.min(56, 28 + Math.max(0, combat.hand.length - 4) * 5)}px`,
                '--hand-drop': `${handArchDrop(combat.hand.length)}px`,
              } as CSSProperties
            }
          >
            {combat.hand.map((card, index) => {
              const picked =
                (pendingChoiceBand && (combat.choiceBandPicks ?? []).includes(card.instanceId)) ||
                (pendingOptionalDiscard && (combat.optionalDiscardPicks ?? []).includes(card.instanceId)) ||
                (pendingFree && combat.freePickSelected === card.instanceId);
              const inbound = arriving.has(card.instanceId);
              const filterLocked =
                pendingOptionalDiscard &&
                !!combat.optionalDiscardFilter &&
                card.defId !== combat.optionalDiscardFilter;
              const playable =
                !locked &&
                !inbound &&
                !filterLocked &&
                (pending || canPlayCard(combat, card.instanceId));
              const { fan, lift } = handFanPose(index, combat.hand.length);
              const isGhost = drag?.card.instanceId === card.instanceId && drag.dragging;
              return (
                <SpireCard
                  key={card.instanceId}
                  card={card}
                  fan={fan}
                  lift={lift}
                  stack={index + 1}
                  arriving={inbound && !pendingDiscard}
                  playable={pendingDiscard || (playable && !pending)}
                  selected={picked || pendingDiscard}
                  disabled={!pendingDiscard && !playable}
                  dragging={isGhost}
                  combat={combat}
                  target={focusTarget}
                  onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                    if (!playable) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({
                      card,
                      pointerId: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                      originX: event.clientX,
                      originY: event.clientY,
                      dragging: false,
                    });
                  }}
                />
              );
            })}
          </div>
        </div>

        {createPortal(
          <div className="spire-piles-edge spire-piles-edge--left">
            <CombatPile kind="draw" count={combat.drawPile.length} onOpen={inspectPile} />
          </div>,
          document.body,
        )}

        <div className="spire-combat-left">
          <div className="spire-player-wrap">
            <div className={`spire-player${playerHit ? ' is-hit' : ''}`}>
              {floats.map((hit) => (
                <span key={hit.id} className="spire-float-hit">
                  {hit.text}
                </span>
              ))}
              <div className="spire-player__sprite">
                {(character.id === 'tide' ||
                  combat.waterCharges.attack > 0 ||
                  combat.waterCharges.block > 0) && (
                  <ChargeOrbs combat={combat} />
                )}
                <img
                  src={localBattleGif(character.speciesId)}
                  alt={character.speciesName}
                  onError={(e) => battleGifOnError(e, character.speciesId)}
                />
              </div>
              <div className="spire-player__stats">
                <div className="spire-player__name-row">
                  <strong>{character.name}</strong>
                  <EnergyPips energy={combat.energy} max={combat.energyMax} />
                </div>
                <HpBar hp={combat.playerHp} max={combat.playerMaxHp} block={combat.playerBlock} />
                {(combat.strength !== 0 ||
                  (combat.tempStrength ?? 0) !== 0 ||
                  combat.dexterity !== 0 ||
                  focusStacks !== 0) && (
                  <p className="spire-buffs">
                    {combat.strength !== 0 && (
                      <span>
                        Str {combat.strength > 0 ? '+' : ''}
                        {combat.strength}
                      </span>
                    )}
                    {(combat.tempStrength ?? 0) !== 0 && (
                      <span>
                        Str {combat.tempStrength > 0 ? '+' : ''}
                        {combat.tempStrength} this turn
                      </span>
                    )}
                    {combat.dexterity !== 0 && <span>Dex {combat.dexterity > 0 ? '+' : ''}{combat.dexterity}</span>}
                    {focusStacks !== 0 && <span>Focus {focusStacks > 0 ? '+' : ''}{focusStacks}</span>}
                  </p>
                )}
                <StatusRow statuses={combat.statuses} />
              </div>
            </div>
            {(combat.activePowers ?? []).length > 0 && (
              <div className="spire-player__powers" aria-label="Active powers">
                {(combat.activePowers ?? []).map((card) => {
                  const def = resolveCard(card);
                  return (
                    <SpireTip
                      key={card.instanceId}
                      title={def.name}
                      body={liveCardDescription(card, combat)}
                      side="top"
                    >
                      <span className="spire-player__power">{def.name}</span>
                    </SpireTip>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {createPortal(<CombatLog lines={combat.log} />, document.body)}

        <div className="spire-combat-right">
          {pendingChoiceBand ? (
            <button
              type="button"
              className="btn btn--primary spire-end-turn"
              disabled={locked}
              onClick={() => {
                playSfx('click', muted);
                confirmChoiceBand();
              }}
            >
              {(combat.choiceBandPicks ?? []).length > 0
                ? `Discard ${combat.choiceBandPicks.length}`
                : 'Keep hand'}
            </button>
          ) : pendingOptionalDiscard ? (
            <button
              type="button"
              className="btn btn--primary spire-end-turn"
              disabled={locked}
              onClick={() => {
                playSfx('click', muted);
                confirmOptionalDiscard();
              }}
            >
              {(combat.optionalDiscardPicks ?? []).length > 0
                ? `${combat.optionalDiscardExhaust ? 'Exhaust' : 'Discard'} ${combat.optionalDiscardPicks.length}`
                : combat.optionalDiscardExhaust
                  ? 'Exhaust none'
                  : 'Discard none'}
            </button>
          ) : pendingFree ? (
            <button
              type="button"
              className="btn btn--primary spire-end-turn"
              disabled={locked || !combat.freePickSelected}
              onClick={() => {
                playSfx('click', muted);
                confirmFreePick();
              }}
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary spire-end-turn"
              disabled={locked || pending || arriving.size > 0}
              onClick={startEnemyPhase}
            >
              {enemyPhase ? 'Enemy Turn…' : 'End Turn'}
            </button>
          )}
        </div>

        {createPortal(
          <div className="spire-piles-edge spire-piles-edge--right">
            <CombatPile kind="exhaust" count={combat.exhaustPile.length} onOpen={inspectPile} />
            <CombatPile kind="discard" count={combat.discardPile.length} onOpen={inspectPile} />
          </div>,
          document.body,
        )}
      </footer>

      {(pendingDiscard || pendingChoiceBand || pendingOptionalDiscard || pendingFree) &&
        createPortal(<div className="spire-discard-veil" aria-hidden="true" />, document.body)}

      {showArrow && drag && (
        <TargetingArrow
          fromX={drag.originX}
          fromY={drag.originY}
          toX={drag.x}
          toY={drag.y}
          hot={!!hoverEnemy}
          targetId={hoverEnemy}
        />
      )}
      {drag?.dragging && !showArrow && (
        <div className="spire-drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <SpireCard card={drag.card} playable combat={combat} target={focusTarget} />
        </div>
      )}

      <CardFlightLayer
        flights={flights}
        combat={combat}
        target={focusTarget}
        onComplete={onFlightComplete}
      />

      {openPile && (
        <PileModal
          kind={openPile}
          cards={pileCards}
          combat={combat}
          target={focusTarget}
          onClose={() => setOpenPile(null)}
        />
      )}

      {(combat.pendingZeroCostOffer ?? []).length > 0 &&
        createPortal(
          <div className="spire-combat-overlay" role="dialog" aria-label="Choose a 0-cost card">
            <div className="spire-combat-overlay__card spire-zero-pick">
              <p className="spire-kicker">Brine</p>
              <h2>Choose a 0-cost card</h2>
              <p>Added from any class into your hand.</p>
              <div className="spire-card-row spire-card-row--pick spire-zero-pick__row">
                {combat.pendingZeroCostOffer.map((card) => (
                  <SpireCard
                    key={card.instanceId}
                    card={card}
                    compact
                    onClick={(event) => {
                      recordCardOrigin(card, event.currentTarget);
                      playSfx('item', muted);
                      pickZeroCostCard(card.instanceId);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {specialFx &&
        createPortal(
          <div className={`spire-special-fx spire-special-fx--${specialFx.kind}`} aria-hidden="true">
            {specialFx.kind === 'surf' && <div className="spire-fx-wave" />}
            {specialFx.kind === 'petal' && <div className="spire-fx-petal" />}
            {specialFx.kind === 'flare' && <div className="spire-fx-flare" />}
            {specialFx.kind === 'charge' && (
              <div className={`spire-fx-charge spire-fx-charge--${specialFx.chargeKind ?? 'attack'}`} />
            )}
          </div>,
          document.body,
        )}

      {revealResult && result && (
        <div className="spire-combat-overlay">
          <Confetti active={result === 'win'} />
          <div className={`spire-combat-overlay__card spire-combat-overlay__card--${result}`}>
            <p className="spire-kicker">{result === 'win' ? 'Victory' : 'Defeat'}</p>
            <h2>{result === 'win' ? 'Foe fainted!' : 'Your partner fainted…'}</h2>
            <p>
              {result === 'win'
                ? 'The path opens. Claim your spoils.'
                : 'The climb ends here.'}
            </p>
            <button type="button" className="btn btn--primary" onClick={() => acknowledgeCombatResult()}>
              {result === 'win' ? 'Claim rewards' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChargeOrbs({ combat }: { combat: CombatState }) {
  const slots = chargeSlots(combat);
  const potency = chargePotency(combat);
  const mid = (slots.length - 1) / 2;
  return (
    <div className="spire-orbs" aria-label="Charge slots">
      {slots.map((kind, index) => {
        const arc = Math.abs(index - mid) * 7;
        const title =
          kind === 'attack'
            ? 'Attack Charge'
            : kind === 'block'
              ? 'Block Charge'
              : 'Empty charge slot';
        const body =
          kind === 'attack'
            ? `Deals ${potency} damage to the front enemy at the end of your turn. Stays for the rest of combat.`
            : kind === 'block'
              ? `Gain ${potency} Block at the end of your turn. Stays for the rest of combat.`
              : 'Play a charge card to fill this slot. Tide starts with 3 slots.';
        return (
          <SpireTip key={`orb-${index}`} title={title} body={body} side="top">
            <span
              className={`spire-orb${kind ? ` spire-orb--${kind}` : ' spire-orb--empty'}`}
              style={{ transform: `translateY(${arc}px)` }}
              aria-label={title}
            />
          </SpireTip>
        );
      })}
    </div>
  );
}

function EnemyCard({
  enemy,
  combat,
  display,
  selected,
  dropTarget,
  acting,
  actKind,
  hit,
  onSelect,
}: {
  enemy: CombatEnemy;
  combat: CombatState;
  display?: FoeVitals;
  selected: boolean;
  dropTarget: boolean;
  acting: boolean;
  actKind: EnemyIntentKind | null;
  hit?: boolean;
  onSelect: () => void;
}) {
  const shownHp = display?.hp ?? enemy.hp;
  const shownBlock = display?.block ?? enemy.block;
  const dead = shownHp <= 0;
  const intents = [enemy.intent, ...(enemy.extraIntents ?? [])].filter(Boolean);
  const speciesId = enemy.speciesId ?? ENEMIES[enemy.defId]?.speciesId ?? 16;
  const types = enemy.types?.length ? enemy.types : (ENEMIES[enemy.defId]?.types ?? []);
  const striking = acting && actKind != null && isAttackKind(actKind);
  const blocking = acting && actKind === 'block';
  const casting = acting && !striking && !blocking;
  const traits = traitPills(enemy);
  return (
    <div className={`spire-enemy-wrap${dead ? ' is-dead' : ''}`}>
      <button
        type="button"
        data-enemy-id={enemy.id}
        className={`spire-enemy${selected ? ' is-selected' : ''}${dead ? ' is-dead' : ''}${dropTarget ? ' is-drop' : ''}${acting ? ' is-acting' : ''}${striking ? ' is-striking' : ''}${blocking ? ' is-blocking' : ''}${casting ? ' is-casting' : ''}${hit ? ' is-hit' : ''}`}
        disabled={dead}
        onClick={onSelect}
      >
        <span className="spire-enemy__intents">
          {intents.map((intent, i) => {
            const meta = INTENT[intent.kind];
            if (!meta) return null;
            const shown = displayedIntentAmount(combat, enemy, intent);
            const raw =
              intent.kind === 'attack' || intent.kind === 'attackDebuff' || intent.kind === 'multiAttack'
                ? intent.amount + enemy.strength
                : intent.amount;
            const modified = shown !== raw;
            return (
              <span
                key={`${intent.kind}-${i}`}
                className={`spire-enemy__intent spire-enemy__intent--${intent.kind}${modified ? (shown < raw ? ' is-reduced' : ' is-increased') : ''}`}
              >
                <span aria-hidden="true">{meta.icon}</span> {meta.label(shown, intent)}
              </span>
            );
          })}
        </span>
        <img
          src={localBattleGif(speciesId)}
          alt={enemy.name}
          onError={(e) => battleGifOnError(e, speciesId)}
        />
        <strong>{enemy.name}</strong>
        <div className="spire-enemy__types">
          {types.map((t) => (
            <TypeBadge key={t} type={t} size="sm" />
          ))}
        </div>
        <HpBar
          hp={shownHp}
          max={enemy.maxHp}
          block={shownBlock}
          toxic={enemy.statuses?.toxic ?? 0}
          tone="foe"
        />
        <StatusRow statuses={enemy.statuses} reserve />
      </button>
      <div className="spire-enemy__traits">
        {traits.map((trait) => (
          <SpireTip key={trait.key} title={trait.label} body={trait.body} side="top">
            <span className="spire-enemy__trait">{trait.label}</span>
          </SpireTip>
        ))}
      </div>
    </div>
  );
}

function StatusRow({
  statuses,
  reserve = false,
}: {
  statuses?: Record<string, number | undefined>;
  reserve?: boolean;
}) {
  const entries = Object.entries(statuses ?? {}).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0 && !reserve) return null;
  return (
    <p className="spire-statuses">
      {entries.map(([k, v]) => {
        const tip = STATUS_TIPS[k];
        const pill = (
          <span className={`spire-status spire-status--${k}`}>
            {k} {v}
          </span>
        );
        return tip ? (
          <SpireTip key={k} title={tip.title} body={tip.body} side="top">
            {pill}
          </SpireTip>
        ) : (
          <span key={k}>{pill}</span>
        );
      })}
    </p>
  );
}
