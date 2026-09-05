import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { biomesForAct, getBiomeDef } from '../data/biomes';
import { BLESSINGS, CHARACTERS } from '../data/characters';
import { getCardDef } from '../data/cards';
import { findEncounterDef, getEncounterDef, getEnemyDef, rollActBossPool } from '../data/enemies';
import { getEventDef } from '../data/events';
import { allObtainableRelics, findRelicDef, getRelicDef, relicHasHook } from '../data/relics';
import {
  applyEnemyHit as applyCombatEnemyHit,
  applyEnemyIntentRest as applyCombatEnemyIntentRest,
  applyPotion,
  canPlayCard,
  combatOutcome,
  completeEnemyRound as completeCombatEnemyRound,
  confirmChoiceBand as confirmChoiceBandCombat,
  confirmOptionalDiscard as confirmOptionalDiscardCombat,
  confirmFreePick as confirmFreePickCombat,
  createCombat,
  discardFromHand,
  completeDiscardIfEmpty,
  endTurn as endCombatTurn,
  closePlayerTurn as closeCombatPlayerTurn,
  resolveEnemyTurn as resolveCombatEnemyTurn,
  pickFreePlay as pickFreePlayCard,
  pickZeroCostCard as pickZeroCostOffer,
  playCard as playCombatCard,
  selectEnemy,
  selectFreePick as selectFreePickCombat,
  takeCombatFx,
  toggleChoiceBandCard,
  toggleOptionalDiscardCard,
} from '../engine/combat';
import { grantCard, grantPotion, grantRelic } from '../engine/acquire';
import { applyEventResult, finishEvent, pickEventId, resolveEventTrade } from '../engine/events';
import { generateActMap, getNode } from '../engine/map';
import {
  buildCombatRewards,
  buildShopStock,
  cardPrice,
  goldForCombat,
  makeCard,
  relicPrice,
  restHealBonus,
  rollCardDefId,
  rollPotionId,
} from '../engine/rewards';
import { mulberry32, nextSeed, pickIndex, pickN, pickOne } from '../engine/rng';
import type {
  BlessingId,
  CharacterId,
  EnemyIntentPattern,
  SpireRun,
} from '../types';

function emptyPotions(): (string | null)[] {
  return [null, null, null];
}

function freshRun(seed: number): SpireRun {
  return {
    seed,
    rngState: seed,
    instanceSeq: 0,
    view: 'select',
    characterId: null,
    hp: 0,
    maxHp: 0,
    gold: 99,
    deck: [],
    relics: [],
    potions: emptyPotions(),
    act: 1,
    map: null,
    currentNodeId: null,
    visitedNodeIds: [],
    combat: null,
    combatResult: null,
    pendingRewards: null,
    shopStock: null,
    currentEventId: null,
    blessingIds: [],
    activeEncounterId: null,
    smithUsed: false,
    smithedCardId: null,
    restHealUsed: false,
    restDexUsed: false,
    restStrUsed: false,
    hallwayTheme: null,
    permStrength: 0,
    permDexterity: 0,
    evioliteUses: 0,
    megaStoneUses: 0,
    restTrade: null,
    eventFollowup: null,
    blessingFollowup: null,
    lastMonsterEncounterId: null,
    lastEliteEncounterId: null,
    pendingAcquire: null,
    actRareTaken: false,
  };
}

export function hasActiveSpireRun(run: SpireRun | null): boolean {
  if (!run) return false;
  if (run.view === 'victory' || run.view === 'defeat') return false;
  if (run.view === 'select' && !run.characterId) return false;
  return true;
}

function restAllowsMany(run: SpireRun): boolean {
  return relicHasHook(run.relics, 'restAny');
}

function finishRestAction(run: SpireRun): void {
  if (restAllowsMany(run)) return;
  run.view = 'map';
  run.smithedCardId = null;
  run.restTrade = null;
}

function seqOf(run: SpireRun): { n: number } {
  return { n: run.instanceSeq };
}

function commitSeq(run: SpireRun, seq: { n: number }): void {
  run.instanceSeq = seq.n;
}

