import { useEffect, useRef, useState } from 'react';
import { asset } from '../utils/asset';
import { getGifDurationMs } from '../utils/gifDuration';
import { fadeOutClip, playClip, resumeMusic, stopClip, stopMusic } from '../utils/music';

const GIF_SRC = asset('img/old_man_catch.gif');
const AUDIO_SRC = asset('sounds/oldman_catch.mp3');
/** Fallback if GIF duration cannot be parsed. */
const FALLBACK_MS = 45_000;
const CATCH_FADE_MS = 1200;

interface OldManCatchTutorialProps {
  onContinue: () => void;
}

/** MissingNo dialogue step: play old-man catch GIF + audio over hub music. */
export function OldManCatchTutorial({ onContinue }: OldManCatchTutorialProps) {
  const [continueReady, setContinueReady] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [gifSrc] = useState(() => `${GIF_SRC}?t=${Date.now()}`);
  const clipRef = useRef<HTMLAudioElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgLoadedRef = useRef(false);
  const loadedAtRef = useRef<number | null>(null);
  const durationMsRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const armRef = useRef<() => void>(() => {});

  useEffect(() => {
    // pause() keeps currentTime so hub music resumes mid-track.
    stopMusic();
    clipRef.current = playClip(AUDIO_SRC);

    let cancelled = false;
    let hubResumed = false;

    const ensureHubMusic = () => {
      if (hubResumed) return;
      hubResumed = true;
      resumeMusic();
    };

    const finishPlayback = () => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;

      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (img && canvas && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }

      // Unmount the <img> so the browser stops looping the GIF.
      setFrozen(true);
      setContinueReady(true);

      const clip = clipRef.current;
      clipRef.current = null;
      void fadeOutClip(clip, CATCH_FADE_MS).then(() => {
        if (!cancelled) ensureHubMusic();
      });
    };

    const armIfReady = () => {
      if (cancelled || doneRef.current) return;
      if (!imgLoadedRef.current || durationMsRef.current == null) return;
      const elapsed = loadedAtRef.current != null ? Date.now() - loadedAtRef.current : 0;
      const remaining = Math.max(0, durationMsRef.current - elapsed);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(finishPlayback, remaining);
    };
    armRef.current = armIfReady;

    void getGifDurationMs(GIF_SRC).then((ms) => {
      if (cancelled) return;
      durationMsRef.current = ms != null && ms > 0 ? ms : FALLBACK_MS;
      armIfReady();
    });

    return () => {
      cancelled = true;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      stopClip(clipRef.current);
      clipRef.current = null;
      ensureHubMusic();
    };
  }, []);

  return (
    <>
      <p className="hub-notice-modal__text">I&apos;ll show you how to then</p>
      <div className="missingno-catch-gif-wrap">
        {!frozen && (
          <img
            ref={imgRef}
            src={gifSrc}
            alt="Old man catching a Pokémon"
            className="missingno-catch-gif"
            onLoad={() => {
              imgLoadedRef.current = true;
              loadedAtRef.current = Date.now();
              armRef.current();
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          className="missingno-catch-gif"
          hidden={!frozen}
          aria-label={frozen ? 'Old man catching a Pokémon' : undefined}
        />
      </div>
      {continueReady && (
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          Continue
        </button>
      )}
    </>
  );
}
