---
<<<<<<< HEAD
title: Fix scoring system + APK network (tasks/achievements/friends)
---
# Core Game Fixes: Scoring + APK Network

## What & Why
Two critical correctness bugs are breaking the core gameplay experience.

**Bug 1 — Wrong scoring values:** The server awards 3 points for a correct unique answer and 0 for a duplicate. The correct rules are: valid unique word → 10 pts, duplicate between players → 5 pts, empty/invalid → 0 pts. The AI game already uses 10/0 — it also needs updating to 10/5/0 for the duplicate case.

**Bug 2 — APK network failure (tasks, achievements, friends):** `tasks.tsx`, `achievements.tsx`, and `friends.tsx` each define a local `apiFetch` helper that uses the global React Native `fetch`. On Android APK builds, this behaves differently from `expo/fetch` (which the rest of the app uses). The result is that those three screens appear blank in the APK.

## Done looks like
- A correct valid word awards 10 points (not 3) in multiplayer
- A word that both players wrote awards 5 points each (not 0)
- An empty field awards 0 points — unchanged
- The score display in the round result screen shows +10 or +5 correctly
- Tasks, Achievements, and Friends screens load their data in the APK

## Out of scope
- Changing the word database or validation logic
- Changing the rapid-fire (rapid.tsx) match scoring
- Changing the tournament scoring
- Any UI redesign

## Tasks
1. **Fix server scoring constants** — In `server/gameLogic.ts`, change the correct-answer score from 3 to 10, and change the duplicate-answer score from 0 to 5. Both changes are in `calculateRoundResults`.

2. **Fix AI game duplicate scoring** — In `app/ai-game.tsx` the duplicate case awards 0 to the player. Update it to award 5 pts when both player and AI wrote the same valid word, and update the status label to show "مكرر" (duplicate) with the correct colour.

3. **Fix APK network in tasks/achievements/friends** — In all three files, replace the file-local `apiFetch` helper's `fetch(...)` call with `fetch` imported from `"expo/fetch"`, matching the pattern already used in `tournament.tsx`.

## Relevant files
- `server/gameLogic.ts:263-305`
- `app/ai-game.tsx:220-290`
- `app/tasks.tsx:33-45`
- `app/achievements.tsx:33-45`
- `app/friends.tsx:33-45`
=======
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
>>>>>>> b0d69105d1e4327f68660c2009a41f75b2532491
- `constants/colors.ts`