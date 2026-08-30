import { useEffect, useState } from 'react';
import { findRelicDef, relicSpriteCandidates } from '../data/relics';
import { getPotionDef } from '../data/potions';
import { SpireTip } from './SpireTip';

export function EnergyPips({ energy, max }: { energy: number; max: number }) {
  const pips = Math.max(0, Math.max(max, energy));
  return (
    <div className="spire-energy" aria-label={`${energy} of ${max} energy`}>
      {Array.from({ length: pips }, (_, i) => (
        <span key={i} className={i < energy ? 'spire-energy__pip is-on' : 'spire-energy__pip'} />
      ))}
      <span className="spire-energy__label">
        {energy}/{max}
      </span>
    </div>
  );
}

export function RelicIcon({ id, name }: { id: string; name: string }) {
  const sources = relicSpriteCandidates(id);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = sources[index];

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [id, sources[0]]);

  if (failed || !src) {
    return <span className="spire-relic__fallback">{name.slice(0, 1)}</span>;
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="spire-relic__icon"
      onError={() => {
        if (index + 1 < sources.length) setIndex(index + 1);
        else setFailed(true);
      }}
    />
  );
}

export function RelicBar({ relics }: { relics: string[] }) {
  return (
    <div className="spire-relics">
      {relics.map((id, i) => {
        const def = findRelicDef(id);
        if (!def) return null;
        return (
          <SpireTip key={`${id}-${i}`} title={def.name} body={def.description} side="bottom">
            <span className="spire-relic" tabIndex={0} aria-label={def.name}>
              <RelicIcon id={id} name={def.name} />
            </span>
          </SpireTip>
        );
      })}
    </div>
  );
}

export function PotionBar({
  potions,
  onUse,
}: {
  potions: (string | null)[];
  onUse?: (slot: number) => void;
}) {
  return (
    <div className="spire-potions">
      {potions.map((id, slot) => {
        if (!id) {
          return (
            <span key={`empty-${slot}`} className="spire-potion spire-potion--empty">
              Empty
            </span>
          );
        }
        const def = getPotionDef(id);
        return (
          <SpireTip key={`${id}-${slot}`} title={def.name} body={def.description} side="bottom">
            <button
              type="button"
              className="spire-potion"
              disabled={!onUse}
              onClick={() => onUse?.(slot)}
            >
              {def.name}
            </button>
          </SpireTip>
        );
      })}
    </div>
  );
}

export function HpBar({
  hp,
  max,
  block = 0,
  toxic = 0,
  tone = 'ok',
}: {
  hp: number;
  max: number;
  block?: number;
  toxic?: number;
  tone?: 'ok' | 'foe';
}) {
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (hp / safeMax) * 100));
  const extraPct = block > 0 ? Math.max(0, Math.min(100 - pct, (block / safeMax) * 100)) : 0;
  const poison = Math.max(0, toxic);
  const poisonHp = Math.min(Math.max(0, hp), poison);
  const poisonPct = (poisonHp / safeMax) * 100;
  const poisonLeft = ((hp - poisonHp) / safeMax) * 100;
  const lethal = poison > 0 && hp > 0 && poison >= hp;
  return (
    <div className={`spire-hp-wrap${block > 0 ? ' has-block' : ''}${poison > 0 ? ' has-toxic' : ''}${lethal ? ' is-lethal-toxic' : ''}`}>
      <div
        className={`spire-hp spire-hp--${tone}${block > 0 ? ' has-block' : ''}${poison > 0 ? ' has-toxic' : ''}${lethal ? ' is-lethal-toxic' : ''}`}
        aria-label={
          poison > 0
            ? `${hp} of ${max} HP, ${poison} Toxic${lethal ? ', lethal' : ''}`
            : block > 0
              ? `${hp} of ${max} HP, ${block} Block`
              : `${hp} of ${max} HP`
        }
      >
        <div className="spire-hp__fill" style={{ width: `${pct}%` }} />
        {block > 0 && pct > 0 && <div className="spire-hp__block-overlay" style={{ width: `${pct}%` }} />}
        {extraPct > 0 && (
          <div className="spire-hp__block-extra" style={{ left: `${pct}%`, width: `${extraPct}%` }} />
        )}
        {poisonPct > 0 && (
          <div className="spire-hp__toxic" style={{ left: `${poisonLeft}%`, width: `${poisonPct}%` }} />
        )}
        <span className={`spire-hp__label${lethal ? ' is-lethal' : ''}`}>
          {hp}/{max}
          {poison > 0 && <span className="spire-hp__toxic-amt">−{poison}</span>}
        </span>
      </div>
      {block > 0 && (
        <span className="spire-hp__shield" title={`${block} Block`}>
          {block}
        </span>
      )}
    </div>
  );
}
