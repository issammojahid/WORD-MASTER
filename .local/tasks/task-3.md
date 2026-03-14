---
title: Player backend persistence & economy (coin entry, daily spin, win streak)
---
# Player Backend & Core Economy

## What & Why
Right now all player data (coins, XP, level, skins) lives only in AsyncStorage on the device. This makes it impossible to have leaderboards, persistent streaks, coin-gated matches, or social features. This task migrates player data to the server (PostgreSQL via Drizzle ORM) and builds the three core engagement features that depend on it: coin entry for matches, daily spin wheel, and win streak system.

IMPORTANT: Do NOT modify existing socket.io events, matchmaking logic, room creation, or Railway server config. New endpoints and logic can be ADDED but nothing existing is changed.

## Done looks like
- Player profiles are saved server-side. Coins/XP earned in a match persist across devices/reinstalls.
- Before joining a quick match, players select an entry (50 / 100 / 500 / 1000 coins). They are only matched with players who chose the same entry. Coins deducted on match start, winner gets 2× (or 2.5×) back.
- A daily spin wheel screen is accessible from the home screen. Players spin once per 24 hours and receive a random reward (coins, XP). A countdown shows the time until the next spin.
- Win streaks are tracked server-side. After 3 / 5 / 10 consecutive wins, a reward banner shows and bonus coins are credited.
- Profile screen and home screen XP/coin display pull from server, with AsyncStorage as an offline fallback.

## Out of scope
- Friends, clans, ranked mode, tournament — handled in separate tasks.
- Avatar/frame cosmetics store — separate task.
- Rapid mode — separate task.

## Tasks
1. **Database schema** — Add `player_profiles`, `daily_spins`, and `win_streaks` tables to `shared/schema.ts`. Run Drizzle migration.
2. **Player API endpoints** — Add `GET /api/player/:id`, `PUT /api/player/:id` (coins/XP update), `POST /api/player/:id/spin` (daily spin), `GET /api/player/:id/streak` to `server/routes.ts` without touching existing socket logic.
3. **Coin entry matchmaking extension** — Add a `coinEntry` field to the matchmaking queue so players with different entries never match. On `game_started`, deduct coins; on `game_over`, credit winner. Add these as new socket listeners alongside existing ones, do not rewrite `findMatch`.
4. **PlayerContext migration** — Update `contexts/PlayerContext.tsx` to sync with the new server endpoints on load and after each game, keeping AsyncStorage as cache for offline use.
5. **Daily spin UI** — Add a spin wheel modal/screen (`app/spin.tsx`) with animated wheel, prize display, and 24-hour countdown timer. Triggered from a button on the home screen.
6. **Coin entry selection UI** — Add a modal on the home screen where players pick their stake before pressing Quick Match. Show current coin balance and estimated win amount.
7. **Win streak UI** — Show a flame streak counter on the home screen and profile. Display a celebratory banner modal when milestone rewards (3/5/10 wins) are reached.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts`
- `server/storage.ts`
- `contexts/PlayerContext.tsx`
- `app/index.tsx`
- `app/game.tsx`
- `constants/colors.ts`