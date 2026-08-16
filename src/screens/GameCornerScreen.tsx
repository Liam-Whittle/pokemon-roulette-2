import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { getCachedSpecies } from '../data/speciesCache';
import { getRegionAllPokemonPool, getStoneItemIdsForRegion, ITEMS, pickRandom, resolveRegionId } from '../data/pools';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { PLACEHOLDER_SPRITE } from '../utils/asset';
import { localPokemonSprite } from '../utils/localAssets';
import type { PokemonData } from '../types/game';

const REEL_COUNT = 5;
const SPIN_TICK_MS = 70;
const REEL_STOP_BASE_MS = 900;
const REEL_STOP_STAGGER_MS = 420;
const BET_STEPS = [1, 5, 10, 25, 50, 100] as const;

function speciesDisplayName(id: number): string {
  const name = getCachedSpecies(id)?.name;
  if (!name) return `#${String(id).padStart(3, '0')}`;
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (_, c: string) => ` ${c.toUpperCase()}`);
}

type ReelView = {
  displayId: number | null;
  mon: PokemonData | null;
  spinning: boolean;
  win: boolean;
};

function emptyReels(): ReelView[] {
  return Array.from({ length: REEL_COUNT }, () => ({
    displayId: null,
    mon: null,
    spinning: false,
    win: false,
  }));
}

