import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { imgFallback, remoteTrainerSprite } from '../utils/localAssets';
import { localTrainerSprite } from '../utils/localAssets';
import {
  ALL_REGION_IDS,
  META_ONLY_UNLOCKS,
  PRESTIGE_UNLOCK_ICONS,
  PRESTIGE_UNLOCKS,
  clearedRegionsFromHall,
  defaultNewGameUnlocks,
  isRegionUnlocked,
} from '../data/prestige';
import type { PrestigeUnlockId } from '../data/prestige';
import type { RegionId } from '../data/pools';
import { pickRandom } from '../data/pools';
import type { TrainerPreset } from '../types/game';

type RegionChoice = RegionId | 'random';

const KANTO_TRAINERS: TrainerPreset[] = [
  {
    id: 'boy',
    label: 'Red',
    sprite: localTrainerSprite('red-gen3.png'),
  },
  {
    id: 'girl',
    label: 'Leaf',
    sprite: localTrainerSprite('leaf-gen3.png'),
  },
];

const JOHTO_TRAINERS: TrainerPreset[] = [
  {
    id: 'boy',
    label: 'Ethan',
    sprite: localTrainerSprite('ethan.png'),
  },
  {
    id: 'girl',
    label: 'Lyra',
    sprite: localTrainerSprite('lyra.png'),
  },
];

function trainersForRegion(region: RegionId): TrainerPreset[] {
  return region === 'Johto' ? JOHTO_TRAINERS : KANTO_TRAINERS;
}

