import { useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { MetaMenuNav } from '../components/MetaMenuNav';
import { PokemonDetailModal } from '../components/PokemonDetailModal';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { TypeBadge } from '../components/TypeBadge';
import { MISSINGNO_ID, MISSINGNO_SPRITE } from '../data/missingno';
import { TYPE_COLORS } from '../data/typeChart';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { PokedexEntry } from '../types/game';

type SortMode = 'dex' | 'name';

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 24) * 0.03, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export function GlobalPokedexScreen() {
  const globalPokedex = useGameStore((s) => s.globalPokedex);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const [search, setSearch] = useState('');
  const [shinyOnly, setShinyOnly] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('dex');
  const [selected, setSelected] = useState<{ id: number; entry: PokedexEntry } | null>(null);

  const entries = useMemo(
    () => Object.entries(globalPokedex).map(([id, entry]) => ({ id: Number(id), entry })),
    [globalPokedex],
  );

  const caughtCount = entries.filter(({ entry }) => entry.caught).length;
  const shinyCount = entries.filter(({ entry }) => entry.caught && entry.shiny).length;

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const { entry } of entries) {
      if (!entry.caught) continue;
      for (const t of entry.types) set.add(t.toLowerCase());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/^#/, '');

    let list = entries.filter(({ id, entry }) => {
      if (shinyOnly && !(entry.caught && entry.shiny)) return false;

      if (selectedTypes.length > 0) {
        if (!entry.caught) return false;
        const types = entry.types.map((t) => t.toLowerCase());
        if (!selectedTypes.every((t) => types.includes(t))) return false;
      }

      if (!q) return true;

      const name = entry.caught ? entry.name.toLowerCase() : '';
      const padded = String(id).padStart(3, '0');
      if (name.includes(q)) return true;
      if (padded.includes(qDigits) || String(id) === qDigits) return true;
      return false;
    });

    list = [...list].sort((a, b) => {
      if (sortMode === 'name') {
        const an = a.entry.caught ? a.entry.name : `zzz${a.id}`;
        const bn = b.entry.caught ? b.entry.name : `zzz${b.id}`;
        return an.localeCompare(bn) || a.id - b.id;
      }
      return a.id - b.id;
    });

    return list;
  }, [entries, search, shinyOnly, selectedTypes, sortMode]);

  function toggleType(type: string) {
    playSfx('click', muted);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  return (
    <motion.div
      className="screen collection-screen global-pokedex-screen"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <header className="collection-header">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            playSfx('click', muted);
            setScreen('title');
          }}
        >
          ← Back
        </button>
        <h2 className="screen-title">Global Pokédex</h2>
        <span className="glass-chip glass-chip--green">
          {caughtCount} caught · {shinyCount} shiny
        </span>
      </header>

      <MetaMenuNav current="global-pokedex" />

      {entries.length === 0 ? (
        <p className="collection-empty">
          No global catches yet. Complete runs or play Daily Encounter!
        </p>
      ) : (
        <>
          <div className="dex-toolbar">
            <input
              type="search"
              className="dex-toolbar__search"
              placeholder="Search name or #025…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search Pokédex"
            />
            <div className="dex-toolbar__chips">
              <button
                type="button"
                className={`dex-chip dex-chip--shiny ${shinyOnly ? 'dex-chip--active' : ''}`}
                onClick={() => {
                  playSfx('click', muted);
                  setShinyOnly((v) => !v);
                }}
              >
                ✨ Shiny
              </button>
              <select
                className="dex-toolbar__select"
                value={sortMode}
                onChange={(e) => {
                  playSfx('click', muted);
                  setSortMode(e.target.value as SortMode);
                }}
                aria-label="Sort Pokédex"
              >
                <option value="dex">Sort: Dex #</option>
                <option value="name">Sort: Name</option>
              </select>
              {(shinyOnly || selectedTypes.length > 0 || search) && (
                <button
                  type="button"
                  className="dex-chip"
                  onClick={() => {
                    playSfx('click', muted);
                    setSearch('');
                    setShinyOnly(false);
                    setSelectedTypes([]);
                    setSortMode('dex');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {availableTypes.length > 0 && (
              <div className="dex-type-row" role="group" aria-label="Filter by type">
                {availableTypes.map((type) => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`dex-type-chip ${active ? 'dex-type-chip--active' : ''}`}
                      style={{ backgroundColor: TYPE_COLORS[type] ?? '#888' }}
                      onClick={() => toggleType(type)}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="collection-empty">No Pokémon match these filters.</p>
          ) : (
            <div className="pokedex-grid">
              {filtered.map(({ id, entry }, index) => {
                const displayName = entry.caught
                  ? `${entry.shiny ? '✨ ' : ''}${entry.name}`
                  : '???';
                const canOpen = entry.caught;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    className={`pokedex-entry ${entry.caught ? 'pokedex-entry--caught' : 'pokedex-entry--unseen'} ${entry.caught && entry.shiny ? 'pokedex-entry--shiny' : ''} ${canOpen ? 'pokedex-entry--clickable' : ''}`}
                    custom={index}
                    variants={cardVariants}
                    initial="hidden"
                    animate="show"
                    layout
                    disabled={!canOpen}
                    onClick={() => {
                      if (!canOpen) return;
                      playSfx('click', muted);
                      setSelected({ id, entry });
                    }}
                  >
                    <img
                      src={
                        id === MISSINGNO_ID
                          ? MISSINGNO_SPRITE
                          : entry.caught && entry.shiny && entry.shinySprite
                            ? entry.shinySprite
                            : entry.sprite
                      }
                      alt={entry.caught ? entry.name : 'Unknown'}
                      className={`pokedex-entry__sprite pokedex-entry__sprite--wave${id === MISSINGNO_ID ? ' pokedex-entry__sprite--missingno' : ''}`}
                      style={{ '--wave-i': index } as CSSProperties}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          id === MISSINGNO_ID ? MISSINGNO_SPRITE : PLACEHOLDER_SPRITE;
                      }}
                    />
                    <span className="pokedex-entry__id">#{String(id).padStart(3, '0')}</span>
                    <span className="pokedex-entry__name" title={displayName}>
                      {displayName}
                    </span>
                    <div className="pokedex-entry__types">
                      {entry.caught &&
                        entry.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected && (
        <PokemonDetailModal
          id={selected.id}
          name={selected.entry.name}
          types={selected.entry.types}
          shiny={!!selected.entry.shiny}
          caughtWithBall={selected.entry.caughtWithBall}
          level={selected.entry.level}
          showSidePanel={false}
          onClose={() => setSelected(null)}
        />
      )}
    </motion.div>
  );
}
