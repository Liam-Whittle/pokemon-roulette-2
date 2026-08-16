import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CatchScreen } from './CatchScreen';
import { EncounterWipe } from '../components/EncounterWipe';
import { MISSINGNO_DATA } from '../data/missingno';
import { useGameStore } from '../store/useGameStore';
import { asset } from '../utils/asset';
import { parseGifDurationMs } from '../utils/gifDuration';
import { MISSINGNO_CRY_VOLUME_SCALE, playClip, setMusicTrack, stopClip } from '../utils/music';

const SEARCH_GIF = asset('img/missingno_search.gif');
const FALLBACK_MS = 60_000;

type Phase = 'search' | 'wipe' | 'catch';

/**
 * Cinnabar Island easter-egg: surf search GIF → encounter wipe → MissingNo catch.
 */
export function MissingNoScreen() {
  const setCurrentPokemon = useGameStore((s) => s.setCurrentPokemon);
  const [phase, setPhase] = useState<Phase>('search');
  const [frozen, setFrozen] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const [gifSrc, setGifSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgLoadedRef = useRef(false);
  const loadedAtRef = useRef<number | null>(null);
  const durationMsRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const cryRef = useRef<HTMLAudioElement | null>(null);
  const doneRef = useRef(false);
  const armRef = useRef<() => void>(() => {});

  useEffect(() => {
    setMusicTrack('cinnabar');

    let unmounted = false;
    let objectUrl: string | null = null;

    const finishSearch = () => {
      if (unmounted || doneRef.current) return;
      doneRef.current = true;

      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (img && canvas && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
      }
      setFrozen(true);
      setPhase('wipe');
      cryRef.current = playClip(asset('sounds/missingno_cry.mp3'), MISSINGNO_CRY_VOLUME_SCALE);

      setCurrentPokemon(MISSINGNO_DATA);
      useGameStore.setState({
        currentActivity: 'wild',
        currentEncounterId: MISSINGNO_DATA.id,
      });
    };

    const armIfReady = () => {
      if (unmounted || doneRef.current) return;
      if (!imgLoadedRef.current || durationMsRef.current == null) return;
      const elapsed = loadedAtRef.current != null ? Date.now() - loadedAtRef.current : 0;
      const remaining = Math.max(0, durationMsRef.current - elapsed);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(finishSearch, remaining);
    };
    armRef.current = armIfReady;

    void fetch(SEARCH_GIF)
      .then((res) => {
        if (!res.ok) throw new Error('gif fetch failed');
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (unmounted) return;
        const bytes = new Uint8Array(buf);
        const ms = parseGifDurationMs(bytes);
        durationMsRef.current = ms != null && ms > 0 ? ms : FALLBACK_MS;
        objectUrl = URL.createObjectURL(new Blob([buf], { type: 'image/gif' }));
        setGifSrc(objectUrl);
        armIfReady();
      })
      .catch(() => {
        if (unmounted) return;
        durationMsRef.current = FALLBACK_MS;
        setGifSrc(SEARCH_GIF);
        armIfReady();
      });

    return () => {
      unmounted = true;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      stopClip(cryRef.current);
      cryRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [setCurrentPokemon]);

  useEffect(() => {
    if (phase !== 'search') return;
    const id = window.setInterval(() => {
      setDotCount((n) => (n % 3) + 1);
    }, 420);
    return () => window.clearInterval(id);
  }, [phase]);

  function enterCatch() {
    stopClip(cryRef.current);
    cryRef.current = null;
    setMusicTrack('missingnoCatch');
    setPhase('catch');
  }

  if (phase === 'catch') {
    return <CatchScreen variant="missingno" />;
  }

  return (
    <motion.div
      className="screen missingno-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="battle-modal__backdrop missingno-search-backdrop">
        <div className="battle-modal hub-notice-modal missingno-search-modal">
          <h3 className="battle-modal__title">Cinnabar Island</h3>
          <div className="missingno-catch-gif-wrap">
            {!frozen && gifSrc && (
              <img
                ref={imgRef}
                src={gifSrc}
                alt="Surfing near Cinnabar Island"
                className="missingno-catch-gif"
                onLoad={() => {
                  imgLoadedRef.current = true;
                  loadedAtRef.current = Date.now();
                  armRef.current();
                }}
              />
            )}
            {!frozen && !gifSrc && <p className="loading">Loading…</p>}
            <canvas
              ref={canvasRef}
              className="missingno-catch-gif"
              hidden={!frozen}
              aria-label={frozen ? 'Surfing near Cinnabar Island' : undefined}
            />
          </div>
          {phase === 'search' && (
            <p className="missingno-surfing" aria-live="polite">
              Surfing{'.'.repeat(dotCount)}
            </p>
          )}
        </div>
      </div>

      {phase === 'wipe' && <EncounterWipe onDone={enterCatch} />}
    </motion.div>
  );
}
