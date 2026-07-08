import type { SpinnerSegment } from '../components/Wheel';
import { ITEM_SPRITES } from '../data/icons';
import type { ChaosEffectId } from './protocol';

export const CHAOS_WHEEL_SEGMENTS: (SpinnerSegment & { id: ChaosEffectId })[] = [
  {
    id: 'rarecandy',
    label: 'Rare Candy',
    color: '#f9a8d4',
    icon: '🍬',
    image: ITEM_SPRITES.rarecandy,
    weight: 1,
  },
  {
    id: 'lose_potion',
    label: '-1 Potion',
    color: '#f87171',
    icon: '💊',
    image: ITEM_SPRITES.potion,
    weight: 1,
  },
  {
    id: 'xattack_both',
    label: 'X-Attack Both',
    color: '#fbbf24',
    icon: '⚔️',
    image: ITEM_SPRITES.xattack,
    weight: 1,
  },
  {
    id: 'skip_turn',
    label: 'Skip Turn',
    color: '#94a3b8',
    icon: '⏭️',
    image: ITEM_SPRITES.escaperope,
    weight: 1,
  },
  {
    id: 'random_swap',
    label: 'Random Swap',
    color: '#a78bfa',
    icon: '🔄',
    image: ITEM_SPRITES.ejectbutton,
    weight: 1,
  },
  {
    id: 'elixir',
    label: 'Free Elixir',
    color: '#38bdf8',
    icon: '🧪',
    image: ITEM_SPRITES.maxelixer,
    weight: 1,
  },
];

export function chaosOutcomeLabel(effect: ChaosEffectId): string {
  switch (effect) {
    case 'rarecandy':
      return 'Chaos: Free Rare Candy!';
    case 'lose_potion':
      return 'Chaos: Lost 1 Potion!';
    case 'xattack_both':
      return 'Chaos: X-Attack on both active moves!';
    case 'skip_turn':
      return 'Chaos: You skip your next turn!';
    case 'random_swap':
      return 'Chaos: Random party swap!';
    case 'elixir':
      return 'Chaos: Active Pokémon PP restored!';
    default:
      return 'Chaos effect applied.';
  }
}
