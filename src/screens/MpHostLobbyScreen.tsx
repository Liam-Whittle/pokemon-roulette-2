import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { useMultiplayerStore } from '../multiplayer/useMultiplayerStore';
import { playSfx } from '../utils/sound';

export function MpHostLobbyScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);
  const hostOfferCode = useMultiplayerStore((s) => s.hostOfferCode);
  const hostAnswerInput = useMultiplayerStore((s) => s.hostAnswerInput);
  const setHostAnswerInput = useMultiplayerStore((s) => s.setHostAnswerInput);
  const connectionStatus = useMultiplayerStore((s) => s.connectionStatus);
  const connectionError = useMultiplayerStore((s) => s.connectionError);
  const acceptAnswer = useMultiplayerStore((s) => s.acceptAnswer);
  const startHost = useMultiplayerStore((s) => s.startHost);
  const resetMultiplayer = useMultiplayerStore((s) => s.resetMultiplayer);

  useEffect(() => {
    if (!hostOfferCode && connectionStatus === 'idle') {
      void startHost();
    }
  }, [hostOfferCode, connectionStatus, startHost]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setScreen('setup');
    }
  }, [connectionStatus, setScreen]);

  const copyOffer = async () => {
    playSfx('click', muted);
    try {
      await navigator.clipboard.writeText(hostOfferCode);
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
      <h2 className="screen-title">Host Multiplayer</h2>
      <p className="mp-lobby-screen__hint">
        Send the host code to your friend. When they send back an answer code, paste it below.
      </p>

      <label className="mp-lobby-screen__label" htmlFor="host-offer">
        Your host code
      </label>
      <textarea
        id="host-offer"
        className="mp-lobby-screen__code"
        readOnly
        value={hostOfferCode || 'Generating code…'}
        rows={6}
      />
      <button
        type="button"
        className="btn btn--primary"
        disabled={!hostOfferCode}
        onClick={() => void copyOffer()}
      >
        Copy host code
      </button>

      <label className="mp-lobby-screen__label" htmlFor="host-answer">
        Friend&apos;s answer code
      </label>
      <textarea
        id="host-answer"
        className="mp-lobby-screen__code"
        value={hostAnswerInput}
        onChange={(e) => setHostAnswerInput(e.target.value)}
        placeholder="Paste answer code here…"
        rows={6}
      />

      {connectionError && <p className="mp-lobby-screen__error">{connectionError}</p>}
      <p className="mp-lobby-screen__status">
        Status:{' '}
        {connectionStatus === 'connected'
          ? 'Connected!'
          : connectionStatus === 'connecting'
            ? 'Connecting…'
            : connectionStatus === 'waiting-answer'
              ? 'Waiting for answer code…'
              : connectionStatus === 'creating-offer'
                ? 'Creating offer…'
                : connectionStatus}
      </p>

      <div className="mp-lobby-screen__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!hostAnswerInput.trim() || connectionStatus === 'connecting'}
          onClick={() => {
            playSfx('click', muted);
            void acceptAnswer();
          }}
        >
          Connect
        </button>
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
      </div>
    </motion.div>
  );
}
