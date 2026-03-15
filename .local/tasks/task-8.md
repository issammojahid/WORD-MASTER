---
title: Dark/Light mode + UI polish across all screens
---
# Dark Mode + UI Polish

## What & Why
The app currently has no theme system — all colours are hard-coded. Adding Dark/Light mode requires:
1. A `ThemeContext` that exposes a `theme` object (colour tokens) and a `toggleTheme()` function.
2. Every screen consuming the theme object instead of hard-coded colour values.
3. A toggle in the Settings screen.

At the same time, the overall UI benefits from a polish pass: consistent spacing, better card design, cleaner typography hierarchy, and improved mobile layout on smaller screens.

## Done looks like
- Settings screen has a "الوضع الليلي / الوضع النهاري" toggle
- Switching toggles the entire app between a dark palette (current default) and a light palette
- Theme preference is persisted in AsyncStorage and restored on next launch
- All screens (index, game, ai-game, rapid, tournament, friends, tasks, achievements, shop, leaderboard, settings, spin) respect the theme
- Light mode uses a white/light-grey background with dark text; the accent colours (cyan, pink, purple, gold) remain the same in both themes
- UI polish: card corners are consistent (16px radius), section spacing is uniform (16px gutters), button heights are at least 48px for touch targets, and text sizes follow a clear hierarchy (title 22px, subtitle 16px, body 14px, caption 12px)

## Out of scope
- Changing any game logic or server code
- Adding new screens
- Changing the font (Cairo is kept)
- Changing accent/brand colours

## Tasks
1. **ThemeContext** — Create `contexts/ThemeContext.tsx` that defines light and dark colour token objects, reads/writes the preference to AsyncStorage under a stable key, and exposes `theme`, `isDark`, and `toggleTheme` via a React context + hook.

2. **Update colour constants** — Refactor `constants/colors.ts` so that each token is a function of the theme rather than a static value. Screens that import specific colour constants should instead consume the theme object.

3. **Apply theme to all screens** — Update all screen files to call `useTheme()` and use `theme.background`, `theme.surface`, `theme.text`, `theme.textSecondary` etc. instead of hard-coded hex values. The accent palette (cyan, pink, purple, gold) stays the same.

4. **Settings toggle** — Add a dark/light mode row in the Settings screen with a Switch component that calls `toggleTheme()`.

5. **UI polish pass** — Standardise card border radius (16px), padding (16px horizontal, 12px vertical), button height (48px min), and typography scale across all screens. Fix any cramped spacing on smaller phones (e.g. 375px wide).

## Relevant files
- `contexts/PlayerContext.tsx`
- `contexts/LanguageContext.tsx`
- `constants/colors.ts`
- `app/settings.tsx`
- `app/index.tsx`
- `app/game.tsx`
- `app/ai-game.tsx`
- `app/rapid.tsx`
- `app/tournament.tsx`
- `app/friends.tsx`
- `app/tasks.tsx`
- `app/achievements.tsx`
- `app/shop.tsx`
- `app/leaderboard.tsx`
- `app/spin.tsx`
- `app/_layout.tsx`