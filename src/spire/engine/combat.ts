import { classPowerDefs, resolveCard, rewriteDescription, zeroCostCardDefs } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { getPotionDef } from '../data/potions';
import { findRelicDef, relicHasHook, relicHookAmount } from '../data/relics';
import type {
  CardInstance,
  CharacterId,
  CombatEnemy,
  CombatFx,
  CombatOutcome,
  CombatState,
  CombatStatus,
  EffectOp,
  EnemyDef,
  EnemyIntentKind,
  EnemyIntentPattern,
  EnemyTraits,
} from '../types';
import type { Rng } from './rng';
import { pickIndex, shuffle } from './rng';

const HAND_CAP = 10;
export const CHARGE_BASE = 4;
export const CHARGE_SLOTS_BASE = 3;
const CHARGE_SLOTS_HARD = 10;
const MAX_ENEMIES = 4;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bagOf(enemy: CombatEnemy): Partial<Record<CombatStatus, number>> {
  return enemy.statuses ?? {};
}

function living(state: CombatState): CombatEnemy[] {
  return state.enemies.filter((e) => num(e.hp) > 0);
}

export function combatPunishesPowers(state: CombatState): boolean {
  return living(state).some((e) => num(e.traits?.punishOnPower) > 0);
}

export interface EnemyActionPreview {
  enemyId: string;
  name: string;
  kind: EnemyIntentKind;
  amount: number;
  playerDamage: number;
  blocked: number;
}

const DURATION_STATUSES: CombatStatus[] = ['weak', 'vulnerable', 'frail'];

