import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchPokemon } from '../api/pokeapi';
import { FOSSIL_POKEMON, pickRandom } from '../data/pools';
import { GameIcon } from '../components/GameIcon';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';

const COLS = 7;
const ROWS = 5;
const START_DURABILITY = 100;
const PICK_COST = 5;
const HAMMER_COST = 11;

type Phase = 'ready' | 'digging' | 'failed' | 'loading';
type Tool = 'pick' | 'hammer';

interface Cell {
  depth: number;
  fossil: boolean;
}

/** Relative [row, col] offsets from anchor — each shape is 6–8 cells. */
const FOSSIL_SHAPES: [number, number][][] = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
  ],
  [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 1],
  ],
  [
    [0, 2],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
  ],
];

function depthForCell(r: number, c: number): number {
  const edgeDist = Math.min(r, c, ROWS - 1 - r, COLS - 1 - c);
  if (edgeDist === 0) return 3;
  if (edgeDist === 1) return Math.random() < 0.6 ? 3 : 2;
  return Math.random() < 0.4 ? 2 : 1;
}

function buildGrid(): Cell[][] {
  const shape = pickRandom(FOSSIL_SHAPES);
  const maxDr = Math.max(...shape.map(([dr]) => dr));
  const maxDc = Math.max(...shape.map(([, dc]) => dc));
  const startR = Math.floor(Math.random() * (ROWS - maxDr));
  const startC = Math.floor(Math.random() * (COLS - maxDc));

  const fossilSet = new Set(
    shape.map(([dr, dc]) => `${startR + dr},${startC + dc}`),
  );

  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      depth: depthForCell(r, c),
      fossil: fossilSet.has(`${r},${c}`),
    })),
  );
}

function countFossilTotal(grid: Cell[][]): number {
  return grid.flat().filter((cell) => cell.fossil).length;
}

function countFossilExposed(grid: Cell[][]): number {
  return grid.flat().filter((cell) => cell.fossil && cell.depth === 0).length;
}

function isFossilCleared(grid: Cell[][]): boolean {
  return grid.every((row) => row.every((cell) => !cell.fossil || cell.depth === 0));
}

function hammerTargets(r: number, c: number): [number, number][] {
  const coords: [number, number][] = [[r, c]];
  if (r > 0) coords.push([r - 1, c]);
  if (r < ROWS - 1) coords.push([r + 1, c]);
  if (c > 0) coords.push([r, c - 1]);
  if (c < COLS - 1) coords.push([r, c + 1]);
  return coords;
}

