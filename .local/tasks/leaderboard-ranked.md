# Leaderboard & Ranked Mode

## What & Why
The existing leaderboard screen is a placeholder. This task builds a real server-backed leaderboard (top players by coins, wins, XP) and adds a Ranked Mode with progression tiers: Bronze → Silver → Gold → Diamond → Master. Ranked matches award rank points (RP) and winning enough RP promotes the player to the next tier.

IMPORTANT: Do NOT modify existing socket events, matchmaking, or room logic. Ranked matching is a new mode added on top.

## Done looks like
- The Leaderboard screen shows real data pulled from the server: top 50 players by coins, by wins, and by XP. Each entry shows player name, avatar/emoji, and value.
- A Ranked Mode option on the home screen lets players enter ranked matches. Players are matched with opponents at a similar rank tier.
- After each ranked match, the winner gains RP and the loser loses RP. Crossing a threshold promotes or demotes the player.
- The player's current rank tier (with a badge icon) is displayed on the home screen profile and leaderboard.
- A Ranked-specific leaderboard category shows players sorted by RP.

## Out of scope
- Season resets or ranked rewards (future).
- Placement matches for new players (default starting rank is Bronze).

## Tasks
1. **Leaderboard API** — Add `GET /api/leaderboard?category=coins|wins|xp|rank_points&limit=50` endpoint backed by the `player_profiles` table (from economy task).
2. **Ranked schema** — Add `rank_tier` (Bronze/Silver/Gold/Diamond/Master) and `rank_points` columns to `player_profiles`. Add RP award/deduct logic called after `game_over`.
3. **Ranked matchmaking** — Extend the matchmaking queue with a `mode: "ranked"` flag. Ranked queue attempts to match players within 1 tier difference.
4. **Leaderboard screen redesign** — Replace placeholder in `app/leaderboard.tsx` with real data, category tabs (Coins / Wins / XP / Rank), and animated rank badge display.
5. **Rank badge on profile** — Show rank badge icon + tier name on the profile section of `app/index.tsx`, updated after each match.

## Relevant files
- `app/leaderboard.tsx`
- `app/index.tsx`
- `server/routes.ts`
- `shared/schema.ts`
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`
