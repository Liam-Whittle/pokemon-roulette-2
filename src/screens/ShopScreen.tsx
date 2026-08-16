import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PokeDollarAmount } from '../components/PokeDollar';
import { ItemIcon } from '../components/ItemIcon';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { buildShopCatalog } from '../utils/shopCatalog';
import type { RegionId } from '../data/pools';
import { resolveRegionId } from '../data/pools';

export function ShopScreen() {
  const money = useGameStore((s) => s.money);
  const bag = useGameStore((s) => s.bag);
  const muted = useGameStore((s) => s.muted);
  const setScreen = useGameStore((s) => s.setScreen);
  const buyShopItem = useGameStore((s) => s.buyShopItem);
  const shopStock = useGameStore((s) => s.shopStock);
  const refillShopStock = useGameStore((s) => s.refillShopStock);
  const activeUnlocks = useGameStore((s) => s.activeUnlocks);
  const hiddenStoneId = useGameStore((s) => s.hiddenStoneId);
  const region = useGameStore((s) =>
    resolveRegionId(s.trainer?.region),
  ) as RegionId;
  const pendingGymAfterShop = useGameStore((s) => s.pendingGymAfterShop);
  const setPendingGymAfterShop = useGameStore((s) => s.setPendingGymAfterShop);

  const [detail, setDetail] = useState<{ id: string; name: string; icon: string } | null>(null);

  useEffect(() => {
    if (Object.keys(shopStock).length === 0) refillShopStock();
  }, [shopStock, refillShopStock]);

  const catalog = useMemo(
    () => buildShopCatalog(region, activeUnlocks, hiddenStoneId),
    [region, activeUnlocks, hiddenStoneId],
  );

  function buyItem(itemId: string, price: number) {
    if (!buyShopItem(itemId, price)) return;
    playSfx('item', muted);
  }

  function leaveShop() {
    if (pendingGymAfterShop) {
      const target = pendingGymAfterShop;
      setPendingGymAfterShop(null);
      setScreen(target);
      return;
    }
    setScreen('hub');
  }

  return (
    <motion.div
      className="screen shop-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="shop-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={leaveShop}>
          {pendingGymAfterShop ? '→ To Battle' : '← Back to Hub'}
        </button>
        <h2 className="screen-title">
          <GameIcon ui="shop" alt="" className="game-icon-img game-icon-img--title" /> Poké Mart
        </h2>
        <p className="shop-balance">
          Balance: <PokeDollarAmount amount={money} />
        </p>
      </header>

      <div className="shop-grid">
        {catalog.map((item) => {
          const owned = bag.find((entry) => entry.id === item.id)?.quantity ?? 0;
          const canAfford = money >= item.price;
          const stock = shopStock[item.id];
          const stockLabel = stock === undefined || stock === 'inf' ? '∞' : String(stock);
          const outOfStock = typeof stock === 'number' && stock <= 0;
          return (
            <div key={item.id} className="shop-card">
              <button
                type="button"
                className="shop-card__info"
                onClick={() => setDetail({ id: item.id, name: item.name, icon: item.icon })}
                aria-label={`View ${item.name} details`}
              >
                <ItemIcon id={item.id} icon={item.icon} name={item.name} className="shop-card__icon" />
                <h3 className="shop-card__name">{item.name}</h3>
              </button>
              <p className="shop-card__owned">Owned: ×{owned}</p>
              <p className="shop-card__stock">Stock: {stockLabel}</p>
              <p className="shop-card__price">
                <PokeDollarAmount amount={item.price} />
              </p>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!canAfford || outOfStock}
                onClick={() => buyItem(item.id, item.price)}
              >
                {outOfStock ? 'Sold Out' : 'Buy'}
              </button>
            </div>
          );
        })}
      </div>

      {detail && (
        <ItemDetailModal
          id={detail.id}
          name={detail.name}
          icon={detail.icon}
          onClose={() => setDetail(null)}
        />
      )}
    </motion.div>
  );
}
