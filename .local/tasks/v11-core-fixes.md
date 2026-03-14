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
- `constants/colors.ts`
