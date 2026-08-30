import { allObtainableRelics, findRelicDef, pickupGoldFor } from '../data/relics';
import { getCardDef } from '../data/cards';
import { POTION_IDS, getPotionDef } from '../data/potions';
import { addPotion, makeCard, rollCardDefId, rollCardOffer, rollRelicId } from './rewards';
import { chance, pickOne } from './rng';
import type { EventResult, LootRevealItem, SpireRun } from '../types';
import type { Rng } from './rng';

function seqOf(run: SpireRun): { n: number } {
  return { n: run.instanceSeq };
}

function commitSeq(run: SpireRun, seq: { n: number }): void {
  run.instanceSeq = seq.n;
}

function giveRelic(run: SpireRun, id: string): void {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  run.gold += pickupGoldFor(id);
}

export function tradeableRelicIds(run: SpireRun): string[] {
  return run.relics.filter((id) => !findRelicDef(id)?.starter);
}

function pushLoot(run: SpireRun, item: LootRevealItem): void {
  if (run.eventFollowup?.kind === 'lootReveal') {
    run.eventFollowup.items.push(item);
    return;
  }
  if (!run.eventFollowup) {
    run.eventFollowup = { kind: 'lootReveal', items: [item] };
  }
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
      if (id) {
        giveRelic(run, id);
        const def = findRelicDef(id);
        if (def) pushLoot(run, { type: 'relic', id, name: def.name, description: def.description });
      }
      break;
    }
    case 'card': {
      if (!run.characterId) break;
      const seq = seqOf(run);
      const defId = rollCardDefId(run.characterId, rng, result.rarity);
      run.deck.push(makeCard(defId, seq));
      commitSeq(run, seq);
      const def = getCardDef(defId);
      pushLoot(run, { type: 'card', id: defId, name: def.name, description: def.description });
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
      const potionId = pickOne(rng, POTION_IDS);
      run.potions = addPotion(run.potions, potionId);
      const def = getPotionDef(potionId);
      pushLoot(run, { type: 'potion', id: potionId, name: def.name, description: def.description });
      break;
    }
    case 'combo':
      for (const inner of result.results) applyEventResult(run, inner, rng);
      break;
    case 'chance': {
      const ok = chance(rng, result.chance ?? 0.5);
      applyEventResult(run, ok ? result.success : result.fail, rng);
      if (run.eventFollowup?.kind === 'lootReveal') {
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
  if (nextId) giveRelic(run, nextId);
  const gainedName = nextId ? (findRelicDef(nextId)?.name ?? 'a relic') : null;
  run.eventFollowup = {
    kind: 'message',
    title: 'Traded',
    body: gainedName ? `You traded ${givenName} for ${gainedName}.` : `You traded away ${givenName}.`,
  };
}
