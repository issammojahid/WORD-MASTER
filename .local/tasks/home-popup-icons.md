# AI Icons for Home Screen Popup Cards

## What & Why
The 3 feature popup cards on the home screen ("طريق الكنز", "مكافأة يومية", "التحديات") still show large emoji icons (📦🎁🎯) inside their 110×110 icon circle. These need to be replaced with AI-generated PNG images, consistent with all the other icon upgrades done across the app (game modes, shop effects, chests, etc.).

## Done looks like
- `assets/home-popups/treasure-road.png` — gold/amber themed icon for "طريق الكنز" (treasure chest/path, 96×96 with transparent background)
- `assets/home-popups/daily-reward.png` — green themed gift/reward icon for "مكافأة يومية" (96×96 transparent)
- `assets/home-popups/challenges.png` — purple themed target/challenges icon for "التحديات" (96×96 transparent)
- `PopupPanel` type gains `image?: number` field
- Each entry in `POPUP_PANELS` has `image: require("@/assets/home-popups/...")` added
- In `FeaturePopup`, the `<Animated.Text style={pStyles.iconEmoji}>` is replaced with `<Animated.Image source={panel.image} style={pStyles.popupIconImage} resizeMode="contain">`, keeping the same `iconTransform` animation (rotate/translateY/scale still work on Animated.Image)
- A new `popupIconImage: { width: 82, height: 82 }` style is added to `pStyles`
- Emoji fallback `<Animated.Text>` is used only when `panel.image` is absent

## Out of scope
- The reward badge text emojis (🪙🎁⭐) inside the badge strip — those are small and inline with text
- Any other screens or modals
- The spin wheel screen itself

## Tasks

1. **Generate 3 AI icon PNGs** — Use `generateImage` to create `assets/home-popups/treasure-road.png`, `daily-reward.png`, `challenges.png` at 1024×1024 with `removeBackground: true`, then resize to 96×96. Colors to match per panel: gold (#F59E0B) for treasure road, green (#10B981) for daily reward, purple (#8B5CF6) for challenges.

2. **Wire images into POPUP_PANELS and FeaturePopup** — Add `image?: number` to `PopupPanel` type; add `image: require(...)` to each POPUP_PANELS entry; replace `<Animated.Text style={pStyles.iconEmoji}>{panel.icon}</Animated.Text>` with a conditional rendering using `<Animated.Image>` when `panel.image` is set; add `popupIconImage` style (82×82) to `pStyles`.

## Relevant files
- `app/index.tsx:298-332` — POPUP_PANELS array with id/icon/title/color
- `app/index.tsx:413-417` — PopupPanel type definition
- `app/index.tsx:486-534` — FeaturePopup render (iconCircle + iconEmoji)
- `app/index.tsx:589-628` — pStyles (iconCircle 110×110, iconEmoji fontSize 56)
