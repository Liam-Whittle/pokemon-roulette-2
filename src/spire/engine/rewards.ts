import { cardsForCharacter, colorlessCards, getCardDef } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { allObtainableRelics, findRelicDef, relicsByRarity } from '../data/relics';
import { POTION_IDS } from '../data/potions';
import type { CardDef, CardInstance, CardRarity, CharacterId, RewardOffer, ShopStock } from '../types';
import type { Rng } from './rng';
import { chance, pickOne, shuffle } from './rng';

const STARTER_CARD_IDS = new Set(Object.values(CHARACTERS).flatMap((c) => c.starterDeck));
const SHOP_EXCLUDED_RELICS = new Set(['amulet-coin']);
const ONE_RARE_CHANCE = 0.05;
const ELITE_RELIC_CHANCE = 0.2;
const SHOP_CARD_COUNT = 6;

type CardPoolMode = 'class' | 'colorless' | 'mixed';

export function isRewardCard(def: CardDef): boolean {
  return !def.token && def.rarity !== 'starter' && !STARTER_CARD_IDS.has(def.id);
}

export function isColorlessCard(def: CardDef): boolean {
  return !def.character;
}

export function rollRarity(rng: Rng): Exclude<CardRarity, 'starter' | 'rare'> {
  return rng() < 0.67 ? 'common' : 'uncommon';
}

function uniqueById(list: CardDef[]): CardDef[] {
  return list.filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);
}

function classPool(characterId: CharacterId, rarity: Exclude<CardRarity, 'starter'>, used: string[]): CardDef[] {
  return cardsForCharacter(characterId, rarity)
    .filter(isRewardCard)
    .filter((c) => c.character === characterId && !used.includes(c.id));
}

function colorPool(rarity: Exclude<CardRarity, 'starter'>, used: string[]): CardDef[] {
  return colorlessCards(rarity).filter(isRewardCard).filter((c) => !used.includes(c.id));
}

function pickCardId(
  characterId: CharacterId,
  rng: Rng,
  rarity: Exclude<CardRarity, 'starter'>,
  mode: CardPoolMode,
  used: string[],
): string | undefined {
  const own = classPool(characterId, rarity, used);
  const colorless = colorPool(rarity, used);
  const mixed = uniqueById([...own, ...colorless]);
  let pool =
    mode === 'class' ? own : mode === 'colorless' ? colorless : chance(rng, 0.5) ? own : colorless;
  if (pool.length === 0) {
    pool = mode === 'class' ? own : mode === 'colorless' ? colorless : mixed;
  }
  if (pool.length === 0) return undefined;
  return pickOne(rng, pool).id;
}

export function rollCardDefId(characterId: CharacterId, rng: Rng, rarity?: CardRarity): string {
  const r = rarity && rarity !== 'starter' ? rarity : rollRarity(rng);
  const id = pickCardId(characterId, rng, r, 'class', []);
  if (id) return id;
  const fallback = cardsForCharacter(characterId).filter(isRewardCard).filter((c) => c.character === characterId);
  return pickOne(rng, fallback).id;
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
  return rollCardOffer(characterId, rng, seq, count, { pool: 'class', oneRareChance: ONE_RARE_CHANCE });
}

export function rollCardOffer(
  characterId: CharacterId,
  rng: Rng,
  seq: { n: number },
  count: number,
  opts: {
    rarity?: Exclude<CardRarity, 'starter'>;
    pool?: CardPoolMode;
    colorlessOnly?: boolean;
    classOnly?: boolean;
    oneRareChance?: number;
    maxColorless?: number;
    allowRare?: boolean;
  },
): CardInstance[] {
  const ids: string[] = [];
  let guard = 0;
  const mode: CardPoolMode = opts.colorlessOnly
    ? 'colorless'
    : opts.classOnly || opts.pool === 'class'
      ? 'class'
      : opts.pool ?? 'class';
  const forcedRare = opts.rarity === 'rare';
  const includeOneRare =
    opts.allowRare !== false && !forcedRare && !opts.rarity && chance(rng, opts.oneRareChance ?? 0);
  const rareSlot = includeOneRare ? Math.min(count - 1, Math.floor(rng() * count)) : -1;
  while (ids.length < count && guard < 80) {
    guard += 1;
    const colorlessCount = ids.filter((id) => isColorlessCard(getCardDef(id))).length;
    const rollMode: CardPoolMode =
      mode === 'mixed'
        ? opts.maxColorless != null && colorlessCount >= opts.maxColorless
          ? 'class'
          : chance(rng, 0.22)
            ? 'colorless'
            : 'class'
        : mode;
    const rarity =
      forcedRare || ids.length === rareSlot
        ? 'rare'
        : opts.rarity && opts.rarity !== 'rare'
          ? opts.rarity
          : rollRarity(rng);
    const id = pickCardId(characterId, rng, rarity, rollMode, ids);
    if (id && !ids.includes(id)) {
      ids.push(id);
      continue;
    }
    const fallbackRarity = rarity === 'rare' ? rollRarity(rng) : rarity;
    const fallback = pickCardId(characterId, rng, fallbackRarity, rollMode, ids);
    if (fallback && !ids.includes(fallback)) ids.push(fallback);
  }
  return ids.map((id) => makeCard(id, seq));
}

