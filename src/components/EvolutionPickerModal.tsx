import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { AvailableEvolution } from '../utils/evolution';
import { getEvolutionMethodLabel, getEvolutionTargetName } from '../utils/evolution';
import { TypeBadge } from './TypeBadge';
import { getCachedSpecies } from '../data/speciesCache';
import { localPokemonArtwork, remotePokemonSprite, imgFallback } from '../utils/localAssets';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

export interface EvolutionPickerOption extends AvailableEvolution {
  caughtAt: number;
  fromSpeciesId: number;
  fromName: string;
}

interface EvolutionPickerModalProps {
  options: EvolutionPickerOption[];
  onSelect: (toId: number) => void;
  onCancel: () => void;
}

export function EvolutionPickerModal({ options, onSelect, onCancel }: EvolutionPickerModalProps) {
  return createPortal(
    <div className="evo-picker-backdrop" onClick={onCancel}>
      <motion.div
        className="evo-picker"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="evo-picker__title">Choose an evolution</h3>
        <p className="evo-picker__subtitle">
          {options[0]?.fromName} can evolve in more than one way. Pick one:
        </p>
        <ul className="evo-picker__list">
          {options.map((option) => {
            const target = getCachedSpecies(option.toId);
            const sprite = localPokemonArtwork(option.toId) || remotePokemonSprite(option.toId);
            return (
              <li key={option.toId}>
                <button
                  type="button"
                  className="evo-picker__option"
                  onClick={() => onSelect(option.toId)}
                >
                  <img
                    src={sprite}
                    alt=""
                    className="evo-picker__sprite"
                    onError={(e) => imgFallback(e, remotePokemonSprite(option.toId), PLACEHOLDER_SPRITE)}
                  />
                  <div className="evo-picker__details">
                    <strong className="evo-picker__name">{getEvolutionTargetName(option.toId)}</strong>
                    <span className="evo-picker__method">
                      {getEvolutionMethodLabel(option, option.fromSpeciesId)}
                    </span>
                    {target && (
                      <div className="evo-picker__types">
                        {target.types.map((type) => (
                          <TypeBadge key={type} type={type} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn--ghost evo-picker__cancel" onClick={onCancel}>
          Cancel
        </button>
      </motion.div>
    </div>,
    document.body,
  );
}
