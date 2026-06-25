import { useGameStore } from '../store/useGameStore';

export function VolumeSlider() {
  const musicVolume = useGameStore((state) => state.musicVolume);
  const setMusicVolume = useGameStore((state) => state.setMusicVolume);

  return (
    <label className="volume-slider" aria-label="Music volume">
      <span className="volume-slider__icon">♫</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={musicVolume}
        onChange={(event) => setMusicVolume(Number(event.target.value))}
      />
    </label>
  );
}
