---
title: Parchisi-inspired home screen redesign
---
# Parchisi-Inspired Home Screen Redesign

## Goal
Rebuild the visual layout of `app/index.tsx` to feel like a high-quality casual Arabic mobile game (Parchisi-style), without copying it. Keep all existing logic, data, animations, popups, and navigation intact — only the visual structure and styling change.

## Done looks like
- Top bar is clean and balanced with avatar | store icon on the left, coins badge | settings on the right
- A new store icon (ShoppingBag or storefront) sits next to the avatar and routes to `/shop`
- The animated logo (ح letter) is smaller and sits inline inside the top bar area or reduced section — no longer takes up a huge amount of vertical space
- One large featured "play" card occupies the main center area — taller, more dominant, with a big pulsing العب الآن button
- Game mode selector is still a horizontal carousel but the active card is visually larger/elevated
- Stats row is a compact horizontal strip — not cluttered
- Daily challenge / battle pass / clan wars cards are smaller and grouped with more breathing space between them — max 2 per visible screen without scrolling
- Bottom nav icons have a cleaner pill or rounded-square selected state highlighting the active tab
- Overall padding is generous — content doesn't feel squeezed
- The result looks like a polished App Store-quality casual game

## Sections to redesign (all in app/index.tsx)

### 1. Top bar (lines 1334–1376)
**Current:** Avatar (38px circle) on left | coins badge + settings on right  
**New:**
- Left cluster: [Avatar circle] [Store icon button] — vertically centered, gap 10
- Store icon: `Ionicons "storefront-outline"` size 24, in a 40×40 rounded square button (same style as settingsBtn), onPress → `/shop`, color = LOGO.yellow or a warm orange
- Right cluster: [coins badge] [settings] — same as before, gap 8
- More vertical padding on the top bar itself

### 2. App logo / title section (lines 1393–1402)
**Current:** 88px "ح" floating letter with sparkles — takes ~100px height  
**New:**
- Reduce logo letter to 62px, tighten marginBottom
- Keep the float animation and sparkles
- Subtitle line stays, just smaller gap

### 3. Game modes carousel — main card (lines 1404–1435)
**Current:** CARD_WIDTH = width * 0.63, card height ~240px  
**New:**
- Active card should feel "selected" with a stronger scale (1.04 vs 1.0 for inactive) — this is already done via scale animation, make sure it's clearly visible
- Increase CARD_WIDTH to width * 0.72 for a more dominant center card
- Increase inner padding and emoji pill size slightly
- Add a subtle "selected" shimmer border on the active card (stronger borderColor opacity)
- The play button should be full-width inside the card and taller (paddingVertical: 16 instead of 13)

### 4. Stats row (lines 1437–1471)
**Current:** A LinearGradient strip with 4 stat columns  
**New:**
- Reduce paddingVertical from 14 to 10, reduce font sizes by 1–2pt
- Keep all 4 stats but make them feel more like a game HUD strip
- Use icon or small emoji prefix on each stat value (🎮 مباريات, 🏆 انتصارات, ⭐ نقاط, 🔥 سلسلة)

### 5. Daily challenge, battle pass, clan wars banners (lines 1473–1590)
**Current:** 3 tall horizontal cards stacked vertically, each ~80px tall with 14px vertical padding  
**New:**
- Reduce paddingVertical from 14 to 10, reduce icon box from 52×52 to 44×44 with borderRadius 12
- Reduce marginTop between cards from 10 to 8
- Title font size from 16 to 15, subtitle font size stays at 12
- These cards feel snappier and less bloated

### 6. Bottom navigation (lines 1593–1636)
**Current:** 5-item nav. Non-active items: icon in 42×38 rounded-rect wrap + 10pt label. Home: 60×60 circle elevated above bar.  
**New:**
- Non-active items: icon only (no icon wrap box), colored label underneath. Cleaner.
- Active tab (home only since this IS the home screen): keep elevated gold circle
- Increase borderRadius on each nav item's icon region slightly
- Add a thin 2px colored underline / indicator dot below the active non-home nav item label (for future use)
- paddingTop: 8 instead of 10
- Nav bar height stays the same

### 7. Store icon — new addition
Add a store icon button in the top bar between the avatar and the center spacer:
```tsx
<TouchableOpacity
  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/shop"); }}
  activeOpacity={0.8}
  style={[styles.storeBtn]}
>
  <Ionicons name="storefront-outline" size={20} color={LOGO.yellow} />
</TouchableOpacity>
```
With `storeBtn` style matching `settingsBtn` (40×40 rounded circle, semi-transparent background, border).

## Files to edit
- `app/index.tsx` — all visual changes, no logic changes

## What NOT to change
- All socket/game logic
- All popup overlay logic (FeaturePopup, LoginRewardPopup)
- All animation logic (BgParticle, ArabicLetterFloat, LogoSparkle, etc.)
- All data structures (gameModes array, POPUP_PANELS, etc.)
- Navigation routing
- Context hooks (usePlayer, useTheme, etc.)
