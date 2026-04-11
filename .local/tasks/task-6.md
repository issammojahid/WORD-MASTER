---
title: Profile Page + Scaled XP System
---
# Profile Page + Scaled XP System

## What & Why
Currently, clicking the profile card on the home screen opens a "change name" modal. The user wants it to open a dedicated profile page showing their ID, full stats (matches, wins, losses), and level info. Also, the current XP/level system is flat (100 XP per level) — it needs to scale up progressively.

## Done looks like
- Tapping the profile card navigates to a new `/profile` screen
- The profile screen shows: player ID (copyable), avatar, name (with edit pencil), games played, wins, losses, win rate %, current level + XP progress bar showing "X / Y XP" to next level
- The name-change modal is removed from home screen; name editing happens via an edit icon inside the profile screen
- The XP/level system scales: Level 1→2 = 100 XP, Level 2→3 = 170 XP, Level 3→4 = 240 XP, +70 XP per level
- XP bar on home screen and profile screen both reflect the new scaling
- Existing players keep their XP — levels recalculate automatically from total XP

## XP Formula
- XP needed to go from level N to N+1 = `100 + (N - 1) * 70`
  - L1 → L2: 100 XP
  - L2 → L3: 170 XP
  - L3 → L4: 240 XP
  - L4 → L5: 310 XP
  - ...

## Changes required

### 1. `contexts/PlayerContext.tsx`
- Replace `calculateLevel(xp)` flat formula with the new scaling one
- Add and export `getXpProgress(xp)` → `{ current, needed, progress }` (used in home screen and profile page)

### 2. `app/index.tsx`
- Change profile card `onPress` from `setShowNameModal(true)` to `router.push("/profile")`
- Remove the name modal JSX and its state (`showNameModal`, `nameInput`)
- Update `xpProgress` to use `getXpProgress(profile.xp).progress` from PlayerContext
- Update the XP label text from `profile.xp % 100 / 100` to show `current / needed XP`

### 3. `app/profile.tsx` (new file)
New screen with:
- Back button top-left
- Avatar circle (skin emoji) centered, large (80px)
- Player name + pencil icon (opens inline edit or small modal to change name)
- Player ID row: label "كود اللاعب" + the ID value + copy button
- Stats grid (2×2 or horizontal row):
  - مباريات (gamesPlayed)
  - انتصارات (wins)
  - خسارات (losses)
  - نسبة الفوز % (wins/gamesPlayed × 100)
- Level section:
  - "المستوى X" badge
  - XP progress bar: "current / needed XP للمستوى التالي"
- Division badge (bronze/silver/gold/platinum/diamond)
- Styled consistently with the rest of the app (dark theme, Cairo font)

### 4. `app/_layout.tsx`
- Ensure `/profile` is added as a valid route (it uses file-based routing so just creating the file is enough, but verify no explicit route list blocks it)

## Relevant files
- `contexts/PlayerContext.tsx` (lines 320-322 calculateLevel, line 566 addXp)
- `app/index.tsx` (lines 1100-1101 state, 1135 xpProgress, 1342 onPress, 1726 modal JSX)
- `app/profile.tsx` (new)
- `app/_layout.tsx` (verify routing)