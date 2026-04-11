---
title: Home Screen Layout — Friendly Redesign
---
# Home Screen Layout — Friendly Redesign

## What & Why
The current home screen feels empty and unfriendly — a massive 88px "ح" logo sits in the middle of the page, game modes are buried below the fold, and three tall full-width banners create a heavy wall of content. The user wants the same features reorganised into a more compact, welcoming, game-like layout.

## Done looks like
- No wasted vertical space: the game modes carousel is the first thing you see after the profile card
- The giant "ح" logo section is replaced by a compact greeting/hero bar (small "ح" 42px + app name/subtitle) in a single slim row
- Win-streak bar is kept but made slimmer (pill style, less padding)
- Banners are shown in a 2-column compact layout: Daily Challenge + Battle Pass side by side, Clan Wars as a slim full-width strip below
- The Parchisi stats 2×2 grid is kept but with tighter cell padding (less empty space inside each cell)
- Overall vertical rhythm feels tight and game-like, not spread out and empty

## New Layout Order (top → bottom)
1. Profile card (Parchisi style — unchanged)
2. Slim win-streak pill (conditional — same content, less padding)
3. Compact hero bar — replaces the giant "ح" logo section: small "ح" (42px) inline with app subtitle, all in one ~56px row
4. Game Modes carousel — moved up, right after the hero bar; becomes the visual centrepiece
5. Parchisi 2×2 stats grid — same design, cells tightened (paddingVertical 14 → 10)
6. Banners row — Daily Challenge + Battle Pass as 2 side-by-side compact cards; Clan Wars below as a slim strip
7. Tournament wins badge (conditional, unchanged)

## Specific changes in app/index.tsx
- The entire `{/* ── LOGO ── */}` Animated.View block (logoContainer + logoLetter + appSubtitle) is replaced by a new compact `heroBar` View with a small "ح" text and subtitle in one row
- The `{/* ── GAME MODES CAROUSEL ── */}` block is moved to appear immediately after the new hero bar (before stats)
- `{/* ── STATS GRID ── */}` follows the carousel
- Daily Challenge + Battle Pass banners are wrapped in a `flexDirection:"row"` container with `gap:10`, each `flex:1`, compact height (~90px), icon size 22px
- Clan Wars banner kept full-width but padded more tightly (paddingVertical 10, icon 22px)
- `streakBar` paddingVertical reduced from 12 → 7
- `parchisiCell` paddingVertical reduced from 14 → 10
- New styles added: `heroBar`, `heroBarLetter`, `heroBarText`, `heroBarSubtitle`
- Old styles removed/simplified: `logoContainer`, `logoGlowRing`, `logoLetter`, `appSubtitle`

## Out of scope
- No changes to game logic, routing, or navigation
- No backend changes
- No changes to modals/overlays or profile card design

## Relevant files
- `app/index.tsx` — JSX layout ~lines 1461–1700, styles ~lines 1926–1985
