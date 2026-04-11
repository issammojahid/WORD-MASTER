---
title: AI difficulty icons for AI challenge screen
---
# AI Images for Difficulty Level Icons in AI Challenge Screen

## What & Why
The AI challenge screen (`app/ai-game.tsx`) has a difficulty selector with 4 levels. Each shows a 52×52 colored circle with an emoji inside it (🌱 سهل, ⚡ متوسط, 🔥 صعب, 👑 أسطوري). Replace these emoji with AI-generated PNG images, consistent with all other icon upgrades in the app.

Also: the "loading" state (phase === "loading") shows `<Text style={styles.loadingEmoji}>🤖</Text>` at fontSize 56 — this can be replaced with the existing `assets/game-modes/ai-bot.png` (already generated in a previous task).

## Done looks like

### New assets
- `assets/ai-difficulty/easy.png` — green seedling/sprout, 96×96, transparent bg
- `assets/ai-difficulty/normal.png` — golden lightning bolt, 96×96, transparent bg
- `assets/ai-difficulty/hard.png` — orange/red fire flame, 96×96, transparent bg
- `assets/ai-difficulty/legendary.png` — gold/purple crown, 96×96, transparent bg

### Code changes in `app/ai-game.tsx`
- `DIFFICULTY_CONFIG` type gains `image?: number`
- Each entry in `DIFFICULTY_CONFIG` gets `image: require("@/assets/ai-difficulty/...")` matching its color:
  - easy (Colors.emerald green) → easy.png
  - normal (Colors.gold yellow) → normal.png
  - hard (Colors.ruby red/orange) → hard.png
  - legendary (#BF00FF purple) → legendary.png
- In the difficulty card render (line 472): replace `<Text style={styles.diffEmoji}>{cfg.emoji}</Text>` with `<Image source={cfg.image!} style={styles.diffImage} resizeMode="contain" />`
- Add `diffImage: { width: 38, height: 38 }` to StyleSheet
- Loading robot (line 490): replace `<Text style={styles.loadingEmoji}>🤖</Text>` with `<Image source={require("@/assets/game-modes/ai-bot.png")} style={styles.loadingRobot} resizeMode="contain" />`
- Add `loadingRobot: { width: 80, height: 80, marginBottom: 16 }` to StyleSheet
- The in-game header badge (line 504) `{diffConfig.emoji} {diffConfig.label}` — remove emoji, keep only `{diffConfig.label}` (it's tiny text in the header)

## Out of scope
- The game play screen itself (categories, timer, scoring)
- Any other screens

## Relevant file locations
- `app/ai-game.tsx:28-78` — DIFFICULTY_CONFIG type + entries
- `app/ai-game.tsx:465-480` — difficulty card render (diffIcon + diffEmoji)
- `app/ai-game.tsx:486-494` — loading phase (loadingEmoji 🤖)
- `app/ai-game.tsx:503-505` — in-game header badge `{diffConfig.emoji} {diffConfig.label}`
- `app/ai-game.tsx:789-809` — StyleSheet: diffIcon (52×52), diffEmoji (fontSize 28), loadingEmoji (fontSize 56)
- `assets/game-modes/ai-bot.png` — already exists, use for loading screen