function scaleAttackDamage(base: number, weak: boolean, vulnerable: boolean): number {
  let dmg = num(base);
  if (weak) dmg = Math.floor(dmg * 0.75);
  if (vulnerable) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

function scaleBlockGain(amount: number): number {
  return Math.max(0, num(amount));
}

function hitThroughBlock(block: number, dmg: number, frail: boolean): { block: number; hpLoss: number } {
  if (frail) {
    const pierce = Math.floor(num(dmg) / 2);
    const againstBlock = num(dmg) - pierce;
    const blocked = Math.min(num(block), againstBlock);
    return { block: num(block) - blocked, hpLoss: pierce + (againstBlock - blocked) };
  }
  const blocked = Math.min(block, dmg);
  return { block: block - blocked, hpLoss: dmg - blocked };
}

let fxSeq = 0;

function pushFx(state: CombatState, fx: Omit<CombatFx, 'id'>): void {
  fxSeq += 1;
  state.combatFx = [...(state.combatFx ?? []), { ...fx, id: fxSeq }];
}

export function takeCombatFx(state: CombatState): CombatState {
  const next = clone(state);
  next.combatFx = [];
  return next;
}

export function eligibleFreePlayCards(state: CombatState): CardInstance[] {
  return state.hand.filter((card) => {
    if ((state.freePlayIds ?? []).includes(card.instanceId)) return false;
    return energyCostToPlay(state, card) > 0;
  });
}

function isStrikeIntent(kind: EnemyIntentKind | undefined): boolean {
  return kind === 'attack' || kind === 'attackDebuff' || kind === 'multiAttack';
}

function smokeReduce(state: CombatState, enemy: CombatEnemy, dmg: number): number {
  const smoke = num(state.smokeScreen);
  if (smoke <= 0 || num(bagOf(enemy).vulnerable) <= 0) return dmg;
  return Math.max(0, Math.floor(dmg * (1 - smoke / 100)));
}

export function incomingAttackDamage(
  state: CombatState,
  enemy: CombatEnemy,
  intent: EnemyIntentPattern | undefined = enemy.intent,
): number {
  if (!intent || !isStrikeIntent(intent.kind)) return 0;
  const base = num(intent.amount) + num(enemy.strength);
  const scaled = scaleAttackDamage(base, num(bagOf(enemy).weak) > 0, num(state.statuses?.vulnerable) > 0);
  const reduced =
    intent.kind === 'multiAttack'
      ? Math.max(0, scaled - relicHookAmount(state.relics, 'reduceMultiAttack'))
      : scaled;
  return smokeReduce(state, enemy, reduced);
}

export function incomingBlockGain(
  enemy: CombatEnemy,
  intent: EnemyIntentPattern | undefined = enemy.intent,
): number {
  if (!intent || intent.kind !== 'block') return 0;
  return scaleBlockGain(intent.amount);
}

export function displayedIntentAmount(
  state: CombatState,
  enemy: CombatEnemy,
  intent: EnemyIntentPattern | undefined = enemy.intent,
): number {
  if (!intent) return 0;
  if (isStrikeIntent(intent.kind)) return incomingAttackDamage(state, enemy, intent);
  if (intent.kind === 'block') return incomingBlockGain(enemy, intent);
  return num(intent.amount);
}

function relicBonusIfStatus(
  state: CombatState,
  enemy: CombatEnemy | undefined,
  sourceType: string,
  kind?: string,
): number {
  if (!enemy) return 0;
  let extra = 0;
  for (const relicId of state.relics ?? []) {
    for (const hook of findRelicDef(relicId)?.hooks ?? []) {
      if (hook.when !== 'bonusIfStatus') continue;
      if (hook.sourceType && hook.sourceType !== sourceType) continue;
      if (hook.kind && hook.kind !== kind) continue;
      if (num(bagOf(enemy)[hook.status]) > 0) extra += hook.amount;
    }
  }
  return extra;
}

export function previewPlayerDeal(
  state: CombatState,
  rawAmount: number,
  enemy: CombatEnemy | undefined,
  sourceType: string,
  kind?: string,
  extras?: { cardId?: string; cost?: number; perOtherZeroCost?: number; ignoreStrength?: boolean },
): number {
  const ignoreStrength = extras?.ignoreStrength || extras?.cardId === 'petal' || extras?.cardId === 'frenzy-plant';
  let dmg = num(rawAmount) + (ignoreStrength ? 0 : num(state.strength) + num(state.tempStrength));
  if (
    kind === 'attack' &&
    num(state.powers?.overgrow) > 0 &&
    num(state.playerHp) * 2 < num(state.playerMaxHp)
  ) {
    dmg += num(state.powers.overgrow);
  }
  if (extras?.cardId === 'aqua-jet') dmg += num(state.powers?.['aqua-jet']);
  if (extras?.cardId === 'petal') {
    dmg += num(state.powers?.spore);
    if (enemy && num(bagOf(enemy).toxic) > 0) dmg += num(state.powers?.sporeToxic);
  }
  if (extras?.cost === 0) {
    dmg += num(state.powers?.zeroCostDamage) + num(state.powers?.zeroCostDamageThisTurn);
  }
  if (extras?.perOtherZeroCost) dmg += extras.perOtherZeroCost * num(state.zeroCostPlayed);
  dmg += relicBonusIfStatus(state, enemy, sourceType, kind);
  dmg = scaleAttackDamage(dmg, num(state.statuses?.weak) > 0, enemy ? num(bagOf(enemy).vulnerable) > 0 : false);
  return Math.max(0, Math.floor(num(dmg)));
}

export function previewPlayerBlock(state: CombatState, rawAmount: number): number {
  return scaleBlockGain(num(rawAmount) + num(state.dexterity));
}

export function chargeSlotCount(state: CombatState): number {
  return Math.min(CHARGE_SLOTS_HARD, CHARGE_SLOTS_BASE + num(state.powers?.reservoir));
}

export function chargePotency(state: CombatState): number {
  return CHARGE_BASE + num(state.powers?.focus) + num(state.tempFocus);
}

function filledCharges(state: CombatState): Array<'attack' | 'block'> {
  if (state.chargeQueue && state.chargeQueue.length > 0) return [...state.chargeQueue];
  const attack = Math.max(0, num(state.waterCharges?.attack));
  const block = Math.max(0, num(state.waterCharges?.block));
  return [
    ...Array.from({ length: attack }, () => 'attack' as const),
    ...Array.from({ length: block }, () => 'block' as const),
  ];
}

function syncWaterCharges(state: CombatState): void {
  const queue = state.chargeQueue ?? [];
  state.waterCharges = {
    attack: queue.filter((kind) => kind === 'attack').length,
    block: queue.filter((kind) => kind === 'block').length,
  };
}

function ensureChargeQueue(state: CombatState): Array<'attack' | 'block'> {
  if (!state.chargeQueue || (state.chargeQueue.length === 0 && (num(state.waterCharges?.attack) > 0 || num(state.waterCharges?.block) > 0))) {
    state.chargeQueue = filledCharges(state);
  } else {
    state.chargeQueue = state.chargeQueue ?? [];
  }
  return state.chargeQueue;
}

export function chargeSlots(state: CombatState): Array<'attack' | 'block' | null> {
  const cap = chargeSlotCount(state);
  const filled = filledCharges(state);
  return Array.from({ length: cap }, (_, i) => filled[i] ?? null);
}

export function cardCostLabel(def: ReturnType<typeof resolveCard>, free: boolean): string | number {
  if (free) return 0;
  if (def.xCost) return 'X';
  return def.cost;
}

export function energyCostToPlay(state: CombatState, inst: CardInstance, def = resolveCard(inst)): number {
  const free = (state.freePlayIds ?? []).includes(inst.instanceId);
  const kindFree = state.freeNextKind != null && state.freeNextKind === def.kind;
  if (free || kindFree) return 0;
  if (def.freeIfDiscardedThisTurn && num(state.discardedThisTurn) > 0) return 0;
  if (def.xCost) return num(state.energy);
  return def.cost;
}

export function liveCardDescription(inst: CardInstance, state: CombatState, enemy?: CombatEnemy): string {
  const def = resolveCard(inst);
  if (def.id === 'blooming') {
    const petals = (state.exhaustPile ?? []).filter((card) => card.defId === 'petal').length;
    const per = previewPlayerDeal(state, 5, enemy, 'grass', 'attack', { cardId: 'petal', cost: 0 });
    const total = petals * per;
    return `Play ${petals} Petal${petals === 1 ? '' : 's'} on the enemy (${total} damage).`;
  }
  if (def.id === 'baneful-bunker') {
    const toxic = enemy ? num(bagOf(enemy).toxic) : 0;
    return `Gain ${previewPlayerBlock(state, toxic)} Block equal to the enemy's Toxic. Exhaust.`;
  }
  if (def.id === 'seed-bomb') {
    const hit = def.effects.find((effect) => effect.op === 'damage' && effect.plusBlockIfStatus);
    const base = hit && hit.op === 'damage' ? hit.amount : 7;
    const dealt = previewPlayerDeal(state, base, enemy, def.type, def.kind, {
      cardId: def.id,
      cost: def.cost,
    });
    const toxic = def.effects.some((effect) => effect.op === 'statusIfStatus');
    const frail = enemy && num(bagOf(enemy).frail) > 0;
    const bonus = frail
      ? previewPlayerDeal(state, num(enemy.block), enemy, def.type, def.kind, {
          cardId: def.id,
          cost: def.cost,
        })
      : null;
    if (bonus == null) {
      return toxic
        ? `Deal ${dealt} damage. If the enemy is Frail, deal damage equal to their Block and apply 3 Toxic.`
        : `Deal ${dealt} damage. If the enemy is Frail, deal damage equal to their Block.`;
    }
    return toxic
      ? `Deal ${dealt} damage. If the enemy is Frail, deal ${bonus} damage equal to their Block and apply 3 Toxic.`
      : `Deal ${dealt} damage. If the enemy is Frail, deal ${bonus} damage equal to their Block.`;
  }
  if (def.id === 'harvest') {
    const seeds = [...(state.hand ?? []), ...(state.discardPile ?? [])].filter((card) => card.defId === 'seed').length;
    const extra = seeds * 2;
    return `Play ${seeds} Seed${seeds === 1 ? '' : 's'} in your hand and discard pile, then Exhaust them. Heal ${extra} extra. Exhaust.`;
  }
  if (def.id === 'power-whip') {
    const hit = def.effects.find((effect) => effect.op === 'damage' && effect.perGardenToken);
    const base = hit && hit.op === 'damage' ? hit.amount : 10;
    const per = hit && hit.op === 'damage' ? (hit.perGardenToken ?? 4) : 4;
    const tokens = gardenTokensInHand(state);
    const total = previewPlayerDeal(state, base + per * tokens, enemy, def.type, def.kind, {
      cardId: def.id,
      cost: def.cost,
    });
    return `Deal ${total} damage. Deal ${per} more for each Seed and Petal in your hand (${tokens}).`;
  }
  if (def.id === 'bloom-doom') {
    const times = Math.max(0, num(state.energy) + (def.effects.some((effect) => effect.op === 'status' && effect.plus) ? 1 : 0));
    const frail = num(state.energy) >= 3;
    return `Apply 3 Toxic ${times} time${times === 1 ? '' : 's'}.${frail ? ' Apply 2 Frail.' : ''} Exhaust.`;
  }
  const previewEnemy = enemy
    ? { ...enemy, statuses: { ...(enemy.statuses ?? {}) } }
    : undefined;
  const previewOp = (effect: (typeof def.effects)[number]) => {
    if (effect.op === 'status' && previewEnemy && !effect.self) {
      if (!effect.all) {
        previewEnemy.statuses = {
          ...previewEnemy.statuses,
          [effect.status]: num(previewEnemy.statuses[effect.status]) + effect.stacks,
        };
      }
      return effect;
    }
    if (effect.op === 'damage' || effect.op === 'damageIfStatus') {
      return {
        ...effect,
        amount: previewPlayerDeal(state, effect.amount, previewEnemy, def.type, def.kind, {
          cardId: def.id,
          cost: def.cost,
          perOtherZeroCost: effect.op === 'damage' ? effect.perOtherZeroCost : undefined,
        }),
      };
    }
    if (effect.op === 'block' || effect.op === 'blockTimes') {
      return { ...effect, amount: previewPlayerBlock(state, effect.amount) };
    }
    return effect;
  };
  const printed = [...def.effects, ...(def.onDiscard ?? [])];
  return rewriteDescription(def.description, printed, printed.map(previewOp));
}

export function previewEnemyActions(state: CombatState): EnemyActionPreview[] {
  let block = num(state.playerBlock);
  const out: EnemyActionPreview[] = [];
  for (const enemy of living(state)) {
    const kind = enemy.intent?.kind ?? 'attack';
    const amount = num(enemy.intent?.amount);
    let playerDamage = 0;
    let blocked = 0;
    const intents = [enemy.intent, ...(enemy.extraIntents ?? [])];
    for (const intent of intents) {
      if (!isStrikeIntent(intent?.kind)) continue;
      const hits = intent.kind === 'multiAttack' ? Math.max(1, num(intent.times, 1)) : 1;
      const dmg = incomingAttackDamage(state, enemy, intent);
      for (let i = 0; i < hits; i += 1) {
        if (state.preventAllDamage) {
          blocked += dmg;
          continue;
        }
        const hit = hitThroughBlock(block, dmg, num(state.statuses?.frail) > 0);
        blocked += block - hit.block;
        block = hit.block;
        playerDamage += hit.hpLoss;
      }
    }
    out.push({
      enemyId: enemy.id,
      name: enemy.name,
      kind,
      amount,
      playerDamage,
      blocked,
    });
  }
  return out;
}

function getEnemy(state: CombatState, id: string | null): CombatEnemy | undefined {
  if (!id) return living(state)[0];
  return state.enemies.find((e) => e.id === id && num(e.hp) > 0) ?? living(state)[0];
}

function pushLog(state: CombatState, line: string): void {
  state.log = [...state.log.slice(-80), line];
}

function addStatus(
  bag: Partial<Record<CombatStatus, number>> | undefined,
  status: CombatStatus,
  stacks: number,
): Partial<Record<CombatStatus, number>> {
  const next = { ...bag };
  next[status] = num(next[status]) + stacks;
  return next;
}

function dropStatus(
  bag: Partial<Record<CombatStatus, number>> | undefined,
  status: CombatStatus,
  by = 1,
): Partial<Record<CombatStatus, number>> {
  const next = { ...bag };
  const left = num(next[status]) - by;
  if (left <= 0) delete next[status];
  else next[status] = left;
  return next;
}

function drawCards(state: CombatState, n: number, rng: Rng): CardInstance[] {
  const drawn: CardInstance[] = [];
  for (let i = 0; i < n; i += 1) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      state.drawPile = shuffle(rng, state.discardPile);
      state.discardPile = [];
    }
    const card = state.drawPile.pop();
    if (!card) break;
    if (state.hand.length >= HAND_CAP) {
      state.discardPile.push(card);
      pushLog(state, `${resolveCard(card).name} bounced to the discard pile.`);
      continue;
    }
    state.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

function hasSash(state: CombatState): boolean {
  return state.relics.some((id) => findRelicDef(id)?.hooks.some((h) => h.when === 'focusSash'));
}

function applyPlayerHpLoss(state: CombatState, amount: number): void {
  const loss = num(amount);
  if (loss <= 0 || state.preventAllDamage) return;
  let hp = num(state.playerHp) - loss;
  if (hp <= 0 && hasSash(state) && !state.sashUsed) {
    hp = 1;
    state.sashUsed = true;
    pushLog(state, 'Focus Sash held at 1 HP!');
  }
  state.playerHp = Math.max(0, hp);
}

function dealToEnemy(
  state: CombatState,
  enemy: CombatEnemy,
  rawAmount: number,
  sourceType: string,
  kind?: string,
  extras?: {
    cardId?: string;
    cost?: number;
    perOtherZeroCost?: number;
    ignoreStrength?: boolean;
    ignoreThorns?: boolean;
    flat?: boolean;
    logAs?: string;
  },
): { dmg: number; hpLoss: number } {
  const dmg = extras?.flat
    ? Math.max(0, Math.floor(num(rawAmount)))
    : previewPlayerDeal(state, rawAmount, enemy, sourceType, kind, extras);
  if (dmg <= 0) return { dmg: 0, hpLoss: 0 };
  const hit = hitThroughBlock(num(enemy.block), dmg, num(bagOf(enemy).frail) > 0);
  enemy.block = hit.block;
  enemy.hp = Math.max(0, num(enemy.hp) - hit.hpLoss);
  const fxKind =
    extras?.cardId === 'petal' ? 'petal' : extras?.cardId === 'flare-blitz' ? 'flare' : 'hitEnemy';
  pushFx(state, {
    kind: fxKind,
    targetId: enemy.id,
    amount: dmg,
    hp: enemy.hp,
    block: enemy.block,
    cardId: extras?.cardId,
  });
  pushLog(
    state,
    extras?.logAs ? `${extras.logAs}: ${dmg} damage to ${enemy.name}.` : `${dmg} damage to ${enemy.name}.`,
  );
  if (hit.hpLoss > 0) {
    const curl = num(enemy.traits?.curlUp);
    if (curl > 0 && !enemy.curlUpUsed) {
      enemy.curlUpUsed = true;
      gainEnemyBlock(state, enemy, curl);
      pushLog(state, `${enemy.name} curled up and gained ${curl} Block.`);
    }
    const thorns = extras?.ignoreThorns ? 0 : num(enemy.traits?.thorns);
    if (thorns > 0 && num(enemy.hp) > 0) {
      const reflectDmg = smokeReduce(state, enemy, thorns);
      const reflect = hitThroughBlock(num(state.playerBlock), reflectDmg, num(state.statuses?.frail) > 0);
      state.playerBlock = reflect.block;
      if (reflect.hpLoss > 0) applyPlayerHpLoss(state, reflect.hpLoss);
      pushLog(state, `${enemy.name}'s Thorns dealt ${reflectDmg}.`);
    }
  }
  checkPhase(state, enemy);
  resolveDeaths(state);
  return { dmg, hpLoss: hit.hpLoss };
}

function pickIntent(
  intents: EnemyIntentPattern[],
  index: number,
  skip: readonly EnemyIntentKind[] = [],
): { intent: EnemyIntentPattern; next: number } {
  if (!intents.length) {
    return { intent: { kind: 'attack', amount: 6 }, next: 1 };
  }
  const n = intents.length;
  let i = Math.abs(index) % n;
  if (!skip.length) {
    return { intent: intents[i]!, next: i + 1 };
  }
  const blocked = new Set(skip);
  for (let step = 0; step < n; step += 1) {
    const candidate = intents[i]!;
    if (!blocked.has(candidate.kind)) {
      return { intent: candidate, next: i + 1 };
    }
    i = (i + 1) % n;
  }
  return { intent: { kind: 'attack', amount: 6 }, next: (Math.abs(index) % n) + 1 };
}

function skipAllyBuff(state: CombatState, enemy: CombatEnemy): EnemyIntentKind[] {
  return living(state).some((other) => other.id !== enemy.id) ? [] : ['buffAlly'];
}

function intentsOf(enemy: CombatEnemy): EnemyIntentPattern[] {
  if (enemy.phased && enemy.traits?.phaseIntents?.length) return enemy.traits.phaseIntents;
  return ENEMIES[enemy.defId]?.intents ?? [];
}

function hashChance(key: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0;
}

function kitStatus(enemy: CombatEnemy): { status: CombatStatus; stacks: number } | undefined {
  for (const pattern of [...intentsOf(enemy), ...(enemy.traits?.phaseIntents ?? [])]) {
    if (pattern.status && num(pattern.statusStacks) > 0) {
      return { status: pattern.status, stacks: Math.min(2, num(pattern.statusStacks)) };
    }
  }
  return undefined;
}

function typeStatus(types: string[]): { status: CombatStatus; stacks: number } {
  if (types.includes('poison')) return { status: 'toxic', stacks: 2 };
  if (types.includes('fire')) return { status: 'burn', stacks: 2 };
  if (types.includes('ice') || types.includes('water')) return { status: 'frail', stacks: 1 };
  if (types.includes('electric')) return { status: 'vulnerable', stacks: 1 };
  if (types.includes('flying') || types.includes('bug')) return { status: 'weak', stacks: 1 };
  return { status: 'vulnerable', stacks: 1 };
}

function linkedStatusIntent(enemy: CombatEnemy): EnemyIntentPattern {
  const pick = kitStatus(enemy) ?? typeStatus(enemy.types);
  return { kind: 'status', amount: 0, status: pick.status, statusStacks: pick.stacks };
}

function typicalStrikeAmount(enemy: CombatEnemy): number {
  const strikes = intentsOf(enemy).filter((intent) => isStrikeIntent(intent.kind));
  if (!strikes.length) return 6;
  return Math.min(...strikes.map((intent) => num(intent.amount, 6)));
}

function linkedAttackIntent(enemy: CombatEnemy): EnemyIntentPattern {
  return { kind: 'attack', amount: Math.max(1, Math.floor(typicalStrikeAmount(enemy) * 0.5)) };
}

function linkedExtras(enemy: CombatEnemy, intent: EnemyIntentPattern, turn: number): EnemyIntentPattern[] {
  if (!hashChance(`${enemy.id}|${enemy.intentIndex}|${turn}|${intent.kind}`)) return [];
  if (intent.kind === 'block') {
    if (enemy.traits?.blockLinksAttack) return [linkedAttackIntent(enemy)];
    return [linkedStatusIntent(enemy)];
  }
  if (intent.kind === 'heal') return [linkedAttackIntent(enemy)];
  return [];
}

function assignIntent(enemy: CombatEnemy, intent: EnemyIntentPattern, nextIndex: number, turn: number): void {
  enemy.intent = intent;
  enemy.intentIndex = nextIndex;
  enemy.extraIntents = linkedExtras(enemy, intent, turn);
}

function copyTraits(traits: EnemyTraits | undefined): EnemyTraits | undefined {
  return traits ? clone(traits) : undefined;
}

function makeCombatEnemy(
  def: EnemyDef,
  seq: number,
  turn = 1,
  skip: readonly EnemyIntentKind[] = [],
): CombatEnemy {
  const { intent, next } = pickIntent(def.intents, 0, skip);
  const enemy: CombatEnemy = {
    id: `enemy-${def.id}-${seq}`,
    defId: def.id,
    name: def.name,
    types: [...def.types],
    speciesId: def.speciesId,
    hp: def.hp,
    maxHp: def.hp,
    block: num(def.traits?.startBlock),
    strength: 0,
    intent,
    extraIntents: [],
    intentIndex: next,
    statuses: {},
    traits: copyTraits(def.traits),
  };
  assignIntent(enemy, intent, next, turn);
  return enemy;
}

function spawnEnemies(defs: EnemyDef[]): CombatEnemy[] {
  const skip = defs.length > 1 ? [] : (['buffAlly'] as const);
  return defs.map((def, i) => makeCombatEnemy(def, i, 1, skip));
}

function livingCount(state: CombatState): number {
  return living(state).length;
}

function spawnEnemy(state: CombatState, defId: string): CombatEnemy | null {
  if (livingCount(state) >= MAX_ENEMIES) return null;
  const def = ENEMIES[defId];
  if (!def) return null;
  const seq = num(state.spawnSeq);
  state.spawnSeq = seq + 1;
  const skip = livingCount(state) > 0 ? [] : (['buffAlly'] as const);
  const spawned = makeCombatEnemy(def, seq, num(state.turn, 1), skip);
  state.enemies.push(spawned);
  pushLog(state, `${def.name} appeared!`);
  return spawned;
}

function retargetIfNeeded(state: CombatState): void {
  const current = state.enemies.find((e) => e.id === state.selectedEnemyId && num(e.hp) > 0);
  if (current) return;
  state.selectedEnemyId = living(state)[0]?.id ?? null;
}

function checkPhase(state: CombatState, enemy: CombatEnemy): void {
  const pct = enemy.traits?.phaseAtHp;
  if (!pct || enemy.phased || num(enemy.hp) <= 0) return;
  if (num(enemy.hp) > num(enemy.maxHp) * pct) return;
  enemy.phased = true;
  if (enemy.traits?.phaseIntents?.length) {
    const { intent, next } = pickIntent(enemy.traits.phaseIntents, 0, skipAllyBuff(state, enemy));
    assignIntent(enemy, intent, next, num(state.turn, 1));
  }
  if (enemy.traits?.phaseSummonId) spawnEnemy(state, enemy.traits.phaseSummonId);
  pushLog(state, `${enemy.name} entered a new phase!`);
}

function resolveDeaths(state: CombatState): void {
  for (const enemy of [...state.enemies]) {
    if (num(enemy.hp) > 0 || enemy.deathResolved) continue;
    const revivePct = enemy.traits?.reviveOnce;
    if (revivePct && !enemy.revived) {
      enemy.revived = true;
      enemy.hp = Math.max(1, Math.floor(num(enemy.maxHp) * revivePct));
      enemy.block = 0;
      pushLog(state, `${enemy.name} revived!`);
      continue;
    }
    enemy.deathResolved = true;
    const cryDef = ENEMIES[enemy.defId];
    pushFx(state, {
      kind: 'faint',
      targetId: enemy.id,
      defId: enemy.defId,
      speciesId: cryDef?.speciesId ?? enemy.speciesId,
      speciesName: cryDef?.name ?? enemy.name,
    });
    const boom = num(enemy.traits?.explodeOnDeath);
    const allyAlive = state.enemies.some((other) => other.id !== enemy.id && num(other.hp) > 0);
    if (boom > 0 && allyAlive) {
      const boomDmg = smokeReduce(state, enemy, boom);
      const hit = hitThroughBlock(num(state.playerBlock), boomDmg, num(state.statuses?.frail) > 0);
      state.playerBlock = hit.block;
      pushFx(state, { kind: 'hitPlayer', targetId: enemy.id, amount: hit.hpLoss || boomDmg });
      if (hit.hpLoss > 0) applyPlayerHpLoss(state, hit.hpLoss);
      pushLog(state, `${enemy.name} exploded for ${boomDmg}!`);
    }
    for (const id of enemy.traits?.splitInto ?? []) {
      if (livingCount(state) >= MAX_ENEMIES) break;
      spawnEnemy(state, id);
    }
  }
  retargetIfNeeded(state);
}

function gainBlock(state: CombatState, amount: number): void {
  const gained = previewPlayerBlock(state, amount);
  if (gained <= 0) return;
  state.playerBlock = num(state.playerBlock) + gained;
  pushFx(state, { kind: 'blockGain', targetId: 'player', amount: gained });
}

function gainEnemyBlock(state: CombatState, enemy: CombatEnemy, amount: number): void {
  const gained = scaleBlockGain(amount);
  if (gained <= 0) return;
  enemy.block = num(enemy.block) + gained;
  pushFx(state, { kind: 'blockGain', targetId: enemy.id, amount: gained });
  const spikes = num(state.powers?.toxicSpikes);
  if (spikes > 0) {
    enemy.statuses = addStatus(enemy.statuses, 'toxic', spikes);
    pushFx(state, { kind: 'status', targetId: enemy.id, status: 'toxic', amount: spikes });
    pushLog(state, `Toxic Spikes: ${enemy.name} gained ${spikes} toxic.`);
  }
}

function gardenTokensInHand(state: CombatState): number {
  return (state.hand ?? []).filter((card) => card.defId === 'seed' || card.defId === 'petal').length;
}

function applyEnemyStatus(
  state: CombatState,
  enemy: CombatEnemy,
  status: CombatStatus,
  stacks: number,
): void {
  enemy.statuses = addStatus(enemy.statuses, status, stacks);
  pushFx(state, { kind: 'status', targetId: enemy.id, status, amount: stacks });
  pushLog(state, `${enemy.name} gained ${stacks} ${status}.`);
  if (status !== 'frail') return;
  const toxic = num(state.powers?.effectSpore);
  if (toxic > 0) {
    enemy.statuses = addStatus(enemy.statuses, 'toxic', toxic);
    pushFx(state, { kind: 'status', targetId: enemy.id, status: 'toxic', amount: toxic });
    pushLog(state, `Effect Spore: ${enemy.name} gained ${toxic} toxic.`);
  }
  const weak = num(state.powers?.effectSporeWeak);
  if (weak > 0) {
    enemy.statuses = addStatus(enemy.statuses, 'weak', weak);
    pushFx(state, { kind: 'status', targetId: enemy.id, status: 'weak', amount: weak });
    pushLog(state, `Effect Spore: ${enemy.name} gained ${weak} weak.`);
  }
}

function pickRandomLiving(state: CombatState, rng?: Rng): CombatEnemy | undefined {
  const foes = living(state);
  if (foes.length === 0) return undefined;
  if (!rng) return foes[Math.floor(Math.random() * foes.length)];
  return foes[pickIndex(rng, foes.length)];
}

function evokeCharge(state: CombatState, kind: 'attack' | 'block', rng?: Rng): void {
  const potency = chargePotency(state);
  pushFx(state, { kind: 'chargeEvoke', chargeKind: kind, amount: potency });
  if (kind === 'block') {
    gainBlock(state, potency);
    pushLog(state, `Evoked Block Charge: ${potency} Block.`);
    return;
  }
  const enemy = pickRandomLiving(state, rng);
  if (enemy) dealToEnemy(state, enemy, potency, 'water');
  pushLog(state, `Evoked Attack Charge: ${potency} damage.`);
}

function addOneCharge(state: CombatState, kind: 'attack' | 'block', rng?: Rng): void {
  const queue = ensureChargeQueue(state);
  const cap = chargeSlotCount(state);
  if (cap > 0 && queue.length >= cap) {
    const right = queue.pop();
    if (right) evokeCharge(state, right, rng);
  }
  if (cap > 0 && queue.length < cap) queue.push(kind);
  state.chargeQueue = queue;
  state.chargesAddedThisCombat = num(state.chargesAddedThisCombat) + 1;
  syncWaterCharges(state);
  if (kind === 'block' && num(state.powers?.torrentEcho) > 0) {
    addOneCharge(state, 'attack', rng);
  }
}

function nextCombatCardId(state: CombatState): string {
  state.cardSeq = num(state.cardSeq) + 1;
  return `gain-${state.cardSeq}`;
}

function addGainedCard(
  state: CombatState,
  defId: string,
  extras?: { costOverride?: number },
): void {
  const inst: CardInstance = {
    instanceId: nextCombatCardId(state),
    defId,
    upgraded: false,
    costOverride: extras?.costOverride,
  };
  if (state.hand.length < HAND_CAP) {
    state.hand.push(inst);
    pushLog(state, `Added ${resolveCard(inst).name} to your hand.`);
    return;
  }
  state.discardPile.push(inst);
  pushLog(state, `Added ${resolveCard(inst).name} to the discard pile.`);
}

function addRandomClassPower(state: CombatState, rng: Rng, costOverride?: number): void {
  const defs = classPowerDefs(state.characterId);
  if (defs.length === 0) return;
  const def = defs[pickIndex(rng, defs.length)]!;
  addGainedCard(state, def.id, { costOverride });
}

function addPetals(state: CombatState, amount: number): void {
  for (let i = 0; i < num(amount); i += 1) addGainedCard(state, 'petal');
}

function addSeeds(state: CombatState, amount: number): void {
  for (let i = 0; i < num(amount); i += 1) addGainedCard(state, 'seed');
}

function triggerRootNetwork(state: CombatState): void {
  const toxic = num(state.powers?.rootNetwork);
  if (toxic <= 0) return;
  for (const enemy of living(state)) {
    enemy.statuses = addStatus(enemy.statuses, 'toxic', toxic);
    pushFx(state, { kind: 'status', targetId: enemy.id, status: 'toxic', amount: toxic });
  }
  const block = num(state.powers?.rootNetworkBlock);
  if (block > 0) gainBlock(state, block);
  pushLog(state, `Root Network: ${toxic} Toxic to ALL enemies.`);
}

function healFromCard(state: CombatState, amount: number): number {
  const heal = Math.max(0, num(amount));
  if (heal <= 0) return 0;
  const before = num(state.playerHp);
  state.playerHp = Math.min(num(state.playerMaxHp), before + heal);
  const gained = num(state.playerHp) - before;
  if (gained > 0) triggerRootNetwork(state);
  return gained;
}

function offerZeroCostCards(state: CombatState, rng: Rng, mode: 'random' | 'choose'): void {
  const defs = zeroCostCardDefs();
  if (defs.length === 0) return;
  if (mode === 'random') {
    const def = defs[pickIndex(rng, defs.length)]!;
    addGainedCard(state, def.id);
    return;
  }
  state.pendingZeroCostOffer = defs.map((def) => ({
    instanceId: nextCombatCardId(state),
    defId: def.id,
    upgraded: false,
  }));
}

function applyEffects(
  state: CombatState,
  effects: EffectOp[],
  rng: Rng,
  ctx: {
    sourceType: string;
    targetId: string | null;
    kind?: string;
    cardId?: string;
    cost?: number;
    xValue?: number;
  },
): void {
  for (const effect of effects) {
    switch (effect.op) {
      case 'damage': {
        const times =
          (effect.times ?? 1) + (effect.extraTimesPerChargeAdded ? num(state.chargesAddedThisCombat) : 0);
        const targets = effect.all ? living(state) : [getEnemy(state, ctx.targetId)].filter(Boolean);
        let dealt = 0;
        const extras = {
          cardId: ctx.cardId,
          cost: ctx.cost,
          perOtherZeroCost: effect.perOtherZeroCost,
        };
        if (
          effect.ifAnyStatus &&
          !living(state).some((foe) => num(bagOf(foe)[effect.ifAnyStatus!]) > 0)
        ) {
          break;
        }
        const raw = effect.amount + num(effect.perGardenToken) * gardenTokensInHand(state);
        for (const enemy of targets) {
          if (!enemy || enemy.hp <= 0) continue;
          const blockSnap = num(enemy.block);
          const bonusBlock = !!(
            effect.plusBlockIfStatus && num(bagOf(enemy)[effect.plusBlockIfStatus]) > 0
          );
          for (let t = 0; t < times; t += 1) {
            if (enemy.hp <= 0) break;
            const hadBlock = num(enemy.block) > 0;
            const hit = dealToEnemy(state, enemy, raw, ctx.sourceType, ctx.kind, extras);
            dealt += hit.dmg;
            if (effect.repeatIfUnblocked && !hadBlock) {
              const bonus = effect.unblockedBonus ?? raw;
              dealt += dealToEnemy(state, enemy, bonus, ctx.sourceType, ctx.kind, extras).dmg;
            }
          }
          if (bonusBlock && blockSnap > 0 && enemy.hp > 0) {
            dealt += dealToEnemy(state, enemy, blockSnap, ctx.sourceType, ctx.kind, extras).dmg;
          }
        }
        if (effect.blockEqualToDamage && dealt > 0) {
          state.playerBlock = num(state.playerBlock) + dealt;
          pushFx(state, { kind: 'blockGain', targetId: 'player', amount: dealt });
        }
        if (effect.healEqualToDamage && dealt > 0) {
          healFromCard(state, dealt);
          pushLog(state, `Healed ${dealt} HP.`);
        }
        break;
      }
      case 'damageIfStatus': {
        const enemy = getEnemy(state, ctx.targetId);
        if (enemy && (enemy.statuses[effect.status] ?? 0) > 0) {
          dealToEnemy(state, enemy, effect.amount, ctx.sourceType, ctx.kind, {
            cardId: ctx.cardId,
            cost: ctx.cost,
          });
          if (effect.heal) {
            healFromCard(state, effect.heal);
            pushLog(state, `Healed ${effect.heal} HP.`);
          }
        }
        break;
      }
      case 'block':
        gainBlock(state, effect.amount);
        break;
      case 'draw': {
        const drawn = drawCards(state, effect.amount, rng);
        if (effect.replayZeroCost) {
          for (const card of drawn) {
            if (resolveCard(card).cost === 0) card.replay = num(card.replay) + 1;
          }
        }
        break;
      }
      case 'gainEnergy':
        state.energy += effect.amount;
        break;
      case 'status': {
        const times = effect.timesFromX ? Math.max(0, num(ctx.xValue) + num(effect.plus)) : 1;
        const stacks = effect.stacks * Math.max(1, times);
        if (effect.timesFromX && times <= 0) break;
        if (effect.self) {
          state.statuses = addStatus(state.statuses, effect.status, stacks);
          break;
        }
        const targets = effect.all ? living(state) : [getEnemy(state, ctx.targetId)].filter(Boolean);
        for (const enemy of targets) {
          if (!enemy) continue;
          applyEnemyStatus(state, enemy, effect.status, effect.timesFromX ? stacks : effect.stacks);
        }
        break;
      }
      case 'statusIfX': {
        if (num(ctx.xValue) < effect.min) break;
        const enemy = getEnemy(state, ctx.targetId);
        if (enemy) applyEnemyStatus(state, enemy, effect.status, effect.stacks);
        break;
      }
      case 'strength':
        if (effect.self !== false) {
          state.strength += effect.amount;
        } else {
          const enemy = getEnemy(state, ctx.targetId);
          if (enemy) enemy.strength += effect.amount;
        }
        break;
      case 'dexterity':
        state.dexterity += effect.amount;
        break;
      case 'applyPower':
        state.powers = state.powers ?? {};
        state.powers[effect.power] = num(state.powers[effect.power]) + (effect.stacks ?? 1);
        pushLog(state, `Power: ${effect.power}.`);
        break;
      case 'exhaust':
        break;
      case 'discard':
        state.discardThen = [...(state.discardThen ?? []), ...(effect.then ?? [])];
        state.discardIfSkill = [...(state.discardIfSkill ?? []), ...(effect.ifSkill ?? [])];
        state.pendingDiscard += effect.amount;
        completeDiscardIfEmpty(state, rng);
        break;
      case 'addCharge': {
        for (let i = 0; i < num(effect.amount); i += 1) addOneCharge(state, effect.kind, rng);
        break;
      }
      case 'heal':
        healFromCard(state, effect.amount);
        break;
      case 'healPercent': {
        const amount = Math.floor(num(state.playerMaxHp) * (effect.percent / 100));
        healFromCard(state, amount);
        pushLog(state, `Healed ${amount} HP.`);
        break;
      }
      case 'healFull':
        healFromCard(state, Math.max(0, num(state.playerMaxHp) - num(state.playerHp)));
        pushLog(state, 'Healed to full.');
        break;
      case 'blockTimes': {
        const times = Math.max(0, num(ctx.xValue) + num(effect.plus));
        for (let i = 0; i < times; i += 1) gainBlock(state, effect.amount);
        if (times > 0) pushLog(state, `Gained Block ${times} times.`);
        break;
      }
      case 'addClassPower':
        addRandomClassPower(state, rng, effect.costOverride);
        break;
      case 'upgradeCombatRewards':
        state.upgradeCardRewards = true;
        pushLog(state, 'Card rewards this combat will be upgraded.');
        break;
      case 'loseHp':
        applyPlayerHpLoss(state, effect.amount);
        break;
      case 'clearStatuses':
        state.statuses = {};
        break;
      case 'shredBlock': {
        const enemy = getEnemy(state, ctx.targetId);
        if (enemy) {
          const lost = Math.floor(num(enemy.block) * (effect.percent / 100));
          enemy.block = Math.max(0, num(enemy.block) - lost);
          pushLog(state, `Shredded ${lost} Block from ${enemy.name}.`);
        }
        break;
      }
      case 'freePlay':
        grantFreePlay(state, rng, effect.mode);
        break;
      case 'smokeScreen':
        state.smokeScreen = Math.max(num(state.smokeScreen), effect.percent);
        pushLog(state, `Smoke Screen: ${effect.percent}% less damage from Vulnerable foes.`);
        break;
      case 'strengthThisTurn':
        state.tempStrength = num(state.tempStrength) + effect.amount;
        pushLog(state, `Gained ${effect.amount} Strength this turn.`);
        break;
      case 'gainMaxHp':
        state.playerMaxHp = num(state.playerMaxHp) + effect.amount;
        state.playerHp = Math.min(state.playerMaxHp, num(state.playerHp) + effect.amount);
        pushLog(state, `Max HP increased by ${effect.amount}.`);
        break;
      case 'multiplyStatus': {
        const targets = effect.all
          ? living(state)
          : [getEnemy(state, ctx.targetId)].filter(Boolean);
        if (!targets.some((enemy) => enemy && num(enemy.statuses[effect.status]) > 0)) break;
        for (const enemy of targets) {
          if (!enemy) continue;
          const cur = num(enemy.statuses[effect.status]);
          if (cur <= 0) continue;
          const nextStacks = cur * effect.factor;
          enemy.statuses = { ...enemy.statuses, [effect.status]: nextStacks };
          pushLog(state, `${enemy.name}'s ${effect.status} is now ${nextStacks}.`);
        }
        break;
      }
      case 'focus':
        if (effect.thisTurn) {
          state.tempFocus = num(state.tempFocus) + effect.amount;
          pushLog(state, `Gained ${effect.amount} Focus this turn.`);
        } else {
          state.powers = state.powers ?? {};
          state.powers.focus = num(state.powers.focus) + effect.amount;
          pushLog(state, `Gained ${effect.amount} Focus.`);
        }
        break;
      case 'reflect':
        state.reflectPercent = Math.max(num(state.reflectPercent), effect.percent);
        pushLog(state, `Reflect ${effect.percent}% of damage taken this turn.`);
        break;
      case 'preventDamageAndEndTurn':
        state.preventAllDamage = true;
        state.pendingSurfDamage = Math.max(num(state.pendingSurfDamage), effect.nextTurnDamage);
        state.forceEndTurn = true;
        pushLog(state, 'All damage is prevented this turn.');
        break;
      case 'clearEnemyBlock': {
        const targets = effect.all ? living(state) : [getEnemy(state, ctx.targetId)].filter(Boolean);
        for (const enemy of targets) {
          if (!enemy) continue;
          enemy.block = 0;
          pushLog(state, `${enemy.name} lost all Block.`);
        }
        break;
      }
      case 'addZeroCostFromAnyClass':
        offerZeroCostCards(state, rng, effect.mode);
        break;
      case 'addPetal':
        addPetals(state, effect.amount);
        break;
      case 'addSeed':
        addSeeds(state, effect.amount);
        break;
      case 'statusIfStatus': {
        const enemy = getEnemy(state, ctx.targetId);
        if (enemy && num(bagOf(enemy)[effect.ifStatus]) > 0) {
          applyEnemyStatus(state, enemy, effect.status, effect.stacks);
        }
        break;
      }
      case 'discardAny':
        state.pendingOptionalDiscard = true;
        state.optionalDiscardPicks = [];
        state.optionalDiscardPer = [...(effect.thenPer ?? [])];
        state.optionalDiscardFilter = effect.filter ?? null;
        state.optionalDiscardExhaust = !!effect.exhaust;
        state.optionalDiscardCardId = ctx.cardId ?? null;
        pushLog(
          state,
          effect.exhaust
            ? `Choose any number of ${effect.filter === 'seed' ? 'Seeds' : 'cards'} to Exhaust.`
            : 'Choose any number of cards to discard.',
        );
        break;
      case 'harvestSeeds': {
        const fromHand = state.hand.filter((card) => card.defId === 'seed');
        const fromDiscard = state.discardPile.filter((card) => card.defId === 'seed');
        const seeds = [...fromHand, ...fromDiscard];
        state.hand = state.hand.filter((card) => card.defId !== 'seed');
        state.discardPile = state.discardPile.filter((card) => card.defId !== 'seed');
        const seedDef = resolveCard({ instanceId: 'seed-play', defId: 'seed', upgraded: false });
        for (const seed of seeds) {
          applyEffects(state, seedDef.effects, rng, {
            sourceType: seedDef.type,
            targetId: ctx.targetId,
            kind: seedDef.kind,
            cardId: 'seed',
            cost: 0,
          });
          state.exhaustPile.push(seed);
          onExhaust(state, rng);
          routeExhaustedCard(state, seed, rng);
        }
        if (seeds.length > 0 && effect.healPer > 0) healFromCard(state, effect.healPer * seeds.length);
        if (seeds.length) pushLog(state, `Harvested ${seeds.length} Seed${seeds.length === 1 ? '' : 's'}.`);
        break;
      }
      case 'freeNext':
        state.freeNextKind = effect.kind;
        pushLog(state, `The next ${effect.kind} you play costs 0.`);
        break;
      case 'statusIfNoBlock': {
        const enemy = getEnemy(state, ctx.targetId);
        if (enemy && num(enemy.block) <= 0) {
          enemy.statuses = addStatus(enemy.statuses, effect.status, effect.stacks);
          pushLog(state, `${enemy.name} gained ${effect.stacks} ${effect.status}.`);
        }
        break;
      }
      case 'toxicIfAlready': {
        const enemy = getEnemy(state, ctx.targetId);
        if (!enemy) break;
        const had = num(enemy.statuses.toxic) > 0;
        if (effect.already === 'double') {
          enemy.statuses = addStatus(enemy.statuses, 'toxic', effect.apply);
          if (had) {
            const nextStacks = num(enemy.statuses.toxic) * 2;
            enemy.statuses = { ...enemy.statuses, toxic: nextStacks };
            pushLog(state, `${enemy.name}'s toxic is now ${nextStacks}.`);
          } else {
            pushLog(state, `${enemy.name} gained ${effect.apply} toxic.`);
          }
        } else {
          const stacks = had ? effect.already : effect.apply;
          enemy.statuses = addStatus(enemy.statuses, 'toxic', stacks);
          pushLog(state, `${enemy.name} gained ${stacks} toxic.`);
        }
        break;
      }
      case 'toxicPerFive': {
        const enemy = getEnemy(state, ctx.targetId);
        if (!enemy) break;
        const current = num(enemy.statuses.toxic);
        const extra = Math.floor(current / 5) * effect.perFive;
        const stacks = effect.base + extra;
        enemy.statuses = addStatus(enemy.statuses, 'toxic', stacks);
        pushLog(state, `${enemy.name} gained ${stacks} toxic.`);
        break;
      }
      case 'gainMaxHpIfAttacking': {
        const enemy = getEnemy(state, ctx.targetId);
        const attacking = !!(enemy && isStrikeIntent(enemy.intent?.kind));
        const amount = attacking ? effect.amount : num(effect.otherwise);
        if (amount > 0) {
          state.playerMaxHp = num(state.playerMaxHp) + amount;
          state.playerHp = Math.min(state.playerMaxHp, num(state.playerHp) + amount);
          pushLog(state, `Max HP increased by ${amount}.`);
        }
        break;
      }
      case 'blockEqualToStatus': {
        const enemy = getEnemy(state, ctx.targetId);
        const stacks = enemy ? num(bagOf(enemy)[effect.status]) : 0;
        if (stacks > 0) gainBlock(state, stacks);
        else pushLog(state, `No ${effect.status} to convert into Block.`);
        break;
      }
      case 'playExhaustedPetals': {
        const petals = state.exhaustPile.filter((c) => c.defId === 'petal');
        const petalDef = resolveCard({ instanceId: 'petal-play', defId: 'petal', upgraded: false });
        const lockedId = effect.all ? null : (ctx.targetId ?? living(state)[0]?.id ?? null);
        let played = 0;
        for (const _petal of petals) {
          const targets = effect.all
            ? living(state)
            : [state.enemies.find((e) => e.id === lockedId && num(e.hp) > 0)].filter(Boolean);
          if (!targets.length) break;
          for (const enemy of targets) {
            if (!enemy) continue;
            applyEffects(state, petalDef.effects, rng, {
              sourceType: petalDef.type,
              targetId: enemy.id,
              kind: petalDef.kind,
              cardId: 'petal',
              cost: 0,
            });
          }
          if (effect.blockPerPetal) gainBlock(state, effect.blockPerPetal);
          played += 1;
        }
        if (played) pushLog(state, `Blooming played ${played} Petal${played === 1 ? '' : 's'}.`);
        break;
      }
      case 'strengthNextTurn':
        state.pendingNextTurnStrength = num(state.pendingNextTurnStrength) + effect.amount;
        pushLog(state, `Gain ${effect.amount} Strength next turn.`);
        break;
      default:
        break;
    }
  }
}

function followupCtx(state: CombatState): {
  sourceType: string;
  targetId: string | null;
} {
  return { sourceType: 'grass', targetId: state.selectedEnemyId };
}

function resolveOnDiscard(state: CombatState, inst: CardInstance, rng: Rng): void {
  state.discardedThisTurn = num(state.discardedThisTurn) + 1;
  const def = resolveCard(inst);
  if (def.onDiscard?.length) applyEffects(state, def.onDiscard, rng, followupCtx(state));
  if (!def.exhaustOnDiscard) return;
  const idx = state.discardPile.findIndex((c) => c.instanceId === inst.instanceId);
  if (idx >= 0) state.discardPile.splice(idx, 1);
  state.exhaustPile.push(inst);
  onExhaust(state, rng);
  routeExhaustedCard(state, inst, rng);
}

function finishDiscardBatch(state: CombatState, rng: Rng): void {
  const then = state.discardThen ?? [];
  state.discardThen = [];
  state.discardIfSkill = [];
  if (then.length) applyEffects(state, then, rng, followupCtx(state));
}

export function completeDiscardIfEmpty(state: CombatState, rng: Rng): void {
  if (state.pendingDiscard <= 0 || state.hand.length > 0) return;
  state.pendingDiscard = 0;
  finishDiscardBatch(state, rng);
}

function triggerFrenzyPlant(state: CombatState, rng: Rng): void {
  const dmg = num(state.powers?.['frenzy-plant']);
  if (dmg <= 0) return;
  const foes = living(state);
  if (foes.length === 0) return;
  const enemy = foes[pickIndex(rng, foes.length)]!;
  dealToEnemy(state, enemy, dmg, 'grass', undefined, {
    cardId: 'frenzy-plant',
    ignoreStrength: true,
    ignoreThorns: true,
  });
}

function triggerLifeOrb(state: CombatState): void {
  applyPlayerHpLoss(state, 1);
  pushLog(state, 'Life Orb saps 1 HP.');
  pushFx(state, { kind: 'relicGlow', relicId: 'life-orb' });
  const enemy = getEnemy(state, state.selectedEnemyId) ?? living(state)[0];
  if (!enemy || enemy.hp <= 0) return;
  dealToEnemy(state, enemy, 4, 'colorless', undefined, {
    ignoreStrength: true,
    ignoreThorns: true,
    flat: true,
    logAs: 'Life Orb',
  });
}

function runRelicHooks(
  state: CombatState,
  when: 'combatStart' | 'turnStart' | 'turnEnd' | 'turnEndNoBlock' | 'onPlay' | 'onExhaust' | 'onPotion',
  rng: Rng,
  kind?: string,
): void {
  for (const relicId of state.relics) {
    const relic = findRelicDef(relicId);
    if (!relic) continue;
    for (const hook of relic.hooks) {
      if (hook.when !== when) continue;
      if (hook.when === 'onPlay' && hook.kind && hook.kind !== kind) continue;
      if (hook.when === 'onPlay' && hook.oncePerTurn) {
        const used = (state.relicsUsedThisTurn ?? []).includes(relicId);
        const played =
          kind === 'power'
            ? num(state.powersPlayedThisTurn)
            : kind === 'attack'
              ? num(state.attacksPlayedThisTurn)
              : 0;
        if (used || played > 0) continue;
      }
      if (!('effects' in hook)) continue;
      if (hook.when === 'onPlay' && hook.oncePerTurn) {
        state.relicsUsedThisTurn = [...(state.relicsUsedThisTurn ?? []), relicId];
      }
      if (relicId === 'life-orb' && when === 'onPlay') {
        triggerLifeOrb(state);
        continue;
      }
      applyEffects(state, hook.effects, rng, {
        sourceType: 'colorless',
        targetId: state.selectedEnemyId,
        kind,
      });
    }
  }
}

function applyBonusEnergy(state: CombatState): void {
  const extra = relicHookAmount(state.relics, 'bonusEnergy');
  if (extra > 0) {
    state.energy += extra;
    pushLog(state, `Gained ${extra} Energy.`);
  }
}

function triggerEveryNAttacks(state: CombatState, rng: Rng): void {
  const count = num(state.attacksPlayedThisTurn);
  for (const relicId of state.relics) {
    for (const hook of findRelicDef(relicId)?.hooks ?? []) {
      if (hook.when !== 'everyNAttacks') continue;
      if (hook.n <= 0 || count % hook.n !== 0) continue;
      applyEffects(state, hook.effects, rng, {
        sourceType: 'colorless',
        targetId: state.selectedEnemyId,
        kind: 'attack',
      });
    }
  }
}

function grantFreePlay(state: CombatState, rng: Rng, mode: 'random' | 'choose'): void {
  const eligible = eligibleFreePlayCards(state);
  if (eligible.length === 0) return;
  if (mode === 'choose') {
    state.pendingFreePick = num(state.pendingFreePick) + 1;
    state.freePickSelected = null;
    return;
  }
  const pick = eligible[pickIndex(rng, eligible.length)]!;
  state.freePlayIds = [...(state.freePlayIds ?? []), pick.instanceId];
  pushLog(state, `${resolveCard(pick).name} is free to play this turn.`);
}

function onExhaust(state: CombatState, rng: Rng): void {
  const dex = num(state.powers.combustDex);
  if (dex > 0) {
    state.dexterity += dex;
    pushLog(state, `Combust: +${dex} Dexterity.`);
  }
  const combust = num(state.powers.combust);
  if (combust > 0) {
    for (const enemy of living(state)) {
      dealToEnemy(state, enemy, combust, 'fire', undefined, { ignoreThorns: true });
    }
  }
  runRelicHooks(state, 'onExhaust', rng);
}

function routeExhaustedCard(state: CombatState, inst: CardInstance, rng: Rng): void {
  const drawMode = num(state.powers.droughtDraw) > 0;
  const discardMode = num(state.powers.droughtDiscard) > 0;
  if (!drawMode && !discardMode) return;
  const idx = state.exhaustPile.findIndex((c) => c.instanceId === inst.instanceId);
  if (idx < 0) return;
  const [card] = state.exhaustPile.splice(idx, 1);
  if (!card) return;
  const name = resolveCard(card).name;
  if (drawMode) {
    state.drawPile = shuffle(rng, [...state.drawPile, card]);
    pushLog(state, `${name} shuffled into the draw pile.`);
  } else {
    state.discardPile.push(card);
    pushLog(state, `${name} discarded instead of Exhaust.`);
  }
}

export function createCombat(opts: {
  hp: number;
  maxHp: number;
  deck: CardInstance[];
  relics: string[];
  potions: (string | null)[];
  enemyDefs: EnemyDef[];
  playerTypes: string[];
  rng: Rng;
  characterId?: CharacterId;
  permStrength?: number;
  permDexterity?: number;
}): CombatState {
  let energyMax = 3;
  let drawCount = 5;
  for (const relicId of opts.relics) {
    for (const hook of findRelicDef(relicId)?.hooks ?? []) {
      if (hook.when === 'energyMax') energyMax += hook.amount;
      if (hook.when === 'drawPerTurn') drawCount += hook.amount;
    }
  }

  const state: CombatState = {
    playerHp: opts.hp,
    playerMaxHp: opts.maxHp,
    playerBlock: 0,
    playerTypes: opts.playerTypes,
    characterId: opts.characterId ?? 'blaze',
    energy: energyMax,
    energyMax,
    drawCount,
    strength: num(opts.permStrength),
    dexterity: num(opts.permDexterity),
    statuses: {},
    powers: {},
    waterCharges: { attack: 0, block: 0 },
    chargeQueue: [],
    tempFocus: 0,
    reflectPercent: 0,
    preventAllDamage: false,
    pendingSurfDamage: 0,
    forceEndTurn: false,
    zeroCostPlayed: 0,
    chargesAddedThisCombat: 0,
    pendingZeroCostOffer: [],
    cardSeq: 0,
    hand: [],
    drawPile: shuffle(
      opts.rng,
      opts.deck.map((c) => ({ ...c })),
    ),
    discardPile: [],
    exhaustPile: [],
    enemies: spawnEnemies(opts.enemyDefs),
    relics: [...opts.relics],
    potions: [...opts.potions],
    turn: 1,
    log: ['Combat start!'],
    pendingDiscard: 0,
    pendingOptionalDiscard: false,
    optionalDiscardPicks: [],
    optionalDiscardPer: [],
    optionalDiscardFilter: null,
    optionalDiscardExhaust: false,
    optionalDiscardCardId: null,
    discardedThisTurn: 0,
    pendingFreePick: 0,
    freePlayIds: [],
    freeNextKind: null,
    pendingNextTurnStrength: 0,
    discardThen: [],
    discardIfSkill: [],
    tempStrength: 0,
    smokeScreen: 0,
    selectedEnemyId: null,
    sashUsed: false,
    spawnSeq: opts.enemyDefs.length,
    upgradeCardRewards: false,
    attacksPlayedThisTurn: 0,
    powersPlayedThisTurn: 0,
    pendingChoiceBand: relicHasHook(opts.relics, 'choiceBand'),
    choiceBandPicks: [],
    playerTurnClosed: false,
    relicsUsedThisTurn: [],
    activePowers: [],
    combatFx: [],
    freePickSelected: null,
  };
  state.selectedEnemyId = state.enemies[0]?.id ?? null;
  runRelicHooks(state, 'combatStart', opts.rng);
  drawCards(state, state.drawCount, opts.rng);
  if (relicHasHook(state.relics, 'upgradeOpeningHand')) {
    for (const card of state.hand) card.upgraded = true;
    pushLog(state, 'Exp. Share upgraded your opening hand.');
  }
  applyBonusEnergy(state);
  if (state.pendingChoiceBand) {
    pushLog(state, 'Choice Band: discard any number of cards, then draw that many.');
  }
  return state;
}

export function combatOutcome(state: CombatState): CombatOutcome {
  if (num(state.playerHp) <= 0) return 'lose';
  if (state.enemies.length === 0) return 'ongoing';
  if (state.enemies.every((e) => num(e.hp) <= 0)) return 'win';
  return 'ongoing';
}

export function selectEnemy(state: CombatState, enemyId: string): CombatState {
  const next = clone(state);
  if (next.enemies.some((e) => e.id === enemyId && e.hp > 0)) {
    next.selectedEnemyId = enemyId;
  }
  return next;
}

export function playCard(
  state: CombatState,
  instanceId: string,
  targetId: string | undefined,
  rng: Rng,
): CombatState {
  const next = clone(state);
  if (next.pendingChoiceBand || next.pendingOptionalDiscard) return next;
  if (num(next.pendingDiscard) > 0 || num(next.pendingFreePick) > 0) return next;
  if ((next.pendingZeroCostOffer ?? []).length > 0) return next;
  const index = next.hand.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return next;
  const inst = next.hand[index]!;
  const def = resolveCard(inst);
  const free = (next.freePlayIds ?? []).includes(instanceId);
  const kindFree = next.freeNextKind != null && next.freeNextKind === def.kind;
  const cost = energyCostToPlay(next, inst, def);
  if (next.energy < cost) return next;
  if (def.target === 'enemy' && living(next).length === 0) return next;

  const xValue = def.xCost ? cost : undefined;
  next.energy -= cost;
  if (free) next.freePlayIds = (next.freePlayIds ?? []).filter((id) => id !== instanceId);
  if (kindFree) next.freeNextKind = null;
  next.hand.splice(index, 1);
  if (targetId) next.selectedEnemyId = targetId;
  pushLog(next, `Played ${def.name}.`);

  const replay = num(inst.replay);
  inst.replay = 0;
  const attackingTarget = (() => {
    const enemy = getEnemy(next, next.selectedEnemyId);
    return !!(enemy && isStrikeIntent(enemy.intent?.kind));
  })();
  const exhaust =
    def.exhaust ||
    def.kind === 'power' ||
    def.effects.some((e) => e.op === 'exhaust') ||
    (attackingTarget &&
      def.effects.some((e) => e.op === 'gainMaxHpIfAttacking' && e.exhaust));
  const ctx = {
    sourceType: def.type,
    targetId: next.selectedEnemyId,
    kind: def.kind,
    cardId: def.id,
    cost,
    xValue,
  };
  applyEffects(next, def.effects, rng, ctx);
  if (replay > 0) {
    pushLog(next, `${def.name} Replays.`);
    applyEffects(next, def.effects, rng, ctx);
  }

  if (cost === 0) {
    next.zeroCostPlayed = num(next.zeroCostPlayed) + 1;
    const bonusBlock = num(next.powers?.zeroCostBlock);
    if (bonusBlock > 0) gainBlock(next, bonusBlock);
  }

  if (def.kind === 'skill') {
    for (const enemy of living(next)) {
      const rage = num(enemy.traits?.enrageOnSkill);
      if (rage > 0) {
        enemy.strength += rage;
        enemy.enrageStrength = num(enemy.enrageStrength) + rage;
        pushLog(next, `${enemy.name} enraged! +${rage} Strength this turn.`);
      }
    }
  }

  if (def.kind === 'power') {
    for (const enemy of living(next)) {
      const punish = num(enemy.traits?.punishOnPower);
      if (punish <= 0) continue;
      const dmg = smokeReduce(next, enemy, punish);
      const hit = hitThroughBlock(num(next.playerBlock), dmg, num(next.statuses?.frail) > 0);
      next.playerBlock = hit.block;
      pushFx(next, { kind: 'hitPlayer', targetId: enemy.id, amount: hit.hpLoss || dmg });
      if (hit.hpLoss > 0) applyPlayerHpLoss(next, hit.hpLoss);
      pushLog(next, `${enemy.name} punished the Power for ${dmg}!`);
    }
  }

  if (def.kind === 'attack' && (next.powers['flame-body'] ?? 0) > 0) {
    const enemy = getEnemy(next, next.selectedEnemyId);
    if (enemy) {
      enemy.statuses = addStatus(enemy.statuses, 'burn', next.powers['flame-body']!);
    }
  }
  if (def.kind === 'skill' && (next.powers.afterimage ?? 0) > 0) {
    gainBlock(next, next.powers.afterimage!);
  }

  runRelicHooks(next, 'onPlay', rng, def.kind);
  if (def.kind === 'power') {
    next.powersPlayedThisTurn = num(next.powersPlayedThisTurn) + 1;
    next.activePowers = [...(next.activePowers ?? []), inst];
  }
  if (def.kind === 'attack') {
    next.attacksPlayedThisTurn = num(next.attacksPlayedThisTurn) + 1;
    triggerEveryNAttacks(next, rng);
  }
  triggerFrenzyPlant(next, rng);

  if (exhaust) {
    next.exhaustPile.push(inst);
    onExhaust(next, rng);
    routeExhaustedCard(next, inst, rng);
  } else {
    next.discardPile.push(inst);
  }
  completeDiscardIfEmpty(next, rng);
  return next;
}

export function pickZeroCostCard(state: CombatState, instanceId: string): CombatState {
  const next = clone(state);
  const offer = next.pendingZeroCostOffer ?? [];
  const index = offer.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return next;
  const card = offer[index]!;
  next.pendingZeroCostOffer = [];
  if (next.hand.length < HAND_CAP) {
    next.hand.push(card);
    pushLog(next, `Added ${resolveCard(card).name} to your hand.`);
  } else {
    next.discardPile.push(card);
    pushLog(next, `Added ${resolveCard(card).name} to the discard pile.`);
  }
  return next;
}

export function selectFreePick(state: CombatState, instanceId: string): CombatState {
  const next = clone(state);
  if (num(next.pendingFreePick) <= 0) return next;
  if (!eligibleFreePlayCards(next).some((card) => card.instanceId === instanceId)) return next;
  next.freePickSelected = next.freePickSelected === instanceId ? null : instanceId;
  return next;
}

export function pickFreePlay(state: CombatState, instanceId: string): CombatState {
  const next = clone(state);
  if (num(next.pendingFreePick) <= 0) return next;
  const inst = next.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return next;
  if ((next.freePlayIds ?? []).includes(instanceId)) return next;
  if (energyCostToPlay(next, inst) <= 0) return next;
  next.freePlayIds = [...(next.freePlayIds ?? []), instanceId];
  next.pendingFreePick = num(next.pendingFreePick) - 1;
  next.freePickSelected = null;
  pushLog(next, `${resolveCard(inst).name} is free to play this turn.`);
  return next;
}

export function confirmFreePick(state: CombatState): CombatState {
  if (!state.freePickSelected) return clone(state);
  return pickFreePlay(state, state.freePickSelected);
}

export function discardFromHand(state: CombatState, instanceId: string, rng: Rng): CombatState {
  const next = clone(state);
  if (next.pendingDiscard <= 0) return next;
  const index = next.hand.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return next;
  const inst = next.hand.splice(index, 1)[0]!;
  const def = resolveCard(inst);
  next.discardPile.push(inst);
  next.pendingDiscard -= 1;
  resolveOnDiscard(next, inst, rng);
  if (def.kind === 'skill' && (next.discardIfSkill ?? []).length > 0) {
    applyEffects(next, next.discardIfSkill, rng, followupCtx(next));
  }
  pushLog(next, `Discarded ${def.name}.`);
  if (next.pendingDiscard <= 0) finishDiscardBatch(next, rng);
  else completeDiscardIfEmpty(next, rng);
  return next;
}

function tickDurationStatuses(
  bag: Partial<Record<CombatStatus, number>> | undefined,
): Partial<Record<CombatStatus, number>> {
  let next = bag;
  for (const status of DURATION_STATUSES) {
    if (num(next?.[status]) > 0) next = dropStatus(next, status);
  }
  return next ?? {};
}

function loseEnemyHp(enemy: CombatEnemy, amount: number): number {
  const loss = Math.max(0, Math.min(num(enemy.hp), amount));
  enemy.hp = Math.max(0, num(enemy.hp) - loss);
  return loss;
}

function tickEnemyStatuses(enemy: CombatEnemy, state: CombatState): void {
  const toxic = num(bagOf(enemy).toxic);
  if (toxic > 0) {
    const loss = loseEnemyHp(enemy, toxic);
    enemy.statuses = dropStatus(enemy.statuses, 'toxic');
    if (loss > 0) pushLog(state, `${enemy.name} took ${loss} Toxic.`);
  }
  const burn = num(bagOf(enemy).burn);
  if (burn > 0) {
    const loss = loseEnemyHp(enemy, burn);
    enemy.statuses = dropStatus(enemy.statuses, 'burn');
    if (loss > 0) pushLog(state, `${enemy.name} took ${loss} Burn.`);
  }
}

function strikePlayer(state: CombatState, enemy: CombatEnemy, dmg: number): void {
  if (state.preventAllDamage) {
    pushLog(state, `Prevented ${dmg} damage.`);
    return;
  }
  const hit = hitThroughBlock(num(state.playerBlock), dmg, num(state.statuses?.frail) > 0);
  state.playerBlock = hit.block;
  pushFx(state, { kind: 'hitPlayer', targetId: enemy.id, amount: hit.hpLoss });
  if (hit.hpLoss > 0) {
    applyPlayerHpLoss(state, hit.hpLoss);
    const bounce = Math.floor(hit.hpLoss * num(state.reflectPercent) / 100);
    if (bounce > 0) {
      enemy.hp = Math.max(0, num(enemy.hp) - bounce);
      pushLog(state, `Reflected ${bounce} damage to ${enemy.name}.`);
    }
    const thorns = num(state.powers?.thorns);
    if (thorns > 0) {
      enemy.hp = Math.max(0, num(enemy.hp) - thorns);
    }
  }
}

function prepareEnemyAct(enemy: CombatEnemy): void {
  if (enemy.acted) {
    enemy.block = num(enemy.traits?.metallicize);
  }
  enemy.acted = true;
}

function resolveIntent(state: CombatState, enemy: CombatEnemy, intent: EnemyIntentPattern): void {
  switch (intent.kind) {
    case 'attack':
    case 'attackDebuff': {
      const dmg = incomingAttackDamage(state, enemy, intent);
      strikePlayer(state, enemy, dmg);
      pushLog(state, `${enemy.name} hits for ${dmg}.`);
      if (intent.status && intent.statusStacks) {
        state.statuses = addStatus(state.statuses, intent.status, intent.statusStacks);
        pushFx(state, { kind: 'status', targetId: 'player', status: intent.status, amount: intent.statusStacks });
      }
      break;
    }
    case 'multiAttack': {
      const hits = Math.max(1, num(intent.times, 2));
      const dmg = incomingAttackDamage(state, enemy, intent);
      for (let i = 0; i < hits; i += 1) {
        if (num(enemy.hp) <= 0 || num(state.playerHp) <= 0) break;
        strikePlayer(state, enemy, dmg);
      }
      pushLog(state, `${enemy.name} hits ${hits} times for ${dmg} each.`);
      break;
    }
    case 'block': {
      const gained = incomingBlockGain(enemy, intent);
      gainEnemyBlock(state, enemy, gained);
      pushLog(state, `${enemy.name} gained ${gained} Block.`);
      break;
    }
    case 'buff':
      enemy.strength += intent.amount;
      pushLog(state, `${enemy.name} gained ${intent.amount} Strength.`);
      break;
    case 'buffAlly': {
      const others = living(state).filter((e) => e.id !== enemy.id);
      for (const ally of others) ally.strength += intent.amount;
      pushLog(
        state,
        others.length
          ? `${enemy.name} buffed allies by ${intent.amount} Strength.`
          : `${enemy.name} found no allies to buff.`,
      );
      break;
    }
    case 'status':
      if (intent.status && intent.statusStacks) {
        state.statuses = addStatus(state.statuses, intent.status, intent.statusStacks);
        pushFx(state, { kind: 'status', targetId: 'player', status: intent.status, amount: intent.statusStacks });
        pushLog(state, `${enemy.name} applied ${intent.status}.`);
      }
      break;
    case 'heal': {
      const amount = num(intent.amount);
      const nextHp = Math.min(num(enemy.maxHp), num(enemy.hp) + amount);
      enemy.hp = nextHp;
      pushLog(state, `${enemy.name} healed ${amount}.`);
      break;
    }
    case 'summon': {
      if ((!enemy.traits?.repeatSummon && enemy.summoned) || livingCount(state) >= MAX_ENEMIES) {
        const fallback = Math.max(6, num(intent.amount));
        const dmg = scaleAttackDamage(
          fallback + num(enemy.strength),
          num(bagOf(enemy).weak) > 0,
          num(state.statuses?.vulnerable) > 0,
        );
        strikePlayer(state, enemy, dmg);
        pushLog(state, `${enemy.name} hits for ${dmg}.`);
        break;
      }
      const id = intent.summonId;
      if (id && spawnEnemy(state, id)) enemy.summoned = true;
      break;
    }
    default:
      break;
  }
}

function enemyActs(state: CombatState, enemy: CombatEnemy): void {
  if (num(enemy.hp) <= 0) return;
  prepareEnemyAct(enemy);
  const intent = enemy.intent;
  if (!intent) return;
  resolveIntent(state, enemy, intent);
  for (const extra of enemy.extraIntents ?? []) {
    if (num(enemy.hp) <= 0 || num(state.playerHp) <= 0) break;
    resolveIntent(state, enemy, extra);
  }
  resolveDeaths(state);
}

function triggerCharges(state: CombatState, rng: Rng): void {
  const queue = ensureChargeQueue(state);
  syncWaterCharges(state);
  const potency = chargePotency(state);
  const times = num(state.powers?.['rain-lord']) > 0 ? 2 : 1;
  for (let t = 0; t < times; t += 1) {
    for (const kind of queue) {
      if (kind === 'block') {
        pushFx(state, { kind: 'chargeEvoke', chargeKind: 'block', amount: potency });
        gainBlock(state, potency);
      } else {
        pushFx(state, { kind: 'chargeEvoke', chargeKind: 'attack', amount: potency });
        const enemy = pickRandomLiving(state, rng);
        if (enemy) dealToEnemy(state, enemy, potency, 'water');
      }
    }
  }
}

function clearEnrage(state: CombatState): void {
  for (const enemy of state.enemies) {
    const rage = num(enemy.enrageStrength);
    if (rage <= 0) continue;
    enemy.strength = Math.max(0, num(enemy.strength) - rage);
    enemy.enrageStrength = 0;
  }
}

function beginPlayerTurn(state: CombatState, rng: Rng): void {
  clearEnrage(state);
  state.playerBlock = 0;
  state.smokeScreen = 0;
  state.freePlayIds = [];
  state.pendingFreePick = 0;
  state.reflectPercent = 0;
  state.preventAllDamage = false;
  state.attacksPlayedThisTurn = 0;
  state.powersPlayedThisTurn = 0;
  state.relicsUsedThisTurn = [];
  state.freePickSelected = null;
  state.discardedThisTurn = 0;
  const surf = num(state.pendingSurfDamage);
  if (surf > 0) {
    state.pendingSurfDamage = 0;
    pushFx(state, { kind: 'surf', amount: surf });
    for (const enemy of living(state)) {
      dealToEnemy(state, enemy, surf, 'water');
    }
    pushLog(state, `Surf crashes in for ${surf}.`);
    resolveDeaths(state);
  }
  const dance = num(state.powers['swords-dance']);
  if (dance > 0) {
    state.strength += dance;
    pushLog(state, `Swords Dance: +${dance} Strength.`);
  }
  const pendingStr = num(state.pendingNextTurnStrength);
  if (pendingStr !== 0) {
    state.strength += pendingStr;
    state.pendingNextTurnStrength = 0;
    pushLog(state, `Discarded Growth: +${pendingStr} Strength.`);
  }
  const hydroFocus = num(state.powers['hydro-pump']);
  if (hydroFocus > 0) {
    state.powers = state.powers ?? {};
    state.powers.focus = num(state.powers.focus) + hydroFocus;
    pushLog(state, `Hydro Pump: +${hydroFocus} Focus.`);
  }
  const toxic = num(state.statuses?.toxic);
  if (toxic > 0) {
    applyPlayerHpLoss(state, toxic);
    state.statuses = dropStatus(state.statuses, 'toxic');
    pushLog(state, `You took ${toxic} Toxic.`);
  }
  const burn = num(state.statuses?.burn);
  if (burn > 0) {
    applyPlayerHpLoss(state, burn);
    state.statuses = dropStatus(state.statuses, 'burn');
    pushLog(state, `You took ${burn} Burn.`);
  }
  const regen = num(state.powers?.['aqua-ring']);
  if (regen > 0) {
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + regen);
  }
  const petals = num(state.powers?.ingrainPetal);
  if (petals > 0) addPetals(state, petals);
  const terrain = num(state.powers?.grassyTerrain);
  if (terrain > 0) addSeeds(state, terrain);
  if (num(state.powers?.brutality) > 0) {
    drawCards(state, 1, rng);
    applyPlayerHpLoss(state, 1);
  }
  runRelicHooks(state, 'turnStart', rng);
  state.energy = state.energyMax;
  applyBonusEnergy(state);
  drawCards(state, state.drawCount, rng);
  for (const card of state.discardPile) {
    const extra = num(resolveCard(card).discardEnergy);
    if (extra > 0) {
      state.energy += extra;
      pushLog(state, `${resolveCard(card).name}: +${extra} Energy.`);
    }
  }
  const chloro = num(state.powers?.chlorophyll);
  if (chloro > 0) {
    state.pendingDiscard += chloro;
    state.discardThen = [...(state.discardThen ?? []), { op: 'draw', amount: chloro }];
    completeDiscardIfEmpty(state, rng);
    pushLog(state, 'Chlorophyll: discard a card, then draw.');
  }
  state.turn += 1;
}

