---
title: Cartoon Parchisi-style backgrounds
---
# Cartoon Parchisi-Style Backgrounds

## What & Why
Replace the current AI photo-realistic background images with colorful cartoon/illustrated backgrounds inspired by the Parchisi (Parcheesi) board game aesthetic. The style should feel playful, vibrant, and appropriate for an Arabic mobile word game — flat cartoon art, bold colors, geometric or tile patterns, illustrated elements (stars, coins, letters, etc.), with a Moroccan/Arabic festive feel.

## Done looks like
- All 23 `bg_*.png` files in `assets/images/` are replaced with new cartoon-style images (1080×1920 px, portrait)
- Style is consistent across all images: flat illustrated cartoon, colorful, Parchisi-inspired (colorful board tiles, bold shapes, decorative Arabic patterns), not photorealistic
- Screen backgrounds: each screen's bg image uses thematically relevant colors/icons (game = letter tiles; shop = coins/gems; tournament = trophy/crown; etc.)
- Popup backgrounds (bg_popup, bg_popup_confirm, bg_popup_reward): simpler, centered cartoon frame/border designs on a solid dark base
- The app still compiles and renders without errors after image replacement

## Out of scope
- Changes to any TypeScript/JSX code (images are just swapped in place, same filenames)
- Layout or overlay changes
- Sound or animation changes

## Tasks
1. **Generate screen backgrounds (20 images)** — Use AI image generation to create cartoon Parchisi-style backgrounds for each screen: bg_home, bg_game, bg_lobby, bg_rapid, bg_word_chain, bg_daily, bg_ai, bg_shop, bg_spin, bg_vip, bg_achievements, bg_battle_pass, bg_tasks, bg_clans, bg_friends, bg_leaderboard, bg_league, bg_tournament, bg_spectate, bg_settings. Style: flat cartoon illustration, vibrant colors, geometric/tile patterns, Arabic decorative motifs, stars, Arabic letters. Each image should reflect the screen theme (e.g., bg_shop has coins/gems, bg_tournament has trophy/crown, bg_game has letter tiles).

2. **Generate popup backgrounds (3 images)** — Create simpler cartoon popup backgrounds: bg_popup (generic dark frame with subtle cartoon border decoration), bg_popup_confirm (slightly warm tone with decorative border), bg_popup_reward (gold/festive cartoon frame with stars and coin decorations). These should work as card backdrops (partial coverage, not full-screen).

3. **Replace all assets** — Save all generated images as PNG to `assets/images/` using the exact same filenames, at 1080×1920 resolution (or consistent with existing dimensions).

## Relevant files
- `assets/images/`