function beginAct(run: SpireRun, act: 1 | 2 | 3, rng: ReturnType<typeof mulberry32>): void {
  const biomes = biomesForAct(act);
  const biome = pickOne(rng, biomes);
  run.act = act;
  run.actRareTaken = false;
  run.map = generateActMap(act, biome.id, rng, rollActBossPool(act, rng));
  run.currentNodeId = run.map.startId;
  run.visitedNodeIds = [run.map.startId];
  run.smithUsed = false;
  run.smithedCardId = null;
  run.activeEncounterId = null;
  run.shopStock = null;
  run.currentEventId = null;
  run.combat = null;
  run.pendingRewards = null;
  run.view = 'map';
}

function startNodeCombat(run: SpireRun, encounterId: string, rng: ReturnType<typeof mulberry32>): void {
  const encounter = getEncounterDef(encounterId);
  const character = CHARACTERS[run.characterId!];
  run.activeEncounterId = encounterId;
  run.combatResult = null;
  run.combat = createCombat({
    hp: run.hp,
    maxHp: run.maxHp,
    deck: run.deck,
    relics: run.relics,
    potions: run.potions,
    enemyDefs: encounter.enemyIds.map((id) => getEnemyDef(id)),
    playerTypes: character.types,
    rng,
    characterId: character.id,
    permStrength: run.permStrength,
    permDexterity: run.permDexterity,
  });
  const node = run.currentNodeId && run.map ? getNode(run.map, run.currentNodeId) : undefined;
  run.hallwayTheme =
    node?.kind === 'boss' ? null : ((pickIndex(rng, node?.kind === 'elite' ? 2 : 3) + 1) as 1 | 2 | 3);
  run.view = 'combat';
}

function resolveCombat(run: SpireRun, rng: ReturnType<typeof mulberry32>): void {
  if (!run.combat || !run.characterId || run.combatResult) return;
  const outcome = combatOutcome(run.combat);
  run.hp = run.combat.playerHp;
  run.maxHp = run.combat.playerMaxHp;
  run.potions = run.combat.potions;
  if (outcome === 'lose') {
    run.combatResult = 'lose';
    run.hp = 0;
    return;
  }
  if (outcome !== 'win') return;
  const encounter = findEncounterDef(run.activeEncounterId);
  const node = run.currentNodeId && run.map ? getNode(run.map, run.currentNodeId) : undefined;
  const finalBoss = run.act >= 3 && (encounter?.kind === 'boss' || node?.kind === 'boss');
  if (finalBoss) {
    run.pendingRewards = null;
    run.combatResult = 'win';
    return;
  }
  if (!encounter) {
    run.combatResult = 'win';
    return;
  }
  const gold = goldForCombat(encounter.gold, run.relics);
  run.gold += gold;
  const seq = seqOf(run);
  run.pendingRewards = buildCombatRewards({
    characterId: run.characterId,
    rng,
    seq,
    gold,
    relics: run.relics,
    potions: run.potions,
    source: encounter.kind,
    upgradeCards: !!run.combat.upgradeCardRewards,
    allowRare: encounter.kind === 'boss' || !run.actRareTaken,
  });
  commitSeq(run, seq);
  run.combatResult = 'win';
}

function acknowledgeCombat(run: SpireRun): void {
  if (!run.combatResult) return;
  if (run.combatResult === 'lose') {
    run.view = 'defeat';
    run.combat = null;
    run.combatResult = null;
    return;
  }
  const encounter = findEncounterDef(run.activeEncounterId);
  const node = run.currentNodeId && run.map ? getNode(run.map, run.currentNodeId) : undefined;
  const finalBoss = run.act >= 3 && (encounter?.kind === 'boss' || node?.kind === 'boss');
  run.combat = null;
  run.combatResult = null;
  if (finalBoss) {
    run.pendingRewards = null;
    run.view = 'victory';
    return;
  }
  run.view = run.pendingRewards ? 'rewards' : 'map';
}

function finishRewardsFlow(run: SpireRun, rng: ReturnType<typeof mulberry32>): void {
  const source = run.pendingRewards?.source;
  run.pendingRewards = null;
  if (source === 'boss') {
    if (run.act >= 3) {
      run.view = 'victory';
      return;
    }
    run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * 0.25));
    beginAct(run, (run.act + 1) as 2 | 3, rng);
    return;
  }
  run.view = 'map';
}