function autoDiscardPending(state: CombatState, rng: Rng): void {
  while (state.pendingDiscard > 0 && state.hand.length > 0) {
    const inst = state.hand.pop()!;
    const def = resolveCard(inst);
    state.discardPile.push(inst);
    state.pendingDiscard -= 1;
    resolveOnDiscard(state, inst, rng);
    if (def.kind === 'skill' && (state.discardIfSkill ?? []).length > 0) {
      applyEffects(state, state.discardIfSkill, rng, followupCtx(state));
    }
  }
  state.pendingDiscard = 0;
  finishDiscardBatch(state, rng);
}

function autoPickFreePlay(state: CombatState, rng: Rng): void {
  while (num(state.pendingFreePick) > 0) {
    const pool = eligibleFreePlayCards(state);
    if (pool.length === 0) break;
    const pick = pool[pickIndex(rng, pool.length)]!;
    state.freePlayIds = [...(state.freePlayIds ?? []), pick.instanceId];
    state.pendingFreePick -= 1;
  }
  state.pendingFreePick = 0;
  state.freePickSelected = null;
}

function autoPickZeroCost(state: CombatState, rng: Rng): void {
  const offer = state.pendingZeroCostOffer ?? [];
  if (offer.length === 0) return;
  const pick = offer[pickIndex(rng, offer.length)]!;
  state.pendingZeroCostOffer = [];
  state.discardPile.push(pick);
  pushLog(state, `${resolveCard(pick).name} was added to the discard pile.`);
}

