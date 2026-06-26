import { useEffect, useMemo, useState } from 'react';
import { fetchPokemon } from '../api/pokeapi';
import { getTypeEffectiveness, getEffectivenessLabel, TYPE_COLORS } from '../data/typeChart';
import { SidePanel } from './SidePanel';
import { TypeBadge } from './TypeBadge';
import { Wheel } from './Wheel';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { playClip, stopClips } from '../utils/music';
import { PokeCenterVisits } from './PokeDollar';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import type { Badge, BattleWheelSegment, GymLeader, PokemonData } from '../types/game';

interface BattleArenaProps {
  title: string;
  leader: GymLeader;
  onWin: () => void;
  onLose: () => void;
  winBadge?: Badge;
  finalVictory?: boolean;
}

type BattlePhase = 'prep' | 'intro' | 'choose' | 'spin' | 'result' | 'victory';

interface AttackOption {
  type: string;
  attackerName: string;
  attackerPower: number;
}

function safePower(power: number): number {
  return Number.isFinite(power) ? power : 0.3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeHitCount(multiplier: number, attackerPower: number, enemyPower: number): number {
  const base =
    multiplier >= 2 ? 7 : multiplier >= 1 ? 5 : multiplier > 0 ? 3 : 1;
  const powerMod = clamp(Math.round((attackerPower - enemyPower) * 4), -3, 3);
  return clamp(base + powerMod, 1, 9);
}

/**
 * Overwhelming advantage: the chosen attack type is at least effective AND the
 * attacker outpowers the enemy by 20+ points (power is normalized 0-1, shown
 * x100). In that case the wheel is stacked to all Hits except a single Miss.
 */
const OVERWHELMING_POWER_DIFF = 0.2;

function hasOverwhelmingAdvantage(
  multiplier: number,
  attackerPower: number,
  enemyPower: number,
): boolean {
  return multiplier >= 1 && attackerPower - enemyPower >= OVERWHELMING_POWER_DIFF;
}

function powerNote(attackerPower: number, enemyPower: number): string {
  const diff = attackerPower - enemyPower;
  if (diff > 0.05) return 'power advantage';
  if (diff < -0.05) return 'power disadvantage';
  return 'even power';
}

function createBattleSegments(hitCount: number): BattleWheelSegment[] {
  const segments: BattleWheelSegment[] = Array.from({ length: 10 }, (_, index) => {
    const hit = index < hitCount;
    return {
      id: `slot-${index}-${hit ? 'hit' : 'miss'}`,
      label: hit ? 'Hit' : 'Miss',
      outcome: hit ? 'hit' : 'miss',
      color: hit ? '#22c55e' : '#ef4444',
      icon: '',
    };
  });
  return segments.sort(() => Math.random() - 0.5);
}

export function BattleArena({ title, leader, onWin, onLose, winBadge, finalVictory = false }: BattleArenaProps) {
  const muted = useGameStore((state) => state.muted);
  const lives = useGameStore((state) => state.lives);
  const party = useGameStore((state) => state.party);
  const bag = useGameStore((state) => state.bag);
  const consumeItem = useGameStore((state) => state.consumeItem);
  const loseLife = useGameStore((state) => state.loseLife);
  const earnBadge = useGameStore((state) => state.earnBadge);
  const addMoney = useGameStore((state) => state.addMoney);
  const setLastResult = useGameStore((state) => state.setLastResult);

  const [enemy, setEnemy] = useState<PokemonData | null>(null);
  const [phase, setPhase] = useState<BattlePhase>('prep');
  const [segments, setSegments] = useState<BattleWheelSegment[]>([]);
  const [message, setMessage] = useState('');
  const [usedXAttack, setUsedXAttack] = useState(false);
  const [wheelKey, setWheelKey] = useState(0);

  const attackOptions = useMemo((): AttackOption[] => {
    const typeSet = Array.from(new Set(party.flatMap((member) => member.types)));
    const types = typeSet.length > 0 ? typeSet : ['normal'];

    return types.map((type) => {
      const candidates = party.filter((member) => member.types.includes(type));
      const best =
        candidates.length > 0
          ? candidates.reduce((a, b) => (safePower(a.powerLevel) >= safePower(b.powerLevel) ? a : b))
          : null;

      return {
        type,
        attackerName: best?.nickname ?? best?.displayName ?? 'Unknown',
        attackerPower: safePower(best?.powerLevel ?? 0.3),
      };
    });
  }, [party]);

  const enemyPower = enemy ? safePower(enemy.powerLevel) : 0.3;

  const xAttackCount = bag.find((item) => item.id === 'xattack')?.quantity ?? 0;

  useEffect(() => {
    fetchPokemon(leader.pokemon[leader.pokemon.length - 1].id).then(setEnemy);
  }, [leader]);

  useEffect(() => () => stopClips(), []);

  useEffect(() => {
    if (phase !== 'intro') return;
    playSfx('battle', muted);
    const t = window.setTimeout(() => setPhase('choose'), 1200);
    return () => clearTimeout(t);
  }, [phase, muted]);

  function buildWheel(type: string) {
    if (!enemy) return;
    const option = attackOptions.find((entry) => entry.type === type);
    const attackerPower = option?.attackerPower ?? 0.3;
    const multiplier = getTypeEffectiveness(type, enemy.types);
    const overwhelming = hasOverwhelmingAdvantage(multiplier, attackerPower, enemyPower);
    const hitCount = overwhelming ? 9 : computeHitCount(multiplier, attackerPower, enemyPower);
    const effectiveness = getEffectivenessLabel(multiplier);
    const note = powerNote(attackerPower, enemyPower);

    setSegments(createBattleSegments(hitCount));
    setUsedXAttack(false);
    setWheelKey((value) => value + 1);
    setPhase('spin');
    setMessage(
      overwhelming
        ? `Overwhelming advantage! Only one Miss on the wheel — ${hitCount}/10 Hits!`
        : `${effectiveness} + ${note} → ${hitCount}/10 Hits!`,
    );
  }

  function applyXAttack() {
    if (usedXAttack || !consumeItem('xattack', 1)) return;

    let flipped = 0;
    const boosted = segments.map((segment) => {
      if (segment.outcome === 'miss' && flipped < 2) {
        flipped += 1;
        return {
          ...segment,
          id: `${segment.id}-boosted-${flipped}`,
          label: 'Hit',
          outcome: 'hit' as const,
          color: '#22c55e',
          icon: '',
        };
      }
      return segment;
    });

    if (flipped === 0) {
      // Refund if there were no misses to convert.
      useGameStore.getState().addItem('xattack', 1);
      setMessage('No Miss segments left to convert.');
      return;
    }

    setSegments(boosted);
    setWheelKey((value) => value + 1);
    setUsedXAttack(true);
    setMessage(`X-Attack converted ${flipped} Miss${flipped === 1 ? '' : 'es'} into Hit!`);
    playSfx('item', muted);
  }

  function handleLand(segment: BattleWheelSegment) {
    if (segment.outcome === 'hit') {
      if (winBadge) {
        earnBadge(winBadge);
        if (!finalVictory) addMoney(100);
      }
      setLastResult({
        type: 'gym',
        success: true,
        badge: winBadge,
        message: finalVictory ? `You defeated ${leader.name} and claimed the title!` : `You defeated ${leader.name}!`,
      });

      // Regular Gym win: celebrate with the badge jingle + a badge popup the
      // player dismisses themselves. Elite Four / Champion wins continue
      // straight through (the Champion gets its own victory screen).
      if (winBadge && !finalVictory) {
        playClip(asset('sounds/gym_victory.mp3'));
        setPhase('victory');
        setMessage(`You won the ${leader.badgeName}!`);
        return;
      }

      playSfx('win', muted);
      setPhase('result');
      setMessage(finalVictory ? 'Champion victory!' : `${leader.badgeName} earned!`);
      window.setTimeout(onWin, 1400);
      return;
    }

    if (consumeItem('potion', 1)) {
      setMessage('Missed, but a Potion gave you one more spin.');
      setWheelKey((value) => value + 1);
      return;
    }

    const nextLives = loseLife();
    if (nextLives <= 0) {
      setLastResult({ type: 'gym', success: false, message: `You ran out of lives against ${leader.name}.` });
      setPhase('result');
      setMessage('No lives left. Your adventure restarts.');
      window.setTimeout(onLose, 1400);
      return;
    }

    setLastResult({ type: 'gym', success: false, message: `Missed against ${leader.name}. ${nextLives} lives remain.` });
    setPhase('result');
    setMessage(`Missed. ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} remaining.`);
    window.setTimeout(onLose, 1400);
  }

  return (
    <>
    <div className="battle-layout">
      <div className="battle-main">
        <h2 className="screen-title">{title}</h2>
        <div className="battle-hud">
          <PokeCenterVisits lives={lives} />
          <span>{leader.badgeName}</span>
        </div>
        <div className="gym-leader-info">
          <h3>{leader.name}</h3>
          <TypeBadge type={leader.type} />
        </div>

        {enemy && (
          <div className="battle-scene">
            {leader.sprite && (
              <img
                src={leader.sprite}
                alt={leader.name}
                className="battle-trainer__sprite"
                onError={(event) => {
                  (event.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                }}
              />
            )}
            <div className="gym-enemy">
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${enemy.id}.gif`}
                alt={enemy.displayName}
                className="gym-enemy__sprite"
                onError={(event) => {
                  const img = event.target as HTMLImageElement;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src = enemy.sprite || PLACEHOLDER_SPRITE;
                  }
                }}
              />
              <p>{enemy.displayName}</p>
              <p className="gym-enemy__power">Power {Math.round(enemyPower * 100)}</p>
              <div className="gym-enemy__types">
                {enemy.types.map((type) => (
                  <TypeBadge key={type} type={type} size="sm" />
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === 'choose' && enemy && (
          <div className="gym-attack-select">
            <p>Choose one of your party's attack types.</p>
            <div className="gym-type-grid">
              {attackOptions.map((option) => {
                const multiplier = getTypeEffectiveness(option.type, enemy.types);
                const effectiveness =
                  multiplier >= 2
                    ? 'Super'
                    : multiplier <= 0
                      ? 'No Effect'
                      : multiplier < 1
                        ? 'Not Very'
                        : 'Effective';
                const effectivenessClass =
                  multiplier >= 2
                    ? 'gym-effectiveness--super'
                    : multiplier < 1
                      ? 'gym-effectiveness--weak'
                      : 'gym-effectiveness--normal';
                return (
                  <button
                    key={option.type}
                    type="button"
                    className="gym-type-btn"
                    style={{ backgroundColor: TYPE_COLORS[option.type] ?? '#888' }}
                    onClick={() => buildWheel(option.type)}
                  >
                    <span className="gym-type-btn__type">{option.type}</span>
                    <span className={`gym-effectiveness ${effectivenessClass}`}>{effectiveness}</span>
                    <span className="gym-type-btn__power">Pwr {Math.round(option.attackerPower * 100)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'result' && <p className="battle-message battle-message--result">{message}</p>}
      </div>

      <SidePanel compact allowSwap={false} allowItems={false} />
    </div>

    {phase === 'prep' && (
      <div className="battle-modal__backdrop">
        <div className="battle-modal battle-prep">
          <h3 className="battle-modal__title">Prepare for Battle</h3>
          <p className="battle-modal__subtitle">
            Swap your party before you face {leader.name}. You can&apos;t swap Pokémon once the battle starts.
          </p>
          <div className="battle-prep__gym-type">
            <span>Gym type:</span>
            <TypeBadge type={leader.type} />
          </div>
          <SidePanel />
          <button type="button" className="btn btn--primary btn--lg" onClick={() => setPhase('intro')}>
            Start Battle
          </button>
        </div>
      </div>
    )}

    {phase === 'spin' && (
      <div className="battle-modal__backdrop">
        <div className="battle-modal battle-spin-modal">
          <p className="battle-message">{message}</p>
          <div className="battle-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={applyXAttack}
              disabled={usedXAttack || xAttackCount === 0}
            >
              {usedXAttack ? 'X-Attack Used' : `Use X-Attack (${xAttackCount})`}
            </button>
          </div>
          <Wheel
            key={wheelKey}
            segments={segments}
            onLand={(segment) => handleLand(segment as BattleWheelSegment)}
          />
        </div>
      </div>
    )}

    {phase === 'victory' && winBadge && (
      <div className="battle-modal__backdrop">
        <div className="battle-modal gym-victory">
          <p className="gym-victory__eyebrow">Gym defeated!</p>
          <h3 className="gym-victory__title">You won the {leader.badgeName}!</h3>
          {winBadge.image && (
            <img src={winBadge.image} alt={winBadge.name} className="gym-victory__badge" />
          )}
          <p className="gym-victory__subtitle">You defeated {leader.name} and earned a new badge.</p>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => {
              stopClips();
              onWin();
            }}
          >
            Continue
          </button>
        </div>
      </div>
    )}
    </>
  );
}
