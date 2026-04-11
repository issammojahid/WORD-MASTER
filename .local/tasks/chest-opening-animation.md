# Chest Opening Animation + Prize Images

## What & Why
The current chest opening modal shows emoji (🎁💜🔥⭐) as the chest icon, and the reward popup also shows emoji for the prize. The user wants:
1. The chest to appear as its real PNG image (closed), shake, then animate open (lid rises + glow burst), and items fly out
2. The prize popup to show the actual item's image (avatar PNG, effect PNG, or coin icon) instead of emoji
3. The popup type labels (🪙🦁😂✨) to be replaced with clean text-only labels

## Done looks like
- In the chest opening modal, the chest is rendered as its PNG image (`assets/chests/basic.png`, etc.) — not an emoji
- Tapping the chest triggers: shake → then a "lid open" animation where the chest transitions from closed PNG to an open-lid PNG (new generated assets), accompanied by a light burst and particles flying upward out of the chest
- After the lid opens, the reward card appears and shows the actual item image: avatar PNG for skin prizes, effect PNG for effect prizes, a coin icon for coin prizes, and emoji fallback only for emotes (which have no images yet)
- Popup reward type labels no longer use emoji (e.g. "أُضيفت لرصيدك" instead of "🪙 أُضيفت لرصيدك")
- The 4 existing chest PNG images (`basic`, `rare`, `epic`, `legendary`) are used for the closed state; 4 new "open lid" variants are generated for the open state

## Out of scope
- Changing the chest purchase prices or loot table
- Adding sounds (already implemented via `playShopSound`)
- Emote images (emotes have no image assets yet — fallback to emoji is fine)
- The spin wheel modal (separate screen)

## Tasks

1. **Generate 4 open-chest PNG assets** — Create `assets/chests/basic-open.png`, `rare-open.png`, `epic-open.png`, `legendary-open.png` (96×96) showing each chest with its lid visibly raised/open and a glow emanating from inside. Use the same color palette as the closed variants: grey for basic, purple for rare, pink/red for epic, gold for legendary. Use the `generateImage` tool with transparent background removal.

2. **Add `openImage` to BOX_TIERS and `image` to MysteryBoxPrize** — In `app/shop.tsx`, add `openImage: require("@/assets/chests/basic-open.png")` etc. to each BOX_TIERS entry. In `contexts/PlayerContext.tsx`, add `image?: number` to the `MysteryBoxPrize` type. In `rollMysteryBox()` in `app/shop.tsx`, populate `image` from the matched item's `.image` property (skin, effect); for coins prizes, use a shared coin icon (`assets/chests/coins-prize.png` — generate this too: a glowing pile of gold coins, 96×96).

3. **Update BoxOpeningModal animation** — Replace the `boxBigEmoji` Text with an `<Image>` component showing `tier.image` (closed chest) during idle/shake phases. On burst, transition to `tier.openImage` (open chest) with a scale-up + fade of the open image, plus animated particles flying upward from the chest center (use Animated.Value for Y-translation). Replace `prize.emoji` Text in the reward card with a conditional `<Image source={prize.image}>` (72×72, resizeMode contain) when `prize.image` exists, with emoji Text fallback only when absent. Remove emoji from the type-label strings.

## Relevant files
- `app/shop.tsx:117-136` — `rollMysteryBox()` function
- `app/shop.tsx:146-151` — `BOX_TIERS` array
- `app/shop.tsx:243-428` — `BoxOpeningModal` component (phases, animations, render)
- `app/shop.tsx:343-370` — idle/shake phase render (where `boxBigEmoji` is used)
- `app/shop.tsx:385-416` — reward phase render (where `prize.emoji` is used)
- `contexts/PlayerContext.tsx:186-192` — `MysteryBoxPrize` type
- `assets/chests/basic.png`
- `assets/chests/rare.png`
- `assets/chests/epic.png`
- `assets/chests/legendary.png`
- `assets/avatars/`
- `assets/effects/confetti.png`