export function TrainerSetup() {
  const setTrainer = useGameStore((s) => s.setTrainer);
  const setCatchGamemode = useGameStore((s) => s.setCatchGamemode);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const hallOfChampions = useGameStore((s) => s.hallOfChampions);
  const ownedUnlocks = useGameStore((s) => s.ownedUnlocks);
  const beginRunWithUnlocks = useGameStore((s) => s.beginRunWithUnlocks);
  const getUnlockedRegions = useGameStore((s) => s.getUnlockedRegions);

  const cleared = useMemo(() => clearedRegionsFromHall(hallOfChampions), [hallOfChampions]);
  const unlockedRegions = getUnlockedRegions();

  const [regionChoice, setRegionChoice] = useState<RegionChoice>('Kanto');
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [name, setName] = useState('');
  const [enabledUnlocks, setEnabledUnlocks] = useState<PrestigeUnlockId[]>(() =>
    defaultNewGameUnlocks(ownedUnlocks),
  );

  const previewRegion: RegionId = regionChoice === 'random' ? 'Kanto' : regionChoice;
  const trainers = trainersForRegion(previewRegion);

  const runToggleUnlocks = PRESTIGE_UNLOCKS.filter(
    (u) => ownedUnlocks.includes(u.id) && !META_ONLY_UNLOCKS.includes(u.id),
  );

  const handleStart = () => {
    if (!name.trim()) return;

    const resolvedRegion: RegionId =
      regionChoice === 'random' ? pickRandom(unlockedRegions) : regionChoice;

    if (!isRegionUnlocked(resolvedRegion, cleared) && !unlockedRegions.includes(resolvedRegion)) {
      return;
    }

    playSfx('click', muted);
    const active = enabledUnlocks.filter(
      (id) => ownedUnlocks.includes(id) && !META_ONLY_UNLOCKS.includes(id),
    );
    const roster = trainersForRegion(resolvedRegion);
    const trainer = roster.find((t) => t.id === gender) ?? roster[0];

    setCatchGamemode('chance');
    beginRunWithUnlocks(active, resolvedRegion);
    setTrainer({
      name: name.trim(),
      avatar: trainer.sprite,
      gender: trainer.id,
      region: resolvedRegion,
    });
    if (active.includes('hardcore')) {
      setScreen('hardcore-draft');
    } else {
      setScreen('starter');
    }
  };

  const handleRegionChange = (nextRegion: RegionId) => {
    if (!unlockedRegions.includes(nextRegion)) return;
    playSfx('click', muted);
    setRegionChoice(nextRegion);
  };

  const selectRandomRegion = () => {
    if (unlockedRegions.length === 0) return;
    playSfx('click', muted);
    setRegionChoice('random');
  };

  const toggleUnlock = (id: PrestigeUnlockId) => {
    playSfx('click', muted);
    setEnabledUnlocks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <motion.div
      className="screen setup-screen"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <h2 className="screen-title">Create Your Trainer</h2>

      <div className="setup-form">
        <p className="setup-form__label">Choose Region</p>
        <div className="region-picker">
          {ALL_REGION_IDS.map((r) => {
            const unlocked = unlockedRegions.includes(r);
            const completed = cleared.includes(r);
            const selectedChip = regionChoice === r;
            return (
              <button
                key={r}
                type="button"
                className={[
                  'region-chip',
                  `region-chip--${r.toLowerCase()}`,
                  selectedChip ? 'region-chip--selected' : '',
                  !unlocked ? 'region-chip--locked' : '',
                  completed ? 'region-chip--cleared' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!unlocked}
                onClick={() => handleRegionChange(r)}
                title={!unlocked ? 'Beat the previous region first' : undefined}
              >
                <span className="region-chip__mark" aria-hidden="true" />
                <span className="region-chip__name">{r}</span>
                <span className="region-chip__meta">
                  {!unlocked ? 'Locked' : completed ? 'Cleared' : 'Available'}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={[
              'region-chip',
              'region-chip--random',
              regionChoice === 'random' ? 'region-chip--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={selectRandomRegion}
            title="Region stays secret until you start"
            disabled={unlockedRegions.length === 0}
          >
            <span className="region-chip__mark" aria-hidden="true" />
            <span className="region-chip__name">Random</span>
            <span className="region-chip__meta">
              {regionChoice === 'random' ? '??? until start' : 'Mystery pick'}
            </span>
          </button>
        </div>

        <p className="setup-form__label">Choose Your Trainer</p>
        <div className="trainer-picker">
          {trainers.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`trainer-card ${gender === t.id ? 'trainer-card--selected' : ''}`}
              onClick={() => {
                playSfx('click', muted);
                setGender(t.id);
              }}
            >
              <div
                className={`trainer-card__sprite-wrap${
                  regionChoice === 'random' ? ' trainer-card__sprite-wrap--mystery' : ''
                }`}
              >
                {regionChoice === 'random' ? (
                  <span className="trainer-card__mystery" aria-hidden="true">
                    ?
                  </span>
                ) : (
                  <img
                    src={t.sprite}
                    alt={t.label}
                    className="trainer-card__sprite"
                    onError={(e) => {
                      const filename = t.sprite.split('/').pop();
                      imgFallback(
                        e,
                        filename ? remoteTrainerSprite(filename) : undefined,
                        PLACEHOLDER_SPRITE,
                      );
                    }}
                  />
                )}
              </div>
              <span className="trainer-card__label">
                {regionChoice === 'random' ? (t.id === 'boy' ? 'Boy' : 'Girl') : t.label}
              </span>
              <span className="trainer-card__gender">
                {regionChoice === 'random' ? 'Trainer TBD' : t.id === 'boy' ? 'Boy' : 'Girl'}
              </span>
            </button>
          ))}
        </div>

        <label className="setup-form__label" htmlFor="trainer-name">
          Trainer Name
        </label>
        <input
          id="trainer-name"
          className="setup-form__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleStart();
          }}
          placeholder="Enter your name..."
          maxLength={12}
        />

        {runToggleUnlocks.length > 0 && (
          <>
            <p className="setup-form__label">
              Prestige Unlocks{' '}
              <span className="setup-form__label-hint">
                ({enabledUnlocks.filter((id) => runToggleUnlocks.some((u) => u.id === id)).length}/
                {runToggleUnlocks.length} on)
              </span>
            </p>
            <div className="setup-unlocks">
              {runToggleUnlocks.map((u) => {
                const on = enabledUnlocks.includes(u.id);
                const icon = PRESTIGE_UNLOCK_ICONS[u.id];
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`setup-unlock ${on ? 'setup-unlock--on' : ''}${
                      u.id === 'shinyCharmPlus' ? ' setup-unlock--gold-icon' : ''
                    }`}
                    onClick={() => toggleUnlock(u.id)}
                    aria-pressed={on}
                    title={u.description}
                  >
                    <img
                      src={icon}
                      alt=""
                      className="setup-unlock__icon"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                      }}
                    />
                    <span className="setup-unlock__name">{u.name}</span>
                    <span className={`setup-unlock__toggle${on ? ' setup-unlock__toggle--on' : ''}`}>
                      <span className="setup-unlock__knob" />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <p className="setup-form__region">
          Region: {regionChoice === 'random' ? '???' : regionChoice}
        </p>

        <button
          type="button"
          className="btn btn--primary"
          disabled={!name.trim()}
          onClick={handleStart}
        >
          Start Adventure!
        </button>
      </div>
    </motion.div>
  );
}
