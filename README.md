# Pokémon Catch Quest

A polished, animation-rich Pokémon adventure game inspired by [pokemon-roulette](https://github.com/zeroxm/pokemon-roulette). Spin the Adventure Wheel with skill, throw Poké Balls, catch Pokémon, battle Gym Leaders, and build your collection.

**Play locally:** run the dev server and open `http://localhost:5173`

## Features

- **Skill-based manual spin wheel** — drag and flick to spin; outcome depends on your flick velocity and angle, not a random button click
- **Interactive catch mini-game** — drag back and release to throw a Poké Ball, then tap a timing ring to secure the catch
- **Adventure activities** — Wild Encounters, Fishing, Find Item, Gym Battles (type matchups)
- **Persistent progress** — Pokédex, party (6 slots), bag, and badges saved to localStorage
- **Polished UI** — Framer Motion animations, type-colored theming, confetti on catch, Web Audio SFX
- **PokeAPI integration** — Pokémon sprites and data fetched live with caching

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
npm run preview
```

## How to Play

1. Create your trainer on the title screen
2. On the **Adventure Hub**, drag the wheel and **flick** to spin it
3. Land on a segment to start an activity:
   - **Wild Encounter** — throw a Poké Ball and time your catch
   - **Fishing** — cast, reel when you get a bite, then catch the Pokémon
   - **Find Item** — discover items for your bag
   - **Gym Battle** — pick the right attack type to earn badges
4. Track progress in the **Pokédex**, **Party**, and **Bag**

## Tech Stack

- React 19 + Vite + TypeScript
- Framer Motion (animations)
- Zustand (state + persistence)
- [PokeAPI](https://pokeapi.co/) (Pokémon data)

## Coming Soon

Legendary hunts, cave exploration, fossil revival, and Elite Four battles are stubbed on the wheel for future updates.

## Disclaimer

Pokémon and related trademarks are property of Nintendo/Game Freak/The Pokémon Company. This is a fan project for educational purposes.
