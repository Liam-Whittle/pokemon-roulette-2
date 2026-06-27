import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchPokemon, fetchPokemonBatch } from '../api/pokeapi';
import { buildMovesForPokemon, buildPartyMoves } from '../data/moves';
import { getTypeEffectiveness, getEffectivenessLabel, TYPE_COLORS } from '../data/typeChart';
import { SidePanel } from './SidePanel';
import { TypeBadge } from './TypeBadge';
import { ItemIcon } from './ItemIcon';
import { MagikarpSplashModal } from './MagikarpSplashModal';
import { HollowPurpleCinematic } from './HollowPurpleCinematic';
import { useGameStore } from '../store/useGameStore';
import { playSfx } from '../utils/sound';
import { playClip, stopClips } from '../utils/music';
import { PokeCenterVisits } from './PokeDollar';
import { asset, PLACEHOLDER_SPRITE } from '../utils/asset';
import {
  computeDamage,
  isFainted,
  maxHpFor,
  moveKey,
  rollCrit,
  safePower,
  XATTACK_BONUS,
} from '../utils/battle';
import type { Badge, BattleMove, GymLeader, PokemonData } from '../types/game';

interface BattleArenaProps {
  title: string;
  leader: GymLeader;
  onWin: () => void;
  onLose: () => void;
  winBadge?: Badge;
  finalVictory?: boolean;
}

