import { tokenizeCardText, type CardTextKind } from '../components/cardText';

export interface KeywordTip {
  kind: CardTextKind;
  title: string;
  body: string;
}

export const STATUS_TIPS: Record<string, { title: string; body: string }> = {
  weak: {
    title: 'Weak',
    body: 'Attacks deal 25% less damage. Loses 1 stack at the end of this Pokémon’s turn.',
  },
  frail: {
    title: 'Frail',
    body: 'Attacks ignore 50% of Block — half the damage goes through to HP, and the other half is applied to Block. Loses 1 stack at the end of this Pokémon’s turn.',
  },
  vulnerable: {
    title: 'Vulnerable',
    body: 'Takes 50% more attack damage. Loses 1 stack at the end of this Pokémon’s turn.',
  },
  burn: {
    title: 'Burn',
    body: 'Takes damage equal to its stacks at the end of its turn, then loses 1 stack.',
  },
  toxic: {
    title: 'Toxic',
    body: 'Takes damage equal to its stacks as soon as you end your turn, before this Pokémon acts. Hits HP directly and ignores Block, then loses 1 stack.',
  },
};

const KEYWORD_TIPS: Partial<Record<CardTextKind, KeywordTip>> = {
  seed: {
    kind: 'seed',
    title: 'Seed',
    body: 'A 0-cost Skill token. Heal 2 HP. If it is discarded, apply 1 Toxic. Exhaust. Seeds are created in combat and never appear as card rewards.',
  },
  petal: {
    kind: 'petal',
    title: 'Petal',
    body: 'A 0-cost Attack token. Deal 5 damage, ignoring Strength. Exhaust. Petals are created in combat and never appear as card rewards.',
  },
  toxic: { kind: 'toxic', title: STATUS_TIPS.toxic!.title, body: STATUS_TIPS.toxic!.body },
  burn: { kind: 'burn', title: STATUS_TIPS.burn!.title, body: STATUS_TIPS.burn!.body },
  frail: { kind: 'frail', title: STATUS_TIPS.frail!.title, body: STATUS_TIPS.frail!.body },
  weak: { kind: 'weak', title: STATUS_TIPS.weak!.title, body: STATUS_TIPS.weak!.body },
  vulnerable: {
    kind: 'vulnerable',
    title: STATUS_TIPS.vulnerable!.title,
    body: STATUS_TIPS.vulnerable!.body,
  },
  charge: {
    kind: 'charge',
    title: 'Charge',
    body: 'Attack Charges deal damage and Block Charges give Block at the end of your turn. Base potency is 4, plus Focus.',
  },
  focus: {
    kind: 'focus',
    title: 'Focus',
    body: 'Each stack increases Charge potency by 1.',
  },
  replay: {
    kind: 'replay',
    title: 'Replay',
    body: 'When you play this card, its effect happens twice.',
  },
  strength: {
    kind: 'strength',
    title: 'Strength',
    body: 'Your Attacks deal 1 more damage for each stack. Some hits, like Petals, ignore Strength.',
  },
  dexterity: {
    kind: 'dexterity',
    title: 'Dexterity',
    body: 'You gain 1 more Block from cards for each stack.',
  },
  exhaust: {
    kind: 'exhaust',
    title: 'Exhaust',
    body: 'Removed from this combat after you play it. It returns to your deck afterward.',
  },
  discard: {
    kind: 'discard',
    title: 'Discard',
    body: 'Card effects and relics that discard trigger “If this is discarded” bonuses. Cards left in your hand at the end of your turn do not.',
  },
  energy: {
    kind: 'energy',
    title: '0-cost',
    body: 'Costs no Energy to play.',
  },
};

const TIP_ORDER: CardTextKind[] = [
  'seed',
  'petal',
  'toxic',
  'burn',
  'frail',
  'weak',
  'vulnerable',
  'charge',
  'focus',
  'replay',
  'strength',
  'dexterity',
  'exhaust',
  'discard',
  'energy',
];

export const CARD_KEYWORD_HOVER_MS = 900;

export function cardKeywordTips(text: string, extraKinds: CardTextKind[] = []): KeywordTip[] {
  const seen = new Set<CardTextKind>();
  for (const token of tokenizeCardText(text)) {
    if (token.kind && KEYWORD_TIPS[token.kind]) seen.add(token.kind);
  }
  for (const kind of extraKinds) {
    if (KEYWORD_TIPS[kind]) seen.add(kind);
  }
  return TIP_ORDER.filter((kind) => seen.has(kind)).map((kind) => KEYWORD_TIPS[kind]!);
}

export function extraKeywordKindsForCard(defId: string, replay = 0): CardTextKind[] {
  const extra: CardTextKind[] = [];
  if (defId === 'seed') extra.push('seed');
  if (defId === 'petal') extra.push('petal');
  if (replay > 0) extra.push('replay');
  return extra;
}