export function closePlayerTurn(state: CombatState, rng: Rng): CombatState {
  if (state.playerTurnClosed) return clone(state);
  const next = clone(state);
  if (next.pendingChoiceBand || next.pendingOptionalDiscard) return next;
  next.forceEndTurn = false;
  autoDiscardPending(next, rng);
  autoPickFreePlay(next, rng);
  while (next.hand.length > 0) {
    next.discardPile.push(next.hand.pop()!);
  }
  autoPickZeroCost(next, rng);
  next.freePlayIds = [];
  next.freeNextKind = null;
  next.pendingFreePick = 0;
  next.tempStrength = 0;
  triggerCharges(next, rng);
  if (num(next.playerBlock) <= 0) runRelicHooks(next, 'turnEndNoBlock', rng);
  runRelicHooks(next, 'turnEnd', rng);
  next.tempFocus = 0;
  if (next.powers?.zeroCostDamageThisTurn) {
    delete next.powers.zeroCostDamageThisTurn;
  }
  next.statuses = tickDurationStatuses(next.statuses);
  for (const enemy of next.enemies) {
    if (num(enemy.hp) > 0) tickEnemyStatuses(enemy, next);
  }
  resolveDeaths(next);
  next.playerTurnClosed = true;
  return next;
}

export function resolveEnemyTurn(state: CombatState, rng: Rng): CombatState {
  let next = state.playerTurnClosed ? clone(state) : closePlayerTurn(state, rng);
  if (combatOutcome(next) !== 'ongoing') return next;
  for (const enemy of next.enemies) {
    enemyActs(next, enemy);
    if (num(next.playerHp) <= 0) return next;
  }
  resolveDeaths(next);
  for (const enemy of next.enemies) {
    if (num(enemy.hp) > 0) enemy.statuses = tickDurationStatuses(enemy.statuses);
  }
  for (const enemy of next.enemies) {
    if (num(enemy.hp) <= 0) continue;
    const { intent, next: ni } = pickIntent(intentsOf(enemy), num(enemy.intentIndex), skipAllyBuff(next, enemy));
    assignIntent(enemy, intent, ni, num(next.turn, 1));
  }
  if (combatOutcome(next) !== 'ongoing') return next;
  next.playerTurnClosed = false;
  beginPlayerTurn(next, rng);
  return next;
}

