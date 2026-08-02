import {
  HIDDEN_STOCK_MASTERBALL,
  HIDDEN_STOCK_RARE_CANDY,
  SHOP_CATALOG,
  getStoneItemIdsForRegion,
  ITEMS,
  pickRandom,
  type RegionId,
  type ShopCatalogEntry,
} from '../data/pools';
import type { PrestigeUnlockId } from '../data/prestige';

export type ShopStockMap = Record<string, number | 'inf'>;

export function buildShopCatalog(
  _region: RegionId,
  activeUnlocks: PrestigeUnlockId[],
  hiddenStoneId: string | null,
): ShopCatalogEntry[] {
  const onTheHouse = activeUnlocks.includes('onTheHouse');
  const hiddenStock = activeUnlocks.includes('hiddenStock');
  const base = SHOP_CATALOG.filter((item) => !(onTheHouse && item.id === 'shinycharm'));
  const extra: ShopCatalogEntry[] = [];
  if (hiddenStock) {
    extra.push(HIDDEN_STOCK_RARE_CANDY);
    if (hiddenStoneId) {
      const stone = ITEMS.find((i) => i.id === hiddenStoneId);
      extra.push({
        id: hiddenStoneId,
        name: stone?.name ?? 'Evolution Stone',
        icon: stone?.icon ?? '🪨',
        price: 300,
        stock: 1,
      });
    }
    extra.push(HIDDEN_STOCK_MASTERBALL);
  }
  return [...base, ...extra];
}

export function createShopStock(
  region: RegionId,
  activeUnlocks: PrestigeUnlockId[],
  hiddenStoneId: string | null,
): ShopStockMap {
  const catalog = buildShopCatalog(region, activeUnlocks, hiddenStoneId);
  const stock: ShopStockMap = {};
  for (const item of catalog) {
    stock[item.id] = item.stock == null ? 'inf' : item.stock;
  }
  return stock;
}

export function pickHiddenStoneId(region: RegionId): string {
  return pickRandom(getStoneItemIdsForRegion(region));
}
