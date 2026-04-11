# AI Icons for Home Screen Game Modes

  ## What & Why
  Replace emoji icons in the home screen's 7 game mode cards and 3 feature panels
  with AI-generated PNG images. This gives the app a more polished, professional
  look consistent with the existing AI-generated avatar and shop icons.

  ## Done looks like
  - 10 AI-generated PNG icons (96×96) saved to `assets/game-modes/` (7 icons) and `assets/features/` (3 icons)
  - Each game mode card renders an `<Image>` instead of the emoji text in the horizontal scrollable list
  - Each feature panel popup (Treasure Road, Daily Reward, Challenges) renders an `<Image>` instead of the large emoji
  - Art style: flat cartoon with neon glow, transparent or dark background, each icon colored in its card's accent color

  ## Out of scope
  - The large animated Ionicons in the expanded game mode "popup" detail views (flash, rocket, people, trophy) — those stay as-is
  - Any other screen (shop, profile, game, spin wheel)

  ## Tasks
  1. **Generate and resize game mode icons** — Use AI image generation to create 7 icons for: quick-match (yellow lightning), rapid-mode (red/orange rocket), friends (green people silhouettes), tournament (purple trophy), ai-bot (cyan robot), daily-challenge (teal globe/calendar), word-chain (purple chain links). Save at 1024×1024, downscale to 96×96 into `assets/game-modes/`.

  2. **Generate and resize feature panel icons** — Create 3 icons for: treasure-road (golden chest on a path), daily-reward (gift box with glow), challenges (target/dart with sparks). Save at 1024×1024, downscale to 96×96 into `assets/features/`.

  3. **Wire icons into home screen** — Add `image: number` field to the `GameMode` type and all 7 entries in the `gameModes` array in `app/index.tsx`. Replace the emoji `<Text>` in the game mode card renderer with `<Image source={item.image} style={styles.modeCardImage} resizeMode="contain" />`. Similarly wire the 3 feature panel icons (lines 301–323) by adding `image` fields and replacing their emoji `<Text>` with `<Image>`.

  ## Relevant files
  - `app/index.tsx:1226-1295`
  - `app/index.tsx:295-340`
  - `app/index.tsx:413-535`
  - `app/index.tsx:677-710`
  - `app/index.tsx:1040-1090`
  - `contexts/PlayerContext.tsx`
  