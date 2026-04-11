---
title: AI icons for shop effects tab
---
# AI Icons for Shop Effects Tab

  ## What & Why
  The Effects tab in the shop (✨ تأثيرات) still renders all 4 victory effects
  using emoji text (🎊 🔥 ⭐ 🪙) inside the effect card circles. This replaces
  them with polished AI-generated PNG icons, consistent with the avatar/title/chest
  upgrades already done in Tasks #16 and #17.

  ## Done looks like
  - 4 AI PNG icons (96×96) saved to `assets/effects/`:
    - confetti.png — colorful confetti explosion, pink/purple neon (#E040FB)
    - fire.png — flame burst with embers, orange neon (#FF6D00)
    - stars.png — glowing stars bursting outward, golden neon (#FFD600)
    - coins-burst.png — golden coins exploding outward, yellow neon (#F5C842)
  - `Effect` type in `contexts/PlayerContext.tsx` gains an `image: number` field
  - All 4 EFFECTS entries have `image: require(...)`
  - In `app/shop.tsx`, the effect card renderer (line ~835)
    replaces `<Text style={styles.avatarEmoji}>{effect.emoji}</Text>`
    with `<Image source={effect.image} style={styles.effectImage} resizeMode="contain" />`
  - New `effectImage` style added (size 52×52)

  ## Out of scope
  - The "none" (default, free) effect — has no visible icon card
  - Any other emoji in the shop or other screens

  ## Tasks
  1. **Generate effect icons** — Generate 4 AI PNG icons (1024×1024, removeBackground: true).
     Style: dynamic particle explosion/burst illustration matching each effect's theme and color,
     flat cartoon with vibrant neon glow on transparent background. Downscale to 96×96.
     Save to `assets/effects/`.

  2. **Wire icons** — Add `image: number` field to the `Effect` type and populate all 4
     EFFECTS entries with `require()` paths in `contexts/PlayerContext.tsx`.
     In `app/shop.tsx`, replace the emoji `<Text>` in the effects card renderer with
     `<Image source={effect.image} style={styles.effectImage} resizeMode="contain" />`
     and add the `effectImage: { width: 52, height: 52 }` style to the StyleSheet.

  ## Relevant files
  - `contexts/PlayerContext.tsx:128-145` (Effect type and EFFECTS array)
  - `app/shop.tsx:812-860` (renderEffects — card renderer)
  - `app/shop.tsx` (StyleSheet — avatarEmoji style at the bottom)