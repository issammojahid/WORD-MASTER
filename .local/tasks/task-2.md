---
title: Add Leaderboard to Bottom Navigation
---
# Add Leaderboard to Bottom Navigation

## What & Why
The leaderboard screen exists and is fully functional, but there is no button in the home screen's bottom navigation bar to reach it. The bottom nav currently has 5 items: Shop, Friends, Home (center), Tasks, Achievements. The Shop is already accessible from a button in the top header of the home screen, so the bottom nav Shop slot can be replaced with a Leaderboard button, giving players direct access to the leaderboard from anywhere on the home screen.

## Done looks like
- The bottom navigation bar shows a Leaderboard tab (with a podium or trophy-list icon and the label "المتصدرون") in place of the Shop tab
- Tapping it navigates to `/leaderboard`
- The shop remains accessible via the existing top-header shop button
- Layout, colors, and icon style match the other nav items

## Out of scope
- Any changes to the leaderboard screen itself
- Any changes to the shop screen
- Adding a 6th nav item (keep the 5-item layout)

## Tasks
1. **Swap Shop nav tab for Leaderboard** — In the bottom navigation render block in `app/index.tsx`, replace the first nav item (Shop → `/shop`) with a Leaderboard nav item that navigates to `/leaderboard`, using an appropriate icon (e.g. `podium` or `bar-chart`) and a green or cyan color to avoid clashing with the existing yellow Achievements tab.

## Relevant files
- `app/index.tsx:1667-1710`