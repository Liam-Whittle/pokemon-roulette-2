import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { DeckModal } from '../components/DeckModal';
import { getBiomeDef } from '../data/biomes';
import { CHARACTERS } from '../data/characters';
import { HpBar, RelicBar } from '../components/SpireHud';
import { getNode } from '../engine/map';
import { useSpireStore } from '../store/useSpireStore';
import { playSfx } from '../../utils/sound';
import { useGameStore } from '../../store/useGameStore';
import type { MapNode, NodeKind } from '../types';

const MIN_LANE_W = 128;
const MAX_LANE_W = 196;
const FLOOR_H = 118;
const PAD_X = 88;
const PAD_Y = 88;
const NODE_R = 17;

const LABELS: Record<NodeKind, string> = {
  start: 'Entrance',
  monster: 'Wild',
  elite: 'Elite',
  event: 'Event',
  rest: 'Center',
  shop: 'Mart',
  treasure: 'Chest',
  boss: 'Boss',
};

function startLabel(act: number): { title: string; body: string } {
  if (act === 1) return { title: 'Tower Entrance', body: 'The Novice Wing doors. Your climb begins here.' };
  if (act === 2) return { title: 'Veteran Gate', body: 'The next wing of the Battle Tower.' };
  return { title: 'Summit Gate', body: 'The final ascent toward the league summit.' };
}

const LEGEND_ORDER: NodeKind[] = ['monster', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss'];

const NODE_TIPS: Record<NodeKind, { title: string; body: string }> = {
  start: { title: 'Entrance', body: 'The start of this act’s climb.' },
  monster: { title: 'Wild battle', body: 'A standard tower fight. Earn gold and a card reward.' },
  elite: { title: 'Elite battle', body: 'A tougher fight with richer relic and gold rewards.' },
  event: { title: 'Event', body: 'A choice that can help or hurt your run.' },
  rest: { title: 'Pokémon Center', body: 'Heal, smith a card, or use relic options you have unlocked.' },
  shop: { title: 'Poké Mart', body: 'Spend gold on cards, relics, potions, or a removal.' },
  treasure: { title: 'Treasure', body: 'Open a locker for a relic.' },
  boss: { title: 'Legendary boss', body: 'One of this act’s three legendaries waits at the summit.' },
};

function hash01(input: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < input.length; i += 1) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function nodeJitter(id: string): { x: number; y: number } {
  return {
    x: (hash01(id, 11) - 0.5) * 8,
    y: (hash01(id, 29) - 0.5) * 6,
  };
}

function climbPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  key: string,
): string {
  const x1 = from.x;
  const y1 = from.y - radius - 2;
  const x2 = to.x;
  const y2 = to.y + radius + 2;
  const rise = y2 - y1;
  const sway = (hash01(key, 47) - 0.5) * 14;
  const mid = (hash01(key, 71) - 0.5) * 8;
  return `M ${x1} ${y1} C ${x1 + sway} ${y1 + rise * 0.32}, ${x2 - sway + mid} ${y2 - rise * 0.34}, ${x2} ${y2}`;
}

