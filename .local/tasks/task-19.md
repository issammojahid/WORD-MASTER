---
title: Fix avatar + AI icons for home banners
---
# Fix Avatar + AI Icons for Home Screen Banners

  ## What & Why
  Two fixes and one enhancement for the home screen:
  1. The avatar in the top-left header still shows the old emoji instead of the AI skin image (regression from Task #16 which only updated profile.tsx and shop.tsx, not index.tsx).
  2. The store button in the header uses a generic Ionicons icon instead of the AI storefront image already generated in Task #15.
  3. The three feature banners (Daily Challenge, Battle Pass, Clan Wars) use emoji icons (🌍, 🎫, ⚔️) instead of polished AI illustrations.

  ## Done looks like
  - Home screen header avatar shows the equipped skin's AI image (same as profile.tsx), with the rarity ring border
  - The store button renders the existing AI storefront icon image instead of Ionicons
  - The three feature banners each display a 44×44 AI-generated icon in their left icon box:
    - Daily Challenge: stylized globe/calendar icon in green (#10B981)
    - Battle Pass: golden ticket/season pass card icon in cyan (#00CFFF)
    - Clan Wars: crossed swords with purple glow icon in purple (#BF00FF)

  ## Out of scope
  - Any other screen or emoji replacement
  - The large Ionicons in the game mode popup detail views
  - The emoji in banner title text (🗓, 🎯, ⚡) — only the square icon box image is replaced

  ## Tasks
  1. **Fix avatar in home screen header** — In `app/index.tsx` around line 1355, replace `<Text style={styles.avatarEmoji}>{equippedSkin.emoji}</Text>` with `<Image source={equippedSkin.image} style={styles.avatarImage} resizeMode="contain" />`. Add `avatarImage` style (size ~34×34 to fit the circle). Keep the rarity ring border logic unchanged.

  2. **Wire existing store icon** — The store button at line 1365 uses `<Ionicons name="storefront-outline">`. Check `assets/shop-icons/` for the existing AI store icon from Task #15 and replace the Ionicons with `<Image source={require(...)}` at 24×24.

  3. **Generate and wire banner icons** — Generate 3 AI PNG icons (1024×1024, downscale to 96×96) for: daily-challenge (glowing globe/calendar, green), battle-pass (glowing golden ticket/pass card, cyan), clan-wars (crossed swords with fire/glow, purple). Save to `assets/banners/`. Replace the emoji `<Text>` in the three banner icon boxes with `<Image source={require(...)}` at 36×36.

  ## Relevant files
  - `app/index.tsx:1341-1366`
  - `app/index.tsx:1500-1510`
  - `app/index.tsx:1542-1548`
  - `app/index.tsx:1576-1582`
  - `assets/shop-icons/`
  - `contexts/PlayerContext.tsx`