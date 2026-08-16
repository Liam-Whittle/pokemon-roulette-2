# Pokéspin Nuzlocke

A polished, animation-rich Pokémon adventure game inspired by [pokemon-roulette](https://github.com/zeroxm/pokemon-roulette). Choose a region, spin pathway wheels, catch Pokémon, battle Gym Leaders and the Elite Four, and chase a Hall of Fame run.

**▶️ Play now: [liam-whittle.github.io/pokemon-roulette-2](https://liam-whittle.github.io/pokemon-roulette-2/)**

## Features

- **Three regions** — Kanto, Johto, and Hoenn, each with their own starters, gyms, Champion, music, and encounter pools
- **Skill-based spin wheels** — drag and flick to spin; the outcome depends on your flick velocity and angle, not a random button click
- **Pathway hub** — pick **Catch Pokémon** or **Explore World** (and sometimes Mew's Mischief), then spin a themed wheel
- **Interactive catch mini-game** — drag back and release to throw a Poké Ball, then nail a timing ring to secure the catch (ball type affects difficulty)
- **Encounter wheels** — Grass, Fishing, Cave, Fossil, and Legendary each spin a wheel of the Pokémon you can run into
- **Gym gauntlet → Elite Four → Champion** — turn-based battles with type matchups, abilities, party switching, items, and a prep phase before the Elite Four
- **Battle depth** — type effectiveness, weather, status, volatiles (Fly/Dig, Substitute, and more), PP that drains in battle and refills at the hub
- **Trainer Card** — open your trainer profile from the hub to review party, badges, run stats, and active modifiers (hover a modifier for what it does)
- **Prestige unlocks** — spend points on run modifiers like Shiny Charm+, Hardcore Nuzlocke, Game Corner, and MissingNo.
- **Shiny hunting** — every catch rolls a shiny check (boosted by the Shiny Charm), with animated holographic detail cards
- **Persistent progress** — Pokédex, party, bag, badges, money, and Hall of Fame saved to localStorage
- **Polished UX** — Framer Motion animations, type-colored theming, confetti, music, and Web Audio SFX
- **Settings & accessibility** — volume slider, mute, exit-to-title, and an option to hide type-effectiveness hints for a harder run
- **PokeAPI integration** — sprites, cries, and data fetched live with caching (core art and cries also ship locally)

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
npm run test
npm run audit-moves
npm run preview
```

Set `VITE_MULTIPLAYER_ENABLED=true` to expose multiplayer options on the title screen (requires STUN/TURN configuration).

## How to Play

1. Create your trainer and pick a region (Kanto, Johto, Hoenn, or random)
2. On the **Adventure Hub**, choose a pathway and **flick** the wheel
3. Land on a segment to start an activity:
   - **Catch path** — Grass, Fishing, Cave, Fossil, or a rare Legendary encounter, then play the catch mini-game
   - **Explore path** — trainers, items, rival fights, Team Rocket / Team Aqua, money, stones, and more
   - **Shop / Poké Mart** — spend winnings on balls and helpful items
   - **Game Corner** — if unlocked, bet on slots next to the Mart
   - **Gym Battle** — build a balanced team and exploit type matchups to earn badges
4. Open your **Trainer Card** from the hub to check party, badges, and run modifiers
5. Earn all gym badges, survive the prep phase, then take on the **Elite Four and Champion**
6. Track everything in the **Pokédex**, **Party**, **Bag**, and **Hall of Fame**

## Tech Stack

- React 19 + Vite + TypeScript
- Framer Motion (animations)
- Zustand (state + persistence)
- [PokeAPI](https://pokeapi.co/) (Pokémon data)

## Disclaimer

Pokémon and related trademarks are property of Nintendo/Game Freak/The Pokémon Company. This is a fan project for educational purposes.
