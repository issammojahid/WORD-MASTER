# Avatar Pinned on Card Border

## What & Why
The avatar circle is currently inside the `levelRow` (XP row) of the home screen profile card. The user wants it to appear as a very small circle (≈22px) sitting ON the border/frame of the profile card itself — like a badge pinned to the card's top-left corner, partially overlapping the card edge. This is a common mobile game UI pattern.

Because the card's `TouchableOpacity` (profileRow) has `overflow: "hidden"` to clip its gradient background, a child element cannot visually overflow outside the card boundary. The avatar must therefore be a sibling element positioned absolutely relative to a wrapper View.

## Done looks like
- On the home screen, the profile card has a tiny avatar circle (~22px) sitting on its top-left corner, overlapping the card border
- The avatar is no longer inside the XP/level row
- The `levelRow` shows only: `[Lv.badge][===XP bar===][XP text]`
- The avatar's rarity ring/glow is preserved (just smaller)
- Tapping the card still navigates to /profile

## Out of scope
- Changes to the /profile page avatar
- Changes to coins badge, settings, or bottom nav
- Any layout changes outside the top bar profile card area

## Tasks
1. **Wrap the profile card** — Wrap the existing `TouchableOpacity` (profileRow) in a new outer `View` with `position: "relative"` and enough `marginTop`/`paddingTop` to accommodate the avatar overflowing above. Remove the avatar IIFE from `levelRow`.

2. **Add avatar as absolute sibling** — Render the avatar IIFE as a direct child of the wrapper View, positioned absolutely at approximately `top: -11`, `left: 8` so it straddles the top-left border of the card. Set `zIndex: 10` so it renders on top of the card border. Size: 22×22px, emoji fontSize: 11.

3. **Style cleanup** — Update `avatarCircle` style to 22×22px (borderRadius 11), `avatarEmoji` fontSize to 11. The wrapper View needs no background; give it a `marginTop` of ~11px to reserve space for the avatar overflow.

## Relevant files
- `app/index.tsx:1336-1430`
- `app/index.tsx:1750-1760`
