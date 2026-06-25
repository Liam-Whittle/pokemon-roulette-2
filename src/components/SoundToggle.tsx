import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

export function SoundToggle() {
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);

  return (
    <button
      type="button"
      className="sound-toggle"
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={() => {
        setMuted(!muted);
        if (muted) playSfx('click', false);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
