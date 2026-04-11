# AI Bot Fallback for Quick Match

## What & Why
In "مباراة سريعة" (findMatch mode), when no human opponent is found after 15 seconds, an AI bot automatically joins so the player can start playing immediately instead of waiting indefinitely.

## Done looks like
- Player taps "مباراة سريعة" — sees "جاري البحث..." as usual
- If no human is found within 15 seconds, an AI bot joins automatically
- The game starts normally with countdown then matchFound
- The AI submits answers after a realistic random delay (6–12 seconds per round)
- The AI picks valid Arabic words from the word database for each category
- The player can play all rounds against the AI
- After each round, the AI automatically submits answers for the next round too
- No ELO points are gained/lost for bot matches
- If the player had paid a coin entry, it is refunded before the bot match starts (bot matches are free)
- Cancelling before the 15-second timeout still works normally

## Out of scope
- AI for rapid mode or friend rooms
- Adaptive AI difficulty
- Any client-side changes (the bot appears as a regular player)

## Tasks

1. **Add bot tracking data structures** — Add two new Maps at the top of `server/routes.ts`:
   - `botRooms: Map<roomId, botSocketId>` — tracks which rooms have an AI bot
   - `matchmakingTimeouts: Map<socketId, TimeoutHandle>` — stores the 15-second fallback timer per queued player
   Also define bot name/skin arrays and a `generateBotAnswers(letter, categories)` helper that uses `getWordsForLetter` to pick a random valid word per category.

2. **Add `scheduleBotSubmission` helper** — A function that, after a given delay, calls `submitAnswers(roomId, botId, answers)` with AI-generated answers. If `allSubmitted` is true after submission, clears the round timer and emits `round_results` to the room (same logic as the human submit_answers handler).

3. **Set bot fallback timer in `findMatch`** — After pushing the player to `matchmakingQueue` and finding no match, schedule a 15-second `setTimeout`. On fire: (a) confirm the player is still queued, (b) remove from queue, (c) refund any coin entry, (d) create a room with the human + bot using `createRoom`/`joinRoom`, (e) register in `botRooms`, (f) call `emitCountdownThenStart` → `startGame` → emit `matchFound` with `coinEntry: 0`, (g) schedule first bot submission via `scheduleBotSubmission`. If a human match IS found first, clear this timeout.

4. **Cancel timeout on match found / cancel / disconnect** — In the `findMatch` handler (when a human match IS found), clear both players' pending timeouts from `matchmakingTimeouts`. In `cancelMatch`, clear the timeout. In the `disconnect` handler, clear the timeout.

5. **Auto-schedule bot for next rounds** — In the `next_round` handler, after a successful `nextRound(data.roomId)` call (when `!isGameOver`), check if `botRooms.has(data.roomId)`. If yes, call `scheduleBotSubmission` for the new round.

6. **Skip ELO and ranked stats for bot matches** — In the `game_over` block where ELO is calculated (the 2-player check), add a guard: skip the entire ELO/win/loss DB update if any player's socket ID starts with `"bot:"`.

## Relevant files
- `server/routes.ts:1619-1722` — findMatch handler
- `server/routes.ts:1261-1365` — next_round handler and game_over/ELO block
- `server/routes.ts:1206-1258` — submit_answers handler (reference for round_results logic)
- `server/routes.ts:1725-1742` — cancelMatch handler
- `server/routes.ts:2146-2180` — disconnect handler
- `server/wordDatabase.ts:170-178` — getWordsForLetter
- `server/gameLogic.ts:36-46` — getActiveCategories, PlayerAnswers
