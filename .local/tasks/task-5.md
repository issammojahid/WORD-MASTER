---
<<<<<<< HEAD
title: Friends: unique player ID display + match invite
---
# Friends: Unique Player ID Display + Match Invite

## What & Why
The friends system exists but two key features are missing:

1. **Unique display ID** — Players have no easy way to share their ID with others. Every player should see their own short code in the format `NAME#XXXX` (e.g. `AISSAM#5821`) on their profile and on the friends screen. The `XXXX` is a deterministic 4-digit number derived from the existing UUID `playerId` stored in AsyncStorage, so no schema change or server round-trip is needed.

2. **Invite friend to match** — Friends can be viewed but cannot be invited to a game. The friends screen should show an "Invite" button next to each accepted friend. Tapping it copies the player's `playerId` to the device clipboard so they can share it in a lobby or future invite flow. (A full real-time invite system is deferred — see Out of scope.)

## Done looks like
- On the friends screen, the player's own code is shown at the top: e.g. "كودك: AISSAM#5821" with a copy-to-clipboard icon
- Searching by player ID (the UUID) still works — no changes to search backend
- Each accepted friend row shows an "Invite" button that copies the friend's player ID to clipboard with haptic feedback and a brief confirmation toast
- The display code is derived from the existing UUID — no database migration needed
- Works identically in Expo Go and APK

## Out of scope
- Real-time socket-based game invites (too complex for this task — full invite system is future work)
- Changing the friend request / accept / reject flow
- Adding the display code to the database (keep it client-side derived)
- Any backend changes

## Tasks
1. **Derive and display player code** — Compute a 4-digit suffix from the last 4 hex characters of the playerId UUID converted to a decimal number (0000–9999). Show the resulting code (e.g. `AISSAM#5821`) at the top of the friends screen and also in the settings/profile section.

2. **Invite button on accepted friends** — Add an "Invite" action button to each accepted friend row. Pressing it uses `expo-clipboard` (already in the project) to copy the friend's `playerId` and shows a brief Arabic confirmation: "تم نسخ المعرف".

## Relevant files
- `app/friends.tsx`
- `app/settings.tsx`
=======
title: Tournament Mode — 8-player bracket with coin entry & prizes
---
# Tournament Mode

## What & Why
Add an 8-player bracket tournament where players pay a coin entry fee (e.g., 100 coins) and compete through Quarter Final → Semi Final → Final rounds. The winner earns a prize (e.g., 1200 coins), XP, and a trophy badge on their profile.

IMPORTANT: Reuse the existing room system for individual matches. Do NOT touch existing matchmaking, socket events, or room creation logic. Tournaments are coordinated through new REST endpoints + new socket events.

## Done looks like
- A "Tournament" tab or section on the home screen shows upcoming/open tournaments.
- Players can join a tournament by paying the entry fee. Once 8 players have joined, the tournament starts.
- The bracket is displayed visually: Quarter Final (4 matches), Semi Final (2 matches), Final (1 match).
- Each match uses the existing game flow (rooms, categories, rounds). After a match ends, the winner advances automatically.
- Players who are eliminated can watch the bracket progress.
- The winner receives coins + XP + a trophy shown on their profile.

## Out of scope
- Spectator live stream of matches.
- More than 8 players per tournament (fixed at 8 for now).
- Scheduled/time-based tournaments (join-and-start when full).

## Tasks
1. **Tournament database schema** — Add `tournaments`, `tournament_players`, and `tournament_matches` tables to `shared/schema.ts`.
2. **Tournament REST API** — Add endpoints: `POST /api/tournament/create`, `POST /api/tournament/:id/join`, `GET /api/tournament/:id`, `GET /api/tournaments/open`. No socket logic modified.
3. **Tournament bracket logic** — Server-side function to generate bracket pairings, advance winners, and mark the tournament complete. Called after each match's `game_over` event is processed.
4. **Tournament socket bridge** — Add a new socket event `tournament_match_result` that the game screen emits after game over if the room is a tournament room, triggering bracket advancement on the server.
5. **Tournament lobby screen** — Build `app/tournament.tsx` with open tournament list, join flow (coin deduction confirmation), bracket visualization, and match status.
6. **Home screen entry point** — Add a "Tournament" entry to the home screen mode selector in `app/index.tsx`.
7. **Trophy on profile** — Show tournament wins as trophy badges on the profile section of `app/index.tsx`.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts`
- `server/gameLogic.ts`
- `app/index.tsx`
- `app/game.tsx`
- `app/lobby.tsx`
>>>>>>> b0d69105d1e4327f68660c2009a41f75b2532491
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`