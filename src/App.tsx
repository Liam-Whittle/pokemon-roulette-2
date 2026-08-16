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
import { TeamRocketScreen } from './screens/TeamRocketScreen';
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
import { PrestigeShopScreen } from './screens/PrestigeShopScreen';
import { GlobalPokedexScreen } from './screens/GlobalPokedexScreen';
import { TrainerBattleScreen } from './screens/TrainerBattleScreen';
import { RivalBattleScreen } from './screens/RivalBattleScreen';
import { GiovanniScreen } from './screens/GiovanniScreen';
import { GameCornerScreen } from './screens/GameCornerScreen';
import { DailyEncounterScreen } from './screens/DailyEncounterScreen';
import { MissingNoScreen } from './screens/MissingNoScreen';
import { HardcoreDraftScreen } from './screens/HardcoreDraftScreen';
import { MpHostLobbyScreen } from './screens/MpHostLobbyScreen';
import { MpJoinScreen } from './screens/MpJoinScreen';
import { MpGuestScreen } from './screens/MpGuestScreen';
import { HostSync } from './multiplayer/HostSync';
import { MpOverlay } from './components/MpOverlay';
import { MetaAnimatedBg } from './components/MetaAnimatedBg';
import { primeMusic, unlockMusic, setMusicMuted, setMusicTrack, setMusicVolume } from './utils/music';
import { asset } from './utils/asset';
import './styles/global.css';
import { resolveRegionId } from './data/pools';