function NodeMark({ kind }: { kind: NodeKind }) {
  const r = kind === 'boss' ? NODE_R + 3 : NODE_R;
  if (kind === 'monster') {
    return (
      <g>
        <circle r={r} className="spire-node__disk" />
        <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`} className="spire-node__ball-top" />
        <rect x={-r} y={-1.6} width={r * 2} height={3.2} className="spire-node__ball-band" />
        <circle r={3.6} className="spire-node__ball-button" />
      </g>
    );
  }
  if (kind === 'elite') {
    return (
      <g>
        <circle r={r} className="spire-node__disk" />
        <polygon points="0,-9 7,0 0,9 -7,0" className="spire-node__gem" />
      </g>
    );
  }
  if (kind === 'boss') {
    return (
      <g>
        <circle r={r} className="spire-node__disk" />
        <polygon points="0,-10 2.8,-3 9.4,-2.6 4.2,1.8 6.2,8.6 0,4.6 -6.2,8.6 -4.2,1.8 -9.4,-2.6 -2.8,-3" className="spire-node__star" />
      </g>
    );
  }
  const glyph =
    kind === 'event' ? '?' : kind === 'rest' ? '+' : kind === 'shop' ? '$' : kind === 'treasure' ? '▣' : '★';
  return (
    <g>
      <circle r={r} className="spire-node__disk" />
      <text textAnchor="middle" dy="5" className="spire-node__glyph">
        {glyph}
      </text>
    </g>
  );
}

export function MapView({ preview = false }: { preview?: boolean }) {
  const run = useSpireStore((s) => s.run);
  const enterNode = useSpireStore((s) => s.enterNode);
  const abandonRun = useSpireStore((s) => s.abandonRun);
  const muted = useGameStore((s) => s.muted);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [hover, setHover] = useState<{ kind: NodeKind; x: number; y: number; below: boolean } | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [stageWidth, setStageWidth] = useState(() => Math.max(720, window.innerWidth - 48));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const syncWidth = () => setStageWidth(scroller.clientWidth);
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [run?.map]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const marker = scroller?.querySelector<SVGElement>(`[data-node-id="${run?.currentNodeId ?? ''}"]`);
    marker?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
  }, [run?.currentNodeId, stageWidth]);

  if (!run?.map || !run.currentNodeId || !run.characterId) return null;

  const map = run.map;
  const biome = getBiomeDef(map.biomeId);
  const character = CHARACTERS[run.characterId];
  const current = getNode(map, run.currentNodeId);
  const available = new Set(current?.nextIds ?? []);
  const maxCol = Math.max(...map.nodes.map((n) => n.column));
  const maxOnFloor = Math.max(
    3,
    ...map.nodes.reduce<number[]>((counts, node) => {
      counts[node.column] = (counts[node.column] ?? 0) + 1;
      return counts;
    }, []),
  );
  const width = Math.max(stageWidth, 720);
  const laneW = Math.max(MIN_LANE_W, Math.min(MAX_LANE_W, (width - PAD_X * 2) / maxOnFloor));
  const height = PAD_Y * 2 + (maxCol + 1) * FLOOR_H;
  const centerX = width / 2;
  const startCopy = startLabel(run.act);

  const pos = (node: MapNode) => {
    const floor = map.nodes.filter((n) => n.column === node.column).sort((a, b) => a.row - b.row);
    const index = Math.max(0, floor.findIndex((n) => n.id === node.id));
    const anchored = node.kind === 'start' || node.kind === 'boss';
    const jitter = anchored ? { x: 0, y: 0 } : nodeJitter(node.id);
    const x = anchored ? centerX : centerX + (index - (floor.length - 1) / 2) * laneW;
    return {
      x: x + jitter.x,
      y: PAD_Y + (maxCol - node.column) * FLOOR_H + NODE_R + jitter.y,
    };
  };

  const onNode = (node: MapNode) => {
    if (dragRef.current?.moved) return;
    if (preview || !available.has(node.id)) return;
    playSfx('click', muted);
    enterNode(node.id);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const hit = event.target;
    if (hit instanceof Element && hit.closest('[data-node-id]')) return;
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const scroller = scrollerRef.current;
    if (!drag || !scroller) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    scroller.scrollLeft -= dx;
    scroller.scrollTop -= dy;
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  const onPointerUp = () => {
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };

  return (
    <div className="spire-view spire-view--map">
      <header className="spire-hud">
        <div className="spire-hud__start">
          <div className="spire-hud__meta">
            <p className="spire-kicker">
              Act {run.act} · {biome.name}
            </p>
            <strong>{character.name}</strong>
          </div>
          <div className="spire-hud__vitals">
            <HpBar hp={run.hp} max={run.maxHp} />
            <span className="spire-gold">¥{run.gold}</span>
          </div>
        </div>
        <RelicBar relics={run.relics} />
        <div className="spire-hud__end">
          <div className="spire-hud__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                playSfx('click', muted);
                setDeckOpen(true);
              }}
            >
              Deck ({run.deck.length})
            </button>
            {!preview && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                playSfx('click', muted);
                setAbandonOpen(true);
              }}
            >
              Abandon
            </button>
            )}
          </div>
        </div>
      </header>

      <div className="spire-map-stage" ref={stageRef}>
        <div
          ref={scrollerRef}
          className="spire-map-scroll"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="spire-map-sheet" style={{ width, height }}>
            <svg
              className="spire-map"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${biome.name} climb map`}
            >
              <defs>
                <filter id="spire-edge-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="1.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="spire-node-shadow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000" floodOpacity="0.45" />
                </filter>
              </defs>
              {Array.from({ length: maxCol + 1 }, (_, col) => {
                const y = PAD_Y + (maxCol - col) * FLOOR_H + NODE_R;
                return (
                  <text key={`floor-${col}`} x={18} y={y + 4} className="spire-map__floor-label">
                    {col === maxCol ? 'B' : col + 1}
                  </text>
                );
              })}
              {map.nodes.flatMap((node) => {
                const from = pos(node);
                const fromCurrent = node.id === run.currentNodeId;
                return node.nextIds.map((id) => {
                  const target = getNode(map, id);
                  if (!target) return null;
                  const to = pos(target);
                  const open = fromCurrent && available.has(id);
                  const taken = run.visitedNodeIds.includes(node.id) && run.visitedNodeIds.includes(id);
                  return (
                    <path
                      key={`${node.id}-${id}`}
                      d={climbPath(from, to, NODE_R, `${node.id}-${id}`)}
                      className={`spire-map__edge${open ? ' is-open' : ''}${taken ? ' is-taken' : ''}`}
                      fill="none"
                      strokeLinecap="round"
                      filter={open ? 'url(#spire-edge-glow)' : undefined}
                    />
                  );
                });
              })}
              {map.nodes.map((node) => {
                const { x, y } = pos(node);
                const visited = run.visitedNodeIds.includes(node.id);
                const isCurrent = node.id === run.currentNodeId;
                const canGo = available.has(node.id);
                const radius = node.kind === 'boss' ? NODE_R + 3 : NODE_R;
                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    transform={`translate(${x}, ${y})`}
                    className={`spire-node spire-node--${node.kind}${visited ? ' is-visited' : ''}${isCurrent ? ' is-current' : ''}${canGo ? ' is-open' : ''}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onNode(node)}
                    onMouseEnter={(event) => {
                      const stage = stageRef.current?.getBoundingClientRect();
                      const rect = event.currentTarget.getBoundingClientRect();
                      if (!stage) return;
                      const top = rect.top - stage.top;
                      const below = node.kind === 'boss' || top < 88;
                      const rawX = rect.left + rect.width / 2 - stage.left;
                      const tipHalf = 112;
                      setHover({
                        kind: node.kind,
                        x: Math.min(Math.max(tipHalf + 8, rawX), stage.width - tipHalf - 8),
                        y: below ? rect.bottom - stage.top : top,
                        below,
                      });
                    }}
                    onMouseLeave={() => setHover(null)}
                    role="button"
                  >
                    <circle r={radius + 12} className="spire-node__hit" />
                    <g filter="url(#spire-node-shadow)">
                      {canGo && <circle r={radius + 7} className="spire-node__halo" />}
                      {isCurrent && <circle r={radius + 9} className="spire-node__pulse" />}
                      <NodeMark kind={node.kind} />
                    </g>
                    {node.kind === 'start' && (
                      <text textAnchor="middle" y={radius + 16} className="spire-node__caption">
                        {startCopy.title}
                      </text>
                    )}
                    {node.kind === 'boss' && (
                      <text textAnchor="middle" y={radius + 16} className="spire-node__caption">
                        Act Boss
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        {hover && (
          <div
            className={`spire-map-tip${hover.below ? ' is-below' : ''}`}
            style={{ left: hover.x, top: hover.y }}
          >
            <strong>{hover.kind === 'start' ? startCopy.title : NODE_TIPS[hover.kind].title}</strong>
            <span>{hover.kind === 'start' ? startCopy.body : NODE_TIPS[hover.kind].body}</span>
          </div>
        )}
        <p className="spire-map-drag-hint">Drag or scroll to explore the climb</p>
        <div className="spire-map-legend" aria-hidden="true">
          {LEGEND_ORDER.map((kind) => (
            <span key={kind} className={`spire-map-legend__item spire-map-legend__item--${kind}`}>
              {LABELS[kind]}
            </span>
          ))}
        </div>
      </div>
      {deckOpen && <DeckModal cards={run.deck} onClose={() => setDeckOpen(false)} />}
      {abandonOpen && (
        <div className="spire-confirm" role="dialog" aria-label="Abandon run">
          <div className="spire-confirm__card">
            <h3>Abandon this climb?</h3>
            <p>The run will end. This cannot be undone.</p>
            <div className="spire-confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setAbandonOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  playSfx('click', muted);
                  abandonRun();
                }}
              >
                Abandon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
