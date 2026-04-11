---
title: AI icons for game mode cards (complete Task #18)
---
# AI Icons for Game Mode Cards (Redo Task #18)

  ## What & Why
  Task #18 was merged but did not deliver: the game mode cards on the home screen
  still render emoji text (⚡ 🚀 👥 🏆 🤖 🌍 🔗) instead of AI-generated images.
  This task completes the work — generating, saving, and wiring 7 PNG icons for all
  7 game mode cards in the scrollable mode selector.

  ## Done looks like
  - 7 AI-generated PNG icons (96×96) saved to `assets/game-modes/`:
    - quick-match.png — yellow/gold lightning bolt (accent #F5C842)
    - rapid-mode.png — orange/red rocket (accent #FF5733)
    - friends.png — green people silhouettes (accent #22C55E)
    - tournament.png — purple trophy with glow (accent #BF00FF)
    - ai-bot.png — cyan robot head (accent #00F5FF)
    - daily-challenge.png — teal/green globe with stars (accent #10B981)
    - word-chain.png — purple chain links (accent #8B5CF6)
  - `GameMode` type in `app/index.tsx` gains an `image: number` field
  - All 7 entries in the `gameModes` array have `image: require(...)`
  - The emoji pill box renderer (line 1055: `<Text style={{ fontSize: 36 }}>{item.emoji}</Text>`)
    is replaced with `<Image source={item.image} style={styles.modeCardImage} resizeMode="contain" />`
  - New `modeCardImage` style added: 52×52 inside the existing accent-colored pill box

  ## Out of scope
  - The large Ionicons in the expanded game mode popup detail views (flash, rocket, people, trophy)
  - Any other screen or emoji

  ## Tasks
  1. **Generate game mode icons** — Generate 7 AI PNG icons at 1024×1024 with
     removeBackground: true. Style: flat cartoon with neon glow, each in its card's
     accent color. Downscale all to 96×96. Save to `assets/game-modes/`.

  2. **Wire icons into game mode cards** — Add `image: number` to the `GameMode`
     interface, add `image: require(...)` to all 7 mode objects in the `gameModes`
     array, replace the emoji `<Text>` in the card renderer with `<Image source={item.image}
     style={styles.modeCardImage} resizeMode="contain" />`, and add the
     `modeCardImage` style (52×52).

  ## Relevant files
  - `app/index.tsx:677` (GameMode type)
  - `app/index.tsx:1226-1295` (gameModes array)
  - `app/index.tsx:1044-1056` (card renderer — emoji pill box)