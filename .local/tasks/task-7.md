---
title: Compact avatar next to XP bar (home screen)
---
# Compact Avatar Beside XP Bar

## What & Why
On the home screen profile card, the avatar (skin emoji) is currently displayed as a large 50×50px circle on the left side of the card, with the player name, title badge, and XP bar all stacked to its right. The user wants the avatar to appear as a smaller circle (~28px) positioned directly to the left of the XP bar row — making the card more compact and visually tighter, with the name/title remaining above.

## Done looks like
- The home screen profile card has: player name + title badge on top row (no avatar there)
- Below that, a row starting with a small avatar circle (~28px) followed immediately by the XP bar and XP text
- The avatar rarity ring/glow effect is preserved (just smaller)
- The overall card height is reduced (more compact)
- Tapping the card still navigates to /profile

## Out of scope
- Changes to the /profile page avatar size
- Changes to the coins badge, settings button, or any other part of the top bar
- Changes to bottom navigation

## Tasks
1. **Restructure profile card JSX** — Remove the avatar from the left of the full card; place a smaller avatar circle (~28px) at the start of the `levelRow` (the row containing the level badge, XP bar, and XP text), to the left of the level badge.

2. **Update styles** — Shrink avatar to ~28px diameter, adjust emoji font size to ~14px. Tighten any padding/margins in the card so the height feels compact. Keep rarity border/glow logic intact.

## Relevant files
- `app/index.tsx:1336-1430`
- `app/index.tsx:1743-1770`