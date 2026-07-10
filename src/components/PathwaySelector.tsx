import { getItemSprite, getPathwayHeroSprite, getSegmentSprite, getUISprite } from '../data/icons';
import { getRegionCatchSegments } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { imgFallback, remoteItemSprite, remotePokemonSprite } from '../utils/localAssets';
import type { PathwayId } from '../types/game';

interface PathwaySelectorProps {
  onSelect: (pathway: PathwayId) => void;
  disabled?: boolean;
}

const PATHWAYS: {
  id: PathwayId;
  title: string;
  subtitle: string;
  className: string;
  icons: string[];
}[] = [
  {
    id: 'catch',
    title: 'Catch Pokémon',
    subtitle: 'Grass, Fishing, Cave, Fossil & Legendary',
    className: 'pathway-card--catch',
    icons: ['wild', 'fishing', 'cave', 'fossil', 'legendary'],
  },
  {
    id: 'items',
    title: 'Hunt Items',
    subtitle: 'Find items, Potions, Candy & More',
    className: 'pathway-card--items',
    icons: ['item', 'elixir', 'potion', 'rarecandy', 'healpowder', 'xattack'],
  },
  {
    id: 'mystery',
    title: 'Mystery',
    subtitle: 'Uber Spin, Team Rocket, Heals & Cash',
    className: 'pathway-card--mystery',
    icons: ['uberspin', 'teamrocket', 'fullheal', 'money100'],
  },
];

function PathwayHero({ pathId }: { pathId: PathwayId }) {
  if (pathId === 'items') {
    return (
      <img
        src={getItemSprite('electricgem') ?? ''}
        alt="Electric Gem"
        className="pathway-card__hero pathway-card__hero--item item-icon-img"
        onError={(e) => imgFallback(e, remoteItemSprite('electric-gem.png'), PLACEHOLDER_SPRITE)}
      />
    );
  }

  if (pathId === 'mystery') {
    return (
      <img
        src={getItemSprite('mysteryegg') ?? ''}
        alt="Mystery Egg"
        className="pathway-card__hero pathway-card__hero--item item-icon-img"
        onError={(e) => imgFallback(e, remoteItemSprite('mystery-egg.png'), PLACEHOLDER_SPRITE)}
      />
    );
  }

  const src = getPathwayHeroSprite(pathId);

  return (
    <img
      src={src}
      alt=""
      className="pathway-card__hero pathway-card__hero--pokemon"
      onError={(e) => imgFallback(e, remotePokemonSprite(133), PLACEHOLDER_SPRITE)}
    />
  );
}

export function PathwaySelector({ onSelect, disabled }: PathwaySelectorProps) {
  const region = useGameStore((s) => (s.trainer?.region === 'Johto' ? 'Johto' : 'Kanto'));
  const catchIcons = getRegionCatchSegments(region).map((segment) => segment.id);
  const catchSubtitle =
    region === 'Johto'
      ? 'Grass, Fishing, Cave & Legendary'
      : 'Grass, Fishing, Cave, Fossil & Legendary';

  const pathways = PATHWAYS.map((path) =>
    path.id === 'catch' ? { ...path, icons: catchIcons, subtitle: catchSubtitle } : path,
  );

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
          <div className="pathway-card__icons">
            {path.icons.map((iconId) => {
              const src = getSegmentSprite(iconId);
              return src ? (
                <img key={iconId} src={src} alt="" className="pathway-card__icon-img" />
              ) : (
                <span key={iconId} className="pathway-card__icon-fallback">
                  ?
                </span>
              );
            })}
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
}

export function HubShopButton({ onClick }: HubShopButtonProps) {
  return (
    <button type="button" className="hub-shop-btn" onClick={onClick}>
      <img src={getUISprite('shop')} alt="" className="hub-shop-btn__icon" />
      Poké Mart
    </button>
  );
}
