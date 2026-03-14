# Expand Word Database — Fill Sparse Category/Letter Gaps

## What & Why
The word validation system is already solid (4-pass check: exact → normalized → ±ال → letter fallback).
The problem is thin coverage in specific category/letter combos, causing valid player answers to be rejected.

Key gaps identified:
- `countries`: ظ=0, ي=0 words; ث,ح,خ,د,ذ,ص,ض,ع = 1 word each
- `fruits`: ذ=1, ظ=1, ض=2, غ=3, ث=7, ط=7
- `vegetables`: ظ=2, ض=4, غ=3
- `cities`: ظ=1, ذ=7, ث=7

## Done looks like
- Every category/letter combo has ≥ 8 words (meaningful player choices)
- `words.json` expanded from 60 → 100+ words per letter (stronger fallback)
- No changes to validation logic in `server/wordDatabase.ts`
- No changes to server networking, socket, matchmaking, or routes
- Server restarts cleanly with the expanded database

## Implementation details

### 1. Expand `server/data/wordDatabase.json`

Fill the sparse combos listed above. Target minimums per category/letter:
- `countries`: ≥ 5 per letter (use real country names, allow transliterated names in Arabic)
- `fruits`: ≥ 6 per letter
- `vegetables`: ≥ 6 per letter
- `cities`: ≥ 5 per letter
- `girl_names`, `boy_names`, `animals`, `objects` are already adequate — leave mostly untouched unless obviously sparse

### 2. Expand `server/data/words.json`

Increase each letter from 60 → 100+ common Arabic words for stronger general fallback.
All 28 Arabic letters: ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي

### 3. NO logic changes

`server/wordDatabase.ts` validation logic stays exactly as-is.
No server networking changes.

## Relevant files
- `server/data/wordDatabase.json`
- `server/data/words.json`
- `server/wordDatabase.ts` (read-only reference — do NOT modify logic)
