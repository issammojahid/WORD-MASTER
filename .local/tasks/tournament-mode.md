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
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`