function relicRarity(rng: Rng): Exclude<CardRarity, 'starter'> {
  const r = rng();
  if (r < 0.55) return 'common';
  if (r < 0.88) return 'uncommon';
  return 'rare';
}

export function rollRelicId(
  rng: Rng,
  owned: string[],
  opts?: { rarity?: Exclude<CardRarity, 'starter'>; exclude?: string[] },
): string | undefined {
  const blocked = new Set([...(opts?.exclude ?? []), ...owned]);
  const rarity = opts?.rarity ?? relicRarity(rng);
  const pool = relicsByRarity(rarity, [...blocked]);
  if (pool.length > 0) return pickOne(rng, pool).id;
  const any = allObtainableRelics([...blocked]);
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
  allowRare?: boolean;
}): RewardOffer {
  const bossCards = opts.source === 'boss';
  const offer: RewardOffer = {
    gold: opts.gold,
    cards:
      opts.source === 'treasure'
        ? []
        : rollCardOffer(opts.characterId, opts.rng, opts.seq, 3, {
            rarity: bossCards ? 'rare' : undefined,
            pool: 'class',
            oneRareChance: bossCards ? 0 : ONE_RARE_CHANCE,
            allowRare: bossCards || opts.allowRare !== false,
          }).map((card) => (opts.upgradeCards ? { ...card, upgraded: true } : card)),
    source: opts.source,
    cardPicked: opts.source === 'treasure',
    relicTaken: true,
    potionTaken: true,
  };
  if (offer.cards.length === 0) offer.cardPicked = true;

  if (opts.source === 'boss') {
    offer.relicId = rollRelicId(opts.rng, opts.relics, { rarity: 'rare' });
    offer.relicTaken = !offer.relicId;
  } else if (opts.source === 'treasure') {
    offer.relicId = rollRelicId(opts.rng, opts.relics);
    offer.relicTaken = !offer.relicId;
  } else if (opts.source === 'elite') {
    if (chance(opts.rng, ELITE_RELIC_CHANCE)) {
      offer.relicId = rollRelicId(opts.rng, opts.relics);
      offer.relicTaken = !offer.relicId;
    } else {
      offer.potionId = rollPotionId(opts.rng);
      offer.potionTaken = false;
    }
  }

  const emptySlot = opts.potions.some((p) => p === null);
  if (
    emptySlot &&
    opts.source !== 'treasure' &&
    opts.source !== 'elite' &&
    !offer.potionId &&
    chance(opts.rng, 0.18)
  ) {
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
  if (rarity === 'rare') return 350;
  if (rarity === 'uncommon') return 300;
  return 250;
}

export function buildShopStock(
  characterId: CharacterId,
  rng: Rng,
  seq: { n: number },
  ownedRelics: string[],
  opts?: { allowRare?: boolean },
): ShopStock {
  const cards = rollCardOffer(characterId, rng, seq, SHOP_CARD_COUNT, {
    pool: 'mixed',
    oneRareChance: ONE_RARE_CHANCE,
    maxColorless: 2,
    allowRare: opts?.allowRare !== false,
  });
  const relics: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const id = rollRelicId(rng, [...ownedRelics, ...relics], { exclude: [...SHOP_EXCLUDED_RELICS] });
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
