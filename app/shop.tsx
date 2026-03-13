import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, Animated, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  usePlayer,
  SKINS, BACKGROUNDS, EMOTES, EFFECTS,
  RARITY_COLORS, RARITY_LABELS, MYSTERY_BOX_PRICE,
  type MysteryBoxPrize, type Rarity,
  type SkinId, type BackgroundId, type EmoteId, type EffectId,
} from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";

const { width: SW } = Dimensions.get("window");
const CARD_W = (SW - 48) / 2;

// ── Daily shop helpers ─────────────────────────────────────────────────────────
interface DailyItem {
  id: string;
  type: "skin" | "background" | "emote" | "effect";
  emoji: string;
  nameAr: string;
  originalPrice: number;
  discountedPrice: number;
  rarity: Rarity;
  color: string;
}

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0x100000000; };
}

function getDailyItems(): DailyItem[] {
  const today = new Date().toDateString();
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) | 0;
  const rng = seededRng(seed);

  const pool: DailyItem[] = [
    ...SKINS.filter(s => s.price > 0 && !s.unlockCondition).map(s => ({
      id: s.id, type: "skin" as const, emoji: s.emoji, nameAr: s.nameAr,
      originalPrice: s.price, discountedPrice: Math.floor(s.price * 0.7),
      rarity: s.rarity, color: s.color,
    })),
    ...BACKGROUNDS.filter(b => b.price > 0).map(b => ({
      id: b.id, type: "background" as const, emoji: b.emoji, nameAr: b.nameAr,
      originalPrice: b.price, discountedPrice: Math.floor(b.price * 0.7),
      rarity: b.rarity, color: b.color,
    })),
    ...EMOTES.filter(e => e.price > 0).map(e => ({
      id: e.id, type: "emote" as const, emoji: e.emoji, nameAr: e.nameAr,
      originalPrice: e.price, discountedPrice: Math.floor(e.price * 0.7),
      rarity: "common" as Rarity, color: "#4CAF50",
    })),
    ...EFFECTS.filter(e => e.price > 0).map(e => ({
      id: e.id, type: "effect" as const, emoji: e.emoji, nameAr: e.nameAr,
      originalPrice: e.price, discountedPrice: Math.floor(e.price * 0.7),
      rarity: e.rarity, color: e.color,
    })),
  ];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function rollMysteryBox(profile: ReturnType<typeof usePlayer>["profile"]): MysteryBoxPrize {
  const r = Math.random();
  if (r < 0.35) {
    const amount = Math.floor(Math.random() * 151) + 50;
    return { type: "coins", coins: amount, emoji: "🪙", nameAr: `${amount} عملة` };
  }
  if (r < 0.65) {
    const av = SKINS.filter(s => s.price > 0 && !s.unlockCondition && !profile.ownedSkins.includes(s.id));
    if (av.length > 0) {
      const s = av[Math.floor(Math.random() * av.length)];
      return { type: "skin", id: s.id, emoji: s.emoji, nameAr: s.nameAr };
    }
    return { type: "coins", coins: 150, emoji: "🪙", nameAr: "150 عملة" };
  }
  if (r < 0.80) {
    const av = BACKGROUNDS.filter(b => b.price > 0 && !profile.ownedBackgrounds.includes(b.id));
    if (av.length > 0) {
      const b = av[Math.floor(Math.random() * av.length)];
      return { type: "background", id: b.id, emoji: b.emoji, nameAr: b.nameAr };
    }
    return { type: "coins", coins: 100, emoji: "🪙", nameAr: "100 عملة" };
  }
  if (r < 0.92) {
    const av = EMOTES.filter(e => e.price > 0 && !profile.ownedEmotes.includes(e.id));
    if (av.length > 0) {
      const e = av[Math.floor(Math.random() * av.length)];
      return { type: "emote", id: e.id, emoji: e.emoji, nameAr: e.nameAr };
    }
    return { type: "coins", coins: 60, emoji: "🪙", nameAr: "60 عملة" };
  }
  const av = EFFECTS.filter(e => e.price > 0 && !profile.ownedEffects.includes(e.id));
  if (av.length > 0) {
    const e = av[Math.floor(Math.random() * av.length)];
    return { type: "effect", id: e.id, emoji: e.emoji, nameAr: e.nameAr };
  }
  return { type: "coins", coins: 80, emoji: "🪙", nameAr: "80 عملة" };
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}س ${m}د`;
}

// ── Rarity border helper ───────────────────────────────────────────────────────
function rarityCardStyle(rarity: Rarity) {
  const color = RARITY_COLORS[rarity];
  return {
    borderColor: color,
    ...(rarity === "epic" || rarity === "legendary"
      ? { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 }
      : {}),
  };
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "outfits",     label: "أزياء",    emoji: "👕" },
  { id: "backgrounds", label: "خلفيات",   emoji: "🖼️" },
  { id: "emotes",      label: "تفاعلات",  emoji: "😂" },
  { id: "effects",     label: "تأثيرات",  emoji: "✨" },
  { id: "mystery",     label: "صندوق",    emoji: "📦" },
  { id: "daily",       label: "اليوم",    emoji: "🏷️" },
] as const;
type TabId = typeof TABS[number]["id"];

const SKIN_FILTERS = ["الكل", "مغربية", "عالمية", "حصرية"] as const;
type SkinFilter = typeof SKIN_FILTERS[number];

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { profile, purchaseSkin, equipSkin, purchaseBackground, equipBackground, purchaseEmote,
    purchaseEffect, equipEffect, grantItem, buyDailyItem, addCoins } = usePlayer();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<TabId>("outfits");
  const [skinFilter, setSkinFilter] = useState<SkinFilter>("الكل");
  const [boxState, setBoxState] = useState<"idle" | "opening" | "revealed">("idle");
  const [boxResult, setBoxResult] = useState<MysteryBoxPrize | null>(null);
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const boxScaleAnim = useRef(new Animated.Value(1)).current;
  const boxOpacityAnim = useRef(new Animated.Value(1)).current;
  const prizeScaleAnim = useRef(new Animated.Value(0)).current;
  const prizeOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date().toDateString();
  const todayBought = profile.dailyShopDate === today ? profile.dailyShopBought : [];
  const dailyItems = getDailyItems();

  // ── Mystery Box ──────────────────────────────────────────────────────────────
  const handleOpenBox = () => {
    if (profile.coins < MYSTERY_BOX_PRICE) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("نقود غير كافية", `تحتاج ${MYSTERY_BOX_PRICE} نقود لفتح الصندوق`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    addCoins(-MYSTERY_BOX_PRICE);
    setBoxState("opening");

    shakeAnim.setValue(0);
    boxScaleAnim.setValue(1);
    boxOpacityAnim.setValue(1);
    prizeScaleAnim.setValue(0);
    prizeOpacityAnim.setValue(0);

    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -14, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 14, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(boxScaleAnim, { toValue: 1.5, duration: 220, useNativeDriver: true }),
        Animated.timing(boxOpacityAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
    ]).start(() => {
      const prize = rollMysteryBox(profile);
      if (prize.type === "coins") addCoins(prize.coins!);
      else grantItem(prize.type, prize.id!);
      setBoxResult(prize);
      setBoxState("revealed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.spring(prizeScaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }),
        Animated.timing(prizeOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const resetBox = () => {
    setBoxState("idle");
    setBoxResult(null);
    shakeAnim.setValue(0);
    boxScaleAnim.setValue(1);
    boxOpacityAnim.setValue(1);
    prizeScaleAnim.setValue(0);
    prizeOpacityAnim.setValue(0);
  };

  // ── Skin action handler ───────────────────────────────────────────────────────
  const handleSkinAction = (skinId: SkinId) => {
    const skin = SKINS.find(s => s.id === skinId)!;
    if (profile.ownedSkins.includes(skinId)) {
      equipSkin(skinId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (skin.unlockCondition) {
      const { type, value, label } = skin.unlockCondition;
      const current =
        type === "wins"   ? profile.wins :
        type === "level"  ? profile.level :
        profile.bestStreak;
      if (current < value) {
        Alert.alert("غير مفتوح بعد", `${label} (${current}/${value})`);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      purchaseSkin(skinId);
      return;
    }
    if (profile.coins < skin.price) {
      Alert.alert("نقود غير كافية", `تحتاج ${skin.price} نقود`);
      return;
    }
    Alert.alert("شراء الزي", `هل تريد شراء "${skin.nameAr}" مقابل ${skin.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseSkin(skinId); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  // ── Background action ─────────────────────────────────────────────────────────
  const handleBgAction = (id: BackgroundId) => {
    const bg = BACKGROUNDS.find(b => b.id === id)!;
    if (profile.ownedBackgrounds.includes(id)) { equipBackground(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); return; }
    if (profile.coins < bg.price) { Alert.alert("نقود غير كافية", `تحتاج ${bg.price} نقود`); return; }
    Alert.alert("شراء الخلفية", `هل تريد شراء "${bg.nameAr}" مقابل ${bg.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseBackground(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  // ── Emote action ─────────────────────────────────────────────────────────────
  const handleEmoteAction = (id: EmoteId) => {
    const emote = EMOTES.find(e => e.id === id)!;
    if (profile.ownedEmotes.includes(id)) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); return; }
    if (profile.coins < emote.price) { Alert.alert("نقود غير كافية", `تحتاج ${emote.price} نقود`); return; }
    Alert.alert("شراء التفاعل", `هل تريد شراء "${emote.nameAr}" مقابل ${emote.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseEmote(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  // ── Effect action ─────────────────────────────────────────────────────────────
  const handleEffectAction = (id: EffectId) => {
    const effect = EFFECTS.find(e => e.id === id)!;
    if (profile.ownedEffects.includes(id)) { equipEffect(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); return; }
    if (profile.coins < effect.price) { Alert.alert("نقود غير كافية", `تحتاج ${effect.price} نقود`); return; }
    Alert.alert("شراء التأثير", `هل تريد شراء "${effect.nameAr}" مقابل ${effect.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseEffect(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  // ── Daily buy action ──────────────────────────────────────────────────────────
  const handleDailyBuy = (item: DailyItem) => {
    const success = buyDailyItem(item.id, item.type, item.discountedPrice);
    if (success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Alert.alert("خطأ", "لم يتم الشراء. تأكد من رصيدك أو أنك لم تشتر هذا المنتج اليوم.");
  };

  const isItemOwned = (item: DailyItem): boolean => {
    if (item.type === "skin")       return profile.ownedSkins.includes(item.id as SkinId);
    if (item.type === "background") return profile.ownedBackgrounds.includes(item.id as BackgroundId);
    if (item.type === "emote")      return profile.ownedEmotes.includes(item.id as EmoteId);
    if (item.type === "effect")     return profile.ownedEffects.includes(item.id as EffectId);
    return false;
  };

  // ── Render: Outfits ───────────────────────────────────────────────────────────
  const renderOutfits = () => {
    const filtered = SKINS.filter(s => {
      if (skinFilter === "الكل") return true;
      if (skinFilter === "مغربية") return s.category === "moroccan";
      if (skinFilter === "عالمية") return s.category === "global";
      return s.category === "exclusive";
    });

    return (
      <>
        {/* Current skin preview */}
        <View style={s.previewBar}>
          {(() => {
            const cur = SKINS.find(sk => sk.id === profile.equippedSkin) || SKINS[0];
            return (
              <>
                <View style={[s.previewCircle, { backgroundColor: cur.color + "33" }]}>
                  <Text style={s.previewEmoji}>{cur.emoji}</Text>
                </View>
                <View>
                  <Text style={s.previewTitle}>زيّك الحالي</Text>
                  <Text style={[s.previewSub, { color: RARITY_COLORS[cur.rarity] }]}>
                    {cur.nameAr} · {RARITY_LABELS[cur.rarity]}
                  </Text>
                </View>
              </>
            );
          })()}
        </View>

        {/* Filter bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterBarContent}>
          {SKIN_FILTERS.map(f => (
            <TouchableOpacity key={f} onPress={() => setSkinFilter(f)}
              style={[s.filterChip, skinFilter === f && s.filterChipActive]}>
              <Text style={[s.filterChipText, skinFilter === f && s.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Grid */}
        <View style={s.grid}>
          {filtered.map(skin => {
            const owned = profile.ownedSkins.includes(skin.id);
            const equipped = profile.equippedSkin === skin.id;
            const canAfford = profile.coins >= skin.price;
            const unlockCond = skin.unlockCondition;
            const unlockCurrent =
              !unlockCond ? 0 :
              unlockCond.type === "wins"   ? profile.wins :
              unlockCond.type === "level"  ? profile.level :
              profile.bestStreak;
            const unlockMet = unlockCond ? unlockCurrent >= unlockCond.value : false;

            return (
              <TouchableOpacity
                key={skin.id}
                style={[s.itemCard, { width: CARD_W }, rarityCardStyle(skin.rarity), equipped && s.itemCardEquipped]}
                onPress={() => handleSkinAction(skin.id)}
                activeOpacity={0.82}
              >
                {/* Rarity badge */}
                <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[skin.rarity] + "28" }]}>
                  <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[skin.rarity] }]}>
                    {RARITY_LABELS[skin.rarity]}
                  </Text>
                </View>

                {/* Status overlay top-right */}
                {equipped && (
                  <View style={s.equippedDot}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.emerald} />
                  </View>
                )}
                {!owned && !unlockCond && !canAfford && (
                  <View style={s.equippedDot}>
                    <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
                  </View>
                )}

                {/* Emoji */}
                <View style={[s.itemEmojiCircle, { backgroundColor: skin.color + "22" }]}>
                  <Text style={s.itemEmoji}>{skin.emoji}</Text>
                </View>

                <Text style={s.itemName}>{skin.nameAr}</Text>
                <Text style={s.itemDesc} numberOfLines={2}>{skin.descAr}</Text>

                {/* Action */}
                {owned ? (
                  <View style={[s.actionBtn, equipped ? s.actionEquipped : s.actionEquip]}>
                    <Text style={[s.actionBtnText, { color: equipped ? Colors.emerald : "#60A5FA" }]}>
                      {equipped ? "✓ مُجهَّز" : "تجهيز"}
                    </Text>
                  </View>
                ) : unlockCond ? (
                  <View style={[s.actionBtn, unlockMet ? s.actionUnlock : s.actionLocked]}>
                    <Text style={[s.actionBtnText, { color: unlockMet ? "#A78BFA" : Colors.textMuted }]} numberOfLines={1}>
                      {unlockMet ? "🔓 افتح" : `${unlockCurrent}/${unlockCond.value} ${unlockCond.label.split(" ").slice(-1)[0]}`}
                    </Text>
                  </View>
                ) : (
                  <View style={[s.actionBtn, canAfford ? s.actionBuy : s.actionCantBuy]}>
                    <Ionicons name="star" size={11} color={canAfford ? Colors.gold : Colors.textMuted} />
                    <Text style={[s.actionBtnText, { color: canAfford ? Colors.gold : Colors.textMuted }]}>
                      {skin.price}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  // ── Render: Backgrounds ───────────────────────────────────────────────────────
  const renderBackgrounds = () => (
    <View style={s.grid}>
      {BACKGROUNDS.map(bg => {
        const owned = profile.ownedBackgrounds.includes(bg.id);
        const equipped = profile.equippedBackground === bg.id;
        const canAfford = profile.coins >= bg.price;

        return (
          <TouchableOpacity
            key={bg.id}
            style={[s.itemCard, { width: CARD_W }, rarityCardStyle(bg.rarity), equipped && s.itemCardEquipped]}
            onPress={() => handleBgAction(bg.id)}
            activeOpacity={0.82}
          >
            <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[bg.rarity] + "28" }]}>
              <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[bg.rarity] }]}>{RARITY_LABELS[bg.rarity]}</Text>
            </View>
            {equipped && <View style={s.equippedDot}><Ionicons name="checkmark-circle" size={18} color={Colors.emerald} /></View>}

            {/* Background preview */}
            <LinearGradient
              colors={[bg.color, bg.color + "88", Colors.background]}
              style={s.bgPreview}
            >
              <Text style={s.bgPreviewEmoji}>{bg.emoji}</Text>
            </LinearGradient>

            <Text style={s.itemName}>{bg.nameAr}</Text>

            {owned ? (
              <View style={[s.actionBtn, equipped ? s.actionEquipped : s.actionEquip]}>
                <Text style={[s.actionBtnText, { color: equipped ? Colors.emerald : "#60A5FA" }]}>
                  {equipped ? "✓ مُجهَّز" : "تجهيز"}
                </Text>
              </View>
            ) : (
              <View style={[s.actionBtn, canAfford ? s.actionBuy : s.actionCantBuy]}>
                <Ionicons name="star" size={11} color={canAfford ? Colors.gold : Colors.textMuted} />
                <Text style={[s.actionBtnText, { color: canAfford ? Colors.gold : Colors.textMuted }]}>{bg.price}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Render: Emotes ────────────────────────────────────────────────────────────
  const renderEmotes = () => (
    <>
      <Text style={s.sectionHint}>أرسل تفاعلات لخصمك أثناء المباراة</Text>
      <View style={s.emotesGrid}>
        {EMOTES.map(emote => {
          const owned = profile.ownedEmotes.includes(emote.id);
          const canAfford = profile.coins >= emote.price;
          return (
            <TouchableOpacity
              key={emote.id}
              style={[s.emoteCard, owned && s.emoteCardOwned]}
              onPress={() => handleEmoteAction(emote.id)}
              activeOpacity={0.82}
            >
              <Text style={s.emoteEmoji}>{emote.emoji}</Text>
              <Text style={s.emoteName}>{emote.nameAr}</Text>
              {owned ? (
                <View style={s.emoteOwnedBadge}>
                  <Text style={s.emoteOwnedText}>✓</Text>
                </View>
              ) : (
                <View style={[s.emotePrice, { backgroundColor: canAfford ? Colors.gold + "22" : Colors.card }]}>
                  <Ionicons name="star" size={10} color={canAfford ? Colors.gold : Colors.textMuted} />
                  <Text style={[s.emotePriceText, { color: canAfford ? Colors.gold : Colors.textMuted }]}>{emote.price}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  // ── Render: Effects ────────────────────────────────────────────────────────────
  const renderEffects = () => (
    <>
      <Text style={s.sectionHint}>تأثيرات بصرية رائعة عند الفوز بمباراة</Text>
      <View style={s.grid}>
        {EFFECTS.map(effect => {
          const owned = profile.ownedEffects.includes(effect.id);
          const equipped = profile.equippedEffect === effect.id;
          const canAfford = profile.coins >= effect.price;

          return (
            <TouchableOpacity
              key={effect.id}
              style={[s.itemCard, { width: CARD_W }, effect.price > 0 ? rarityCardStyle(effect.rarity) : {}, equipped && s.itemCardEquipped]}
              onPress={() => handleEffectAction(effect.id)}
              activeOpacity={0.82}
            >
              {effect.price > 0 && (
                <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[effect.rarity] + "28" }]}>
                  <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[effect.rarity] }]}>{RARITY_LABELS[effect.rarity]}</Text>
                </View>
              )}
              {equipped && <View style={s.equippedDot}><Ionicons name="checkmark-circle" size={18} color={Colors.emerald} /></View>}

              <View style={[s.itemEmojiCircle, { backgroundColor: effect.color + "22" }]}>
                <Text style={s.itemEmoji}>{effect.emoji}</Text>
              </View>
              <Text style={s.itemName}>{effect.nameAr}</Text>
              <Text style={s.itemDesc} numberOfLines={2}>{effect.descAr}</Text>

              {owned ? (
                <View style={[s.actionBtn, equipped ? s.actionEquipped : s.actionEquip]}>
                  <Text style={[s.actionBtnText, { color: equipped ? Colors.emerald : "#60A5FA" }]}>
                    {equipped ? "✓ مُجهَّز" : "تجهيز"}
                  </Text>
                </View>
              ) : effect.price === 0 ? (
                <View style={[s.actionBtn, s.actionEquip]}>
                  <Text style={[s.actionBtnText, { color: "#60A5FA" }]}>تجهيز</Text>
                </View>
              ) : (
                <View style={[s.actionBtn, canAfford ? s.actionBuy : s.actionCantBuy]}>
                  <Ionicons name="star" size={11} color={canAfford ? Colors.gold : Colors.textMuted} />
                  <Text style={[s.actionBtnText, { color: canAfford ? Colors.gold : Colors.textMuted }]}>{effect.price}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  // ── Render: Mystery Box ────────────────────────────────────────────────────────
  const renderMysteryBox = () => {
    const canAfford = profile.coins >= MYSTERY_BOX_PRICE;

    return (
      <View style={s.boxContainer}>
        {boxState !== "revealed" ? (
          <>
            <Text style={s.boxTitle}>صندوق الغموض</Text>
            <Text style={s.boxSubtitle}>افتح الصندوق للحصول على جائزة عشوائية!</Text>

            {/* Box */}
            <Animated.View style={[s.boxWrapper, {
              transform: [
                { translateX: shakeAnim },
                { scale: boxScaleAnim },
              ],
              opacity: boxOpacityAnim,
            }]}>
              <LinearGradient colors={["#2D1B69", "#1A1035"]} style={s.boxCard}>
                <Text style={s.boxEmoji}>📦</Text>
                <View style={s.boxQuestionMarks}>
                  {["❓", "✨", "❓"].map((q, i) => (
                    <Text key={i} style={s.boxQuestion}>{q}</Text>
                  ))}
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Prize pool hint */}
            <View style={s.boxPoolRow}>
              {[
                { emoji: "🥷", label: "أزياء" },
                { emoji: "🖼️", label: "خلفيات" },
                { emoji: "😂", label: "تفاعلات" },
                { emoji: "✨", label: "تأثيرات" },
                { emoji: "🪙", label: "نقود" },
              ].map((item, i) => (
                <View key={i} style={s.boxPoolItem}>
                  <Text style={s.boxPoolEmoji}>{item.emoji}</Text>
                  <Text style={s.boxPoolLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.openBoxBtn, !canAfford && s.openBoxBtnDisabled]}
              onPress={handleOpenBox}
              disabled={boxState === "opening" || !canAfford}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={canAfford ? ["#7C3AED", "#4C1D95"] : [Colors.card, Colors.card]}
                style={s.openBoxBtnGrad}
              >
                <Ionicons name="star" size={14} color={canAfford ? Colors.gold : Colors.textMuted} />
                <Text style={[s.openBoxBtnText, !canAfford && { color: Colors.textMuted }]}>
                  {boxState === "opening" ? "جاري الفتح..." : `فتح الصندوق · ${MYSTERY_BOX_PRICE}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {!canAfford && (
              <Text style={s.cantAffordHint}>تحتاج المزيد من النقود للفتح</Text>
            )}
          </>
        ) : (
          /* Prize reveal */
          <Animated.View style={[s.prizeReveal, {
            transform: [{ scale: prizeScaleAnim }],
            opacity: prizeOpacityAnim,
          }]}>
            <Text style={s.prizeCongrats}>مبروك! 🎉</Text>
            <LinearGradient colors={["#1A2E43", "#0D1B2A"]} style={s.prizeCard}>
              <Text style={s.prizeEmoji}>{boxResult?.emoji}</Text>
              <Text style={s.prizeName}>{boxResult?.nameAr}</Text>
              <Text style={s.prizeTypeLabel}>
                {boxResult?.type === "coins" ? "🪙 عملات مضافة لرصيدك" :
                 boxResult?.type === "skin"       ? "👕 زي جديد في مجموعتك" :
                 boxResult?.type === "background" ? "🖼️ خلفية جديدة مفتوحة" :
                 boxResult?.type === "emote"      ? "😂 تفاعل جديد مفتوح" :
                 "✨ تأثير جديد مفتوح"}
              </Text>
            </LinearGradient>
            <TouchableOpacity style={s.openAgainBtn} onPress={resetBox} activeOpacity={0.85}>
              <Text style={s.openAgainText}>فتح مرة أخرى</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    );
  };

  // ── Render: Daily Shop ─────────────────────────────────────────────────────────
  const renderDailyShop = () => (
    <>
      {/* Header */}
      <LinearGradient colors={["#1A2E43", "#0D1B2A"]} style={s.dailyHeader}>
        <View>
          <Text style={s.dailyTitle}>عروض اليوم 🏷️</Text>
          <Text style={s.dailySubtitle}>تتجدد كل يوم · خصم 30%</Text>
        </View>
        <View style={s.dailyTimer}>
          <Ionicons name="time-outline" size={14} color={Colors.gold} />
          <Text style={s.dailyTimerText}>{timeLeft}</Text>
        </View>
      </LinearGradient>

      {/* Items */}
      {dailyItems.map((item, idx) => {
        const owned = isItemOwned(item);
        const boughtToday = todayBought.includes(item.id);
        const canAfford = profile.coins >= item.discountedPrice;
        const discount = Math.round((1 - item.discountedPrice / item.originalPrice) * 100);

        return (
          <View key={idx} style={[s.dailyCard, rarityCardStyle(item.rarity)]}>
            {/* Discount badge */}
            <View style={s.discountBadge}>
              <Text style={s.discountBadgeText}>-{discount}%</Text>
            </View>

            {/* Content row */}
            <View style={s.dailyCardContent}>
              <View style={[s.dailyItemCircle, { backgroundColor: item.color + "22" }]}>
                <Text style={s.dailyItemEmoji}>{item.emoji}</Text>
              </View>
              <View style={s.dailyItemInfo}>
                <View style={s.dailyItemTopRow}>
                  <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[item.rarity] + "28" }]}>
                    <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[item.rarity] }]}>
                      {RARITY_LABELS[item.rarity]}
                    </Text>
                  </View>
                  <Text style={s.dailyItemType}>
                    {item.type === "skin" ? "زي" : item.type === "background" ? "خلفية" : item.type === "emote" ? "تفاعل" : "تأثير"}
                  </Text>
                </View>
                <Text style={s.dailyItemName}>{item.nameAr}</Text>
                <View style={s.dailyPriceRow}>
                  <Text style={s.dailyOriginalPrice}>{item.originalPrice}</Text>
                  <Ionicons name="star" size={13} color={Colors.gold} />
                  <Text style={s.dailyDiscountedPrice}>{item.discountedPrice}</Text>
                </View>
              </View>

              {/* Action */}
              {owned || boughtToday ? (
                <View style={[s.dailyActionBtn, s.dailyActionOwned]}>
                  <Text style={s.dailyActionOwnedText}>{owned ? "تملكه" : "✓ مشترى"}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.dailyActionBtn, canAfford ? s.dailyActionBuy : s.dailyActionDisabled]}
                  onPress={() => handleDailyBuy(item)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.dailyActionBuyText, !canAfford && { color: Colors.textMuted }]}>
                    {canAfford ? "شراء" : "لا يكفي"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {/* Earn coins tip */}
      <View style={s.earnCard}>
        <Text style={s.earnTitle}>كيف تكسب المزيد من النقود؟</Text>
        {[
          { rank: "1", color: Colors.rank1, text: "المركز الأول = 20 نقود" },
          { rank: "2", color: Colors.rank2, text: "المركز الثاني = 15 نقود" },
          { rank: "3", color: Colors.rank3, text: "المركز الثالث = 10 نقود" },
          { rank: "+", color: Colors.textMuted, text: "باقي المراكز = 5 نقود" },
        ].map((r, i) => (
          <View key={i} style={s.earnRow}>
            <View style={[s.earnBadge, { backgroundColor: r.color + "22" }]}>
              <Text style={[s.earnBadgeText, { color: r.color }]}>{r.rank}</Text>
            </View>
            <Text style={s.earnText}>{r.text}</Text>
          </View>
        ))}
      </View>
    </>
  );

  // ── Main render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>المتجر</Text>
        <View style={s.coinsBadge}>
          <Ionicons name="star" size={14} color={Colors.gold} />
          <Text style={s.coinsText}>{profile.coins}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => { setActiveTab(tab.id); if (tab.id !== "mystery") resetBox(); }}
            activeOpacity={0.8}
          >
            <Text style={s.tabEmoji}>{tab.emoji}</Text>
            <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: bottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "outfits"     && renderOutfits()}
        {activeTab === "backgrounds" && renderBackgrounds()}
        {activeTab === "emotes"      && renderEmotes()}
        {activeTab === "effects"     && renderEffects()}
        {activeTab === "mystery"     && renderMysteryBox()}
        {activeTab === "daily"       && renderDailyShop()}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  coinsBadge: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, gap: 5 },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },

  // Tab bar
  tabBar: { maxHeight: 68, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: "center", paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignItems: "center", flexDirection: "row", gap: 6, backgroundColor: Colors.card },
  tabActive: { backgroundColor: Colors.gold + "22", borderWidth: 1, borderColor: Colors.gold + "55" },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  tabLabelActive: { color: Colors.gold },

  scrollContent: { padding: 16 },

  // Preview bar
  previewBar: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  previewCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  previewEmoji: { fontSize: 28 },
  previewTitle: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  previewSub: { fontFamily: "Cairo_700Bold", fontSize: 14 },

  // Filter bar
  filterBar: { marginBottom: 14 },
  filterBarContent: { gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  filterChipActive: { backgroundColor: Colors.gold + "22", borderColor: Colors.gold + "55" },
  filterChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.gold },

  // Cards grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  itemCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 2, position: "relative", overflow: "hidden" },
  itemCardEquipped: { backgroundColor: Colors.emerald + "0A" },

  rarityBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, zIndex: 1 },
  rarityBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 9 },
  equippedDot: { position: "absolute", top: 8, right: 8, zIndex: 1 },

  itemEmojiCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginTop: 22, marginBottom: 8 },
  itemEmoji: { fontSize: 32 },
  itemName: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.textPrimary, textAlign: "center", marginBottom: 3 },
  itemDesc: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted, textAlign: "center", marginBottom: 10, lineHeight: 15 },

  actionBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 10, gap: 4 },
  actionEquipped: { backgroundColor: Colors.emerald + "18" },
  actionEquip: { backgroundColor: "#60A5FA18" },
  actionBuy: { backgroundColor: Colors.gold + "22" },
  actionCantBuy: { backgroundColor: Colors.cardBorder },
  actionUnlock: { backgroundColor: "#A78BFA22" },
  actionLocked: { backgroundColor: Colors.cardBorder },
  actionBtnText: { fontFamily: "Cairo_700Bold", fontSize: 12 },

  // Background card
  bgPreview: { width: "100%", height: 70, borderRadius: 10, justifyContent: "center", alignItems: "center", marginTop: 20, marginBottom: 8 },
  bgPreviewEmoji: { fontSize: 30 },

  // Emotes
  sectionHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, textAlign: "center", marginBottom: 16 },
  emotesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 20 },
  emoteCard: { width: 90, backgroundColor: Colors.card, borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 2, borderColor: Colors.cardBorder },
  emoteCardOwned: { borderColor: Colors.emerald + "60", backgroundColor: Colors.emerald + "08" },
  emoteEmoji: { fontSize: 34, marginBottom: 6 },
  emoteName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textPrimary, marginBottom: 6 },
  emoteOwnedBadge: { backgroundColor: Colors.emerald + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  emoteOwnedText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: Colors.emerald },
  emotePrice: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  emotePriceText: { fontFamily: "Cairo_700Bold", fontSize: 12 },

  // Mystery box
  boxContainer: { alignItems: "center", paddingTop: 10 },
  boxTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.textPrimary, marginBottom: 6 },
  boxSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textMuted, marginBottom: 28, textAlign: "center" },
  boxWrapper: { marginBottom: 28 },
  boxCard: { width: 180, height: 180, borderRadius: 24, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#7C3AED55" },
  boxEmoji: { fontSize: 72, marginBottom: 6 },
  boxQuestionMarks: { flexDirection: "row", gap: 8 },
  boxQuestion: { fontSize: 18 },
  boxPoolRow: { flexDirection: "row", gap: 16, marginBottom: 28 },
  boxPoolItem: { alignItems: "center", gap: 4 },
  boxPoolEmoji: { fontSize: 22 },
  boxPoolLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted },
  openBoxBtn: { width: 240, borderRadius: 16, overflow: "hidden", marginBottom: 10 },
  openBoxBtnDisabled: { opacity: 0.5 },
  openBoxBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  openBoxBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary },
  cantAffordHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  prizeReveal: { alignItems: "center", width: "100%" },
  prizeCongrats: { fontFamily: "Cairo_700Bold", fontSize: 24, color: Colors.textPrimary, marginBottom: 16 },
  prizeCard: { width: "85%", borderRadius: 24, padding: 32, alignItems: "center", borderWidth: 1, borderColor: Colors.gold + "44", marginBottom: 24 },
  prizeEmoji: { fontSize: 72, marginBottom: 12 },
  prizeName: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary, marginBottom: 8, textAlign: "center" },
  prizeTypeLabel: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textMuted, textAlign: "center" },
  openAgainBtn: { backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  openAgainText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary },

  // Daily shop
  dailyHeader: { borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder },
  dailyTitle: { fontFamily: "Cairo_700Bold", fontSize: 17, color: Colors.textPrimary, marginBottom: 3 },
  dailySubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted },
  dailyTimer: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.gold + "18", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  dailyTimerText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.gold },
  dailyCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 2, position: "relative", overflow: "hidden" },
  discountBadge: { position: "absolute", top: 12, left: 12, backgroundColor: "#EF4444", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, zIndex: 1 },
  discountBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 11, color: "#FFFFFF" },
  dailyCardContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  dailyItemCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  dailyItemEmoji: { fontSize: 28 },
  dailyItemInfo: { flex: 1 },
  dailyItemTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  dailyItemType: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },
  dailyItemName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary, marginBottom: 6 },
  dailyPriceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dailyOriginalPrice: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textMuted, textDecorationLine: "line-through" },
  dailyDiscountedPrice: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold },
  dailyActionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, minWidth: 72, alignItems: "center" },
  dailyActionBuy: { backgroundColor: Colors.gold + "22" },
  dailyActionDisabled: { backgroundColor: Colors.cardBorder },
  dailyActionOwned: { backgroundColor: Colors.emerald + "18" },
  dailyActionBuyText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.gold },
  dailyActionOwnedText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: Colors.emerald },

  // Earn card
  earnCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder, gap: 10 },
  earnTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary, textAlign: "center", marginBottom: 4 },
  earnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  earnBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  earnBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  earnText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
});
