import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { playSfx } from '../utils/sound';

export function MpJoinScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const joinOfferInput = useMultiplayerStore((s) => s.joinOfferInput);
  const setJoinOfferInput = useMultiplayerStore((s) => s.setJoinOfferInput);
  const guestAnswerCode = useMultiplayerStore((s) => s.guestAnswerCode);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const connectionError = useMultiplayerStore((s) => s.connectionError);
  const startJoin = useMultiplayerStore((s) => s.startJoin);
  const resetMultiplayer = useMultiplayerStore((s) => s.resetMultiplayer);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setScreen('mp-guest');
    }
  }, [connectionStatus, setScreen]);

  const copyAnswer = async () => {
    playSfx('click', muted);
    try {
      await navigator.clipboard.writeText(guestAnswerCode);
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      className="screen mp-lobby-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="screen-title">Join Multiplayer</h2>
      <p className="mp-lobby-screen__hint">
        Paste your friend&apos;s host code, then send them the answer code you get back.
      </p>

      <label className="mp-lobby-screen__label" htmlFor="join-offer">
        Host code
      </label>
      <textarea
        id="join-offer"
        className="mp-lobby-screen__code"
        value={joinOfferInput}
        onChange={(e) => setJoinOfferInput(e.target.value)}
        placeholder="Paste host code here…"
        rows={6}
        disabled={!!guestAnswerCode}
      />

      {!guestAnswerCode ? (
        <button
          type="button"
          className="btn btn--primary"
          disabled={!joinOfferInput.trim()}
          onClick={() => {
            playSfx('click', muted);
            void startJoin();
          }}
        >
          Generate answer code
        </button>
      ) : (
        <>
          <label className="mp-lobby-screen__label" htmlFor="guest-answer">
            Your answer code (send to host)
          </label>
          <textarea
            id="guest-answer"
            className="mp-lobby-screen__code"
            readOnly
            value={guestAnswerCode}
            rows={6}
          />
          <button type="button" className="btn btn--primary" onClick={() => void copyAnswer()}>
            Copy answer code
          </button>
          <p className="mp-lobby-screen__hint">
            Waiting for the host to paste your answer and connect…
          </p>
        </>
      )}

      {connectionError && <p className="mp-lobby-screen__error">{connectionError}</p>}
      <p className="mp-lobby-screen__status">Status: {connectionStatus}</p>

      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          playSfx('click', muted);
          resetMultiplayer();
          setScreen('title');
        }}
      >
        Cancel
      </button>
    </motion.div>
  );
}
