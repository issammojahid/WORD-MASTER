# Fix: Daily Deals & Active Title Banner Still Show Emoji Icons

## What & Why
Two spots in `app/shop.tsx` ignore the AI PNG images from SKINS/EFFECTS/TITLES and fall back to emoji instead:

**A — Daily Deals (العروض) tab** (the main bug the user reported)
- `DailyItem` interface (line 76-81) has no `image?: number` field
- `getDailyItems()` pool mapping (lines 94-108) copies `emoji` from SKINS/EFFECTS but never copies `image`
- The card render (line 691) always shows `<Text>{item.emoji}</Text>` — never checks for an image

**B — Active Title Banner** (ألقاب tab, line 925)
- The active-title banner at the top of the titles section renders `<Text style={{ fontSize: 28 }}>{activeTitleData.emoji}</Text>`
- Each Title already has `image: require("@/assets/titles/...")` — it just isn't used in the banner

## Done looks like
- `DailyItem` interface gains `image?: number`
- `getDailyItems()` SKINS mapping adds `image: s.image`; EFFECTS mapping adds `image: e.image` (EMOTES stay emoji-only — no image field)
- Daily card render (line 690-692) conditionally shows `<Image source={item.image} style={styles.dailyAvatarImage} resizeMode="contain" />` when image is present, else falls back to `<Text>{item.emoji}</Text>`
- New `dailyAvatarImage: { width: 48, height: 48 }` added to the StyleSheet (circle is 58×58)
- Active title banner (line 925) replaces `<Text fontSize 28>{activeTitleData.emoji}</Text>` with `<Image source={activeTitleData.image} style={{ width: 44, height: 44 }} resizeMode="contain" />`

## Out of scope
- The titles grid cards themselves — they already use `<Image source={title.image}>` correctly
- Effects grid cards — already use `<Image source={effect.image!}>` correctly
- Avatars grid — already correct

## Relevant file locations
- `app/shop.tsx:76-81` — DailyItem interface
- `app/shop.tsx:94-108` — getDailyItems() pool mapping
- `app/shop.tsx:690-692` — daily card icon render
- `app/shop.tsx:1362-1367` — StyleSheet: dailyAvatarCircle, dailyAvatarEmoji
- `app/shop.tsx:922-933` — active title banner (line 925 is the emoji)