export function FossilScreen() {
  const setCurrentPokemon = useGameStore((s) => s.setCurrentPokemon);
  const setScreen = useGameStore((s) => s.setScreen);
  const muted = useGameStore((s) => s.muted);

  const fossilId = useMemo(() => pickRandom(FOSSIL_POKEMON), []);

  const [phase, setPhase] = useState<Phase>('ready');
  const [grid, setGrid] = useState<Cell[][]>(() => buildGrid());
  const [durability, setDurability] = useState(START_DURABILITY);
  const [tool, setTool] = useState<Tool>('pick');

  const fossilTotal = countFossilTotal(grid);
  const fossilExposed = countFossilExposed(grid);
  const durabilityPct = Math.max(0, (durability / START_DURABILITY) * 100);
  const durabilityState =
    durabilityPct > 50 ? 'high' : durabilityPct > 25 ? 'mid' : 'low';

  const finishSuccess = useCallback(async () => {
    setPhase('loading');
    playSfx('win', muted);
    const pokemon = await fetchPokemon(fossilId);
    setCurrentPokemon(pokemon);
    setScreen('catch');
  }, [fossilId, muted, setCurrentPokemon, setScreen]);

  function startDig() {
    const fresh = buildGrid();
    setGrid(fresh);
    setDurability(START_DURABILITY);
    setTool('pick');
    setPhase('digging');
  }

  function applyTool(r: number, c: number) {
    if (phase !== 'digging' || durability <= 0) return;

    const cost = tool === 'pick' ? PICK_COST : HAMMER_COST;
    const layers = tool === 'pick' ? 1 : 2;
    const targets = tool === 'pick' ? [[r, c] as [number, number]] : hammerTargets(r, c);

    const hasDiggable = targets.some(([tr, tc]) => grid[tr][tc].depth > 0);
    if (!hasDiggable) return;

    const nextGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
    let hitFossil = false;

    for (const [tr, tc] of targets) {
      const cell = nextGrid[tr][tc];
      if (cell.depth <= 0) continue;
      const prevDepth = cell.depth;
      cell.depth = Math.max(0, cell.depth - layers);
      if (cell.fossil && cell.depth < prevDepth) hitFossil = true;
    }

    playSfx(hitFossil ? 'clink' : 'dig', muted);

    const nextDurability = durability - cost;
    setGrid(nextGrid);
    setDurability(nextDurability);

    if (isFossilCleared(nextGrid)) {
      finishSuccess();
      return;
    }

    if (nextDurability <= 0) {
      playSfx('fail', muted);
      setPhase('failed');
    }
  }

  function cellClass(cell: Cell): string {
    if (cell.depth === 0) {
      return cell.fossil ? 'fossil-cell fossil-cell--bone' : 'fossil-cell fossil-cell--floor';
    }
    const classes = [`fossil-cell fossil-cell--depth-${cell.depth}`];
    if (cell.fossil && cell.depth === 1) classes.push('fossil-cell--hint');
    return classes.join(' ');
  }

  return (
    <motion.div className="screen fossil-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="screen-title">Fossil Revive</h2>

      {phase === 'ready' && (
        <>
          <p className="fossil-screen__subtitle">
            Chip away the dirt wall to fully uncover the hidden fossil before the wall&apos;s durability
            runs out. Use the pick for precision or the hammer for broad strikes — but hammering burns
            durability fast.
          </p>
          <div className="fossil-screen__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={startDig}>
              Start Digging
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setScreen('hub')}>
              Back to Hub
            </button>
          </div>
        </>
      )}

      {phase === 'loading' && <p className="fossil-screen__subtitle">The ancient Pokémon stirs...</p>}

      {phase === 'digging' && (
        <>
          <div className="fossil-excavate__hud">
            <div className="fossil-excavate__durability">
              <span className="fossil-excavate__label">Wall durability</span>
              <div className="fossil-excavate__bar-track">
                <div
                  className={`fossil-excavate__bar-fill fossil-excavate__bar-fill--${durabilityState}`}
                  style={{ width: `${durabilityPct}%` }}
                />
              </div>
              <span className="fossil-excavate__durability-num">{Math.max(0, durability)}</span>
            </div>
            <p className="fossil-excavate__progress">
              Fossil exposed: <strong>{fossilExposed}</strong> / {fossilTotal}
            </p>
          </div>

          <div className="fossil-excavate__tools">
            <button
              type="button"
              className={`fossil-excavate__tool${tool === 'pick' ? ' fossil-excavate__tool--active' : ''}`}
              onClick={() => setTool('pick')}
            >
              <span>⛏️</span>
              <span>Pick</span>
              <span className="fossil-excavate__tool-cost">-{PICK_COST}</span>
            </button>
            <button
              type="button"
              className={`fossil-excavate__tool${tool === 'hammer' ? ' fossil-excavate__tool--active' : ''}`}
              onClick={() => setTool('hammer')}
            >
              <span>🔨</span>
              <span>Hammer</span>
              <span className="fossil-excavate__tool-cost">-{HAMMER_COST}</span>
            </button>
          </div>

          <div className="fossil-excavate__board">
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={cellClass(cell)}
                  onClick={() => applyTool(r, c)}
                  disabled={cell.depth === 0}
                  aria-label={
                    cell.depth === 0
                      ? cell.fossil
                        ? 'Exposed fossil'
                        : 'Cleared rock'
                      : `Dig layer ${cell.depth}`
                  }
                />
              )),
            )}
          </div>

          <button type="button" className="btn btn--ghost" onClick={() => setScreen('hub')}>
            Back to Hub
          </button>
        </>
      )}

      {phase === 'failed' && (
        <div className="battle-modal__backdrop">
          <motion.div
            className="battle-modal hub-notice-modal"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          >
            <div className="fossil-fail__icon">
              <GameIcon ui="fossil" alt="" className="game-icon-img game-icon-img--lg" />
            </div>
            <p className="hub-notice-modal__text">
              The fossil shattered! The wall gave out before you could fully uncover it.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => setScreen('hub')}>
              Back to Hub
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
