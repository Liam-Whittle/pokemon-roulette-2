import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store/useGameStore';
import { SoundToggle } from './components/SoundToggle';
import { VolumeSlider } from './components/VolumeSlider';
import { SettingsMenu } from './components/SettingsMenu';
import { MusicPrompt } from './components/MusicPrompt';
import { TitleScreen } from './screens/TitleScreen';
import { TrainerSetup } from './screens/TrainerSetup';
import { StarterScreen } from './screens/StarterScreen';
import { HubScreen } from './screens/HubScreen';
import { CatchScreen } from './screens/CatchScreen';
import { FishingScreen } from './screens/FishingScreen';
import { FossilScreen } from './screens/FossilScreen';
import { CaveScreen } from './screens/CaveScreen';
import { ItemScreen } from './screens/ItemScreen';
import { GymBattleScreen } from './screens/GymBattleScreen';
import { EliteFourScreen } from './screens/EliteFourScreen';
import { PokedexScreen } from './screens/PokedexScreen';
import { PartyScreen } from './screens/PartyScreen';
import { BagScreen } from './screens/BagScreen';
import { ChampionScreen } from './screens/ChampionScreen';
import { ChadpionScreen } from './screens/ChadpionScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { HallOfChampionsScreen } from './screens/HallOfChampionsScreen';
import { ShopScreen } from './screens/ShopScreen';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { primeMusic, unlockMusic, setMusicMuted, setMusicTrack, setMusicVolume } from './utils/music';
import { asset } from './utils/asset';
import './styles/global.css';

function ScreenRouter() {
  const screen = useGameStore((s) => s.screen);

  switch (screen) {
    case 'title':
      return <TitleScreen key="title" />;
    case 'setup':
      return <TrainerSetup key="setup" />;
    case 'starter':
      return <StarterScreen key="starter" />;
    case 'hub':
      return <HubScreen key="hub" />;
    case 'catch':
      return <CatchScreen key="catch" />;
    case 'fishing':
      return <FishingScreen key="fishing" />;
    case 'fossil':
      return <FossilScreen key="fossil" />;
    case 'cave':
      return <CaveScreen key="cave" />;
    case 'item':
      return <ItemScreen key="item" />;
    case 'gym':
      return <GymBattleScreen key="gym" />;
    case 'elite':
      return <EliteFourScreen key="elite" />;
    case 'pokedex':
      return <PokedexScreen key="pokedex" />;
    case 'party':
      return <PartyScreen key="party" />;
    case 'bag':
      return <BagScreen key="bag" />;
    case 'champion':
      return <ChampionScreen key="champion" />;
    case 'chadpion':
      return <ChadpionScreen key="chadpion" />;
    case 'gameover':
      return <GameOverScreen key="gameover" />;
    case 'hall':
      return <HallOfChampionsScreen key="hall" />;
    case 'shop':
      return <ShopScreen key="shop" />;
    case 'coming-soon':
      return <ComingSoonScreen key="coming-soon" />;
    default:
      return <TitleScreen key="title-fallback" />;
  }
}

export default function App() {
  const muted = useGameStore((s) => s.muted);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const setMuted = useGameStore((s) => s.setMuted);
  const screen = useGameStore((s) => s.screen);
  const currentActivity = useGameStore((s) => s.currentActivity);
  const [showMusicPrompt, setShowMusicPrompt] = useState(true);
  const bgRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Parallax is only active on the title screen.
    if (screen !== 'title') {
      target.current = { x: 0, y: 0 };
      current.current = { x: 0, y: 0 };
      if (bgRef.current) bgRef.current.style.transform = 'scale(1.12) translate3d(0, 0, 0)';
      return;
    }

    const MAX = 60;
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * -2 * MAX;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * -2 * MAX;
    };

    let raf = 0;
    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.x += (t.x - c.x) * 0.08;
      c.y += (t.y - c.y) * 0.08;
      if (bgRef.current) {
        bgRef.current.style.transform = `scale(1.12) translate3d(${c.x}px, ${c.y}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [screen]);

  useEffect(() => {
    // Start the track muted right away (allowed by browsers), then unmute it
    // on the first user interaction so it's audible as early as possible.
    primeMusic();
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    const cleanup = () => events.forEach((e) => window.removeEventListener(e, onGesture));
    const onGesture = () => {
      unlockMusic();
      cleanup();
    };
    events.forEach((e) => window.addEventListener(e, onGesture));
    return cleanup;
  }, []);

  useEffect(() => {
    setMusicMuted(muted);
  }, [muted]);

  useEffect(() => {
    setMusicVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    if (screen === 'gym') {
      setMusicTrack('gym');
    } else if (screen === 'elite') {
      setMusicTrack('elite4');
    } else if (screen === 'champion' || screen === 'chadpion') {
      setMusicTrack('gamewin');
    } else if (screen === 'gameover') {
      setMusicTrack('gamelose');
    } else if (screen === 'title' || screen === 'hall' || screen === 'shop') {
      setMusicTrack('title');
    } else if (screen === 'catch' || screen === 'fishing' || screen === 'fossil' || screen === 'cave') {
      setMusicTrack('pokemon');
    } else {
      setMusicTrack('main');
    }
  }, [screen]);

  // On the catch screen, match the background to the activity that triggered the
  // encounter (fishing/fossil/cave) instead of always showing the main hub art.
  const catchBg =
    currentActivity === 'fishing'
      ? asset('img/fishing.jpg')
      : currentActivity === 'cave' || currentActivity === 'fossil'
        ? asset('img/cave.jpg')
        : asset('img/main.jpg');

  const bgImage =
    screen === 'gym' || screen === 'elite' || screen === 'champion' || screen === 'chadpion' || screen === 'gameover'
      ? asset('img/battle.jpg')
      : screen === 'title' || screen === 'hall'
        ? asset('img/title.jpg')
        : screen === 'fishing'
          ? asset('img/fishing.jpg')
          : screen === 'cave' || screen === 'fossil'
            ? asset('img/cave.jpg')
            : screen === 'catch'
              ? catchBg
              : asset('img/main.jpg');

  return (
    <div className="app">
      <div
        ref={bgRef}
        className="app-bg"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url('${bgImage}')`,
        }}
      />
      <div className="app-controls">
        <VolumeSlider />
        <SettingsMenu />
        <SoundToggle />
      </div>
      <AnimatePresence mode="wait">
        <ScreenRouter />
      </AnimatePresence>
      <AnimatePresence>
        {showMusicPrompt && (
          <MusicPrompt
            key="music-prompt"
            onEnable={() => {
              setMuted(false);
              unlockMusic();
              setShowMusicPrompt(false);
            }}
            onDecline={() => {
              setMuted(true);
              setShowMusicPrompt(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
