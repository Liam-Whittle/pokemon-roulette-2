import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { TypeBadge } from '../components/TypeBadge';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

export function PokedexScreen() {
  const pokedex = useGameStore((s) => s.pokedex);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const entries = Object.entries(pokedex).sort(([a], [b]) => Number(a) - Number(b));
  const caughtCount = entries.filter(([, e]) => e.caught).length;

  return (
    <motion.div
      className="screen collection-screen"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <header className="collection-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { playSfx('click', muted); setScreen('hub'); }}>
          ← Back
        </button>
        <h2 className="screen-title">📖 Pokédex</h2>
        <p className="collection-count">{caughtCount} caught</p>
      </header>

      {entries.length === 0 ? (
        <p className="collection-empty">No Pokémon registered yet. Go spin the wheel!</p>
      ) : (
        <div className="pokedex-grid">
          {entries.map(([id, entry]) => {
            const displayName = entry.caught ? `${entry.shiny ? '✨ ' : ''}${entry.name}` : '???';
            const nameLen = entry.caught ? entry.name.length : 3;
            const nameSize =
              nameLen > 9 ? ' pokedex-entry__name--xs' : nameLen > 7 ? ' pokedex-entry__name--sm' : '';
            return (
              <div key={id} className={`pokedex-entry ${entry.caught ? 'pokedex-entry--caught' : ''} ${entry.caught && entry.shiny ? 'pokedex-entry--shiny' : ''}`}>
                {entry.caught && (
                  <span className="pokedex-entry__power">
                    {Math.round((Number.isFinite(entry.powerLevel) ? entry.powerLevel : 0.3) * 100)}
                  </span>
                )}
                <img
                  src={entry.caught && entry.shiny && entry.shinySprite ? entry.shinySprite : entry.sprite}
                  alt={entry.name}
                  className="pokedex-entry__sprite"
                  onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE; }}
                />
                <span className="pokedex-entry__id">#{String(id).padStart(3, '0')}</span>
                <span className={`pokedex-entry__name${nameSize}`} title={displayName}>
                  {displayName}
                </span>
                <div className="pokedex-entry__types">
                  {entry.caught && entry.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
