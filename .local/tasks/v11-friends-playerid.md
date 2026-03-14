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
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`
