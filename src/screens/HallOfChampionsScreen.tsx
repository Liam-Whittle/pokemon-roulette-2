import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { TypeBadge } from '../components/TypeBadge';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { formatRunTime, sortChampions } from '../utils/hallOfFame';

const FAME_RESET_CLICKS = 15;

export function HallOfChampionsScreen() {
  const hallOfChampions = useGameStore((s) => s.hallOfChampions);
  const clearHallOfFame = useGameStore((s) => s.clearHallOfFame);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const fameClicks = useRef(0);
  const [notice, setNotice] = useState<string | null>(null);

  const ranked = sortChampions(hallOfChampions);

  const handleFameClick = useCallback(() => {
    fameClicks.current += 1;
    if (fameClicks.current < FAME_RESET_CLICKS) return;
    fameClicks.current = 0;
    clearHallOfFame();
    playSfx('click', muted);
    setNotice('All Hall of Fame data has reset');
  }, [clearHallOfFame, muted]);

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
        <div className="hall-header__titles">
          <h2 className="screen-title hall-title">
            <GameIcon ui="hall" alt="" className="game-icon-img game-icon-img--title" /> Hall of{' '}
            <button type="button" className="hall-title__fame" onClick={handleFameClick}>
              Fame
            </button>
          </h2>
          <p className="hall-subtitle">
            Ranked by fastest clear, then fewest resources used
          </p>
        </div>
      </header>

      {ranked.length === 0 ? (
        <p className="collection-empty">No champions yet. Beat the Elite Four and become Champion!</p>
      ) : (
        <div className="hall-list">
          {ranked.map((record, index) => {
            const rank = index + 1;
            const rankClass =
              rank === 1
                ? 'hall-card--rank-1'
                : rank === 2
                  ? 'hall-card--rank-2'
                  : rank === 3
                    ? 'hall-card--rank-3'
                    : '';
            return (
              <motion.div
                key={record.id}
                className={`hall-card ${rankClass}`.trim()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="hall-card__trainer">
                  <span className={`hall-card__rank${rank <= 3 ? ` hall-card__rank--top` : ''}`}>
                    #{rank}
                  </span>
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
                </div>

                <div className="hall-card__stats">
                  <div className="hall-stat">
                    <span className="hall-stat__value">{formatRunTime(record.timeMs)}</span>
                    <span className="hall-stat__label">Time</span>
                  </div>
                  <div className="hall-stat">
                    <span className="hall-stat__value">{record.itemsUsed}</span>
                    <span className="hall-stat__label">Items</span>
                  </div>
                  <div className="hall-stat">
                    <span className="hall-stat__value">{record.livesUsed}</span>
                    <span className="hall-stat__label">Lives</span>
                  </div>
                  <div className="hall-stat">
                    <span className="hall-stat__value">{record.revivesUsed}</span>
                    <span className="hall-stat__label">Revives</span>
                  </div>
                  <div className="hall-stat">
                    <span className="hall-stat__value">{record.faints}</span>
                    <span className="hall-stat__label">Faints</span>
                  </div>
                  <div className="hall-stat hall-stat--shiny">
                    <span className="hall-stat__value">{record.shiniesCaught}</span>
                    <span className="hall-stat__label">Shinies</span>
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
                      <span className="hall-mon__level">Lv. {member.level}</span>
                      <div className="hall-mon__types">
                        {member.types.map((type) => (
                          <TypeBadge key={type} type={type} size="sm" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {notice && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal hub-notice-modal">
            <p className="hub-notice-modal__text">{notice}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                playSfx('click', muted);
                setNotice(null);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
