import { motion } from 'framer-motion';
import { SHOP_CATALOG } from '../data/pools';
import { PokeDollarAmount } from '../components/PokeDollar';
import { ItemIcon } from '../components/ItemIcon';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

export function ShopScreen() {
  const money = useGameStore((s) => s.money);
  const bag = useGameStore((s) => s.bag);
  const muted = useGameStore((s) => s.muted);
  const setScreen = useGameStore((s) => s.setScreen);
  const spendMoney = useGameStore((s) => s.spendMoney);
  const addItem = useGameStore((s) => s.addItem);

  function buyItem(itemId: string, price: number) {
    if (!spendMoney(price)) return;
    addItem(itemId);
    playSfx('item', muted);
  }

  return (
    <motion.div
      className="screen shop-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="shop-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setScreen('hub')}>
          ← Back to Hub
        </button>
        <h2 className="screen-title">
          <GameIcon ui="shop" alt="" className="game-icon-img game-icon-img--title" /> Poké Mart
        </h2>
        <p className="shop-balance">
          Balance: <PokeDollarAmount amount={money} />
        </p>
      </header>

      <div className="shop-grid">
        {SHOP_CATALOG.map((item) => {
          const owned = bag.find((entry) => entry.id === item.id)?.quantity ?? 0;
          const canAfford = money >= item.price;
          return (
            <div key={item.id} className="shop-card">
              <ItemIcon id={item.id} icon={item.icon} name={item.name} className="shop-card__icon" />
              <h3 className="shop-card__name">{item.name}</h3>
              <p className="shop-card__owned">Owned: ×{owned}</p>
              <p className="shop-card__price">
                <PokeDollarAmount amount={item.price} />
              </p>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!canAfford}
                onClick={() => buyItem(item.id, item.price)}
              >
                Buy
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