export function applyEnemyHit(
  state: CombatState,
  enemyId: string,
  intentOverride?: EnemyIntentPattern,
): CombatState {
  const next = clone(state);
  const enemy = next.enemies.find((e) => e.id === enemyId && num(e.hp) > 0);
  if (!enemy) return next;
  if (!enemy.acted) prepareEnemyAct(enemy);
  const intent = intentOverride ?? enemy.intent;
  if (!intent || !isStrikeIntent(intent.kind)) return next;
  const dmg = incomingAttackDamage(next, enemy, intent);
  strikePlayer(next, enemy, dmg);
  pushLog(next, `${enemy.name} hits for ${dmg}.`);
  resolveDeaths(next);
  return next;
}

export function applyEnemyIntentRest(
  state: CombatState,
  enemyId: string,
  intentOverride?: EnemyIntentPattern,
): CombatState {
  const next = clone(state);
  const enemy = next.enemies.find((e) => e.id === enemyId && num(e.hp) > 0);
  if (!enemy) return next;
  if (!enemy.acted) prepareEnemyAct(enemy);
  const intent = intentOverride ?? enemy.intent;
  if (!intent) return next;
  if (isStrikeIntent(intent.kind)) {
    if (intent.status && intent.statusStacks) {
      next.statuses = addStatus(next.statuses, intent.status, intent.statusStacks);
      pushFx(next, { kind: 'status', targetId: 'player', status: intent.status, amount: intent.statusStacks });
    }
    resolveDeaths(next);
    return next;
  }
  resolveIntent(next, enemy, intent);
  resolveDeaths(next);
  return next;
}

