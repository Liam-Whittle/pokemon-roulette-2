import { cardsForCharacter, colorlessCards } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { allObtainableRelics, findRelicDef, relicsByRarity } from '../data/relics';
import { POTION_IDS } from '../data/potions';
import type { CardDef, CardInstance, CardRarity, CharacterId, RewardOffer, ShopStock } from '../types';
import type { Rng } from './rng';
import { chance, pickOne, shuffle } from './rng';

const STARTER_CARD_IDS = new Set(Object.values(CHARACTERS).flatMap((c) => c.starterDeck));

export function isRewardCard(def: CardDef): boolean {
  return !def.token && def.rarity !== 'starter' && !STARTER_CARD_IDS.has(def.id);
}

export function rollRarity(rng: Rng): Exclude<CardRarity, 'starter'> {
  const r = rng();
  if (r < 0.6) return 'common';
  if (r < 0.9) return 'uncommon';
  return 'rare';
}

export function rollCardDefId(characterId: CharacterId, rng: Rng, rarity?: CardRarity): string {
  const r = rarity && rarity !== 'starter' ? rarity : rollRarity(rng);
  const pool = (chance(rng, 0.7) ? cardsForCharacter(characterId, r) : colorlessCards(r)).filter(isRewardCard);
  const fallback = [...cardsForCharacter(characterId), ...colorlessCards()].filter(isRewardCard);
  const list = pool.length > 0 ? pool : fallback;
  return pickOne(rng, list).id;
}

export function makeCard(defId: string, seq: { n: number }): CardInstance {
  seq.n += 1;
  return { instanceId: `c${seq.n}`, defId, upgraded: false };
}

export function rollCardRewards(
  characterId: CharacterId,
  rng: Rng,
  seq: { n: number },
  count = 3,
): CardInstance[] {
  return rollCardOffer(characterId, rng, seq, count, {});
}

export function rollCardOffer(
  characterId: CharacterId,
  rng: Rng,
  seq: { n: number },
  count: number,
  opts: { rarity?: Exclude<CardRarity, 'starter'>; colorlessOnly?: boolean },
): CardInstance[] {
  const ids: string[] = [];
  let guard = 0;
  while (ids.length < count && guard < 80) {
    guard += 1;
    if (opts.colorlessOnly) {
      const pool = colorlessCards(opts.rarity).filter(isRewardCard).filter((c) => !ids.includes(c.id));
      if (pool.length === 0) break;
      ids.push(pickOne(rng, pool).id);
      continue;
    }
    const id = rollCardDefId(characterId, rng, opts.rarity);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => makeCard(id, seq));
}

function relicRarity(rng: Rng): Exclude<CardRarity, 'starter'> {
  const r = rng();
  if (r < 0.55) return 'common';
  if (r < 0.88) return 'uncommon';
  return 'rare';
}

export function rollRelicId(rng: Rng, owned: string[]): string | undefined {
  const rarity = relicRarity(rng);
  const pool = relicsByRarity(rarity, owned);
  if (pool.length > 0) return pickOne(rng, pool).id;
  const any = allObtainableRelics(owned);
  return any.length > 0 ? pickOne(rng, any).id : undefined;
}

export function rollPotionId(rng: Rng): string {
  return pickOne(rng, POTION_IDS);
}

export function goldForCombat(
  base: number,
  relics: string[],
): number {
  let gold = base;
  let percent = 0;
  let flat = 0;
  for (const id of relics) {
    for (const hook of findRelicDef(id)?.hooks ?? []) {
      if (hook.when === 'goldBonus') {
        percent += hook.percent ?? 0;
        flat += hook.flat ?? 0;
      }
    }
  }
  gold = Math.floor(gold * (1 + percent / 100)) + flat;
  return Math.max(0, gold);
}

export function restHealBonus(relics: string[]): number {
  let extra = 0;
  for (const id of relics) {
    for (const hook of findRelicDef(id)?.hooks ?? []) {
      if (hook.when === 'restHealBonus') extra += hook.amount;
    }
  }
  return extra;
}

export function buildCombatRewards(opts: {
  characterId: CharacterId;
  rng: Rng;
  seq: { n: number };
  gold: number;
  relics: string[];
  potions: (string | null)[];
  source: RewardOffer['source'];
  upgradeCards?: boolean;
}): RewardOffer {
  const offer: RewardOffer = {
    gold: opts.gold,
    cards:
      opts.source === 'treasure'
        ? []
        : rollCardRewards(opts.characterId, opts.rng, opts.seq).map((card) =>
            opts.upgradeCards ? { ...card, upgraded: true } : card,
          ),
    source: opts.source,
    cardPicked: opts.source === 'treasure',
    relicTaken: true,
    potionTaken: true,
  };
  if (offer.cards.length === 0) offer.cardPicked = true;
  if (opts.source === 'elite' || opts.source === 'boss' || opts.source === 'treasure') {
    offer.relicId = rollRelicId(opts.rng, opts.relics);
    offer.relicTaken = !offer.relicId;
  }
  const emptySlot = opts.potions.some((p) => p === null);
  if (emptySlot && opts.source !== 'treasure' && chance(opts.rng, 0.18)) {
    offer.potionId = rollPotionId(opts.rng);
    offer.potionTaken = false;
  }
  return offer;
}

export function cardPrice(rarity: CardRarity): number {
  if (rarity === 'rare') return 125;
  if (rarity === 'uncommon') return 75;
  return 50;
}

export function relicPrice(rarity: CardRarity): number {
  if (rarity === 'rare') return 280;
  if (rarity === 'uncommon') return 200;
  return 150;
}

export function buildShopStock(
  characterId: CharacterId,
  rng: Rng,
  seq: { n: number },
  ownedRelics: string[],
): ShopStock {
  const cards = rollCardRewards(characterId, rng, seq, 3);
  const relics: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const id = rollRelicId(rng, [...ownedRelics, ...relics]);
    if (id) relics.push(id);
  }
  const potions = shuffle(rng, [...POTION_IDS]).slice(0, 2);
  return { cards, relics, potions, removalCost: 75, removed: false };
}

export function addPotion(potions: (string | null)[], id: string): (string | null)[] {
  const next = [...potions];
  const idx = next.findIndex((p) => p === null);
  if (idx >= 0) next[idx] = id;
  return next;
}