interface SpireStore {
  run: SpireRun | null;
  startNewRun: () => void;
  selectCharacter: (id: CharacterId) => void;
  chooseBlessing: (id: BlessingId) => void;
  enterNode: (nodeId: string) => void;
  playCard: (instanceId: string, enemyId?: string) => void;
  pickFreePlay: (instanceId: string) => void;
  selectFreePick: (instanceId: string) => void;
  confirmFreePick: () => void;
  pickZeroCostCard: (instanceId: string) => void;
  closePlayerTurn: () => void;
  resolveEnemyTurn: () => void;
  applyEnemyHit: (enemyId: string, intent?: EnemyIntentPattern) => void;
  applyEnemyIntentRest: (enemyId: string, intent?: EnemyIntentPattern) => void;
  completeEnemyRound: () => void;
  clearCombatFx: () => void;
  endTurn: () => void;
  acknowledgeCombatResult: () => void;
  selectCombatEnemy: (enemyId: string) => void;
  drinkPotion: (slot: number, enemyId?: string) => void;
  discardForPending: (instanceId: string) => void;
  toggleChoiceBand: (instanceId: string) => void;
  confirmChoiceBand: () => void;
  toggleOptionalDiscard: (instanceId: string) => void;
  confirmOptionalDiscard: () => void;
  pickCardReward: (instanceId: string) => void;
  skipCardReward: () => void;
  takeRelicReward: () => void;
  skipRelicReward: () => void;
  takePotionReward: () => void;
  skipPotionReward: () => void;
  continueRewards: () => void;
  buyCard: (instanceId: string) => void;
  buyRelic: (id: string) => void;
  buyPotion: (id: string) => void;
  removeCard: (instanceId: string) => void;
  leaveShop: () => void;
  restHeal: () => void;
  restSmith: (instanceId: string) => void;
  restTrainDex: () => void;
  restTrainStr: () => void;
  restBeginTrade: (givingId: string) => void;
  restPickTrade: (id: string) => void;
  restCancelTrade: () => void;
  leaveRest: () => void;
  resolveEvent: (choiceIndex: number) => void;
  eventSelectOfferCard: (instanceId: string) => void;
  eventConfirmOffer: () => void;
  eventSelectRemoveCard: (instanceId: string) => void;
  eventConfirmRemove: () => void;
  eventTradeRelic: (givingId: string) => void;
  eventAck: () => void;
  ackAcquire: () => void;
  blessingPickCard: (instanceId: string) => void;
  takeTreasure: () => void;
  skipTreasure: () => void;
  abandonRun: () => void;
}

