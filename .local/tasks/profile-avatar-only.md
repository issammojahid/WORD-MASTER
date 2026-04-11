# Profile: Avatar Circle Only (No Card)

## What & Why
The home screen top bar currently shows a wide rectangular profile card (with name, XP bar, level badge). The user wants to remove the card entirely and replace it with just a small circular avatar button (~38px) on the left side of the top bar. Tapping it navigates to /profile. The top bar becomes: [Avatar Circle] ... [Coins Badge] [Settings].

## Done looks like
- No rectangular profile card in the top bar
- A single small circle (~38px) on the left with the skin emoji inside
- Rarity ring/glow on the circle is preserved
- Tapping the circle navigates to /profile
- The top bar is now one line height (same height as coins badge / settings)
- The styles profileRow, profileMeta, nameEditRow, playerName, levelRow, levelBadge, xpBarContainer, xpBar, xpText, equippedTitleBadge, equippedTitleText are removed or simplified

## Out of scope
- /profile page changes
- Coins badge, settings button, bottom nav

## Tasks
1. **Replace profileRow with avatar-only button** — In `app/index.tsx`, replace the entire `TouchableOpacity` (profileRow) and its children (gradient, avatar IIFE, profileMeta with name/XP) with a single `TouchableOpacity` that renders only the rarity-styled avatar circle. Size: 38×38px. Keep the same `onPress` (navigate to /profile).

2. **Remove unused styles** — Delete `profileRow`, `profileMeta`, `nameEditRow`, `playerName`, `levelRow`, `levelBadge`, `levelText`, `xpBarContainer`, `xpBar`, `xpText`, `equippedTitleBadge`, `equippedTitleText` from the StyleSheet. Update `avatarCircle` to 38×38 (borderRadius 19) and `avatarEmoji` to fontSize 20.

## Relevant files
- `app/index.tsx:1336-1410`
- `app/index.tsx:1697-1730`
