# Friends & Clan System

## What & Why
Add a social layer to the game: players can add friends, invite them to private matches (with chat and voice chat, already built), and join or create clans. Clans let groups of players compete together and appear on a clan leaderboard.

IMPORTANT: The existing private room (friend match) system already works. Only extend it with friend invites. Do NOT touch existing room creation, join_room, or socket events.

## Done looks like
- A "Friends" tab/section lets players search for other players by username and send friend requests. Accepted friends appear in a friend list.
- From the friend list, a player can invite a friend to a private match. The friend gets a notification/banner and can accept to be taken to the lobby.
- A "Clans" section lets players create a clan (with name and tag) or browse and join existing clans. Clans have a member list and a clan leaderboard sorted by total clan XP.
- Friend match rooms already support quick chat and voice chat (no changes needed there).
- Clan tag shows on the player profile and beside the player name in match lobbies.

## Out of scope
- Clan vs clan tournaments (future).
- In-app messaging beyond quick chat (future).
- Push notifications (local in-app banners only).

## Tasks
1. **Social database schema** — Add `friendships` (player_a, player_b, status), `friend_requests`, `clans` (id, name, tag, created_by), and `clan_members` tables to `shared/schema.ts`.
2. **Friends API** — Endpoints: `GET /api/players/search?q=`, `POST /api/friends/request`, `PUT /api/friends/:id/accept`, `GET /api/friends` (list), `DELETE /api/friends/:id`.
3. **Clan API** — Endpoints: `POST /api/clans`, `GET /api/clans`, `POST /api/clans/:id/join`, `DELETE /api/clans/:id/leave`, `GET /api/clans/:id/members`, `GET /api/clans/leaderboard`.
4. **Friend invite socket event** — Add a new `invite_to_room` socket event (does not modify existing room logic) that sends a targeted notification to the invited friend's socket.
5. **Friends screen** — Build `app/friends.tsx` with search, pending requests, and friend list. Each friend entry has an "Invite to Match" button that fires the invite event.
6. **Clans screen** — Build `app/clans.tsx` with clan search, create clan form, current clan view (members, clan XP, leaderboard rank), and leave/join actions.
7. **Profile integration** — Show clan tag on profile section of `app/index.tsx` and in the lobby player list.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts`
- `app/index.tsx`
- `app/lobby.tsx`
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`
