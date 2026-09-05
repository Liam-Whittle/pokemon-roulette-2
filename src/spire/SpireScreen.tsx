import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CharacterSelectView } from './views/CharacterSelectView';
import { BlessingView } from './views/BlessingView';
import { MapView } from './views/MapView';
import { CombatView } from './views/CombatView';
import { AcquireModal } from './components/AcquireModal';
import { EventView, RestView, RewardsView, RunOverView, ShopView, TreasureView } from './views/MetaViews';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { useSpireStore } from './store/useSpireStore';
import './spire.css';

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22 },
};

export function SpireScreen() {
  const run = useSpireStore((s) => s.run);
  const startNewRun = useSpireStore((s) => s.startNewRun);
  const muted = useGameStore((s) => s.muted);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (!run) startNewRun();
  }, [run, startNewRun]);

  useEffect(() => {
    document.body.classList.toggle('spire-map-preview-open', mapOpen);
    return () => document.body.classList.remove('spire-map-preview-open');
  }, [mapOpen]);

  const view = run?.view ?? 'select';
  const showMapBtn =
    !!run?.map &&
    view !== 'select' &&
    view !== 'blessing' &&
    view !== 'victory' &&
    view !== 'defeat' &&
    view !== 'map';

  return (
    <motion.div className="screen spire-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {showMapBtn && (
        <button
          type="button"
          className="btn btn--sm spire-map-preview-btn"
          onClick={() => {
            playSfx('click', muted);
            setMapOpen(true);
          }}
        >
          Map
        </button>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={view} className="spire-screen__stage" {...fade}>
          {view === 'select' && <CharacterSelectView />}
          {view === 'blessing' && <BlessingView />}
          {view === 'map' && <MapView />}
          {view === 'combat' && <CombatView />}
          {view === 'rewards' && <RewardsView />}
          {view === 'shop' && <ShopView />}
          {view === 'rest' && <RestView />}
          {view === 'event' && <EventView />}
          {view === 'treasure' && <TreasureView />}
          {view === 'victory' && <RunOverView victory />}
          {view === 'defeat' && <RunOverView victory={false} />}
        </motion.div>
      </AnimatePresence>
      {mapOpen && run?.map && (
        <div className="spire-map-preview" role="dialog" aria-label="Map preview">
          <button
            type="button"
            className="btn btn--sm spire-map-preview__close"
            onClick={() => {
              playSfx('click', muted);
              setMapOpen(false);
            }}
          >
            Close map
          </button>
          <MapView preview />
        </div>
      )}
      <AcquireModal />
    </motion.div>
  );
}