export function completeEnemyRound(state: CombatState, rng: Rng): CombatState {
  const next = clone(state);
  resolveDeaths(next);
  for (const enemy of next.enemies) {
    if (num(enemy.hp) > 0) enemy.statuses = tickDurationStatuses(enemy.statuses);
  }
  for (const enemy of next.enemies) {
    if (num(enemy.hp) <= 0) continue;
    const { intent, next: ni } = pickIntent(intentsOf(enemy), num(enemy.intentIndex), skipAllyBuff(next, enemy));
    assignIntent(enemy, intent, ni, num(next.turn, 1));
  }
  if (combatOutcome(next) !== 'ongoing') return next;
  next.playerTurnClosed = false;
  beginPlayerTurn(next, rng);
  return next;
}

export function endTurn(state: CombatState, rng: Rng): CombatState {
  return resolveEnemyTurn(closePlayerTurn(state, rng), rng);
}

export function applyPotion(
  state: CombatState,
  slot: number,
  targetId: string | undefined,
  rng: Rng,
): CombatState {
  const next = clone(state);
  if (next.pendingChoiceBand || next.pendingOptionalDiscard || num(next.pendingDiscard) > 0) return next;
  const potionId = next.potions[slot];
  if (!potionId) return next;
  const def = getPotionDef(potionId);
  if (targetId) next.selectedEnemyId = targetId;
  applyEffects(next, def.effects, rng, {
    sourceType: 'colorless',
    targetId: next.selectedEnemyId,
  });
  next.potions[slot] = null;
  runRelicHooks(next, 'onPotion', rng);
  pushLog(next, `Used ${def.name}.`);
  return next;
}

