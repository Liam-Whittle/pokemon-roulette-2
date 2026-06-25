import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import type { TrainerPreset } from '../types/game';

const TRAINERS: TrainerPreset[] = [
  {
    id: 'boy',
    label: 'Red',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/red-gen3.png',
  },
  {
    id: 'girl',
    label: 'Leaf',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/leaf-gen3.png',
  },
];

export function TrainerSetup() {
  const setTrainer = useGameStore((s) => s.setTrainer);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<TrainerPreset>(TRAINERS[0]);

  const handleStart = () => {
    if (!name.trim()) return;
    playSfx('click', muted);
    setTrainer({
      name: name.trim(),
      avatar: selected.sprite,
      gender: selected.id,
      region: 'Kanto',
    });
    setScreen('starter');
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
        <p className="setup-form__label">Choose Your Trainer</p>
        <div className="trainer-picker">
          {TRAINERS.map((t) => (
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
                    (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
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
          placeholder="Enter your name..."
          maxLength={12}
        />

        <p className="setup-form__region">Region: Kanto 🗾</p>

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
