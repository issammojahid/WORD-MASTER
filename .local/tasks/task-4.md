---
title: Rapid Mode — first correct word wins
---
# Rapid Mode — First Word Wins

## What & Why
Add a fast new game mode called "Rapid Mode" where a random Arabic letter appears and the first player to submit a valid word starting with that letter wins the round instantly. This gives the game a shorter, more reactive experience alongside the existing category-fill mode.

IMPORTANT: Add new socket events (`rapid_join`, `rapid_start`, `rapid_word`, `rapid_round_result`) without modifying any existing socket events, matchmaking, or room logic.

## Done looks like
- A "Rapid Mode" button appears on the home screen alongside Quick Match and Friends.
- Players enter a lobby where 2 players are matched (reuses the existing matchmaking queue with a `mode: "rapid"` flag).
- A random Arabic letter flashes on screen. Both players have a text field to type a word.
- The first player to submit a correct word wins the round. A correct word must start with the letter and be found in the words database.
- Best of 5 rounds. After 5 rounds the player with more round wins wins the match.
- Clear visual: the winning word flashes green, the losing player's field shows their attempt struck through.
- Results screen matches the existing game over flow (XP / coins awarded).

## Out of scope
- Coin entry staking in Rapid Mode (kept free for now, or optionally hooks into the economy task).
- Rapid Mode in Tournament brackets (future).

## Tasks
1. **Backend rapid mode logic** — Add server-side rapid room management: track which mode a room is in, add `rapid_word` socket event that validates the first submission and emits `rapid_round_result` to all players in the room. Add a `rapid_letter` event that broadcasts a random Arabic letter to start each round.
2. **Rapid matchmaking** — Extend the matchmaking queue entry with a `mode` field. When mode is `"rapid"`, create a rapid room instead of a standard one. Existing `findMatch` (standard) flow is untouched.
3. **Rapid game screen** — Build `app/rapid.tsx` with: large letter display, countdown per round (10 seconds), text input for word submission, animated round result, and score tracker (Player 1 wins: X / Player 2 wins: Y).
4. **Home screen entry point** — Add a "Rapid Mode" card/button to the home screen carousel/mode selector in `app/index.tsx`.

## Relevant files
- `server/routes.ts`
- `server/gameLogic.ts`
- `server/wordDatabase.ts`
- `app/index.tsx`
- `app/lobby.tsx`
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`