export function GameCornerScreen() {
  const region = useGameStore((s) => resolveRegionId(s.trainer?.region));
  const money = useGameStore((s) => s.money);
  const spendMoney = useGameStore((s) => s.spendMoney);
  const addMoney = useGameStore((s) => s.addMoney);
  const addItem = useGameStore((s) => s.addItem);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const pool = useMemo(() => getRegionAllPokemonPool(region), [region]);
  const poolOptions = useMemo(
    () =>
      pool
        .map((id) => ({ id, name: speciesDisplayName(id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [pool],
  );
  const [guessId, setGuessId] = useState<number | null>(null);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<ReelView[]>(() => emptyReels());
  const [result, setResult] = useState<string | null>(null);
  const [jackpot, setJackpot] = useState(false);
  const [stonePickOpen, setStonePickOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const stones = getStoneItemIdsForRegion(region);
  const spinTimers = useRef<number[]>([]);
  const pickMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      for (const id of spinTimers.current) {
        window.clearTimeout(id);
        window.clearInterval(id);
      }
      spinTimers.current = [];
    };
  }, []);

  useEffect(() => {
    if (!pickOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!pickMenuRef.current?.contains(e.target as Node)) setPickOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickOpen]);

  const guessSprite = guessId != null ? localPokemonSprite(guessId) : null;
  const guessName = guessId != null ? speciesDisplayName(guessId) : null;
  const canSpin = guessId != null && bet > 0 && bet <= money && !spinning;

  function adjustBet(delta: number) {
    setBet((prev) => Math.min(money, Math.max(1, prev + delta)));
  }

  function clearSpinTimers() {
    for (const id of spinTimers.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    spinTimers.current = [];
  }

  function schedule(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    spinTimers.current.push(id);
    return id;
  }

  async function lockIn() {
    if (!canSpin || guessId == null) return;
    if (!spendMoney(bet)) return;

    clearSpinTimers();
    playSfx('spin', muted);
    setSpinning(true);
    setResult(null);
    setJackpot(false);

    const pickedIds: number[] = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      const choices = pool.filter((id) => !pickedIds.includes(id));
      pickedIds.push(pickRandom(choices.length ? choices : pool));
    }

    setReels(
      Array.from({ length: REEL_COUNT }, () => ({
        displayId: pickRandom(pool),
        mon: null,
        spinning: true,
        win: false,
      })),
    );

    // Rapid reel flicker while spinning
    let tick = 0;
    const flicker = window.setInterval(() => {
      tick += 1;
      setReels((prev) =>
        prev.map((reel) =>
          reel.spinning
            ? {
                ...reel,
                displayId: pool[(tick * 3 + Math.floor(Math.random() * pool.length)) % pool.length]!,
              }
            : reel,
        ),
      );
      if (tick % 3 === 0) playSfx('tick', muted);
    }, SPIN_TICK_MS);
    spinTimers.current.push(flicker);

    await Promise.all(
      pickedIds.map(
        (id, i) =>
          new Promise<void>((resolve) => {
            schedule(() => {
              void (async () => {
                let mon: PokemonData | null = null;
                try {
                  mon = await fetchPokemon(id);
                } catch {
                  mon = null;
                }
                const isWinReel = id === guessId;
                setReels((prev) => {
                  const next = [...prev];
                  next[i] = {
                    displayId: id,
                    mon,
                    spinning: false,
                    win: isWinReel,
                  };
                  return next;
                });
                playSfx('spinStop', muted);
                resolve();
              })();
            }, REEL_STOP_BASE_MS + i * REEL_STOP_STAGGER_MS);
          }),
      ),
    );

    window.clearInterval(flicker);
    spinTimers.current = spinTimers.current.filter((timerId) => timerId !== flicker);

    const won = pickedIds.includes(guessId);
    if (won) {
      addMoney(bet * 3);
      setJackpot(true);
      setResult(`JACKPOT! ¥${bet * 3} paid out!`);
      playSfx('win', muted);
      setStonePickOpen(true);
    } else {
      setResult('No match — the house wins this round.');
      playSfx('fail', muted);
    }
    setSpinning(false);
  }

  return (
    <motion.div
      className="screen gamecorner-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={`gamecorner-neon${jackpot ? ' gamecorner-neon--jackpot' : ''}`} aria-hidden />

      <header className="gamecorner-header">
        <button type="button" className="wheel-back-btn" onClick={() => setScreen('hub')}>
          ← Back
        </button>
        <div className="gamecorner-title-wrap">
          <h2 className="gamecorner-title">
            <span>GAME</span> CORNER
          </h2>
          <p className="gamecorner-subtitle">Slots · Stones · Big Wins</p>
        </div>
        <div className="gamecorner-wallet">
          <span className="gamecorner-wallet__money">¥{money}</span>
        </div>
      </header>

      <div className="gamecorner-machine">
        <div className="gamecorner-machine__lights" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="gamecorner-machine__bulb" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>

        <div className="gamecorner-machine__marquee">
          <span>★ LUCKY REELS ★</span>
          <span>MATCH YOUR PICK</span>
          <span>WIN 3× + STONE</span>
        </div>

        <div className={`gamecorner-reels${spinning ? ' gamecorner-reels--spinning' : ''}${jackpot ? ' gamecorner-reels--jackpot' : ''}`}>
          {reels.map((reel, i) => {
            const sprite =
              reel.mon?.sprite ||
              (reel.displayId != null ? localPokemonSprite(reel.displayId) : null);
            return (
              <div
                key={i}
                className={[
                  'gamecorner-reel',
                  reel.spinning ? 'gamecorner-reel--spinning' : '',
                  reel.win ? 'gamecorner-reel--win' : '',
                  !reel.spinning && reel.mon ? 'gamecorner-reel--landed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="gamecorner-reel__window">
                  {sprite ? (
                    <img
                      src={sprite}
                      alt={reel.mon?.displayName ?? `Reel ${i + 1}`}
                      className="gamecorner-reel__sprite"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                      }}
                    />
                  ) : (
                    <span className="gamecorner-reel__placeholder">?</span>
                  )}
                </div>
                <span className="gamecorner-reel__label">
                  {reel.spinning ? '···' : reel.mon?.displayName ?? '—'}
                </span>
              </div>
            );
          })}
        </div>

        <p className="gamecorner-paytable">
          Pick a regional Pokémon. If it lands in any reel, cash out <strong>3×</strong> your bet and claim a
          stone.
        </p>
      </div>

      <div className="gamecorner-console">
        <div className="gamecorner-guess">
          <div className="gamecorner-guess__preview">
            {guessSprite ? (
              <img
                src={guessSprite}
                alt=""
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                }}
              />
            ) : (
              <span>?</span>
            )}
          </div>
          <div className="gamecorner-guess__fields">
            <div className="gamecorner-field" ref={pickMenuRef}>
              <span>Your pick</span>
              <button
                type="button"
                className={`gamecorner-pick${pickOpen ? ' gamecorner-pick--open' : ''}`}
                disabled={spinning}
                aria-haspopup="listbox"
                aria-expanded={pickOpen}
                onClick={() => setPickOpen((open) => !open)}
              >
                <span className="gamecorner-pick__value">{guessName ?? 'Choose a Pokémon'}</span>
                <span className="gamecorner-pick__chevron" aria-hidden>
                  ▾
                </span>
              </button>
              {pickOpen && (
                <ul className="gamecorner-pick__menu" role="listbox">
                  {poolOptions.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={guessId === opt.id}
                        className={`gamecorner-pick__option${guessId === opt.id ? ' gamecorner-pick__option--active' : ''}`}
                        onClick={() => {
                          setGuessId(opt.id);
                          setPickOpen(false);
                        }}
                      >
                        <img
                          src={localPokemonSprite(opt.id)}
                          alt=""
                          className="gamecorner-pick__option-sprite"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                          }}
                        />
                        <span>{opt.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="gamecorner-btn gamecorner-btn--ghost"
              onClick={() => {
                setGuessId(pickRandom(pool));
                setPickOpen(false);
              }}
              disabled={spinning}
            >
              Random
            </button>
          </div>
        </div>

        <div className="gamecorner-field gamecorner-field--bet">
          <span>Bet</span>
          <div className="gamecorner-bet">
            <button
              type="button"
              className="gamecorner-bet__step"
              disabled={spinning || bet <= 1}
              onClick={() => adjustBet(-1)}
              aria-label="Decrease bet"
            >
              −
            </button>
            <div className="gamecorner-bet__value">
              <span className="gamecorner-bet__currency">¥</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bet}
                disabled={spinning}
                onChange={(e) => {
                  const next = Number(e.target.value.replace(/\D/g, ''));
                  if (!next) {
                    setBet(1);
                    return;
                  }
                  setBet(Math.min(money, Math.max(1, next)));
                }}
                aria-label="Bet amount"
              />
            </div>
            <button
              type="button"
              className="gamecorner-bet__step"
              disabled={spinning || bet >= money}
              onClick={() => adjustBet(1)}
              aria-label="Increase bet"
            >
              +
            </button>
          </div>
          <div className="gamecorner-bet__presets">
            {BET_STEPS.filter((step) => step <= money).map((step) => (
              <button
                key={step}
                type="button"
                className={`gamecorner-bet__chip${bet === step ? ' gamecorner-bet__chip--active' : ''}`}
                disabled={spinning}
                onClick={() => setBet(step)}
              >
                ¥{step}
              </button>
            ))}
            {money > 0 && (
              <button
                type="button"
                className={`gamecorner-bet__chip${bet === money ? ' gamecorner-bet__chip--active' : ''}`}
                disabled={spinning}
                onClick={() => setBet(money)}
              >
                Max
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`gamecorner-btn gamecorner-btn--spin${spinning ? ' gamecorner-btn--spinning' : ''}`}
          disabled={!canSpin}
          onClick={() => void lockIn()}
          aria-label={spinning ? 'Spinning…' : 'Lock in & spin'}
        >
          <span className="gamecorner-btn__spin-label" aria-hidden={spinning}>
            LOCK IN & SPIN
          </span>
          <span className="gamecorner-btn__spin-label" aria-hidden={!spinning}>
            SPINNING…
          </span>
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.p
            className={`gamecorner-result${jackpot ? ' gamecorner-result--win' : ''}`}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            {result}
          </motion.p>
        )}
      </AnimatePresence>

      {stonePickOpen && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal gamecorner-stone-modal">
            <h3 className="battle-modal__title">Choose a Stone</h3>
            <p className="gamecorner-stone-modal__hint">Your jackpot prize — pick one evolution stone.</p>
            <div className="gamecorner-stone-grid">
              {stones.map((id) => {
                const stone = ITEMS.find((i) => i.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="gamecorner-btn gamecorner-btn--stone"
                    onClick={() => {
                      addItem(id, 1);
                      setStonePickOpen(false);
                      playSfx('item', muted);
                    }}
                  >
                    {stone?.name ?? id}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
