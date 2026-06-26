import { motion } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { TypeBadge } from '../components/TypeBadge';
import { PLACEHOLDER_SPRITE } from '../utils/asset';

function power(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0.3) * 100);
}

export function HallOfChampionsScreen() {
  const hallOfChampions = useGameStore((s) => s.hallOfChampions);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  return (
    <motion.div
      className="screen hall-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="hall-header">
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
        <h2 className="screen-title hall-title">
          <GameIcon ui="hall" alt="" className="game-icon-img game-icon-img--title" /> Hall of Champions
        </h2>
      </header>

      {hallOfChampions.length === 0 ? (
        <p className="collection-empty">No champions yet. Beat the Elite Four and become Champion!</p>
      ) : (
        <div className="hall-list">
          {hallOfChampions.map((record) => (
            <motion.div
              key={record.id}
              className="hall-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="hall-card__trainer">
                <img
                  src={record.trainerAvatar}
                  alt={record.trainerName}
                  className="hall-card__avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                  }}
                />
                <div className="hall-card__meta">
                  <strong className="hall-card__name">{record.trainerName}</strong>
                  <span className="hall-card__region">Champion of {record.region}</span>
                  <span className="hall-card__date">
                    {new Date(record.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="hall-card__power">
                  <span className="hall-card__power-value">{power(record.avgPower)}</span>
                  <span className="hall-card__power-label">Avg Power</span>
                </div>
              </div>

              <div className="hall-card__party">
                {record.party.map((member) => (
                  <div key={`${member.id}-${member.caughtAt}`} className="hall-mon">
                    <img
                      src={member.shiny && member.shinySprite ? member.shinySprite : member.sprite}
                      alt={member.displayName}
                      className="hall-mon__sprite"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                      }}
                    />
                    <span className="hall-mon__name">
                      {member.shiny ? '✨ ' : ''}
                      {member.nickname ?? member.displayName}
                    </span>
                    <span className="hall-mon__power">Pwr {power(member.powerLevel)}</span>
                    <div className="hall-mon__types">
                      {member.types.map((type) => (
                        <TypeBadge key={type} type={type} size="sm" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