export function toggleChoiceBandCard(state: CombatState, instanceId: string): CombatState {
  const next = clone(state);
  if (!next.pendingChoiceBand) return next;
  if (!next.hand.some((c) => c.instanceId === instanceId)) return next;
  const picks = new Set(next.choiceBandPicks ?? []);
  if (picks.has(instanceId)) picks.delete(instanceId);
  else picks.add(instanceId);
  next.choiceBandPicks = [...picks];
  return next;
}

export function confirmChoiceBand(state: CombatState, rng: Rng): CombatState {
  const next = clone(state);
  if (!next.pendingChoiceBand) return next;
  const picks = new Set(next.choiceBandPicks ?? []);
  const chosen = next.hand.filter((c) => picks.has(c.instanceId));
  next.hand = next.hand.filter((c) => !picks.has(c.instanceId));
  for (const inst of chosen) {
    next.discardPile.push(inst);
    resolveOnDiscard(next, inst, rng);
    pushLog(next, `Discarded ${resolveCard(inst).name}.`);
  }
  drawCards(next, chosen.length, rng);
  next.choiceBandPicks = [];
  next.pendingChoiceBand = false;
  return next;
}

export function toggleOptionalDiscardCard(state: CombatState, instanceId: string): CombatState {
  const next = clone(state);
  if (!next.pendingOptionalDiscard) return next;
  const card = next.hand.find((c) => c.instanceId === instanceId);
  if (!card) return next;
  if (next.optionalDiscardFilter && card.defId !== next.optionalDiscardFilter) return next;
  const picks = new Set(next.optionalDiscardPicks ?? []);
  if (picks.has(instanceId)) picks.delete(instanceId);
  else picks.add(instanceId);
  next.optionalDiscardPicks = [...picks];
  return next;
}

