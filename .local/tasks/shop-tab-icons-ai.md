## الهدف
توليد 7 صور بالذكاء الاصطناعي لإيكونات تابات المتجر (عوضاً عن الإيموجي النصية الحالية)،
ثم تحديث app/shop.tsx لعرضها.

## التابات الحالية (TABS array في app/shop.tsx)
```
{ id: "daily",   label: "العروض",   emoji: "🛒", color: "#10B981" }
{ id: "spin",    label: "العجلة",   emoji: "🎡", color: "#06B6D4" }
{ id: "mystery", label: "صناديق",   emoji: "📦", color: "#8B5CF6" }
{ id: "avatars", label: "الأفاتار", emoji: "🦁", color: "#6C63FF" }
{ id: "effects", label: "تأثيرات", emoji: "✨", color: "#EC4899" }
{ id: "titles",  label: "ألقاب",   emoji: "🎖️", color: "#F59E0B" }
{ id: "coins",   label: "حزم",     emoji: "💎", color: "#F59E0B" }
```

## الخطوة 1: توليد 7 صور بالـ AI

كل صورة 1:1، removeBackground: true، حجم مناسب للـ icon (~64px داخل التاب).
تُحفظ في: `assets/shop-tabs/{id}.png`

**مواصفات كل صورة** (أسلوب موحد: dark fantasy game icon, neon glow, clean transparent bg):

1. **daily** → "Glowing neon-green shopping bag icon with golden star bursts, arcade game style, vibrant, transparent background"
2. **spin** → "Glowing colorful prize wheel / roulette wheel icon with cyan and rainbow neon lights, arcade game style, transparent background"
3. **mystery** → "Magical glowing purple mystery treasure chest with sparkles and purple aura, arcade game style, transparent background"
4. **avatars** → "Majestic glowing lion face avatar icon with deep purple and indigo neon halo, game art style, transparent background"
5. **effects** → "Swirling pink and magenta sparkle magic effects icon, glowing stars, game art style, transparent background"
6. **titles** → "Gleaming golden crown with royal gold neon glow and laurel decoration, game icon style, transparent background"
7. **coins** → "Brilliant glowing diamond gem with gold and yellow neon aura, coin stack behind, game icon style, transparent background"

## الخطوة 2: تحديث app/shop.tsx

### إضافة image import
```tsx
import { Image } from "react-native";
```

### تحديث TABS array — إضافة `icon` field
```tsx
const TABS = [
  { id: "daily",   label: "العروض",   emoji: "🛒", color: "#10B981", icon: require("@/assets/shop-tabs/daily.png") },
  { id: "spin",    label: "العجلة",   emoji: "🎡", color: "#06B6D4", icon: require("@/assets/shop-tabs/spin.png") },
  { id: "mystery", label: "صناديق",   emoji: "📦", color: "#8B5CF6", icon: require("@/assets/shop-tabs/mystery.png") },
  { id: "avatars", label: "الأفاتار", emoji: "🦁", color: "#6C63FF", icon: require("@/assets/shop-tabs/avatars.png") },
  { id: "effects", label: "تأثيرات", emoji: "✨", color: "#EC4899", icon: require("@/assets/shop-tabs/effects.png") },
  { id: "titles",  label: "ألقاب",   emoji: "🎖️", color: "#F59E0B", icon: require("@/assets/shop-tabs/titles.png") },
  { id: "coins",   label: "حزم",     emoji: "💎", color: "#F59E0B", icon: require("@/assets/shop-tabs/coins.png") },
] as const;
```

### تبديل عرض الـ tab icon (line ~1162)
عوض:
```tsx
<Text style={[styles.tabEmoji, active && { fontSize: 21 }]}>{tab.emoji}</Text>
```
تحط:
```tsx
<Image
  source={tab.icon}
  style={[styles.tabIcon, active && styles.tabIconActive]}
  resizeMode="contain"
/>
```

### إضافة styles
```tsx
tabIcon: {
  width: 28, height: 28, marginBottom: 2,
  opacity: 0.75,
},
tabIconActive: {
  width: 32, height: 32,
  opacity: 1.0,
},
```
(وتقدر تمسح `tabEmoji` style من الـ StyleSheet أو تبقيه)

## ملاحظات مهمة
- لا تمسح `emoji` field من TABS (يمكن يتستعمل في أماكن أخرى)
- ما تمسحش `tabEmoji` style باش ما تكسرش أي شي
- كل الـ tab logic، الألوان، الـ active state — تبقى كما هي
- فقط الـ emoji Text يتبدل بـ Image component

## النتيجة المتوقعة
تابات المتجر تبين صور AI جميلة عوض الإيموجي العادية، مع نفس الـ active state والألوان
