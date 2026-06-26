import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ItemIcon } from './ItemIcon';
import { ITEM_DESCRIPTIONS } from '../data/pools';

interface ItemDetailModalProps {
  id: string;
  name: string;
  icon: string;
  onClose: () => void;
}

export function ItemDetailModal({ id, name, icon, onClose }: ItemDetailModalProps) {
  const description = ITEM_DESCRIPTIONS[id] ?? 'No description available for this item yet.';

  return createPortal(
    <div className="item-detail-backdrop" onClick={onClose}>
      <motion.div
        className="item-detail"
        initial={{ scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="item-detail__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="item-detail__head">
          <ItemIcon id={id} icon={icon} name={name} className="item-detail__icon" />
          <h3 className="item-detail__name">{name}</h3>
        </div>
        <p className="item-detail__desc">{description}</p>
      </motion.div>
    </div>,
    document.body,
  );
}
