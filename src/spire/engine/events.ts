import { getEventDef } from '../data/events';
import { allObtainableRelics, findRelicDef } from '../data/relics';
import { POTION_IDS } from '../data/potions';
import { grantCard, grantPotion, grantRelic } from './acquire';
import { makeCard, rollCardDefId, rollCardOffer, rollRelicId } from './rewards';
import { chance, pickOne } from './rng';
import type { EventResult, SpireRun } from '../types';
import type { Rng } from './rng';

function resultGrantsRareCard(result: EventResult): boolean {
  if (result.type === 'card') return result.rarity === 'rare';
  if (result.type === 'chooseCards') return result.rarity === 'rare';
  if (result.type === 'combo') return result.results.some(resultGrantsRareCard);
  if (result.type === 'chance') {
    return resultGrantsRareCard(result.success) || resultGrantsRareCard(result.fail);
  }
  return false;
}

export function eventGrantsRareCard(eventId: string): boolean {
  return getEventDef(eventId).choices.some((choice) => resultGrantsRareCard(choice.result));
}

export function pickEventId(ids: string[], rng: Rng, allowRareCardEvents = true): string {
  const pool = allowRareCardEvents ? ids : ids.filter((id) => !eventGrantsRareCard(id));
  return pickOne(rng, pool.length > 0 ? pool : ids);
}

function seqOf(run: SpireRun): { n: number } {
  return { n: run.instanceSeq };
}

function commitSeq(run: SpireRun, seq: { n: number }): void {
  run.instanceSeq = seq.n;
}

export function tradeableRelicIds(run: SpireRun): string[] {
  return run.relics.filter((id) => !findRelicDef(id)?.starter);
}

export function finishEvent(run: SpireRun): void {
  run.eventFollowup = null;
  run.currentEventId = null;
  run.view = 'map';
}

export function applyEventResult(run: SpireRun, result: EventResult, rng: Rng): void {
  switch (result.type) {
    case 'heal':
      run.hp = Math.min(run.maxHp, run.hp + result.amount);
      break;
    case 'damage':
      run.hp = Math.max(1, run.hp - result.amount);
      break;
    case 'gold':
      run.gold = Math.max(0, run.gold + result.amount);
      break;
    case 'maxHp': {
      run.maxHp = Math.max(20, run.maxHp + result.amount);
      run.hp = Math.min(run.hp, run.maxHp);
      break;
    }
    case 'relic': {
      const id = rollRelicId(rng, run.relics);
      if (id) grantRelic(run, id);
      break;
    }
    case 'card': {
      if (!run.characterId) break;
      const seq = seqOf(run);
      grantCard(run, makeCard(rollCardDefId(run.characterId, rng, result.rarity), seq));
      commitSeq(run, seq);
      break;
    }
    case 'removeRandom': {
      if (run.deck.length <= 5) break;
      const idx = Math.floor(rng() * run.deck.length);
      run.deck.splice(idx, 1);
      break;
    }
    case 'upgradeRandom': {
      const candidates = run.deck.filter((c) => !c.upgraded);
      for (let i = 0; i < result.count; i += 1) {
        const left = candidates.filter((c) => !c.upgraded);
        if (left.length === 0) break;
        pickOne(rng, left).upgraded = true;
      }
      break;
    }
    case 'potion': {
      grantPotion(run, pickOne(rng, POTION_IDS));
      break;
    }
    case 'combo':
      for (const inner of result.results) applyEventResult(run, inner, rng);
      break;
    case 'chance': {
      const ok = chance(rng, result.chance ?? 0.5);
      applyEventResult(run, ok ? result.success : result.fail, rng);
      if (run.pendingAcquire?.length) {
        break;
      }
      if (!run.eventFollowup || run.eventFollowup.kind === 'message') {
        run.eventFollowup = {
          kind: 'message',
          title: ok ? result.successTitle : result.failTitle,
          body: ok ? result.successNote : result.failNote,
        };
      }
      break;
    }
    case 'chooseCards': {
      if (!run.characterId) break;
      const seq = seqOf(run);
      const cards = rollCardOffer(run.characterId, rng, seq, result.offer, {
        rarity: result.rarity,
        colorlessOnly: result.colorlessOnly,
      });
      commitSeq(run, seq);
      run.eventFollowup = { kind: 'chooseCards', pick: result.pick, cards, selected: [] };
      break;
    }
    case 'removeChoose': {
      const pick = Math.min(result.count, run.deck.length);
      if (pick <= 0) break;
      run.eventFollowup = { kind: 'removeCards', pick, selected: [] };
      break;
    }
    case 'tradeRelic': {
      if (tradeableRelicIds(run).length === 0) {
        run.eventFollowup = {
          kind: 'message',
          title: 'Nothing to trade',
          body: 'You have no relics you can give up.',
        };
        break;
      }
      run.eventFollowup = { kind: 'tradeRelic' };
      break;
    }
    default:
      break;
  }
}

export function resolveEventTrade(run: SpireRun, givingId: string, rng: Rng): void {
  if (!tradeableRelicIds(run).includes(givingId)) return;
  const pool = allObtainableRelics(run.relics).map((r) => r.id);
  const nextId = pool.length > 0 ? pickOne(rng, pool) : undefined;
  const givenName = findRelicDef(givingId)?.name ?? 'a relic';
  run.relics = run.relics.filter((id) => id !== givingId);
  if (nextId) grantRelic(run, nextId);
  const gainedName = nextId ? (findRelicDef(nextId)?.name ?? 'a relic') : null;
  run.eventFollowup = {
    kind: 'message',
    title: 'Traded',
    body: gainedName ? `You traded ${givenName} for ${gainedName}.` : `You traded away ${givenName}.`,
  };
}