export const useSpireStore = create<SpireStore>()(
  persist(
    (set, get) => {
      const patch = (fn: (run: SpireRun, rng: ReturnType<typeof mulberry32>) => void) => {
        const run = get().run;
        if (!run) return;
        const next = structuredClone(run);
        const rng = mulberry32(next.rngState);
        fn(next, rng);
        next.rngState = nextSeed(rng);
        set({ run: next });
      };

      const update = (fn: (run: SpireRun) => void) => {
        const run = get().run;
        if (!run) return;
        const next = structuredClone(run);
        fn(next);
        set({ run: next });
      };

      return {
        run: null,

        startNewRun: () => {
          const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
          set({ run: freshRun(seed) });
        },

        selectCharacter: (id) =>
          patch((run, rng) => {
            const character = CHARACTERS[id];
            const seq = seqOf(run);
            run.characterId = id;
            run.maxHp = character.maxHp;
            run.hp = character.maxHp;
            run.deck = character.starterDeck.map((defId) => makeCard(defId, seq));
            run.relics = [character.starterRelic];
            commitSeq(run, seq);
            run.blessingIds = pickN(
              rng,
              BLESSINGS.map((b) => b.id),
              3,
            );
            run.view = 'blessing';
          }),

        chooseBlessing: (id) =>
          patch((run, rng) => {
            if (id === 'train') {
              run.blessingFollowup = { kind: 'train', step: 'upgrade' };
              return;
            }
            if (id === 'gold') run.gold += 100;
            if (id === 'potion') {
              grantPotion(run, rollPotionId(rng));
            }
            if (id === 'card' && run.characterId) {
              const seq = seqOf(run);
              grantCard(run, makeCard(rollCardDefId(run.characterId, rng, 'uncommon'), seq));
              commitSeq(run, seq);
            }
            beginAct(run, 1, rng);
          }),

        blessingPickCard: (instanceId) =>
          patch((run, rng) => {
            const follow = run.blessingFollowup;
            if (follow?.kind !== 'train') return;
            const card = run.deck.find((c) => c.instanceId === instanceId);
            if (!card) return;
            if (follow.step === 'upgrade') {
              if (card.upgraded) return;
              card.upgraded = true;
              run.blessingFollowup = { kind: 'train', step: 'remove' };
              return;
            }
            run.deck = run.deck.filter((c) => c.instanceId !== instanceId);
            run.blessingFollowup = null;
            beginAct(run, 1, rng);
          }),

        enterNode: (nodeId) =>
          patch((run, rng) => {
            if (!run.map || !run.currentNodeId || !run.characterId) return;
            const current = getNode(run.map, run.currentNodeId);
            if (!current?.nextIds.includes(nodeId)) return;
            const node = getNode(run.map, nodeId);
            if (!node) return;
            run.currentNodeId = nodeId;
            run.visitedNodeIds = [...run.visitedNodeIds, nodeId];
            run.smithUsed = false;
            run.smithedCardId = null;
            run.restHealUsed = false;
            run.restDexUsed = false;
            run.restStrUsed = false;
            run.restTrade = null;
            run.eventFollowup = null;
            const biome = getBiomeDef(run.map.biomeId);
            if (node.kind === 'monster' || node.kind === 'elite' || node.kind === 'boss') {
              const bossPool = run.map.bossPool?.length ? run.map.bossPool : [biome.boss];
              const pool =
                node.kind === 'boss' ? bossPool : node.kind === 'elite' ? biome.elites : biome.normals;
              const last =
                node.kind === 'monster'
                  ? run.lastMonsterEncounterId
                  : node.kind === 'elite'
                    ? run.lastEliteEncounterId
                    : null;
              const filtered = last && pool.length > 1 ? pool.filter((id) => id !== last) : pool;
              const encounterId = pickOne(rng, filtered);
              if (node.kind === 'monster') run.lastMonsterEncounterId = encounterId;
              if (node.kind === 'elite') run.lastEliteEncounterId = encounterId;
              startNodeCombat(run, encounterId, rng);
              return;
            }
            if (node.kind === 'shop') {
              const seq = seqOf(run);
              run.shopStock = buildShopStock(run.characterId, rng, seq, run.relics, {
                allowRare: !run.actRareTaken,
              });
              commitSeq(run, seq);
              run.view = 'shop';
              return;
            }
            if (node.kind === 'rest') {
              run.view = 'rest';
              return;
            }
            if (node.kind === 'event') {
              run.currentEventId = pickEventId(biome.events, rng, !run.actRareTaken);
              run.view = 'event';
              return;
            }
            if (node.kind === 'treasure') {
              const seq = seqOf(run);
              run.pendingRewards = buildCombatRewards({
                characterId: run.characterId,
                rng,
                seq,
                gold: 0,
                relics: run.relics,
                potions: run.potions,
                source: 'treasure',
              });
              commitSeq(run, seq);
              run.view = 'treasure';
            }
          }),

        playCard: (instanceId, enemyId) =>
          patch((run, rng) => {
            if (!run.combat || run.combatResult || !canPlayCard(run.combat, instanceId)) return;
            run.combat = playCombatCard(run.combat, instanceId, enemyId, rng);
            resolveCombat(run, rng);
          }),

        pickFreePlay: (instanceId) =>
          update((run) => {
            if (!run.combat) return;
            run.combat = pickFreePlayCard(run.combat, instanceId);
          }),

        selectFreePick: (instanceId) =>
          update((run) => {
            if (!run.combat) return;
            run.combat = selectFreePickCombat(run.combat, instanceId);
          }),

        confirmFreePick: () =>
          update((run) => {
            if (!run.combat) return;
            run.combat = confirmFreePickCombat(run.combat);
          }),

        pickZeroCostCard: (instanceId) =>
          update((run) => {
            if (!run.combat) return;
            run.combat = pickZeroCostOffer(run.combat, instanceId);
          }),

        closePlayerTurn: () =>
          patch((run, rng) => {
            if (!run.combat || run.combatResult) return;
            run.combat = closeCombatPlayerTurn(run.combat, rng);
            resolveCombat(run, rng);
          }),

        resolveEnemyTurn: () =>
          patch((run, rng) => {
            if (!run.combat || run.combatResult) return;
            run.combat = resolveCombatEnemyTurn(run.combat, rng);
            resolveCombat(run, rng);
          }),

        applyEnemyHit: (enemyId, intent) =>
          update((run) => {
            if (!run.combat || run.combatResult) return;
            run.combat = applyCombatEnemyHit(run.combat, enemyId, intent);
          }),

        applyEnemyIntentRest: (enemyId, intent) =>
          update((run) => {
            if (!run.combat || run.combatResult) return;
            run.combat = applyCombatEnemyIntentRest(run.combat, enemyId, intent);
          }),

        completeEnemyRound: () =>
          patch((run, rng) => {
            if (!run.combat || run.combatResult) return;
            run.combat = completeCombatEnemyRound(run.combat, rng);
            resolveCombat(run, rng);
          }),

        clearCombatFx: () =>
          update((run) => {
            if (!run.combat) return;
            run.combat = takeCombatFx(run.combat);
          }),

        endTurn: () =>
          patch((run, rng) => {
            if (!run.combat || run.combatResult) return;
            run.combat = endCombatTurn(run.combat, rng);
            resolveCombat(run, rng);
          }),

        acknowledgeCombatResult: () =>
          update((run) => {
            acknowledgeCombat(run);
          }),

        selectCombatEnemy: (enemyId) =>
          update((run) => {
            if (!run.combat || run.combatResult) return;
            run.combat = selectEnemy(run.combat, enemyId);
          }),

        drinkPotion: (slot, enemyId) =>
          patch((run, rng) => {
            if (
              !run.combat ||
              run.combatResult ||
              run.combat.pendingChoiceBand ||
              run.combat.pendingOptionalDiscard ||
              (run.combat.pendingDiscard ?? 0) > 0
            ) return;
            run.combat = applyPotion(run.combat, slot, enemyId, rng);
            run.potions = run.combat.potions;
            resolveCombat(run, rng);
          }),

        discardForPending: (instanceId) =>
          patch((run, rng) => {
            if (!run.combat) return;
            completeDiscardIfEmpty(run.combat, rng);
            if ((run.combat.pendingDiscard ?? 0) <= 0) return;
            run.combat = discardFromHand(run.combat, instanceId, rng);
          }),

        toggleChoiceBand: (instanceId) =>
          update((run) => {
            if (!run.combat) return;
            run.combat = toggleChoiceBandCard(run.combat, instanceId);
          }),

        confirmChoiceBand: () =>
          patch((run, rng) => {
            if (!run.combat) return;
            run.combat = confirmChoiceBandCombat(run.combat, rng);
          }),

        toggleOptionalDiscard: (instanceId) =>
          update((run) => {
            if (!run.combat) return;
            run.combat = toggleOptionalDiscardCard(run.combat, instanceId);
          }),

        confirmOptionalDiscard: () =>
          patch((run, rng) => {
            if (!run.combat) return;
            run.combat = confirmOptionalDiscardCombat(run.combat, rng);
            resolveCombat(run, rng);
          }),

        pickCardReward: (instanceId) =>
          update((run) => {
            const offer = run.pendingRewards;
            if (!offer) return;
            const card = offer.cards.find((c) => c.instanceId === instanceId);
            if (!card) return;
            grantCard(run, card);
            offer.cardPicked = true;
          }),

        skipCardReward: () =>
          update((run) => {
            if (run.pendingRewards) run.pendingRewards.cardPicked = true;
          }),

        takeRelicReward: () =>
          update((run) => {
            const offer = run.pendingRewards;
            if (!offer?.relicId) return;
            grantRelic(run, offer.relicId);
            offer.relicTaken = true;
          }),

        skipRelicReward: () =>
          update((run) => {
            if (run.pendingRewards) run.pendingRewards.relicTaken = true;
          }),

        takePotionReward: () =>
          update((run) => {
            const offer = run.pendingRewards;
            if (!offer?.potionId) return;
            grantPotion(run, offer.potionId);
            offer.potionTaken = true;
          }),

        skipPotionReward: () =>
          update((run) => {
            if (run.pendingRewards) run.pendingRewards.potionTaken = true;
          }),

        continueRewards: () =>
          patch((run, rng) => {
            if (!rewardsReady(run)) return;
            finishRewardsFlow(run, rng);
          }),

        buyCard: (instanceId) =>
          update((run) => {
            const stock = run.shopStock;
            if (!stock) return;
            const card = stock.cards.find((c) => c.instanceId === instanceId);
            if (!card) return;
            const price = cardPrice(getCardDef(card.defId).rarity);
            if (run.gold < price) return;
            run.gold -= price;
            grantCard(run, card);
            stock.cards = stock.cards.filter((c) => c.instanceId !== instanceId);
          }),

        buyRelic: (id) =>
          update((run) => {
            const stock = run.shopStock;
            if (!stock?.relics.includes(id)) return;
            const price = relicPrice(getRelicDef(id).rarity);
            if (run.gold < price) return;
            run.gold -= price;
            grantRelic(run, id);
            stock.relics = stock.relics.filter((r) => r !== id);
          }),

        buyPotion: (id) =>
          update((run) => {
            const stock = run.shopStock;
            if (!stock?.potions.includes(id)) return;
            if (run.gold < 50) return;
            if (!run.potions.includes(null)) return;
            run.gold -= 50;
            grantPotion(run, id);
            stock.potions = stock.potions.filter((p) => p !== id);
          }),

        removeCard: (instanceId) =>
          update((run) => {
            const stock = run.shopStock;
            if (!stock || stock.removed || run.gold < stock.removalCost) return;
            if (run.deck.length <= 5) return;
            run.gold -= stock.removalCost;
            run.deck = run.deck.filter((c) => c.instanceId !== instanceId);
            stock.removed = true;
          }),

        leaveShop: () =>
          update((run) => {
            run.shopStock = null;
            run.view = 'map';
          }),

        restHeal: () =>
          update((run) => {
            if (run.restHealUsed) return;
            const amount = Math.floor(run.maxHp * 0.3) + restHealBonus(run.relics);
            run.hp = Math.min(run.maxHp, run.hp + amount);
            run.restHealUsed = true;
            finishRestAction(run);
          }),

        restSmith: (instanceId) =>
          update((run) => {
            if (run.smithUsed) return;
            const card = run.deck.find((c) => c.instanceId === instanceId);
            if (!card || card.upgraded) return;
            card.upgraded = true;
            run.smithUsed = true;
            run.smithedCardId = instanceId;
          }),

        restTrainDex: () =>
          update((run) => {
            if (!relicHasHook(run.relics, 'restPermDex')) return;
            if (run.restDexUsed || run.evioliteUses >= 3) return;
            run.permDexterity += 1;
            run.evioliteUses += 1;
            run.restDexUsed = true;
            finishRestAction(run);
          }),

        restTrainStr: () =>
          update((run) => {
            if (!relicHasHook(run.relics, 'restPermStr')) return;
            if (run.restStrUsed || run.megaStoneUses >= 3) return;
            run.permStrength += 1;
            run.megaStoneUses += 1;
            run.restStrUsed = true;
            finishRestAction(run);
          }),

        restBeginTrade: (givingId) =>
          patch((run, rng) => {
            if (!relicHasHook(run.relics, 'restTrade')) return;
            const def = findRelicDef(givingId);
            if (!def || def.starter || !run.relics.includes(givingId)) return;
            const remaining = run.relics.filter((id) => id !== givingId);
            const pool = allObtainableRelics(remaining).map((r) => r.id);
            const choices = pickN(rng, pool, 3);
            if (choices.length === 0) return;
            run.restTrade = { givingId, choices };
          }),

        restPickTrade: (id) =>
          update((run) => {
            const trade = run.restTrade;
            if (!trade || !trade.choices.includes(id)) return;
            run.relics = run.relics.filter((r) => r !== trade.givingId);
            grantRelic(run, id);
            run.restTrade = null;
            finishRestAction(run);
          }),

        restCancelTrade: () =>
          update((run) => {
            run.restTrade = null;
          }),

        leaveRest: () =>
          update((run) => {
            if (run.smithedCardId && restAllowsMany(run)) {
              run.smithedCardId = null;
              return;
            }
            run.view = 'map';
            run.smithedCardId = null;
            run.restTrade = null;
          }),

        resolveEvent: (choiceIndex) =>
          patch((run, rng) => {
            if (!run.currentEventId || run.eventFollowup) return;
            const event = getEventDef(run.currentEventId);
            const choice = event.choices[choiceIndex];
            if (!choice) return;
            applyEventResult(run, choice.result, rng);
            if (!run.eventFollowup) finishEvent(run);
          }),

        eventSelectOfferCard: (instanceId) =>
          update((run) => {
            const follow = run.eventFollowup;
            if (follow?.kind !== 'chooseCards') return;
            if (!follow.cards.some((c) => c.instanceId === instanceId)) return;
            if (follow.pick <= 1) {
              const card = follow.cards.find((c) => c.instanceId === instanceId);
              if (card) grantCard(run, card);
              finishEvent(run);
              return;
            }
            const selected = new Set(follow.selected);
            if (selected.has(instanceId)) selected.delete(instanceId);
            else if (selected.size < follow.pick) selected.add(instanceId);
            follow.selected = [...selected];
          }),

        eventConfirmOffer: () =>
          update((run) => {
            const follow = run.eventFollowup;
            if (follow?.kind !== 'chooseCards') return;
            if (follow.selected.length !== follow.pick) return;
            for (const id of follow.selected) {
              const card = follow.cards.find((c) => c.instanceId === id);
              if (card) grantCard(run, card);
            }
            finishEvent(run);
          }),

        eventSelectRemoveCard: (instanceId) =>
          update((run) => {
            const follow = run.eventFollowup;
            if (follow?.kind !== 'removeCards') return;
            if (!run.deck.some((c) => c.instanceId === instanceId)) return;
            if (follow.pick <= 1) {
              run.deck = run.deck.filter((c) => c.instanceId !== instanceId);
              finishEvent(run);
              return;
            }
            const selected = new Set(follow.selected);
            if (selected.has(instanceId)) selected.delete(instanceId);
            else if (selected.size < follow.pick) selected.add(instanceId);
            follow.selected = [...selected];
          }),

        eventConfirmRemove: () =>
          update((run) => {
            const follow = run.eventFollowup;
            if (follow?.kind !== 'removeCards') return;
            if (follow.selected.length !== follow.pick) return;
            const drop = new Set(follow.selected);
            run.deck = run.deck.filter((c) => !drop.has(c.instanceId));
            finishEvent(run);
          }),

        eventTradeRelic: (givingId) =>
          patch((run, rng) => {
            if (run.eventFollowup?.kind !== 'tradeRelic') return;
            resolveEventTrade(run, givingId, rng);
          }),

        eventAck: () =>
          update((run) => {
            if (run.eventFollowup?.kind !== 'message' && run.eventFollowup?.kind !== 'lootReveal') return;
            finishEvent(run);
          }),

        ackAcquire: () =>
          update((run) => {
            run.pendingAcquire = null;
          }),

        takeTreasure: () =>
          patch((run, rng) => {
            const offer = run.pendingRewards;
            if (offer?.relicId) grantRelic(run, offer.relicId);
            finishRewardsFlow(run, rng);
          }),

        skipTreasure: () =>
          patch((run, rng) => {
            finishRewardsFlow(run, rng);
          }),

        abandonRun: () =>
          update((run) => {
            run.view = 'defeat';
            run.combat = null;
            run.combatResult = null;
          }),
      };
    },
    {
      name: 'pokemon-spire',
      partialize: (s) => ({ run: s.run }),
      merge: (persisted, current) => {
        const saved = persisted as { run?: SpireRun | null } | undefined;
        const run = saved?.run
          ? {
              ...saved.run,
              actRareTaken: saved.run.actRareTaken ?? false,
              combatResult: saved.run.combatResult ?? null,
              hallwayTheme: saved.run.hallwayTheme ?? null,
              combat: saved.run.combat
                ? {
                    ...saved.run.combat,
                    pendingFreePick: saved.run.combat.pendingFreePick ?? 0,
                    freePlayIds: saved.run.combat.freePlayIds ?? [],
                    tempStrength: saved.run.combat.tempStrength ?? 0,
                    smokeScreen: saved.run.combat.smokeScreen ?? 0,
                    chargeQueue:
                      saved.run.combat.chargeQueue ??
                      [
                        ...Array.from(
                          { length: saved.run.combat.waterCharges?.attack ?? 0 },
                          () => 'attack' as const,
                        ),
                        ...Array.from(
                          { length: saved.run.combat.waterCharges?.block ?? 0 },
                          () => 'block' as const,
                        ),
                      ],
                    tempFocus: saved.run.combat.tempFocus ?? 0,
                    reflectPercent: saved.run.combat.reflectPercent ?? 0,
                    preventAllDamage: saved.run.combat.preventAllDamage ?? false,
                    pendingSurfDamage: saved.run.combat.pendingSurfDamage ?? 0,
                    forceEndTurn: saved.run.combat.forceEndTurn ?? false,
                    zeroCostPlayed: saved.run.combat.zeroCostPlayed ?? 0,
                    chargesAddedThisCombat: saved.run.combat.chargesAddedThisCombat ?? 0,
                    pendingZeroCostOffer: saved.run.combat.pendingZeroCostOffer ?? [],
                    cardSeq: saved.run.combat.cardSeq ?? 0,
                    freeNextKind: saved.run.combat.freeNextKind ?? null,
                    pendingNextTurnStrength: saved.run.combat.pendingNextTurnStrength ?? 0,
                    discardThen: saved.run.combat.discardThen ?? [],
                    discardIfSkill: saved.run.combat.discardIfSkill ?? [],
                    characterId: saved.run.combat.characterId ?? saved.run.characterId ?? 'blaze',
                    upgradeCardRewards: saved.run.combat.upgradeCardRewards ?? false,
                    attacksPlayedThisTurn: saved.run.combat.attacksPlayedThisTurn ?? 0,
                    powersPlayedThisTurn: saved.run.combat.powersPlayedThisTurn ?? 0,
                    pendingChoiceBand: saved.run.combat.pendingChoiceBand ?? false,
                    choiceBandPicks: saved.run.combat.choiceBandPicks ?? [],
                    pendingOptionalDiscard: saved.run.combat.pendingOptionalDiscard ?? false,
                    optionalDiscardPicks: saved.run.combat.optionalDiscardPicks ?? [],
                    optionalDiscardPer: saved.run.combat.optionalDiscardPer ?? [],
                    optionalDiscardFilter: saved.run.combat.optionalDiscardFilter ?? null,
                    optionalDiscardExhaust: saved.run.combat.optionalDiscardExhaust ?? false,
                    optionalDiscardCardId: saved.run.combat.optionalDiscardCardId ?? null,
                    discardedThisTurn: saved.run.combat.discardedThisTurn ?? 0,
                    playerTurnClosed: saved.run.combat.playerTurnClosed ?? false,
                    relicsUsedThisTurn: saved.run.combat.relicsUsedThisTurn ?? [],
                    activePowers: saved.run.combat.activePowers ?? [],
                    combatFx: [],
                    freePickSelected: saved.run.combat.freePickSelected ?? null,
                  }
                : saved.run.combat,
              restHealUsed: saved.run.restHealUsed ?? false,
              restDexUsed: saved.run.restDexUsed ?? false,
              restStrUsed: saved.run.restStrUsed ?? false,
              permStrength: saved.run.permStrength ?? 0,
              permDexterity: saved.run.permDexterity ?? 0,
              evioliteUses: saved.run.evioliteUses ?? 0,
              megaStoneUses: saved.run.megaStoneUses ?? 0,
              restTrade: saved.run.restTrade ?? null,
              eventFollowup: saved.run.eventFollowup ?? null,
              blessingFollowup: saved.run.blessingFollowup ?? null,
              lastMonsterEncounterId: saved.run.lastMonsterEncounterId ?? null,
              lastEliteEncounterId: saved.run.lastEliteEncounterId ?? null,
              pendingAcquire: saved.run.pendingAcquire ?? null,
              map: saved.run.map
                ? { ...saved.run.map, bossPool: saved.run.map.bossPool ?? [] }
                : saved.run.map,
            }
          : current.run;
        return { ...current, run };
      },
    },
  ),
);

export function rewardsReady(run: SpireRun): boolean {
  const offer = run.pendingRewards;
  if (!offer) return false;
  return offer.cardPicked && offer.relicTaken && offer.potionTaken;
}
