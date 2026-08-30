import { motion } from 'framer-motion';
import { TypeBadge } from '../../components/TypeBadge';
import { CHARACTERS, CHARACTER_IDS } from '../data/characters';
import { findRelicDef } from '../data/relics';
import { localPokemonArtwork, remotePokemonArtwork, imgFallback } from '../../utils/localAssets';
import { playSfx } from '../../utils/sound';
import { useGameStore } from '../../store/useGameStore';
import { useSpireStore } from '../store/useSpireStore';
import type { CharacterId } from '../types';

export function CharacterSelectView() {
  const selectCharacter = useSpireStore((s) => s.selectCharacter);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const pick = (id: CharacterId) => {
    playSfx('click', muted);
    selectCharacter(id);
  };

  return (
    <div className="spire-view spire-view--select">
      <button
        type="button"
        className="btn btn--ghost btn--sm spire-select__back"
        onClick={() => {
          playSfx('click', muted);
          setScreen('title');
        }}
      >
        ← Title screen
      </button>
      <header className="spire-panel spire-panel--title">
        <p className="spire-kicker">Battle Tower</p>
        <h2>Choose your partner</h2>
        <p>Three trainers. Three engines. One climb to the top floor.</p>
      </header>
      <div className="spire-select">
        {CHARACTER_IDS.map((id, index) => {
          const ch = CHARACTERS[id];
          const relic = findRelicDef(ch.starterRelic);
          return (
            <motion.button
              key={id}
              type="button"
              className={`spire-select__card spire-select__card--${id}`}
              onClick={() => pick(id)}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -10 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="spire-select__art">
                <img
                  src={localPokemonArtwork(ch.speciesId)}
                  alt={ch.speciesName}
                  onError={(e) => imgFallback(e, remotePokemonArtwork(ch.speciesId))}
                />
              </div>
              <div className="spire-select__types">
                {ch.types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </div>
              <h3>{ch.name}</h3>
              <p className="spire-select__species">{ch.speciesName}</p>
              <p className="spire-select__title">{ch.title}</p>
              <p className="spire-select__blurb">{ch.description}</p>
              {relic && (
                <p className="spire-select__relic">
                  <span className="spire-select__relic-label">Starter relic · {relic.name}</span>
                  <span className="spire-select__relic-desc">{relic.description}</span>
                </p>
              )}
              <span className="spire-select__hp">{ch.maxHp} HP</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
