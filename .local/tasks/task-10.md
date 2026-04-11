---
title: Profile card height reduction
---
# Profile Card Height Reduction

## What & Why
The home screen profile card is still too tall. The user wants it noticeably shorter (less than half the current height). This is a pure style tweak — reduce padding, avatar size, font size, and spacing.

## Done looks like
- The profile card is significantly shorter/more compact
- Avatar shrinks from 36px → 28px, emoji from 18 → 14
- Card padding reduced from 8 → 5
- nameEditRow marginBottom reduced from 4 → 2
- playerName fontSize reduced from 14 → 12
- levelBadge paddingVertical reduced from 1 → 0
- xpBarContainer height stays at 4px (already minimal)
- Everything still readable and functional

## Out of scope
- Layout structure changes
- /profile page
- Coins, settings, bottom nav

## Tasks
1. **Tighten all vertical spacing styles** — In `app/index.tsx` styles, reduce: `profileRow` padding 8→5, `avatarCircle` 36×36→28×28 (borderRadius 18→14), `avatarEmoji` fontSize 18→14, `nameEditRow` marginBottom 4→2, `playerName` fontSize 14→12.

## Relevant files
- `app/index.tsx:1700-1730`