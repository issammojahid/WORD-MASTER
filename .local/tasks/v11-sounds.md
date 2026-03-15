# Sound System

## What & Why
The game currently has no audio feedback. Sound effects make the experience more engaging and provide instant feedback on actions. `expo-av` is already installed (~15.0.2) in the project.

Required sounds:
- **Correct answer** — short positive chime (played when a round result shows a "correct" word)
- **Wrong/invalid answer** — short negative buzz
- **Win** — triumphant fanfare (game over, player won)
- **Lose** — short sad tone (game over, player lost)
- **Emoji reaction** — three distinct short sounds mapped to the main emojis: 😂 → laugh, 👏 → clap, 🔥 → fire

## Done looks like
- A `SoundManager` utility loads all sounds on first use and exposes `playSound(name)` calls
- `app/game.tsx` plays correct/wrong sounds when round results are shown, and win/lose sounds on game over
- `app/ai-game.tsx` does the same for the AI game
- `app/rapid.tsx` plays correct/wrong sounds on word submit result
- Emoji chat reactions (already rendered in game.tsx) play the mapped sound when sent or received
- Sounds play on both Expo Go and APK (sounds are bundled as assets, not fetched from a URL)
- If a sound fails to load (e.g. on web), `playSound()` silently catches the error — no crash

## Out of scope
- Background music
- Volume control UI
- Sound settings (mute toggle is deferred — simpler to add later)
- Changing the emoji or chat system

## Tasks
1. **Bundle audio assets** — Add short royalty-free sound files (MP3 or M4A, <50 KB each) to `assets/sounds/`: `correct.mp3`, `wrong.mp3`, `win.mp3`, `lose.mp3`, `laugh.mp3`, `clap.mp3`, `fire.mp3`. Use the `expo-av` `Audio.Sound` API to load them.

2. **SoundManager utility** — Create `lib/sound-manager.ts` that lazily loads each sound on first play, caches the `Audio.Sound` instances, and exports a single `playSound(name: SoundName)` async function. All errors are caught silently.

3. **Wire sounds into game screens** — Call `playSound("correct")` / `playSound("wrong")` in round result display logic in `app/game.tsx` and `app/ai-game.tsx`. Call `playSound("win")` or `playSound("lose")` when the game-over screen appears. Do the same for `app/rapid.tsx` on `rapid_word_result`.

4. **Emoji reaction sounds** — In the in-game emoji picker / reaction renderer in `app/game.tsx`, call `playSound("laugh" | "clap" | "fire")` when an emoji reaction is sent or received.

## Relevant files
- `app/game.tsx`
- `app/ai-game.tsx`
- `app/rapid.tsx`
- `lib/query-client.ts`
- `package.json`
