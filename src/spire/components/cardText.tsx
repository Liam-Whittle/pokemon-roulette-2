import type { ReactNode } from 'react';

export type CardTextKind =
  | 'damage'
  | 'block'
  | 'burn'
  | 'toxic'
  | 'weak'
  | 'vulnerable'
  | 'frail'
  | 'exhaust'
  | 'strength'
  | 'dexterity'
  | 'focus'
  | 'hp'
  | 'petal'
  | 'charge'
  | 'replay'
  | 'draw'
  | 'energy'
  | 'attack'
  | 'skill'
  | 'power'
  | 'num';

export interface CardTextToken {
  text: string;
  kind: CardTextKind | null;
  live?: boolean;
}

const TOKEN_RE =
  /\b(?:0-cost|Charge slots?|Max HP|Exhausted|Exhaust|Vulnerable|Strength|Dexterity|Toxic|Burn|Weak|Frail|Replay|Petals?|Focus|Charges?|Charge)\b|\d+%?/gi;

function keywordKind(token: string): CardTextKind {
  const t = token.toLowerCase();
  if (t === '0-cost') return 'energy';
  if (t.startsWith('block charge')) return 'block';
  if (t.startsWith('attack charge')) return 'charge';
  if (t.startsWith('charge')) return 'charge';
  if (t === 'exhausted' || t === 'exhaust') return 'exhaust';
  if (t === 'vulnerable') return 'vulnerable';
  if (t === 'strength') return 'strength';
  if (t === 'dexterity') return 'dexterity';
  if (t === 'toxic') return 'toxic';
  if (t === 'burn') return 'burn';
  if (t === 'weak') return 'weak';
  if (t === 'frail') return 'frail';
  if (t === 'replay') return 'replay';
  if (t.startsWith('petal')) return 'petal';
  if (t === 'focus' || t === 'max hp') return t === 'focus' ? 'focus' : 'hp';
  return 'num';
}

function classifyNumber(before: string, after: string): CardTextKind {
  const ahead = after.slice(0, 44).toLowerCase().replace(/^[\s%'s]*/, '');
  const behind = before.slice(-32).toLowerCase();

  if (/^(block charges?)\b/.test(ahead)) return 'block';
  if (/^(attack charges?)\b/.test(ahead)) return 'charge';
  if (/^(charge slots?|charges?)\b/.test(ahead)) return 'charge';
  if (/^(burn)\b/.test(ahead)) return 'burn';
  if (/^(toxic)\b/.test(ahead)) return 'toxic';
  if (/^(weak)\b/.test(ahead)) return 'weak';
  if (/^(vulnerable)\b/.test(ahead)) return 'vulnerable';
  if (/^(frail)\b/.test(ahead)) return 'frail';
  if (/^(strength)\b/.test(ahead)) return 'strength';
  if (/^(dexterity)\b/.test(ahead)) return 'dexterity';
  if (/^(focus)\b/.test(ahead)) return 'focus';
  if (/^(petals?)\b/.test(ahead)) return 'petal';
  if (/^(block)\b/.test(ahead) || /of the enemy'?s block/.test(ahead)) return 'block';
  if (/^(max hp|hp)\b/.test(ahead)) return 'hp';
  if (/^(damage|more|extra damage)\b/.test(ahead)) return 'damage';
  if (/less damage|of the damage|unblocked damage/.test(ahead)) return 'damage';
  if (/\bdeal\b/.test(behind)) return 'damage';
  if (/\bdraw\b/.test(behind) || /^(cards?)\b/.test(ahead)) return 'draw';
  return 'num';
}

function changedNumberSlots(printed: string, live: string): Set<number> {
  if (printed === live) return new Set();
  const from = [...printed.matchAll(/\d+/g)].map((m) => m[0]);
  const to = [...live.matchAll(/\d+/g)].map((m) => m[0]);
  const changed = new Set<number>();
  const n = Math.max(from.length, to.length);
  for (let i = 0; i < n; i += 1) {
    if (from[i] !== to[i]) changed.add(i);
  }
  return changed;
}

export function tokenizeCardText(text: string, printed?: string): CardTextToken[] {
  const liveSlots = printed != null ? changedNumberSlots(printed, text) : new Set<number>();
  const tokens: CardTextToken[] = [];
  let cursor = 0;
  let numberSlot = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: text.slice(cursor, index), kind: null });
    const raw = match[0]!;
    if (/^\d+%?$/.test(raw)) {
      tokens.push({
        text: raw,
        kind: classifyNumber(text.slice(0, index), text.slice(index + raw.length)),
        live: liveSlots.has(numberSlot),
      });
      numberSlot += 1;
    } else {
      tokens.push({ text: raw, kind: keywordKind(raw) });
    }
    cursor = index + raw.length;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor), kind: null });
  return tokens;
}

export function formatCardText(text: string, printed?: string): ReactNode {
  const tokens = tokenizeCardText(text, printed);
  return tokens.map((token, index) => {
    if (!token.kind) return token.text;
    const isNum = /^\d+%?$/.test(token.text);
    return (
      <em
        key={`${token.kind}-${index}`}
        className={[
          isNum ? 'spire-card__num' : 'spire-card__kw',
          `spire-card__kw--${token.kind}`,
          token.live ? 'spire-card__num--live' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {token.text}
      </em>
    );
  });
}
