---
title: Remove friend room auto-start
---
# Remove Friend Room Auto-Start

## What & Why
The friend room currently auto-starts the game after a 5-second countdown when 2+ players join. This is wrong — the host should decide when to start, especially when waiting for more than 2 players (up to 5+). The auto-start must be removed so the host controls the start button.

## Done looks like
- When players join a friend room, nothing starts automatically
- The host sees the "ابدأ اللعبة" (Start Game) button, enabled as soon as 2+ players are in the room
- The host presses the button manually whenever ready (whether there are 2, 3, 4, or 5 players)
- Non-host players see a "في انتظار المضيف" waiting message as before
- No countdown bar appears anywhere in the waiting room

## Out of scope
- Any changes to the server, socket events, or matchmaking
- Quick match behavior (unchanged)

## Tasks
1. **Remove auto-start state and refs** — Delete the `autoStartCountdown` state, `autoStartTimerRef`, `autoStartInitiatedRef`, and all related logic from the lobby waiting room.

2. **Restore manual start button** — Make the host's "ابدأ اللعبة" button always visible and enabled when 2+ players are present, with no countdown overlay.

3. **Clean up handleBack and handleGameStarted** — Remove any auto-start cleanup code that was added to these functions.

## Relevant files
- `app/lobby.tsx`