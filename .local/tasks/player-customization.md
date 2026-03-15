# Player Customization Store

## What & Why
Expand the existing shop with more cosmetic categories: avatar photos/emojis, avatar frames, profile backgrounds, and letter skins (how the player's typed letters appear in-game: gold, neon, fire). All are bought with coins.

## Done looks like
- The shop screen has four tabs: Avatars, Frames, Backgrounds, Letter Skins.
- Letter skin examples: default (white), gold (yellow gradient), neon (cyan glow), fire (orange/red).
- Players can preview a letter skin in the shop before buying.
- The equipped letter skin is applied in the game screen so typed words appear with the selected style.
- Avatar frames appear as a border around the player emoji in lobbies and on the profile.
- Backgrounds change the color/gradient behind the profile header.
- All purchases persist in the `player_profiles` cosmetics field server-side.

## Out of scope
- Animated letter skins (static color/style only for now).
- Real money purchases (coins only).

## Tasks
1. **Cosmetics schema** — Add a `cosmetics_owned` JSON column and `cosmetics_equipped` JSON column to `player_profiles` (from economy task). Define a catalog of cosmetic items as a server constant.
2. **Shop API** — Add `GET /api/shop/items`, `POST /api/shop/buy` endpoints. Validate coin balance before purchase.
3. **Shop screen redesign** — Expand `app/shop.tsx` with tab navigation for Avatars, Frames, Backgrounds, and Letter Skins. Show price, owned/equipped state, and a preview area.
4. **Letter skin in game** — In `app/game.tsx`, read the player's equipped letter skin from context and apply color/style to the answer text inputs.
5. **Frame & background on profile** — Apply the equipped frame around the player emoji and background behind the profile header in `app/index.tsx` and lobby player cards in `app/lobby.tsx`.

## Relevant files
- `app/shop.tsx`
- `app/game.tsx`
- `app/index.tsx`
- `app/lobby.tsx`
- `shared/schema.ts`
- `server/routes.ts`
- `contexts/PlayerContext.tsx`
- `constants/colors.ts`
