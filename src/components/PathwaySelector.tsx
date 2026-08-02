import { getItemSprite, getPathwayHeroSprite, getUISprite } from '../data/icons';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { imgFallback, remoteItemSprite, remotePokemonSprite } from '../utils/localAssets';
import type { PathwayId } from '../types/game';

type HubActionVariant = 'shop' | 'gamecorner' | 'mysterygift' | 'cinnabar' | 'maxrepel';

interface PathwaySelectorProps {
  onSelect: (pathway: PathwayId) => void;
  disabled?: boolean;
  showMischief?: boolean;
  hideCatch?: boolean;
}

const PATHWAYS: {
  id: PathwayId;
  title: string;
  subtitle: string;
  className: string;
}[] = [
  {
    id: 'catch',
    title: 'Catch Pokémon',
    subtitle: 'Spin for a random regional Pokémon',
    className: 'pathway-card--catch',
  },
  {
    id: 'explore',
    title: 'Explore World',
    subtitle: 'Trainers, Rival, Rocket, loot & more',
    className: 'pathway-card--items',
  },
  {
    id: 'mischief',
    title: "Mew's Mischief",
    subtitle: 'Wonder Trade, Picnic, Lucky Egg & more',
    className: 'pathway-card--mystery',
  },
];

function PathwayHero({ pathId }: { pathId: PathwayId }) {
  if (pathId === 'explore') {
    return (
      <img
        src={getPathwayHeroSprite('explore')}
        alt="Explore"
        className="pathway-card__hero pathway-card__hero--item item-icon-img"
        onError={(e) => imgFallback(e, remoteItemSprite('bicycle.png'), PLACEHOLDER_SPRITE)}
      />
    );
  }

  if (pathId === 'mischief') {
    return (
      <img
        src={getPathwayHeroSprite('mischief')}
        alt="Mew's Mischief"
        className="pathway-card__hero pathway-card__hero--pokemon"
        onError={(e) => imgFallback(e, remotePokemonSprite(151), PLACEHOLDER_SPRITE)}
      />
    );
  }

  const src = getPathwayHeroSprite('catch');

  return (
    <img
      src={src}
      alt=""
      className="pathway-card__hero pathway-card__hero--pokemon"
      onError={(e) => imgFallback(e, remotePokemonSprite(133), PLACEHOLDER_SPRITE)}
    />
  );
}

export function PathwaySelector({
  onSelect,
  disabled,
  showMischief = false,
  hideCatch = false,
}: PathwaySelectorProps) {
  const pathways = PATHWAYS.filter((path) => {
    // Mew swipes the usual paths — only Mischief remains.
    if (showMischief) return path.id === 'mischief';
    if (path.id === 'mischief') return false;
    if (path.id === 'catch') return !hideCatch;
    return true;
  });

  return (
    <div className="pathway-hub">
      {pathways.map((path) => (
        <button
          key={path.id}
          type="button"
          className={`pathway-card ${path.className}`}
          disabled={disabled}
          onClick={() => onSelect(path.id)}
        >
          <div className="pathway-card__hero-wrap">
            <PathwayHero pathId={path.id} />
          </div>
          <h4 className="pathway-card__title">{path.title}</h4>
          <p className="pathway-card__subtitle">{path.subtitle}</p>
        </button>
      ))}
    </div>
  );
}

interface HubShopButtonProps {
  onClick: () => void;
  label?: string;
  variant?: HubActionVariant;
  disabled?: boolean;
  title?: string;
}

const HUB_ACTION_ICONS: Record<HubActionVariant, string> = {
  shop: getUISprite('shop'),
  gamecorner: getUISprite('gamecorner'),
  mysterygift: getUISprite('mysterygift'),
  cinnabar: getUISprite('cinnabar'),
  maxrepel: getItemSprite('maxrepel') ?? getUISprite('shop'),
};

export function HubShopButton({
  onClick,
  label = 'Poké Mart',
  variant = 'shop',
  disabled = false,
  title,
}: HubShopButtonProps) {
  return (
    <button
      type="button"
      className={`hub-shop-btn hub-shop-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <img src={HUB_ACTION_ICONS[variant]} alt="" className="hub-shop-btn__icon" />
      {label}
    </button>
  );
}