type BattlePhase =
  | 'prep'
  | 'choose'
  | 'between'
  | 'forcedSwap'
  | 'victory'
  | 'result';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function HpBar({ current, max, label }: { current: number; max: number; label?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const tone = ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low';
  return (
    <div className="hp-bar-wrap">
      {label && <span className="hp-bar__label">{label}</span>}
      <div className={`hp-bar hp-bar--${tone}${ratio <= 0.2 && ratio > 0 ? ' hp-bar--pulse' : ''}`}>
        <div className="hp-bar__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="hp-bar__text">
        {current}/{max}
      </span>
    </div>
  );
}

export function BattleArena({
  title,
  leader,
  onWin,
  onLose,
  winBadge,
  finalVictory = false,
}: BattleArenaProps) {
  const muted = useGameStore((s) => s.muted);
  const showTypeEffectiveness = useGameStore((s) => s.showTypeEffectiveness);
  const lives = useGameStore((s) => s.lives);
  const party = useGameStore((s) => s.party);
  const bag = useGameStore((s) => s.bag);
  const consumeItem = useGameStore((s) => s.consumeItem);
  const loseLife = useGameStore((s) => s.loseLife);
  const earnBadge = useGameStore((s) => s.earnBadge);
  const addMoney = useGameStore((s) => s.addMoney);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const damagePartyMember = useGameStore((s) => s.damagePartyMember);
  const setActivePartyMember = useGameStore((s) => s.setActivePartyMember);
  const reviveHealAllParty = useGameStore((s) => s.reviveHealAllParty);
  const useMovePp = useGameStore((s) => s.useMovePp);
  const setScreen = useGameStore((s) => s.setScreen);

  const [enemyTeam, setEnemyTeam] = useState<PokemonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [enemyHp, setEnemyHp] = useState(0);
  const [phase, setPhase] = useState<BattlePhase>('prep');
  const [message, setMessage] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [xAttackBuff, setXAttackBuff] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [critFlash, setCritFlash] = useState(false);
  const [damagePopup, setDamagePopup] = useState<{ text: string; side: 'player' | 'enemy' } | null>(
    null,
  );
  const [learnsets, setLearnsets] = useState<Map<number, string[]>>(new Map());
  const [splashGag, setSplashGag] = useState<{ sprite: string; name: string } | null>(null);
  const [hollowPurple, setHollowPurple] = useState(false);

  const logRef = useRef<HTMLDivElement | null>(null);

  const say = useCallback((msg: string) => {
    setMessage(msg);
    setLog((prev) => [...prev, msg]);
  }, []);

  const enemy = enemyTeam[enemyIndex] ?? null;
  const enemyMaxHp = enemy ? maxHpFor(enemy.powerLevel) : 0;
  const activeMember = party[0];

  const xAttackItem = bag.find((item) => item.id === 'xattack');
  const xAttackCount = xAttackItem?.quantity ?? 0;

  const partyMoves = useMemo(
    () => buildPartyMoves(party, learnsets),
    [party, learnsets],
  );

  const hasUsablePokemon = party.some((m) => !isFainted(m));

  // True if any non-fainted party member still has a move with PP to spend. When
  // this is false the player can't act at all and forfeits the battle (loses a life).
  const hasAnyPpMove = partyMoves.some((m) => {
    const owner = party.find((p) => p.caughtAt === m.ownerCaughtAt);
    return !!owner && !isFainted(owner) && m.currentPp > 0;
  });

  const loadLearnsets = useCallback(async () => {
    const ids = [...new Set(useGameStore.getState().party.map((m) => m.id))];
    const datas = await Promise.all(ids.map((id) => fetchPokemon(id).catch(() => null)));
    const map = new Map<number, string[]>();
    datas.forEach((d) => {
      if (d) map.set(d.id, d.moves ?? []);
    });
    setLearnsets(map);
  }, []);

  // Load the enemy team once per leader. This must NOT depend on party state,
  // otherwise taking damage would re-run it and reset the enemy's HP/index.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const enemyIds = leader.pokemon.map((p) => p.id);
    fetchPokemonBatch(enemyIds).then((team) => {
      if (!active) return;
      setEnemyTeam(team);
      setEnemyIndex(0);
      setEnemyHp(maxHpFor(team[0]?.powerLevel ?? 0.3));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [leader]);

  // Load learnsets for the current party (separately, so it never touches enemy state).
  useEffect(() => {
    loadLearnsets();
  }, [loadLearnsets]);

  useEffect(() => () => stopClips(), []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const sendOutNextEnemy = useCallback(
    (index: number, team: PokemonData[]) => {
      const mon = team[index];
      if (!mon) return;
      setEnemyIndex(index);
      setEnemyHp(maxHpFor(mon.powerLevel));
      setXAttackBuff(null);
      say(`${leader.name} sent out ${mon.displayName}!`);
      playSfx('battle', muted);
    },
    [leader.name, muted],
  );

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  };

  const showDamage = (text: string, side: 'player' | 'enemy') => {
    setDamagePopup({ text, side });
    window.setTimeout(() => setDamagePopup(null), 900);
  };

  const handlePartyWipe = useCallback(async () => {
    setPhase('result');
    say('Your whole party fainted!');
    playSfx('fail', muted);
    const nextLives = loseLife();
    reviveHealAllParty();
    setLastResult({
      type: 'gym',
      success: false,
      message:
        nextLives <= 0
          ? `You ran out of lives against ${leader.name}.`
          : `Your party was wiped. ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} remain.`,
    });
    await delay(1400);
    onLose();
  }, [leader.name, loseLife, muted, onLose, reviveHealAllParty, setLastResult]);

  const handleOutOfPp = useCallback(async () => {
    setPhase('result');
    say('Your Pokémon are all out of PP and can no longer fight!');
    playSfx('fail', muted);
    const nextLives = loseLife();
    reviveHealAllParty();
    setLastResult({
      type: 'gym',
      success: false,
      message:
        nextLives <= 0
          ? `You ran out of lives against ${leader.name}.`
          : `Out of PP against ${leader.name}! ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} remain.`,
    });
    await delay(1400);
    onLose();
  }, [leader.name, loseLife, muted, onLose, reviveHealAllParty, setLastResult]);

  // If it's the player's turn but no non-fainted Pokémon has any PP left, there's no
  // legal action — forfeit the battle and lose a life rather than soft-locking.
  useEffect(() => {
    if (phase !== 'choose' || processing) return;
    if (!hasUsablePokemon || hasAnyPpMove) return;
    handleOutOfPp();
  }, [phase, processing, hasUsablePokemon, hasAnyPpMove, handleOutOfPp]);

  const enemyAttack = useCallback(async (): Promise<boolean> => {
    if (!enemy || !activeMember) return false;
    const target = useGameStore.getState().party[0];
    if (!target || isFainted(target)) return false;

    const enemyMoves = buildMovesForPokemon(
      {
        id: enemy.id,
        types: enemy.types,
        moves: enemy.moves,
        powerLevel: enemy.powerLevel,
        displayName: enemy.displayName,
      },
      -1,
      true,
    );
    const move = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
    if (!move) return false;

    let movePower = move.power;
    const effectiveness = getTypeEffectiveness(move.type, target.types);
    const crit = rollCrit();
    const dmg = computeDamage({
      movePower,
      defenderMaxHp: maxHpFor(target.powerLevel),
      effectiveness,
      attackerPower: safePower(enemy.powerLevel),
      defenderPower: safePower(target.powerLevel),
      crit,
    });

    damagePartyMember(target.caughtAt, dmg);
    triggerShake();
    playSfx('hit', muted);
    const effLabel = getEffectivenessLabel(effectiveness);
    say(
      `${leader.name}'s ${enemy.displayName} used ${move.name}!${crit ? ' Critical hit!' : ''} (${effLabel})`,
    );
    showDamage(`-${dmg}`, 'player');

    await delay(1200);

    const updated = useGameStore.getState().party[0];
    if (!updated || isFainted(updated)) {
      const alive = useGameStore.getState().party.some((m) => !isFainted(m));
      if (!alive) {
        await handlePartyWipe();
        return true;
      }
      setPhase('forcedSwap');
      say(`${target.nickname ?? target.displayName} fainted! Choose a replacement.`);
      playSfx('fail', muted);
      return true;
    }
    return false;
  }, [activeMember, damagePartyMember, enemy, handlePartyWipe, leader.name, muted]);

  const handleVictory = useCallback(async () => {
    if (winBadge) {
      earnBadge(winBadge);
      if (!finalVictory) addMoney(100);
    }
    setLastResult({
      type: 'gym',
      success: true,
      badge: winBadge,
      message: finalVictory
        ? `You defeated ${leader.name} and claimed the title!`
        : `You defeated ${leader.name}!`,
    });

    if (winBadge && !finalVictory) {
      playClip(asset('sounds/gym_victory.mp3'));
      setPhase('victory');
      say(`You won the ${leader.badgeName}!`);
      return;
    }

    playSfx('win', muted);
    setPhase('result');
    say(finalVictory ? 'Champion victory!' : `${leader.badgeName} earned!`);
    await delay(1400);
    onWin();
  }, [
    addMoney,
    earnBadge,
    finalVictory,
    leader.badgeName,
    leader.name,
    muted,
    onWin,
    setLastResult,
    winBadge,
  ]);

  const advanceAfterEnemyFaint = useCallback(async () => {
    playSfx('win', muted);
    const nextIndex = enemyIndex + 1;
    if (nextIndex >= enemyTeam.length) {
      await handleVictory();
      return;
    }
    setPhase('between');
    say(`${enemy?.displayName ?? 'The Pokémon'} fainted! Swap if you need to, then continue.`);
    await delay(900);
  }, [enemy?.displayName, enemyIndex, enemyTeam.length, handleVictory, muted]);

  const onMoveClick = async (move: BattleMove) => {
    if (processing || phase !== 'choose' || !enemy) return;
    const owner = party.find((m) => m.caughtAt === move.ownerCaughtAt);
    if (!owner || isFainted(owner)) return;
    if (move.fromActive && move.currentPp <= 0) return;

    // Magikarp's Splash easter egg: play the gag, deal no damage, and crucially do NOT
    // consume the turn (the enemy doesn't get a free hit). Only when used by the active
    // Magikarp — the switch-move variant should still switch normally.
    if (move.splashGag && move.fromActive) {
      const sprite = owner.shiny && owner.shinySprite ? owner.shinySprite : owner.sprite;
      setProcessing(true);
      setSplashGag({ sprite, name: owner.nickname ?? owner.displayName });
      return;
    }

    // Shiny Magikarp's "Hollow Purple": play the win cinematic, never costs a turn.
    if (move.hollowPurple && move.fromActive) {
      setProcessing(true);
      setHollowPurple(true);
      return;
    }

    setProcessing(true);

    if (!move.fromActive) {
      const swapped = setActivePartyMember(move.ownerCaughtAt);
      if (!swapped) {
        setProcessing(false);
        return;
      }
      say(`Go, ${move.ownerDisplayName}!`);
      playSfx('click', muted);
      await delay(950);
      await loadLearnsets();
      const wiped = await enemyAttack();
      if (!wiped) setPhase('choose');
      setProcessing(false);
      return;
    }

    const attacker = useGameStore.getState().party[0];
    if (!attacker || isFainted(attacker)) {
      setProcessing(false);
      return;
    }

    let movePower = move.power;
    const key = moveKey(move.ownerCaughtAt, move.slug);
    if (xAttackBuff === key) movePower += XATTACK_BONUS;

    if (move.currentPp > 0) useMovePp(move.ownerCaughtAt, move.slug, move.maxPp);

    const effectiveness = getTypeEffectiveness(move.type, enemy.types);
    const attackerPower = safePower(attacker.powerLevel);
    const defenderPower = safePower(enemy.powerLevel);
    const quadEffective = effectiveness >= 4;
    // A 4x super-effective hit is devastating: it one-shots a weaker/equal-power
    // foe, or chunks half its max HP if the foe out-powers the attacker.
    const quadOneShot = quadEffective && attackerPower > defenderPower;
    const crit = !quadEffective && rollCrit();

    let dmg: number;
    let powerEdge = false;
    if (quadEffective) {
      dmg = quadOneShot ? enemyHp : Math.ceil(enemyMaxHp / 2);
    } else {
      dmg = computeDamage({
        movePower,
        defenderMaxHp: enemyMaxHp,
        effectiveness,
        attackerPower,
        defenderPower,
        crit,
      });
      // A stronger move that's at least neutral hits harder, scaling with how many
      // power points it has over the foe: +50% at 8+, +70% at 20+, +100% at 25+.
      const powerDiff = (movePower - defenderPower) * 100;
      let edgeMult = 1;
      if (effectiveness >= 1) {
        if (powerDiff >= 25) edgeMult = 2;
        else if (powerDiff >= 20) edgeMult = 1.7;
        else if (powerDiff >= 8) edgeMult = 1.5;
      }
      powerEdge = edgeMult > 1;
      if (powerEdge) dmg = Math.round(dmg * edgeMult);
    }

    const newEnemyHp = Math.max(0, enemyHp - dmg);
    setEnemyHp(newEnemyHp);
    triggerShake();
    playSfx('hit', muted);
    if (crit || quadEffective) {
      setCritFlash(true);
      window.setTimeout(() => setCritFlash(false), 500);
    }

    const effLabel = getEffectivenessLabel(effectiveness);
    const extra = quadOneShot
      ? ' One-shot KO!'
      : quadEffective
        ? ' A devastating blow!'
        : powerEdge
          ? ' Powered-up hit!'
          : crit
            ? ' Critical hit!'
            : '';
    say(
      `${attacker.nickname ?? attacker.displayName} used ${move.name}!${extra} (${effLabel})`,
    );
    showDamage(`-${dmg}`, 'enemy');
    await delay(1200);

    if (newEnemyHp <= 0) {
      await advanceAfterEnemyFaint();
      setProcessing(false);
      return;
    }

    const wiped = await enemyAttack();
    if (!wiped) setPhase('choose');
    setProcessing(false);
  };

  // Using a Potion or Max Elixir mid-battle costs your turn — the enemy gets a free hit.
  const spendItemTurn = useCallback(
    async (msg: string) => {
      if (phase !== 'choose' || processing) return;
      setProcessing(true);
      say(msg);
      await delay(900);
      const wiped = await enemyAttack();
      if (!wiped) setPhase('choose');
      setProcessing(false);
    },
    [enemyAttack, phase, processing, say],
  );

  const applyXAttack = (move: BattleMove) => {
    if (xAttackBuff || xAttackCount === 0 || !consumeItem('xattack', 1)) return;
    setXAttackBuff(moveKey(move.ownerCaughtAt, move.slug));
    say(`X-Attack boosted ${move.name}!`);
    playSfx('item', muted);
  };

  const continueToNextEnemy = () => {
    const nextIndex = enemyIndex + 1;
    sendOutNextEnemy(nextIndex, enemyTeam);
    setPhase('choose');
  };

  const onForcedSwap = (caughtAt: number) => {
    if (setActivePartyMember(caughtAt)) {
      setPhase('choose');
      say('Ready to battle!');
      loadLearnsets();
    }
  };

  if (loading) {
    return (
      <div className="battle-layout">
        <div className="battle-main">
          <p className="loading">Preparing battle…</p>
        </div>
      </div>
    );
  }

  const effectivenessClass = (mult: number) =>
    mult >= 4
      ? 'gym-effectiveness--quad'
      : mult >= 2
        ? 'gym-effectiveness--super'
        : mult < 1
          ? 'gym-effectiveness--weak'
          : 'gym-effectiveness--normal';

  return (
    <>
      <div className={`battle-layout${shake ? ' battle-layout--shake' : ''}${critFlash ? ' battle-layout--crit' : ''}`}>
        <div className="battle-main">
          <h2 className="screen-title">{title}</h2>
          <div className="battle-hud">
            <PokeCenterVisits lives={lives} />
            <span>{leader.badgeName}</span>
            {enemyTeam.length > 1 && (
              <span className="battle-team-pips">
                {enemyTeam.map((_, i) => (
                  <span
                    key={i}
                    className={`battle-team-pip${i < enemyIndex ? ' battle-team-pip--done' : ''}${i === enemyIndex ? ' battle-team-pip--active' : ''}`}
                  />
                ))}
              </span>
            )}
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_SPRITE;
                  }}
                />
              )}
              <div className="gym-enemy">
                <img
                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${enemy.id}.gif`}
                  alt={enemy.displayName}
                  className="gym-enemy__sprite"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = '1';
                      img.src = enemy.sprite || PLACEHOLDER_SPRITE;
                    }
                  }}
                />
                <p>{enemy.displayName}</p>
                <HpBar current={enemyHp} max={enemyMaxHp} />
                <span className="gym-enemy__power">
                  Power {Math.round((Number.isFinite(enemy.powerLevel) ? enemy.powerLevel : 0.3) * 100)}
                </span>
                <div className="gym-enemy__types">
                  {enemy.types.map((type) => (
                    <TypeBadge key={type} type={type} size="sm" />
                  ))}
                </div>
              </div>
              {damagePopup && (
                <span className={`battle-damage battle-damage--${damagePopup.side}`}>
                  {damagePopup.text}
                </span>
              )}
            </div>
          )}

          {message && phase !== 'prep' && (
            <p className="battle-message battle-message--turn">{message}</p>
          )}

          {phase === 'choose' && enemy && hasUsablePokemon && (
            <div className="battle-move-select">
              <p className="battle-move-select__title">Choose a move</p>
              <div className="battle-move-grid">
                {partyMoves.map((move) => {
                  const owner = party.find((m) => m.caughtAt === move.ownerCaughtAt);
                  const fainted = owner ? isFainted(owner) : true;
                  const mult = getTypeEffectiveness(move.type, enemy.types);
                  const eff =
                    mult >= 4
                      ? '4x Super'
                      : mult >= 2
                        ? 'Super'
                        : mult <= 0
                          ? 'No Effect'
                          : mult < 1
                            ? 'Not Very'
                            : 'Effective';
                  const key = moveKey(move.ownerCaughtAt, move.slug);
                  const boosted = xAttackBuff === key;
                  // A move with no PP left is always disabled. If the whole party is
                  // out of PP the battle is forfeited (see the out-of-PP effect).
                  const ppDepleted = move.fromActive && move.currentPp <= 0;
                  const ppLow = move.currentPp <= Math.max(1, Math.floor(move.maxPp * 0.25));
                  if (move.hollowPurple) {
                    return (
                      <div key={key} className="battle-move-cell">
                        <button
                          type="button"
                          className="battle-move-btn battle-move-btn--hollow"
                          disabled={fainted || processing}
                          onClick={() => onMoveClick(move)}
                        >
                          <span className="battle-move-btn__cosmic" aria-hidden />
                          <span className="battle-move-btn__name">{move.name}</span>
                          {showTypeEffectiveness && (
                            <span className="gym-effectiveness gym-effectiveness--godlike">GODLIKE</span>
                          )}
                          <span className="battle-move-btn__meta">{move.ownerDisplayName}</span>
                          <span className="battle-move-btn__footer">
                            <span className="battle-move-btn__power">Pwr ∞</span>
                            <span className="battle-move-btn__pp">PP ∞/∞</span>
                          </span>
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="battle-move-cell">
                      <button
                        type="button"
                        className={`battle-move-btn${fainted || ppDepleted ? ' battle-move-btn--disabled' : ''}${!move.fromActive ? ' battle-move-btn--switch' : ''}`}
                        style={{ backgroundColor: TYPE_COLORS[move.type] ?? '#888' }}
                        disabled={fainted || ppDepleted || processing}
                        onClick={() => onMoveClick(move)}
                      >
                        <span className="battle-move-btn__name">{move.name}</span>
                        {showTypeEffectiveness && (
                          <span className={`gym-effectiveness ${effectivenessClass(mult)}`}>{eff}</span>
                        )}
                        <span className="battle-move-btn__meta">
                          {move.ownerDisplayName}
                          {!move.fromActive && ' · switch (1 turn)'}
                        </span>
                        <span className="battle-move-btn__footer">
                          <span className="battle-move-btn__power">
                            Pwr {Math.round((move.power + (boosted ? XATTACK_BONUS : 0)) * 100)}
                          </span>
                          <span className={`battle-move-btn__pp${ppLow ? ' battle-move-btn__pp--low' : ''}`}>
                            PP {move.currentPp}/{move.maxPp}
                          </span>
                        </span>
                      </button>
                      {move.fromActive && !fainted && (
                        <button
                          type="button"
                          className="battle-move-xattack"
                          title="Use X-Attack on this move"
                          disabled={!!xAttackBuff || xAttackCount === 0 || processing}
                          onClick={() => applyXAttack(move)}
                        >
                          <ItemIcon
                            id="xattack"
                            icon={xAttackItem?.icon ?? '⚔️'}
                            name="X-Attack"
                            className="battle-move-xattack__icon"
                          />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === 'between' && (
            <div className="battle-between">
              <button type="button" className="btn btn--primary" onClick={continueToNextEnemy}>
                Send out next Pokémon
              </button>
            </div>
          )}

          {phase === 'forcedSwap' && (
            <div className="battle-forced-swap">
              <p>Choose a Pokémon to send out:</p>
              <div className="battle-forced-swap__grid">
                {party
                  .filter((m, i) => i !== 0 && !isFainted(m))
                  .map((m) => (
                    <button
                      key={m.caughtAt}
                      type="button"
                      className="battle-forced-swap__btn"
                      onClick={() => onForcedSwap(m.caughtAt)}
                    >
                      <img src={m.sprite} alt={m.displayName} />
                      {m.nickname ?? m.displayName}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {phase === 'result' && <p className="battle-message battle-message--result">{message}</p>}
        </div>

        <div className="battle-side">
          <SidePanel
            compact
            allowSwap={phase === 'prep' || phase === 'between'}
            allowItems={(phase === 'choose' || phase === 'between' || phase === 'forcedSwap') && !processing}
            highlightActive={phase !== 'prep'}
            onPotionUsed={() => spendItemTurn('You used a Potion!')}
            onElixirUsed={() => spendItemTurn('You used a Max Elixir!')}
          />
          {phase !== 'prep' && (
            <div className="battle-log">
              <p className="battle-log__title">Battle Log</p>
              <div className="battle-log__entries" ref={logRef}>
                {log.length === 0 ? (
                  <p className="battle-log__empty">The battle is about to begin…</p>
                ) : (
                  log.map((entry, i) => (
                    <p key={i} className="battle-log__entry">
                      {entry}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {phase === 'prep' && (
        <div className="battle-modal__backdrop">
          <div className="battle-modal battle-prep">
            <h3 className="battle-modal__title">Prepare for Battle</h3>
            <p className="battle-modal__subtitle">
              Swap your party before you face {leader.name}. HP carries over between fights — plan
              ahead!
            </p>
            <div className="battle-prep__gym-type">
              <span>Specialty:</span>
              <TypeBadge type={leader.type} />
            </div>
            <p className="battle-prep__team">
              {leader.name} has {leader.pokemon.length} Pokémon
            </p>
            <SidePanel allowSwap highlightActive={false} />
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => {
                sendOutNextEnemy(0, enemyTeam);
                setPhase('choose');
              }}
            >
              Start Battle
            </button>
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

      {splashGag && (
        <MagikarpSplashModal
          sprite={splashGag.sprite}
          name={splashGag.name}
          onDone={() => {
            // Turn is intentionally not consumed — return to the move menu.
            setSplashGag(null);
            setProcessing(false);
          }}
        />
      )}

      {hollowPurple && (
        <HollowPurpleCinematic
          onComplete={() => {
            stopClips();
            useGameStore.getState().recordChampion();
            setScreen('chadpion');
          }}
        />
      )}
    </>
  );
}
