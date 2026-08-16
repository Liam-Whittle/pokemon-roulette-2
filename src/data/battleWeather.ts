import type { BattleWeather } from './battleField';

/** Fire/Water damage multiplier from weather (Gen II). */
export function weatherTypeMultiplier(moveType: string, weather: BattleWeather): number {
  if (weather === 'sunny') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  if (weather === 'rain') {
    if (moveType === 'fire') return 0.5;
    if (moveType === 'water') return 1.5;
  }
  return 1;
}

export function isSunny(weather: BattleWeather): boolean {
  return weather === 'sunny';
}

export function isRainy(weather: BattleWeather): boolean {
  return weather === 'rain';
}

/** Heal fraction for Morning Sun / Synthesis / Moonlight by weather. */
export function weatherHealFraction(weather: BattleWeather): number {
  if (weather === 'sunny') return 0.66;
  if (weather === 'rain' || weather === 'hail' || weather === 'sandstorm') return 0.25;
  return 0.5;
}

export function weatherLabel(weather: BattleWeather): string {
  switch (weather) {
    case 'sunny':
      return 'Harsh sunlight';
    case 'rain':
      return 'Rain';
    case 'hail':
      return 'Hail';
    case 'sandstorm':
      return 'A sandstorm';
    default:
      return '';
  }
}

export function setWeatherFromMove(slug: string): { weather: BattleWeather; turns: number } | null {
  if (slug === 'sunny-day') return { weather: 'sunny', turns: 5 };
  if (slug === 'rain-dance') return { weather: 'rain', turns: 5 };
  if (slug === 'hail') return { weather: 'hail', turns: 5 };
  if (slug === 'sandstorm') return { weather: 'sandstorm', turns: 5 };
  return null;
}

export function weatherSetMessage(slug: string): string {
  if (slug === 'sunny-day') return 'The sunlight turned harsh!';
  if (slug === 'rain-dance') return 'It started to rain!';
  if (slug === 'hail') return 'It started to hail!';
  if (slug === 'sandstorm') return 'A sandstorm kicked up!';
  return '';
}

export function tickWeather(
  weather: BattleWeather,
  turns: number,
): { weather: BattleWeather; turns: number } {
  if (weather === 'none' || turns <= 0) return { weather: 'none', turns: 0 };
  const next = turns - 1;
  if (next <= 0) return { weather: 'none', turns: 0 };
  return { weather, turns: next };
}