export function confirmOptionalDiscard(state: CombatState, rng: Rng): CombatState {
  const next = clone(state);
  if (!next.pendingOptionalDiscard) return next;
  const picks = new Set(next.optionalDiscardPicks ?? []);
  const chosen = next.hand.filter((c) => picks.has(c.instanceId));
  next.hand = next.hand.filter((c) => !picks.has(c.instanceId));
  const exhaustPicks = !!next.optionalDiscardExhaust;
  for (const inst of chosen) {
    if (exhaustPicks) {
      next.exhaustPile.push(inst);
      onExhaust(next, rng);
      routeExhaustedCard(next, inst, rng);
      pushLog(next, `Exhausted ${resolveCard(inst).name}.`);
    } else {
      next.discardPile.push(inst);
      resolveOnDiscard(next, inst, rng);
      pushLog(next, `Discarded ${resolveCard(inst).name}.`);
    }
  }
  const per = next.optionalDiscardPer ?? [];
  if (per.length && chosen.length) {
    const ctx = {
      sourceType: 'grass',
      targetId: next.selectedEnemyId ?? living(next)[0]?.id ?? null,
      kind: 'attack',
      cardId: next.optionalDiscardCardId ?? 'leaf-storm',
    };
    for (let i = 0; i < chosen.length; i += 1) {
      applyEffects(next, per, rng, ctx);
    }
  }
  next.optionalDiscardPicks = [];
  next.optionalDiscardPer = [];
  next.optionalDiscardFilter = null;
  next.optionalDiscardExhaust = false;
  next.optionalDiscardCardId = null;
  next.pendingOptionalDiscard = false;
  resolveDeaths(next);
  return next;
}

export function canPlayCard(state: CombatState, instanceId: string): boolean {
  if (state.pendingChoiceBand || state.pendingOptionalDiscard) return false;
  if (num(state.pendingDiscard) > 0 || num(state.pendingFreePick) > 0) return false;
  if ((state.pendingZeroCostOffer ?? []).length > 0) return false;
  const inst = state.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return false;
  const def = resolveCard(inst);
  return state.energy >= energyCostToPlay(state, inst, def);
}
