import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { imgFallback, remoteTrainerSprite } from '../utils/localAssets';
import { localTrainerSprite } from '../utils/localAssets';
import type { TrainerPreset } from '../types/game';

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

export function TrainerSetup() {
  const setTrainer = useGameStore((s) => s.setTrainer);
  const setCatchGamemode = useGameStore((s) => s.setCatchGamemode);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const [region, setRegion] = useState<'Kanto' | 'Johto'>('Kanto');
  const trainers = region === 'Johto' ? JOHTO_TRAINERS : KANTO_TRAINERS;
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<TrainerPreset>(KANTO_TRAINERS[0]);

  const handleStart = () => {
    if (!name.trim()) return;
    playSfx('click', muted);
    setTrainer({
      name: name.trim(),
      avatar: selected.sprite,
      gender: selected.id,
      region,
    });
    setCatchGamemode('chance');
    setScreen('starter');
  };

  const handleRegionChange = (nextRegion: 'Kanto' | 'Johto') => {
    playSfx('click', muted);
    setRegion(nextRegion);
    setSelected(nextRegion === 'Johto' ? JOHTO_TRAINERS[0] : KANTO_TRAINERS[0]);
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
        <div className="trainer-picker">
          <button
            type="button"
            className={`trainer-card ${region === 'Kanto' ? 'trainer-card--selected' : ''}`}
            onClick={() => handleRegionChange('Kanto')}
          >
            <span className="trainer-card__label">Kanto</span>
          </button>
          <button
            type="button"
            className={`trainer-card ${region === 'Johto' ? 'trainer-card--selected' : ''}`}
            onClick={() => handleRegionChange('Johto')}
          >
            <span className="trainer-card__label">Johto</span>
          </button>
        </div>

        <p className="setup-form__label">Choose Your Trainer</p>
        <div className="trainer-picker">
          {trainers.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`trainer-card ${selected.id === t.id ? 'trainer-card--selected' : ''}`}
              onClick={() => {
                playSfx('click', muted);
                setSelected(t);
              }}
            >
              <div className="trainer-card__sprite-wrap">
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
              </div>
              <span className="trainer-card__label">{t.label}</span>
              <span className="trainer-card__gender">{t.id === 'boy' ? 'Boy' : 'Girl'}</span>
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

        <p className="setup-form__region">Region: {region} 🗾</p>

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
