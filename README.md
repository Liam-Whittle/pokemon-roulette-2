# Pokéspin Nuzlocke

A polished, animation-rich Pokémon adventure game inspired by [pokemon-roulette](https://github.com/zeroxm/pokemon-roulette). Spin the Adventure Wheel, throw Poké Balls, catch Pokémon, battle Gym Leaders and the Elite Four, and build your collection.

**▶️ Play now: [liam-whittle.github.io/pokemon-roulette-2](https://liam-whittle.github.io/pokemon-roulette-2/)**

## Features

- **Skill-based spin wheel** — drag and flick to spin; the outcome depends on your flick velocity and angle, not a random button click
- **Interactive catch mini-game** — drag back and release to throw a Poké Ball, then nail a timing ring to secure the catch (ball type affects difficulty)
- **Encounter wheels** — Wild Encounters, Fishing, Cave, and Fossil Revival each spin a wheel of the Pokémon you can run into, with backgrounds themed to the activity
- **Gym gauntlet → Elite Four → Champion** — turn-based battles with type matchups, party switching, items (Potions, Max Elixir, X-Attack), and a prep phase before the Elite Four
- **Battle depth** — type effectiveness tags, power-advantage damage bonuses, devastating 4× super-effective hits, and PP that drains across a battle but refills back at the hub
- **Shiny hunting** — every catch rolls a shiny check (boosted by the Shiny Charm), with animated holographic detail cards
- **Persistent progress** — Pokédex, party, bag, badges, money, and Hall of Fame saved to localStorage
- **Polished UX** — Framer Motion animations, type-colored theming, confetti, music, and Web Audio SFX
- **Settings & accessibility** — volume slider, mute, exit-to-title, and an option to hide type-effectiveness hints for a harder run
- **PokeAPI integration** — sprites, cries, and data fetched live with caching

> Tip: there may be a secret or two hiding for trainers who raise the right Pokémon. ✨

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
  - **Wild Encounter / Fishing / Cave / Fossil** — spin the encounter wheel, then play the catch mini-game
  - **Find Item** — discover items for your bag
  - **Shop** — spend your winnings on balls and helpful items
  - **Gym Battle** — build a balanced team and exploit type matchups to earn badges
4. Earn all 8 badges, survive the prep phase, then take on the **Elite Four and Champion**
5. Track everything in the **Pokédex**, **Party**, **Bag**, and **Hall of Fame**

## Tech Stack

- React 19 + Vite + TypeScript
- Framer Motion (animations)
- Zustand (state + persistence)
- [PokeAPI](https://pokeapi.co/) (Pokémon data)

## Disclaimer

Pokémon and related trademarks are property of Nintendo/Game Freak/The Pokémon Company. This is a fan project for educational purposes.