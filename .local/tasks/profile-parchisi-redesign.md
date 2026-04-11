# Profile Card Parchisi Redesign

## What & Why
The current profile section on the home screen (top bar + stats row) looks like a generic dark-themed card. The user wants it redesigned to look like a Parchisi (بارشيسي) board game player card — bold, colorful, game-like, with the classic 4-color aesthetic of the Parchisi board (red, green, blue, yellow), prominent game-piece-style avatar, and stats displayed in a 2×2 board-quadrant layout.

## Done looks like
- The profile card has a Parchisi-inspired design: thick colored border, bold quadrant colors, cross decorative motif
- The player avatar is displayed like a large Parchisi game piece — prominent, with a bold colored ring and shadow glow
- Player name, level badge, and XP bar are styled like a game scoreboard label
- The stats section (games played, wins, score, streak) is displayed as a 2×2 colored grid — each cell uses one of the 4 Parchisi colors (red 🔴, green 🟢, blue 🔵, yellow 🟡), with a bold border and game-like typography
- The division/ranked badge is styled as a "rank token" below the avatar
- Overall feel is playful, vibrant, and game-board-like — matching the Parchisi aesthetic while still fitting the dark app theme

## Out of scope
- Changes to any other screen (settings, leaderboard, shop, etc.)
- Changes to navigation or routing
- Backend changes

## Tasks
1. **Redesign the profile row card** — Restyle the avatar+name+level block (lines ~1338–1451 of `app/index.tsx`) to look like a Parchisi player token card: make the avatar larger (60–64px) with a thick 3px colored ring using the player's skin rarity color, add a cross-shaped or diamond decorative background motif behind the avatar, display player name in a bold game-scoreboard style, and style the level + XP bar like a "score track" running across the card bottom.

2. **Redesign the stats row as a 2×2 Parchisi board grid** — Replace the horizontal stats bar (lines ~1512–1546 of `app/index.tsx`) with a 2×2 grid where each quadrant uses a distinct Parchisi color: top-left red for games played, top-right green for wins, bottom-left blue for total score, bottom-right yellow for best streak. Each cell should have a bold colored border, colored background tint, a large bold stat number, and a small Arabic label below it.

## Relevant files
- `app/index.tsx:1338-1451`
- `app/index.tsx:1512-1546`
- `app/index.tsx:1779-1833`
