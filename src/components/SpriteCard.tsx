import { motion } from 'framer-motion';
import type { PokemonData } from '../types/game';
import { TypeBadge } from './TypeBadge';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

interface SpriteCardProps {
  pokemon: PokemonData;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  shiny?: boolean;
}

const sizes = { sm: 80, md: 140, lg: 200 };

export function SpriteCard({ pokemon, size = 'md', animate = true, shiny = false }: SpriteCardProps) {
  const px = sizes[size];
  const isShiny = shiny;
  const image =
    isShiny && pokemon.shinyArtwork
      ? pokemon.shinyArtwork
      : isShiny && pokemon.shinySprite
        ? pokemon.shinySprite
        : pokemon.artwork || pokemon.sprite;

  return (
    <div className={`sprite-card ${isShiny ? 'sprite-card--shiny' : ''}`}>
      <motion.img
        src={image}
        alt={pokemon.displayName}
        width={px}
        height={px}
        className="sprite-card__img"
        onError={(e) => {
          (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
        }}
        animate={animate ? { y: [0, -8, 0] } : undefined}
        transition={animate ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <h3 className="sprite-card__name">
        {isShiny ? '✨ ' : ''}
        {pokemon.displayName}
      </h3>
      <div className="sprite-card__types">
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>
    </div>
  );
}
