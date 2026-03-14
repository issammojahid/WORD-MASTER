# Tournament Room System Fixes

## What & Why
Players cannot reliably create or join tournament rooms, and the room list gives no feedback on how full each room is. Key gaps:

- Room creation works on the server but the UI does not show the real-time player count as people join (e.g. "3 / 4").
- There is no empty-state message when no open rooms exist.
- The tournament does not auto-start the moment the room reaches its `maxPlayers` capacity; players must wait.
- The room host name and entry fee are not shown on each room card in the list view.
- On first load in the APK the tournament screen can show stale or blank state.

The server already supports 4/8/16-player brackets, socket events for join/leave, and auto-starting via `generateTournamentBracket`. The fix is primarily on the client side.

## Done looks like
- The room list shows each room as: host player name, "X / Y players", entry fee (100 coins), and a Join button
- When no rooms are available the list shows the Arabic message "لا توجد بطولات حالياً"
- Inside a room (detail view), the player count updates in real time as others join (socket event `tournament_player_joined`)
- When the room fills to capacity it auto-starts — the host does not need to press a button
- Creating a room (4 / 8 / 16) works correctly from the create modal, deducts 100 coins, and lands in the room detail view
- All of this works the same way in Expo Go and in an APK build

## Out of scope
- Changing the bracket logic or match flow (do not touch `generateTournamentBracket`)
- Changing the tournament entry fee amount
- Changing the server-side tournament routes

## Tasks
1. **Room list card UI** — Update the tournament list item card to display: host player name (from `playerName` of the first joined player), current player count vs. max (e.g. "3 / 4"), and entry fee. Add an Arabic empty-state message when the list is empty.

2. **Real-time player count in room detail** — Listen to the `tournament_player_joined` and `tournament_player_left` socket events already emitted by the server. Re-fetch the tournament detail (or update local state) when either event fires so the count updates without a manual refresh.

3. **Auto-start on full room** — When the server emits `tournament_started` (already emitted by `generateTournamentBracket` when a room fills), transition the room detail view from "waiting" to the bracket/match view automatically. Remove any manual "start" button for the room creator.

4. **APK stability pass** — Ensure all fetch calls in `tournament.tsx` use `safeFetch` (already partially done) and that all list results are guarded with `Array.isArray`. Verify the `EXPO_PUBLIC_DOMAIN` environment variable resolves correctly.

## Relevant files
- `app/tournament.tsx`
- `server/routes.ts:118-300`
- `server/index.ts`
- `lib/query-client.ts`
- `eas.json`
