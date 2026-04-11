# Home Profile Card — Compact Simple Layout

## What & Why
The home screen profile card currently shows: avatar (inside XP row) + name + title badge + level/XP bar + division badge (silver/gold + ELO + wins/losses). This makes the card tall and cluttered. The user wants a simple, compact profile card: small avatar on the LEFT, and to the right: name + XP bar only. Remove the division/ELO/season row from the card to reduce height.

## Done looks like
- Profile card has a small avatar circle (~36px) on the LEFT side of the card
- To the right of the avatar: player name on top, level badge + XP bar + XP text below
- The division/ELO/season stats row (🥈 فضة 1000 | 0ف 0خ) is REMOVED from the card
- Title badge (if equipped) can stay or be removed — keep it small under the name
- The card is visibly shorter/more compact than before
- Rarity ring/glow on the avatar is preserved

## Out of scope
- Changes to /profile page
- Changes to coins badge, settings button, bottom nav
- The division info is still accessible on the /profile page

## Tasks
1. **Move avatar back to left column** — Remove the avatar IIFE from inside `levelRow`. Place it back as the first element inside `profileRow` (left column), shrunk to ~36×36px with emoji fontSize ~18. Update `avatarCircle` style accordingly.

2. **Remove division/ELO row** — Delete the inline division IIFE block (the one rendering 🥉/🥈/🥇/💠/💎 + ELO + season wins/losses) from `profileMeta`. This row adds the most height to the card.

3. **Tighten card padding** — Reduce `profileRow` padding from 10 to 8, and reduce `gap` between avatar and profileMeta to 8. This makes the overall card compact.

## Relevant files
- `app/index.tsx:1336-1430`
- `app/index.tsx:1743-1770`