function ScreenRouter() {
  const screen = useGameStore((s) => s.screen);

  switch (screen) {
    case 'title':
      return <TitleScreen key="title" />;
    case 'mp-host-lobby':
      return <MpHostLobbyScreen key="mp-host-lobby" />;
    case 'mp-join':
      return <MpJoinScreen key="mp-join" />;
    case 'mp-guest':
      return <MpGuestScreen key="mp-guest" />;
    case 'setup':
      return <TrainerSetup key="setup" />;
    case 'starter':
      return <StarterScreen key="starter" />;
    case 'hardcore-draft':
      return <HardcoreDraftScreen key="hardcore-draft" />;
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
    case 'teamrocket':
      return <TeamRocketScreen key="teamrocket" />;
    case 'trainerbattle':
      return <TrainerBattleScreen key="trainerbattle" />;
    case 'rivalbattle':
      return <RivalBattleScreen key="rivalbattle" />;
    case 'giovanni':
      return <GiovanniScreen key="giovanni" />;
    case 'elite':
      return <EliteFourScreen key="elite" />;
    case 'pokedex':
      return <PokedexScreen key="pokedex" />;
    case 'global-pokedex':
      return <GlobalPokedexScreen key="global-pokedex" />;
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
    case 'prestige':
      return <PrestigeShopScreen key="prestige" />;
    case 'gamecorner':
      return <GameCornerScreen key="gamecorner" />;
    case 'daily':
      return <DailyEncounterScreen key="daily" />;
    case 'missingno':
      return <MissingNoScreen key="missingno" />;
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
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const [showMusicPrompt, setShowMusicPrompt] = useState(true);
  const ensurePartyInstanceFields = useGameStore((s) => s.ensurePartyInstanceFields);
  const bgRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    ensurePartyInstanceFields();
  }, [ensurePartyInstanceFields]);

  useEffect(() => {
    // Parallax is only active on the title screen (same base scale as other screens).
    if (screen !== 'title') {
      target.current = { x: 0, y: 0 };
      current.current = { x: 0, y: 0 };
      if (bgRef.current) bgRef.current.style.transform = '';
      return;
    }

    const MAX = 40;
    const SCALE = 1.12;
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
        bgRef.current.style.transform = `scale(${SCALE}) translate3d(${c.x}px, ${c.y}px, 0)`;
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

  const isMetaMenu =
    screen === 'prestige' || screen === 'global-pokedex' || screen === 'daily';
  const isHallMeta = screen === 'hall';
  const isGiovanniMeta = screen === 'giovanni';
  const usesMetaBg = isMetaMenu || isHallMeta || isGiovanniMeta;

  useEffect(() => {
    if (screen === 'teamrocket') {
      setMusicTrack(region === 'Hoenn' ? 'teamaqua' : 'teamrocket');
    } else if (screen === 'giovanni') {
      setMusicTrack('giovanni');
    } else if (screen === 'trainerbattle') {
      setMusicTrack('trainerBattle');
    } else if (screen === 'rivalbattle') {
      setMusicTrack('rivalBattle');
    } else if (screen === 'gym') {
      setMusicTrack('gym');
    } else if (screen === 'elite') {
      setMusicTrack('elite4');
    } else if (screen === 'champion' || screen === 'chadpion') {
      setMusicTrack('gamewin');
    } else if (screen === 'gameover') {
      setMusicTrack('gamelose');
    } else if (screen === 'shop') {
      setMusicTrack('pokemart');
    } else if (screen === 'gamecorner') {
      setMusicTrack('gamecorner');
    } else if (screen === 'missingno') {
      // Intro uses cinnabar; MissingNoScreen switches to missingnoCatch for the fight.
      setMusicTrack('cinnabar');
    } else if (isMetaMenu) {
      // Shared track across Prestige / Global Pokédex / Daily — keeps playing on switch.
      setMusicTrack('titleExtra');
    } else if (screen === 'title' || screen === 'hall') {
      setMusicTrack('title');
    } else if (screen === 'setup' || screen === 'starter' || screen === 'hardcore-draft') {
      // Keep create_trainer.mp3 through starter / hardcore draft pick.
      setMusicTrack('createTrainer');
    } else if (screen === 'catch' || screen === 'fishing' || screen === 'fossil' || screen === 'cave') {
      setMusicTrack('pokemon');
    } else if (screen === 'hub') {
      setMusicTrack(
        region === 'Hoenn' ? 'hoenn' : region === 'Johto' ? 'johto' : 'kanto',
      );
    } else {
      setMusicTrack('main');
    }
  }, [screen, region, isMetaMenu]);

  const hubBg = asset(region === 'Hoenn' ? 'img/hoenn.png' : 'img/main.png');

  // On the catch screen, match the background to the activity that triggered the
  // encounter (fishing/fossil/cave) instead of always showing the main hub art.
  const catchBg =
    currentActivity === 'fishing'
      ? asset('img/fishing.png')
      : currentActivity === 'cave'
        ? asset('img/cave.png')
        : currentActivity === 'fossil'
          ? asset('img/fossil.png')
          : hubBg;

  const bgImage =
    screen === 'teamrocket'
      ? asset(region === 'Hoenn' ? 'img/team_aqua.png' : 'img/team_rocket.png')
      : screen === 'gym' || screen === 'champion' || screen === 'chadpion'
        ? asset('img/battle_day.png')
        : screen === 'elite'
          ? asset('img/battle_night.png')
          : screen === 'gameover'
            ? asset('img/defeat.png')
            : screen === 'title'
              ? asset('img/title.jpg')
              : screen === 'shop'
                ? asset('img/pokemart.png')
                : screen === 'gamecorner'
                  ? asset('img/game_corner.png')
                  : screen === 'fishing'
                    ? asset('img/fishing.png')
                    : screen === 'cave'
                      ? asset('img/cave.png')
                      : screen === 'fossil'
                        ? asset('img/fossil.png')
                        : screen === 'catch'
                          ? catchBg
                          : screen === 'hub'
                            ? hubBg
                            : asset('img/main.png');

  const isFossilBg = screen === 'fossil' || (screen === 'catch' && currentActivity === 'fossil');
  const isHoennHub = screen === 'hub' && region === 'Hoenn';
  const overlayTop =
    isHoennHub
      ? 0.40
      : screen === 'cave'
        ? 0.25
        : screen === 'gamecorner'
          ? 0.35
          : screen === 'elite'
            ? 0.52
            : screen === 'shop'
              ? 0.4
              : isFossilBg
                ? 0.35
                : 0.55;
  const overlayBottom =
    isHoennHub
      ? 0.10
      : screen === 'elite'
        ? 0.4
        : screen === 'shop' || screen === 'cave' || screen === 'gamecorner'
          ? 0.25
          : isFossilBg
            ? 0.35
            : 0.55;

  const isTitleBg = screen === 'title';
  const titleOverlayTop = isTitleBg ? 0.35 : overlayTop;
  const titleOverlayBottom = isTitleBg ? 0.4 : overlayBottom;

  const metaBgClass =
    screen === 'prestige'
      ? 'app-bg--meta app-bg--prestige'
      : screen === 'global-pokedex'
        ? 'app-bg--meta app-bg--pokedex'
        : screen === 'daily'
          ? 'app-bg--meta app-bg--daily'
          : screen === 'hall'
            ? 'app-bg--meta app-bg--hall'
            : screen === 'giovanni'
              ? 'app-bg--meta app-bg--giovanni'
              : isTitleBg
                ? 'app-bg--title'
                : isHoennHub
                  ? 'app-bg--hub'
                  : '';

  return (
    <div className="app">
      <div
        ref={bgRef}
        className={`app-bg ${metaBgClass}`.trim()}
        style={
          usesMetaBg
            ? undefined
            : {
                backgroundImage: `linear-gradient(rgba(0, 0, 0, ${titleOverlayTop}), rgba(0, 0, 0, ${titleOverlayBottom})), url('${bgImage}')`,
              }
        }
      >
        {screen === 'prestige' && <MetaAnimatedBg variant="prestige" />}
        {screen === 'global-pokedex' && <MetaAnimatedBg variant="pokedex" />}
        {screen === 'daily' && <MetaAnimatedBg variant="daily" />}
        {screen === 'hall' && <MetaAnimatedBg variant="hall" />}
        {screen === 'giovanni' && <MetaAnimatedBg variant="giovanni" />}
      </div>
      <div className="app-controls">
        <VolumeSlider />
        <SettingsMenu />
        <SoundToggle />
      </div>
      <AnimatePresence mode="wait">
        <ScreenRouter />
      </AnimatePresence>
      <HostSync />
      <MpOverlay />
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
