# Pokéspin Nuzlocke

A polished, animation-rich Pokémon adventure game inspired by [pokemon-roulette](https://github.com/zeroxm/pokemon-roulette). Choose a region, spin hub wheels, catch Pokémon, battle Gym Leaders and the Elite Four, and chase a Hall of Fame run.

**▶️ Play now: [liam-whittle.github.io/pokemon-roulette-2](https://liam-whittle.github.io/pokemon-roulette-2/)**

## Features

- **Three regions** — Kanto, Johto, and Hoenn, each with their own starters, gyms, Champion, music, and encounter pools. Johto and Hoenn unlock after you Hall of Fame the previous region.
- **Spin wheels** — flick the wheel to spin, or use Quick Spin. Landings use weighted wedges (you cannot nudge a chosen result).
- **Pathway hub** — pick **Catch Pokémon** or **Explore World**. If you own Mew's Mischief, that path can occasionally replace the usual two.
- **Catch Pokémon** — spin a wheel of regional species, pick a Poké Ball, then throw. Catches use Gen-style shake math: ball type and the Pokémon's catch rate set the odds, and failed throws add a small bonus to the next try.
- **Explore World** — trainers, rival fights, Team Rocket (or Team Magma / Aqua in Hoenn), items, money, stones, Rare Candy, Full Heal, and Uber Spin.
- **Gym gauntlet → Elite Four → Champion** — a gym appears every few hub spins. Earn all eight badges, use the prep spins to shop and train, then take on the Elite Four and Champion in a gauntlet.
- **Nuzlocke pressure** — fainted Pokémon stay down, and you have two lives per run (one on Hardcore). Party of five, with PC storage for extras.
- **Battle depth** — type matchups, abilities, weather, status, volatiles (Fly/Dig, Substitute, and more), PP that drains in battle and refills at the hub, switching, and items.
- **Trainer Card** — open your trainer profile from the hub to review party, badges, run stats, and active modifiers (hover a modifier for what it does).
- **Prestige unlocks** — spend points after a Hall of Fame on run modifiers such as Shiny Charm+, Hardcore Nuzlocke, Game Corner, MissingNo., and more.
- **Shiny hunting** — every catch rolls a shiny check (boosted by the Shiny Charm), with animated holographic detail cards.
- **Persistent progress** — Pokédex, party, bag, badges, money, prestige, and Hall of Fame saved to localStorage.
- **Polished UX** — Framer Motion animations, type-colored theming, confetti, music, and Web Audio SFX.
- **Settings** — music volume, mute, exit-to-title, and an option to hide type-effectiveness hints for a harder run.
- **Local Pokémon data** — species, moves, and sprites ship with the game; cries can fall back to [PokeAPI](https://pokeapi.co/).

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

Set `VITE_MULTIPLAYER_ENABLED=true` to expose multiplayer spectate options on the title screen (requires STUN/TURN configuration).

## How to Play

1. Create your trainer and pick a region (Kanto, Johto, Hoenn, or random). You receive a **random regional starter**.
2. On the **Adventure Hub**, choose a pathway and **flick** the wheel (or Quick Spin).
3. Land on a segment to start an activity:
   - **Catch Pokémon** — spin a wheel of wild species, choose a ball, and try to catch it. Better balls raise the odds.
   - **Explore World** — trainer and rival battles, villain teams, items, money, stones, and more.
   - **Poké Mart** — spend winnings on balls and helpful items.
   - **Game Corner** — if unlocked, bet on Pokémon slots next to the Mart.
   - **Gym Battle** — after a few hub spins, challenge the next Gym Leader for a badge.
4. Open your **Trainer Card** from the hub to check party, badges, lives, and run modifiers.
5. Earn all gym badges, use the prep spins, then take on the **Elite Four and Champion**.
6. Track everything in the **Pokédex**, **Party**, **Bag**, and **Hall of Fame**.

## Tech Stack

- React 19 + Vite + TypeScript
- Framer Motion (animations)
- Zustand (state + persistence)
- Local species cache, with [PokeAPI](https://pokeapi.co/) as a cry/data fallback

## Disclaimer

Pokémon and related trademarks are property of Nintendo/Game Freak/The Pokémon Company. This is a fan project for educational purposes.
