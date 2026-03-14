import React, { useState, useRef, useEffect, memo, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, Animated, Dimensions, Modal, Easing,
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
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = (SW - 48) / 2;

// ── Sound helper (Web Audio API + Haptics) ────────────────────────────────────
function playShopSound(type: "open" | "click" | "unlock" | "error" | "sparkle" | "select") {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const ACtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (ACtx) {
        const ctx = new ACtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        const t = ctx.currentTime;
        if (type === "open") {
          osc.type = "sine"; osc.frequency.setValueAtTime(440, t);
          osc.frequency.linearRampToValueAtTime(880, t + 0.15);
          gain.gain.setValueAtTime(0.12, t); gain.gain.linearRampToValueAtTime(0, t + 0.25);
          osc.start(t); osc.stop(t + 0.25);
        } else if (type === "click" || type === "select") {
          osc.type = "sine"; osc.frequency.setValueAtTime(660, t);
          gain.gain.setValueAtTime(0.07, t); gain.gain.linearRampToValueAtTime(0, t + 0.08);
          osc.start(t); osc.stop(t + 0.08);
        } else if (type === "unlock") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(523, t);
          osc.frequency.setValueAtTime(659, t + 0.08);
          osc.frequency.setValueAtTime(784, t + 0.18);
          osc.frequency.setValueAtTime(1047, t + 0.28);
          gain.gain.setValueAtTime(0.18, t); gain.gain.linearRampToValueAtTime(0, t + 0.45);
          osc.start(t); osc.stop(t + 0.45);
        } else if (type === "error") {
          osc.type = "sawtooth"; osc.frequency.setValueAtTime(220, t);
          osc.frequency.linearRampToValueAtTime(160, t + 0.18);
          gain.gain.setValueAtTime(0.09, t); gain.gain.linearRampToValueAtTime(0, t + 0.18);
          osc.start(t); osc.stop(t + 0.18);
        } else if (type === "sparkle") {
          osc.type = "sine"; osc.frequency.setValueAtTime(1200, t);
          osc.frequency.linearRampToValueAtTime(1600, t + 0.12);
          gain.gain.setValueAtTime(0.07, t); gain.gain.linearRampToValueAtTime(0, t + 0.18);
          osc.start(t); osc.stop(t + 0.18);
        }
      }
    } catch (_) { /* ignore */ }
  }
  switch (type) {
    case "open":    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
    case "click":   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  break;
    case "select":  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
    case "unlock":  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
    case "error":   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   break;
    case "sparkle": Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  break;
  }
}

// ── Daily shop helpers ──────────────────────────────────────────────────────
interface DailyItem {
  id: string; type: "skin" | "background" | "emote" | "effect";
  emoji: string; nameAr: string;
  originalPrice: number; discountedPrice: number;
  rarity: Rarity; color: string;
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
    if (av.length > 0) { const s = av[Math.floor(Math.random() * av.length)]; return { type: "skin", id: s.id, emoji: s.emoji, nameAr: s.nameAr }; }
    return { type: "coins", coins: 150, emoji: "🪙", nameAr: "150 عملة" };
  }
  if (r < 0.80) {
    const av = BACKGROUNDS.filter(b => b.price > 0 && !profile.ownedBackgrounds.includes(b.id));
    if (av.length > 0) { const b = av[Math.floor(Math.random() * av.length)]; return { type: "background", id: b.id, emoji: b.emoji, nameAr: b.nameAr }; }
    return { type: "coins", coins: 100, emoji: "🪙", nameAr: "100 عملة" };
  }
  if (r < 0.92) {
    const av = EMOTES.filter(e => e.price > 0 && !profile.ownedEmotes.includes(e.id));
    if (av.length > 0) { const e = av[Math.floor(Math.random() * av.length)]; return { type: "emote", id: e.id, emoji: e.emoji, nameAr: e.nameAr }; }
    return { type: "coins", coins: 60, emoji: "🪙", nameAr: "60 عملة" };
  }
  const av = EFFECTS.filter(e => e.price > 0 && !profile.ownedEffects.includes(e.id));
  if (av.length > 0) { const e = av[Math.floor(Math.random() * av.length)]; return { type: "effect", id: e.id, emoji: e.emoji, nameAr: e.nameAr }; }
  return { type: "coins", coins: 80, emoji: "🪙", nameAr: "80 عملة" };
}

function getTimeUntilMidnight(): string {
  const now = new Date(); const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000); const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}س ${m}د`;
}

function rarityCardStyle(rarity: Rarity) {
  const color = RARITY_COLORS[rarity];
  return {
    borderColor: color,
    ...(rarity === "legendary"
      ? { shadowColor: color, shadowOpacity: 0.65, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10 }
      : rarity === "epic"
      ? { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 }
      : rarity === "rare"
      ? { shadowColor: color, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 }
      : {}),
  };
}

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

// ── Floating particles background ─────────────────────────────────────────────
const PARTICLE_SYMBOLS = ["⭐", "✨", "🪙", "💫", "⭐", "✨", "🪙"];
const PARTICLES_COUNT = 14;

const ShopParticles = memo(() => {
  const particles = useRef(
    Array.from({ length: PARTICLES_COUNT }, (_, i) => ({
      x: Math.random() * (SW - 30),
      symbol: PARTICLE_SYMBOLS[i % PARTICLE_SYMBOLS.length],
      size: 10 + Math.random() * 10,
      opacity: 0.12 + Math.random() * 0.18,
      duration: 4000 + Math.random() * 5000,
      delay: Math.random() * 4000,
      anim: new Animated.Value(Math.random()),
    }))
  ).current;

  useEffect(() => {
    particles.forEach(p => {
      const loop = () => {
        p.anim.setValue(1);
        Animated.timing(p.anim, {
          toValue: 0,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => loop());
      };
      loop();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            fontSize: p.size,
            opacity: p.opacity,
            transform: [
              {
                translateY: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-40, SH + 20],
                }),
              },
            ],
          }}
        >
          {p.symbol}
        </Animated.Text>
      ))}
    </View>
  );
});

// ── Animated press card wrapper ──────────────────────────────────────────────
interface AnimatedCardProps {
  children: React.ReactNode;
  style?: any;
  onPress: () => void;
  disabled?: boolean;
}

const AnimatedCard = memo(({ children, style, onPress, disabled }: AnimatedCardProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 1.055, tension: 400, friction: 12, useNativeDriver: true }).start();
    playShopSound("click");
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, tension: 400, friction: 12, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        activeOpacity={1}
        disabled={disabled}
        style={{ flex: 1 }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Avatar Preview Modal ───────────────────────────────────────────────────────
interface PreviewSkin {
  id: SkinId; emoji: string; nameAr: string; descAr?: string;
  rarity: Rarity; color: string; price: number;
  unlockCondition?: { type: string; value: number; label: string };
}

interface AvatarPreviewModalProps {
  skin: PreviewSkin | null;
  owned: boolean; equipped: boolean; canAfford: boolean;
  profile: ReturnType<typeof usePlayer>["profile"];
  onClose: () => void;
  onAction: () => void;
}

const AvatarPreviewModal = memo(({ skin, owned, equipped, canAfford, profile, onClose, onAction }: AvatarPreviewModalProps) => {
  const { theme } = useTheme();
  const breathAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!skin) return;
    playShopSound("sparkle");
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 200, friction: 14, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0.93, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: false }),
      ])
    ).start();
  }, [skin?.id]);

  if (!skin) return null;

  const rarityColor = RARITY_COLORS[skin.rarity];
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] });

  const unlockCond = skin.unlockCondition;
  const unlockCurrent = !unlockCond ? 0 :
    unlockCond.type === "wins"  ? profile.wins :
    unlockCond.type === "level" ? profile.level : profile.bestStreak;
  const unlockMet = unlockCond ? unlockCurrent >= unlockCond.value : false;

  let actionLabel = "";
  let actionColor = Colors.gold;
  let actionBg = Colors.gold + "22";
  if (owned) { actionLabel = equipped ? "✓ مُجهَّز" : "تجهيز الآن"; actionColor = equipped ? Colors.emerald : "#60A5FA"; actionBg = equipped ? Colors.emerald + "22" : "#60A5FA22"; }
  else if (unlockCond) { actionLabel = unlockMet ? "🔓 افتح الآن" : `${unlockCurrent}/${unlockCond.value}`; actionColor = unlockMet ? "#A78BFA" : Colors.textMuted; actionBg = unlockMet ? "#A78BFA22" : Colors.cardBorder; }
  else { actionLabel = canAfford ? `شراء · ${skin.price} ⭐` : `غير كافٍ · ${skin.price} ⭐`; actionColor = canAfford ? Colors.gold : Colors.textMuted; actionBg = canAfford ? Colors.gold + "22" : Colors.cardBorder; }

  return (
    <Modal visible={!!skin} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[pm.overlay, { opacity: fadeAnim, backgroundColor: theme.overlay }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[pm.card, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={[skin.color + "30", theme.backgroundSecondary, theme.background]} style={[pm.cardGrad, { borderColor: theme.cardBorder }]}>
            {/* Close button */}
            <TouchableOpacity style={pm.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Rarity label */}
            <View style={[pm.rarityBadge, { backgroundColor: rarityColor + "28", borderColor: rarityColor + "60" }]}>
              <Text style={[pm.rarityText, { color: rarityColor }]}>{RARITY_LABELS[skin.rarity]}</Text>
            </View>

            {/* Glow behind avatar */}
            <Animated.View style={[pm.glowCircle, { backgroundColor: rarityColor, opacity: glowOpacity, shadowColor: rarityColor }]} />

            {/* Breathing avatar */}
            <Animated.View style={[pm.avatarCircle, { backgroundColor: skin.color + "30", borderColor: rarityColor + "80", transform: [{ scale: breathAnim }] }]}>
              <Text style={pm.avatarEmoji}>{skin.emoji}</Text>
            </Animated.View>

            <Text style={[pm.skinName, { color: theme.textPrimary }]}>{skin.nameAr}</Text>
            {skin.descAr && <Text style={[pm.skinDesc, { color: theme.textSecondary }]}>{skin.descAr}</Text>}

            {/* Price row (if not owned) */}
            {!owned && skin.price > 0 && (
              <View style={pm.priceRow}>
                <Ionicons name="star" size={14} color={Colors.gold} />
                <Text style={pm.priceText}>{skin.price}</Text>
                <Text style={[pm.balanceText, { color: profile.coins >= skin.price ? Colors.emerald : Colors.ruby }]}>
                  (رصيدك: {profile.coins})
                </Text>
              </View>
            )}

            {/* Action button */}
            <TouchableOpacity
              style={[pm.actionBtn, { backgroundColor: actionBg, borderColor: actionColor + "60" }]}
              onPress={() => { onAction(); }}
              activeOpacity={0.85}
            >
              <Text style={[pm.actionBtnText, { color: actionColor }]}>{actionLabel}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

// ── Unlock burst overlay (flying coins + sparkles) ────────────────────────────
interface UnlockBurstProps {
  visible: boolean;
  emoji: string;
  onDone: () => void;
}

const UnlockBurstOverlay = memo(({ visible, emoji, onDone }: UnlockBurstProps) => {
  const NUM_COINS = 12;
  const NUM_SPARKS = 8;
  const centerX = SW / 2;
  const centerY = SH / 2;

  const coins = useRef(Array.from({ length: NUM_COINS }, (_, i) => {
    const angle = (i / NUM_COINS) * Math.PI * 2 - Math.PI / 2;
    const dist = 80 + Math.random() * 80;
    return {
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      targetX: Math.cos(angle) * dist,
      targetY: Math.sin(angle) * dist - 60,
    };
  })).current;

  const sparks = useRef(Array.from({ length: NUM_SPARKS }, (_, i) => {
    const angle = (i / NUM_SPARKS) * Math.PI * 2;
    const dist = 50 + Math.random() * 60;
    return {
      tx: new Animated.Value(0), ty: new Animated.Value(0),
      opacity: new Animated.Value(0),
      targetX: Math.cos(angle) * dist,
      targetY: Math.sin(angle) * dist,
    };
  })).current;

  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    playShopSound("unlock");

    overlayOpacity.setValue(1);
    burstScale.setValue(0);
    burstOpacity.setValue(0);
    coins.forEach(c => { c.tx.setValue(0); c.ty.setValue(0); c.opacity.setValue(0); c.scale.setValue(0); });
    sparks.forEach(sp => { sp.tx.setValue(0); sp.ty.setValue(0); sp.opacity.setValue(0); });

    Animated.parallel([
      Animated.spring(burstScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.timing(burstOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      ...coins.map(c =>
        Animated.parallel([
          Animated.spring(c.scale, { toValue: 1, tension: 400, friction: 8, useNativeDriver: true }),
          Animated.timing(c.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.spring(c.tx, { toValue: c.targetX, tension: 120, friction: 10, useNativeDriver: true }),
          Animated.spring(c.ty, { toValue: c.targetY, tension: 120, friction: 10, useNativeDriver: true }),
        ])
      ),
      ...sparks.map(sp =>
        Animated.parallel([
          Animated.timing(sp.opacity, { toValue: 0.9, duration: 120, useNativeDriver: true }),
          Animated.spring(sp.tx, { toValue: sp.targetX, tension: 150, friction: 9, useNativeDriver: true }),
          Animated.spring(sp.ty, { toValue: sp.targetY, tension: 150, friction: 9, useNativeDriver: true }),
        ])
      ),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(burstOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ...coins.map(c =>
          Animated.parallel([
            Animated.timing(c.opacity, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
            Animated.timing(c.ty, { toValue: c.targetY - 80, duration: 600, useNativeDriver: true }),
          ])
        ),
        ...sparks.map(sp =>
          Animated.timing(sp.opacity, { toValue: 0, duration: 400, useNativeDriver: true })
        ),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }),
      ]).start(() => onDone());
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity, zIndex: 999 }]}
      pointerEvents="none"
    >
      {/* Radial glow */}
      <Animated.View style={[ub.glowBurst, {
        left: centerX - 100, top: centerY - 100,
        transform: [{ scale: burstScale }], opacity: burstOpacity,
      }]} />

      {/* Flying coins */}
      {coins.map((c, i) => (
        <Animated.Text key={i} style={[ub.coin, {
          left: centerX - 14, top: centerY - 14,
          opacity: c.opacity,
          transform: [{ translateX: c.tx }, { translateY: c.ty }, { scale: c.scale }],
        }]}>🪙</Animated.Text>
      ))}

      {/* Sparkles */}
      {sparks.map((sp, i) => (
        <Animated.Text key={i} style={[ub.spark, {
          left: centerX - 10, top: centerY - 10,
          opacity: sp.opacity,
          transform: [{ translateX: sp.tx }, { translateY: sp.ty }],
        }]}>✨</Animated.Text>
      ))}

      {/* Center emoji burst */}
      <Animated.Text style={[ub.centerEmoji, {
        left: centerX - 36, top: centerY - 50,
        transform: [{ scale: burstScale }], opacity: burstOpacity,
      }]}>{emoji}</Animated.Text>
    </Animated.View>
  );
});

// ── Main component ────────────────────────────────────────────────────────────
export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { profile, purchaseSkin, equipSkin, purchaseBackground, equipBackground,
    purchaseEmote, purchaseEffect, equipEffect, grantItem, buyDailyItem, addCoins } = usePlayer();
  const { theme } = useTheme();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<TabId>("outfits");
  const [skinFilter, setSkinFilter] = useState<SkinFilter>("الكل");
  const [boxState, setBoxState] = useState<"idle" | "opening" | "revealed">("idle");
  const [boxResult, setBoxResult] = useState<MysteryBoxPrize | null>(null);
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  // Preview modal state
  const [previewSkin, setPreviewSkin] = useState<PreviewSkin | null>(null);

  // Unlock burst state
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstEmoji, setBurstEmoji] = useState("🎉");

  // Mystery box animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const boxScaleAnim = useRef(new Animated.Value(1)).current;
  const boxOpacityAnim = useRef(new Animated.Value(1)).current;
  const prizeScaleAnim = useRef(new Animated.Value(0)).current;
  const prizeOpacityAnim = useRef(new Animated.Value(0)).current;

  // Tab switch animation
  const tabContentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Play "open shop" sound on mount
  useEffect(() => { playShopSound("open"); }, []);

  const switchTab = (tabId: TabId) => {
    Animated.sequence([
      Animated.timing(tabContentOpacity, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(tabContentOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setActiveTab(tabId);
    if (tabId !== "mystery") resetBox();
    playShopSound("click");
  };

  const today = new Date().toDateString();
  const todayBought = profile.dailyShopDate === today ? profile.dailyShopBought : [];
  const dailyItems = getDailyItems();

  // ── Mystery Box ──────────────────────────────────────────────────────────
  const handleOpenBox = () => {
    if (profile.coins < MYSTERY_BOX_PRICE) {
      playShopSound("error");
      Alert.alert("نقود غير كافية", `تحتاج ${MYSTERY_BOX_PRICE} نقود لفتح الصندوق`);
      return;
    }
    playShopSound("select");
    addCoins(-MYSTERY_BOX_PRICE);
    setBoxState("opening");
    shakeAnim.setValue(0); boxScaleAnim.setValue(1); boxOpacityAnim.setValue(1);
    prizeScaleAnim.setValue(0); prizeOpacityAnim.setValue(0);

    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 14,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
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
      setBurstEmoji(prize.emoji || "🎉");
      setBurstVisible(true);
      Animated.parallel([
        Animated.spring(prizeScaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }),
        Animated.timing(prizeOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const resetBox = () => {
    setBoxState("idle"); setBoxResult(null);
    shakeAnim.setValue(0); boxScaleAnim.setValue(1); boxOpacityAnim.setValue(1);
    prizeScaleAnim.setValue(0); prizeOpacityAnim.setValue(0);
  };

  // ── Skin action (tap = preview modal) ────────────────────────────────────
  const handleSkinAction = (skinId: SkinId) => {
    const skin = SKINS.find(s => s.id === skinId)!;
    setPreviewSkin(skin as PreviewSkin);
  };

  const executeSkinAction = useCallback(() => {
    if (!previewSkin) return;
    const skinId = previewSkin.id;
    const skin = SKINS.find(s => s.id === skinId)!;

    if (profile.ownedSkins.includes(skinId)) {
      equipSkin(skinId);
      playShopSound("select");
      setPreviewSkin(null);
      return;
    }
    if (skin.unlockCondition) {
      const { type, value, label } = skin.unlockCondition;
      const current = type === "wins" ? profile.wins : type === "level" ? profile.level : profile.bestStreak;
      if (current < value) { playShopSound("error"); Alert.alert("غير مفتوح بعد", `${label} (${current}/${value})`); return; }
      purchaseSkin(skinId);
      setPreviewSkin(null);
      setBurstEmoji(skin.emoji);
      setBurstVisible(true);
      return;
    }
    if (profile.coins < skin.price) { playShopSound("error"); Alert.alert("نقود غير كافية", `تحتاج ${skin.price} نقود`); return; }
    Alert.alert("شراء الزي", `هل تريد شراء "${skin.nameAr}" مقابل ${skin.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "شراء", onPress: () => {
          purchaseSkin(skinId);
          setPreviewSkin(null);
          setBurstEmoji(skin.emoji);
          setBurstVisible(true);
        }
      },
    ]);
  }, [previewSkin, profile]);

  // ── Background action ─────────────────────────────────────────────────────
  const handleBgAction = (id: BackgroundId) => {
    const bg = BACKGROUNDS.find(b => b.id === id)!;
    if (profile.ownedBackgrounds.includes(id)) { equipBackground(id); playShopSound("select"); return; }
    if (profile.coins < bg.price) { playShopSound("error"); Alert.alert("نقود غير كافية", `تحتاج ${bg.price} نقود`); return; }
    Alert.alert("شراء الخلفية", `هل تريد شراء "${bg.nameAr}" مقابل ${bg.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseBackground(id); setBurstEmoji(bg.emoji); setBurstVisible(true); } },
    ]);
  };

  const handleEmoteAction = (id: EmoteId) => {
    const emote = EMOTES.find(e => e.id === id)!;
    if (profile.ownedEmotes.includes(id)) { playShopSound("select"); return; }
    if (profile.coins < emote.price) { playShopSound("error"); Alert.alert("نقود غير كافية", `تحتاج ${emote.price} نقود`); return; }
    Alert.alert("شراء التفاعل", `هل تريد شراء "${emote.nameAr}" مقابل ${emote.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseEmote(id); setBurstEmoji(emote.emoji); setBurstVisible(true); } },
    ]);
  };

  const handleEffectAction = (id: EffectId) => {
    const effect = EFFECTS.find(e => e.id === id)!;
    if (profile.ownedEffects.includes(id)) { equipEffect(id); playShopSound("select"); return; }
    if (profile.coins < effect.price) { playShopSound("error"); Alert.alert("نقود غير كافية", `تحتاج ${effect.price} نقود`); return; }
    Alert.alert("شراء التأثير", `هل تريد شراء "${effect.nameAr}" مقابل ${effect.price} نقود؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseEffect(id); setBurstEmoji(effect.emoji); setBurstVisible(true); } },
    ]);
  };

  const handleDailyBuy = (item: DailyItem) => {
    const success = buyDailyItem(item.id, item.type, item.discountedPrice);
    if (success) { setBurstEmoji(item.emoji); setBurstVisible(true); }
    else { playShopSound("error"); Alert.alert("خطأ", "لم يتم الشراء. تأكد من رصيدك."); }
  };

  const isItemOwned = (item: DailyItem): boolean => {
    if (item.type === "skin")       return profile.ownedSkins.includes(item.id as SkinId);
    if (item.type === "background") return profile.ownedBackgrounds.includes(item.id as BackgroundId);
    if (item.type === "emote")      return profile.ownedEmotes.includes(item.id as EmoteId);
    if (item.type === "effect")     return profile.ownedEffects.includes(item.id as EffectId);
    return false;
  };

  // ── Render: Outfits ──────────────────────────────────────────────────────
  const renderOutfits = () => {
    const filtered = SKINS.filter(sk => {
      if (skinFilter === "الكل") return true;
      if (skinFilter === "مغربية") return sk.category === "moroccan";
      if (skinFilter === "عالمية") return sk.category === "global";
      return sk.category === "exclusive";
    });

    return (
      <>
        {/* Current outfit preview */}
        {(() => {
          const cur = SKINS.find(sk => sk.id === profile.equippedSkin) || SKINS[0];
          return (
            <TouchableOpacity
              style={[s.currentBar, { borderColor: RARITY_COLORS[cur.rarity] + "55", backgroundColor: theme.card }]}
              onPress={() => handleSkinAction(cur.id)}
              activeOpacity={0.88}
            >
              <LinearGradient colors={[cur.color + "30", "transparent"]} style={StyleSheet.absoluteFillObject} />
              <View style={[s.currentCircle, { backgroundColor: cur.color + "40", borderColor: RARITY_COLORS[cur.rarity] + "60" }]}>
                <Text style={s.currentEmoji}>{cur.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.currentLabel, { color: theme.textMuted }]}>زيّك الحالي</Text>
                <Text style={[s.currentName, { color: RARITY_COLORS[cur.rarity] }]}>{cur.nameAr}</Text>
                <Text style={[s.currentRarity, { color: theme.textMuted }]}>{RARITY_LABELS[cur.rarity]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })()}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterBarContent}>
          {SKIN_FILTERS.map(f => (
            <TouchableOpacity key={f} onPress={() => { setSkinFilter(f); playShopSound("click"); }}
              style={[s.filterChip, { backgroundColor: theme.card, borderColor: theme.cardBorder }, skinFilter === f && s.filterChipActive]}>
              <Text style={[s.filterChipText, { color: theme.textMuted }, skinFilter === f && s.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cards grid */}
        <View style={s.grid}>
          {filtered.map(skin => {
            const owned = profile.ownedSkins.includes(skin.id);
            const equipped = profile.equippedSkin === skin.id;
            const canAfford = profile.coins >= skin.price;
            const locked = !owned && !canAfford && !skin.unlockCondition && skin.price > 0;
            const unlockCond = skin.unlockCondition;
            const unlockCurrent = !unlockCond ? 0 :
              unlockCond.type === "wins" ? profile.wins :
              unlockCond.type === "level" ? profile.level : profile.bestStreak;

            return (
              <AnimatedCard
                key={skin.id}
                style={{ width: CARD_W }}
                onPress={() => handleSkinAction(skin.id)}
              >
                <View style={[s.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }, rarityCardStyle(skin.rarity), equipped && s.itemCardEquipped, locked && s.itemCardLocked]}>
                  {/* Rarity glow top strip */}
                  <LinearGradient
                    colors={[RARITY_COLORS[skin.rarity] + "30", "transparent"]}
                    style={s.rarityGlowTop}
                  />

                  {/* Rarity badge */}
                  <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[skin.rarity] + "28" }]}>
                    <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[skin.rarity] }]}>{RARITY_LABELS[skin.rarity]}</Text>
                  </View>

                  {/* Status icon top-right */}
                  {equipped && (
                    <View style={s.statusDot}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.emerald} />
                    </View>
                  )}
                  {locked && !unlockCond && (
                    <View style={s.statusDot}>
                      <Ionicons name="lock-closed" size={16} color={theme.textMuted} />
                    </View>
                  )}
                  {unlockCond && !owned && (
                    <View style={s.statusDot}>
                      <Ionicons name="trophy" size={15} color="#A78BFA" />
                    </View>
                  )}

                  {/* Emoji */}
                  <View style={[s.itemEmojiCircle, { backgroundColor: skin.color + "28" }]}>
                    <Text style={[s.itemEmoji, locked && { opacity: 0.55 }]}>{skin.emoji}</Text>
                    {locked && (
                      <View style={s.lockOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#fff" />
                      </View>
                    )}
                  </View>

                  <Text style={[s.itemName, { color: theme.textPrimary }, locked && { color: theme.textMuted }]}>{skin.nameAr}</Text>
                  {skin.descAr && <Text style={[s.itemDesc, { color: theme.textMuted }]} numberOfLines={2}>{skin.descAr}</Text>}

                  {/* Action button */}
                  {owned ? (
                    <View style={[s.actionBtn, equipped ? s.actionEquipped : s.actionEquip]}>
                      <Text style={[s.actionBtnText, { color: equipped ? Colors.emerald : "#60A5FA" }]}>
                        {equipped ? "✓ مُجهَّز" : "تجهيز"}
                      </Text>
                    </View>
                  ) : unlockCond ? (
                    <View style={[s.actionBtn, { backgroundColor: "#A78BFA18" }]}>
                      <Text style={[s.actionBtnText, { color: "#A78BFA" }]} numberOfLines={1}>
                        {unlockCurrent}/{unlockCond.value}
                      </Text>
                    </View>
                  ) : (
                    <View style={[s.actionBtn, canAfford ? s.actionBuy : s.actionCantBuy]}>
                      <Ionicons name="star" size={11} color={canAfford ? Colors.gold : theme.textMuted} />
                      <Text style={[s.actionBtnText, { color: canAfford ? Colors.gold : theme.textMuted }]}>{skin.price}</Text>
                    </View>
                  )}
                </View>
              </AnimatedCard>
            );
          })}
        </View>
      </>
    );
  };

  // ── Render: Backgrounds ──────────────────────────────────────────────────
  const renderBackgrounds = () => (
    <View style={s.grid}>
      {BACKGROUNDS.map(bg => {
        const owned = profile.ownedBackgrounds.includes(bg.id);
        const equipped = profile.equippedBackground === bg.id;
        const canAfford = profile.coins >= bg.price;
        return (
          <AnimatedCard key={bg.id} style={{ width: CARD_W }} onPress={() => handleBgAction(bg.id)}>
            <View style={[s.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }, rarityCardStyle(bg.rarity), equipped && s.itemCardEquipped]}>
              <LinearGradient colors={[RARITY_COLORS[bg.rarity] + "30", "transparent"]} style={s.rarityGlowTop} />
              <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[bg.rarity] + "28" }]}>
                <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[bg.rarity] }]}>{RARITY_LABELS[bg.rarity]}</Text>
              </View>
              {equipped && <View style={s.statusDot}><Ionicons name="checkmark-circle" size={18} color={Colors.emerald} /></View>}
              <LinearGradient colors={[bg.color, bg.color + "88", theme.background]} style={s.bgPreview}>
                <Text style={s.bgPreviewEmoji}>{bg.emoji}</Text>
              </LinearGradient>
              <Text style={[s.itemName, { color: theme.textPrimary }]}>{bg.nameAr}</Text>
              {owned ? (
                <View style={[s.actionBtn, equipped ? s.actionEquipped : s.actionEquip]}>
                  <Text style={[s.actionBtnText, { color: equipped ? Colors.emerald : "#60A5FA" }]}>{equipped ? "✓ مُجهَّز" : "تجهيز"}</Text>
                </View>
              ) : (
                <View style={[s.actionBtn, canAfford ? s.actionBuy : s.actionCantBuy]}>
                  <Ionicons name="star" size={11} color={canAfford ? Colors.gold : theme.textMuted} />
                  <Text style={[s.actionBtnText, { color: canAfford ? Colors.gold : theme.textMuted }]}>{bg.price}</Text>
                </View>
              )}
            </View>
          </AnimatedCard>
        );
      })}
    </View>
  );

  // ── Render: Emotes ────────────────────────────────────────────────────────
  const renderEmotes = () => (
    <>
      <Text style={[s.sectionHint, { color: theme.textMuted }]}>أرسل تفاعلات لخصمك أثناء المباراة</Text>
      <View style={s.emotesGrid}>
        {EMOTES.map(emote => {
          const owned = profile.ownedEmotes.includes(emote.id);
          const canAfford = profile.coins >= emote.price;
          return (
            <AnimatedCard key={emote.id} style={undefined} onPress={() => handleEmoteAction(emote.id)}>
              <View style={[s.emoteCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }, owned && s.emoteCardOwned]}>
                <Text style={s.emoteEmoji}>{emote.emoji}</Text>
                <Text style={[s.emoteName, { color: theme.textPrimary }]}>{emote.nameAr}</Text>
                {owned ? (
                  <View style={s.emoteOwnedBadge}><Text style={s.emoteOwnedText}>✓</Text></View>
                ) : (
                  <View style={[s.emotePrice, { backgroundColor: canAfford ? Colors.gold + "22" : theme.card }]}>
                    <Ionicons name="star" size={10} color={canAfford ? Colors.gold : theme.textMuted} />
                    <Text style={[s.emotePriceText, { color: canAfford ? Colors.gold : theme.textMuted }]}>{emote.price}</Text>
                  </View>
                )}
              </View>
            </AnimatedCard>
          );
        })}
      </View>
    </>
  );

  // ── Render: Effects ───────────────────────────────────────────────────────
  const renderEffects = () => (
    <>
      <Text style={[s.sectionHint, { color: theme.textMuted }]}>تأثيرات بصرية رائعة عند الفوز بمباراة</Text>
      <View style={s.grid}>
        {EFFECTS.map(effect => {
          const owned = profile.ownedEffects.includes(effect.id);
          const equipped = profile.equippedEffect === effect.id;
          const canAfford = profile.coins >= effect.price;
          return (
            <AnimatedCard key={effect.id} style={{ width: CARD_W }} onPress={() => handleEffectAction(effect.id)}>
              <View style={[s.itemCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }, effect.price > 0 ? rarityCardStyle(effect.rarity) : {}, equipped && s.itemCardEquipped]}>
                {effect.price > 0 && <LinearGradient colors={[RARITY_COLORS[effect.rarity] + "30", "transparent"]} style={s.rarityGlowTop} />}
                {effect.price > 0 && (
                  <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[effect.rarity] + "28" }]}>
                    <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[effect.rarity] }]}>{RARITY_LABELS[effect.rarity]}</Text>
                  </View>
                )}
                {equipped && <View style={s.statusDot}><Ionicons name="checkmark-circle" size={18} color={Colors.emerald} /></View>}
                <View style={[s.itemEmojiCircle, { backgroundColor: effect.color + "22" }]}>
                  <Text style={s.itemEmoji}>{effect.emoji}</Text>
                </View>
                <Text style={[s.itemName, { color: theme.textPrimary }]}>{effect.nameAr}</Text>
                {effect.descAr && <Text style={[s.itemDesc, { color: theme.textMuted }]} numberOfLines={2}>{effect.descAr}</Text>}
                {owned ? (
                  <View style={[s.actionBtn, equipped ? s.actionEquipped : s.actionEquip]}>
                    <Text style={[s.actionBtnText, { color: equipped ? Colors.emerald : "#60A5FA" }]}>{equipped ? "✓ مُجهَّز" : "تجهيز"}</Text>
                  </View>
                ) : effect.price === 0 ? (
                  <View style={[s.actionBtn, s.actionEquip]}><Text style={[s.actionBtnText, { color: "#60A5FA" }]}>تجهيز</Text></View>
                ) : (
                  <View style={[s.actionBtn, canAfford ? s.actionBuy : s.actionCantBuy]}>
                    <Ionicons name="star" size={11} color={canAfford ? Colors.gold : theme.textMuted} />
                    <Text style={[s.actionBtnText, { color: canAfford ? Colors.gold : theme.textMuted }]}>{effect.price}</Text>
                  </View>
                )}
              </View>
            </AnimatedCard>
          );
        })}
      </View>
    </>
  );

  // ── Render: Mystery Box ──────────────────────────────────────────────────
  const renderMysteryBox = () => {
    const canAfford = profile.coins >= MYSTERY_BOX_PRICE;
    return (
      <View style={s.boxContainer}>
        {boxState !== "revealed" ? (
          <>
            <Text style={[s.boxTitle, { color: theme.textPrimary }]}>صندوق الغموض</Text>
            <Text style={[s.boxSubtitle, { color: theme.textMuted }]}>افتح الصندوق للحصول على جائزة عشوائية!</Text>
            <Animated.View style={[s.boxWrapper, {
              transform: [{ translateX: shakeAnim }, { scale: boxScaleAnim }],
              opacity: boxOpacityAnim,
            }]}>
              <LinearGradient colors={["#2D1B69", "#1A1035"]} style={s.boxCard}>
                <Text style={s.boxEmoji}>📦</Text>
                <View style={s.boxQuestionMarks}>
                  {["❓", "✨", "❓"].map((q, i) => <Text key={i} style={s.boxQuestion}>{q}</Text>)}
                </View>
              </LinearGradient>
            </Animated.View>
            <View style={s.boxPoolRow}>
              {[{ emoji: "🥷", label: "أزياء" }, { emoji: "🖼️", label: "خلفيات" }, { emoji: "😂", label: "تفاعلات" }, { emoji: "✨", label: "تأثيرات" }, { emoji: "🪙", label: "نقود" }]
                .map((item, i) => (
                  <View key={i} style={s.boxPoolItem}>
                    <Text style={s.boxPoolEmoji}>{item.emoji}</Text>
                    <Text style={[s.boxPoolLabel, { color: theme.textMuted }]}>{item.label}</Text>
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
                colors={canAfford ? ["#7C3AED", "#4C1D95"] : [theme.card, theme.card]}
                style={s.openBoxBtnGrad}
              >
                <Ionicons name="star" size={14} color={canAfford ? Colors.gold : theme.textMuted} />
                <Text style={[s.openBoxBtnText, !canAfford && { color: theme.textMuted }]}>
                  {boxState === "opening" ? "جاري الفتح..." : `فتح الصندوق · ${MYSTERY_BOX_PRICE}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            {!canAfford && <Text style={[s.cantAffordHint, { color: theme.textMuted }]}>تحتاج المزيد من النقود للفتح</Text>}
          </>
        ) : (
          <Animated.View style={[s.prizeReveal, { transform: [{ scale: prizeScaleAnim }], opacity: prizeOpacityAnim }]}>
            <Text style={[s.prizeCongrats, { color: theme.textPrimary }]}>مبروك! 🎉</Text>
            <LinearGradient colors={["#1A2E43", "#0D1B2A"]} style={s.prizeCard}>
              <Text style={s.prizeEmoji}>{boxResult?.emoji}</Text>
              <Text style={[s.prizeName, { color: theme.textPrimary }]}>{boxResult?.nameAr}</Text>
              <Text style={[s.prizeTypeLabel, { color: theme.textMuted }]}>
                {boxResult?.type === "coins" ? "🪙 عملات مضافة لرصيدك" :
                 boxResult?.type === "skin"       ? "👕 زي جديد في مجموعتك" :
                 boxResult?.type === "background" ? "🖼️ خلفية جديدة مفتوحة" :
                 boxResult?.type === "emote"      ? "😂 تفاعل جديد مفتوح" : "✨ تأثير جديد مفتوح"}
              </Text>
            </LinearGradient>
            <TouchableOpacity style={[s.openAgainBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={resetBox} activeOpacity={0.85}>
              <Text style={[s.openAgainText, { color: theme.textPrimary }]}>فتح مرة أخرى</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    );
  };

  // ── Render: Daily Shop ────────────────────────────────────────────────────
  const renderDailyShop = () => (
    <>
      <LinearGradient colors={["#1A2E43", "#0D1B2A"]} style={[s.dailyHeader, { borderColor: theme.cardBorder }]}>
        <View>
          <Text style={[s.dailyTitle, { color: theme.textPrimary }]}>عروض اليوم 🏷️</Text>
          <Text style={[s.dailySubtitle, { color: theme.textMuted }]}>تتجدد كل يوم · خصم 30%</Text>
        </View>
        <View style={s.dailyTimer}>
          <Ionicons name="time-outline" size={14} color={Colors.gold} />
          <Text style={s.dailyTimerText}>{timeLeft}</Text>
        </View>
      </LinearGradient>
      {dailyItems.map((item, idx) => {
        const owned = isItemOwned(item);
        const boughtToday = todayBought.includes(item.id);
        const canAfford = profile.coins >= item.discountedPrice;
        const discount = Math.round((1 - item.discountedPrice / item.originalPrice) * 100);
        return (
          <View key={idx} style={[s.dailyCard, rarityCardStyle(item.rarity)]}>
            <LinearGradient colors={[item.color + "18", "transparent"]} style={StyleSheet.absoluteFillObject} />
            <View style={s.discountBadge}><Text style={s.discountBadgeText}>-{discount}%</Text></View>
            <View style={s.dailyCardContent}>
              <View style={[s.dailyItemCircle, { backgroundColor: item.color + "22" }]}>
                <Text style={s.dailyItemEmoji}>{item.emoji}</Text>
              </View>
              <View style={s.dailyItemInfo}>
                <View style={s.dailyItemTopRow}>
                  <View style={[s.rarityBadge, { backgroundColor: RARITY_COLORS[item.rarity] + "28", position: "relative", top: 0, left: 0 }]}>
                    <Text style={[s.rarityBadgeText, { color: RARITY_COLORS[item.rarity] }]}>{RARITY_LABELS[item.rarity]}</Text>
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
                  <Text style={[s.dailyActionBuyText, !canAfford && { color: theme.textMuted }]}>
                    {canAfford ? "شراء" : "لا يكفي"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
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

  // ── Preview skin data ─────────────────────────────────────────────────────
  const previewSkinOwned  = previewSkin ? profile.ownedSkins.includes(previewSkin.id) : false;
  const previewSkinEquip  = previewSkin ? profile.equippedSkin === previewSkin.id : false;
  const previewSkinAfford = previewSkin ? profile.coins >= previewSkin.price : false;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: topInset, backgroundColor: theme.background }]}>
      {/* Animated particles background */}
      <ShopParticles />

      {/* Header */}
      <LinearGradient colors={[theme.background, theme.background + "F0"]} style={s.headerGrad}>
        <View style={s.header}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.textPrimary }]}>المتجر</Text>
          <LinearGradient colors={[Colors.gold + "30", Colors.gold + "10"]} style={s.coinsBadge}>
            <Ionicons name="star" size={14} color={Colors.gold} />
            <Text style={s.coinsText}>{profile.coins}</Text>
          </LinearGradient>
        </View>
      </LinearGradient>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabBar, { borderBottomColor: theme.cardBorder }]} contentContainerStyle={s.tabBarContent}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={[s.tab, { backgroundColor: theme.card }, activeTab === tab.id && s.tabActive]}
            onPress={() => switchTab(tab.id)} activeOpacity={0.8}>
            <Text style={s.tabEmoji}>{tab.emoji}</Text>
            <Text style={[s.tabLabel, { color: theme.textMuted }, activeTab === tab.id && s.tabLabelActive]}>{tab.label}</Text>
            {activeTab === tab.id && <View style={s.tabActiveLine} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <Animated.View style={[{ flex: 1 }, { opacity: tabContentOpacity }]}>
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
      </Animated.View>

      {/* Avatar preview modal (outfits only) */}
      <AvatarPreviewModal
        skin={previewSkin}
        owned={previewSkinOwned}
        equipped={previewSkinEquip}
        canAfford={previewSkinAfford}
        profile={profile}
        onClose={() => setPreviewSkin(null)}
        onAction={executeSkinAction}
      />

      {/* Unlock burst overlay */}
      <UnlockBurstOverlay
        visible={burstVisible}
        emoji={burstEmoji}
        onDone={() => setBurstVisible(false)}
      />
    </View>
  );
}

// ── Preview modal styles ──────────────────────────────────────────────────────
const pm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 24,
  },
  card: { width: "100%", maxWidth: 340, borderRadius: 28, overflow: "hidden" },
  cardGrad: { padding: 28, alignItems: "center", borderRadius: 28, borderWidth: 1.5, borderColor: "#FFFFFF18" },
  closeBtn: {
    position: "absolute", top: 14, right: 14, width: 32, height: 32,
    borderRadius: 16, backgroundColor: "#FFFFFF15", justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  rarityBadge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, marginBottom: 18,
    borderWidth: 1,
  },
  rarityText: { fontFamily: "Cairo_700Bold", fontSize: 12 },
  glowCircle: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    top: "30%", alignSelf: "center",
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 40, shadowOpacity: 1, elevation: 0,
  },
  avatarCircle: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, marginBottom: 20, zIndex: 2,
  },
  avatarEmoji: { fontSize: 58 },
  skinName: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.textPrimary, textAlign: "center", marginBottom: 6 },
  skinDesc: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", marginBottom: 16, lineHeight: 20 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  priceText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.gold },
  balanceText: { fontFamily: "Cairo_400Regular", fontSize: 12 },
  actionBtn: {
    width: "100%", paddingVertical: 15, borderRadius: 16,
    alignItems: "center", borderWidth: 1.5, marginTop: 4,
  },
  actionBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16 },
});

// ── Unlock burst styles ────────────────────────────────────────────────────────
const ub = StyleSheet.create({
  glowBurst: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold, shadowRadius: 60, shadowOpacity: 1,
    elevation: 20,
  },
  coin: { position: "absolute", fontSize: 24, zIndex: 10 },
  spark: { position: "absolute", fontSize: 18, zIndex: 10 },
  centerEmoji: { position: "absolute", fontSize: 64, zIndex: 11 },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  headerGrad: { zIndex: 2 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    justifyContent: "space-between",
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary },
  coinsBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 5,
    borderWidth: 1, borderColor: Colors.gold + "44",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },

  // Tab bar
  tabBar: { maxHeight: 68, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: "center", paddingVertical: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    alignItems: "center", flexDirection: "row", gap: 6,
    backgroundColor: Colors.card, position: "relative",
  },
  tabActive: { backgroundColor: Colors.gold + "22", borderWidth: 1, borderColor: Colors.gold + "55" },
  tabActiveLine: {
    position: "absolute", bottom: -2, left: "25%", right: "25%",
    height: 2, borderRadius: 1, backgroundColor: Colors.gold,
  },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  tabLabelActive: { color: Colors.gold },

  scrollContent: { padding: 16 },

  // Current outfit bar
  currentBar: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.card, borderRadius: 18, padding: 14,
    marginBottom: 14, borderWidth: 1.5, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  currentCircle: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center", borderWidth: 2,
  },
  currentEmoji: { fontSize: 30 },
  currentLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted, marginBottom: 1 },
  currentName: { fontFamily: "Cairo_700Bold", fontSize: 15, marginBottom: 1 },
  currentRarity: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },

  // Filter bar
  filterBar: { marginBottom: 14 },
  filterBarContent: { gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  filterChipActive: { backgroundColor: Colors.gold + "22", borderColor: Colors.gold + "55" },
  filterChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.gold },

  // Cards grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  itemCard: {
    backgroundColor: Colors.card, borderRadius: 18, padding: 12,
    alignItems: "center", borderWidth: 2, position: "relative", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  itemCardEquipped: { backgroundColor: Colors.emerald + "0A" },
  itemCardLocked: { opacity: 0.72 },

  rarityGlowTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: 40,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  rarityBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, zIndex: 1 },
  rarityBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 9 },
  statusDot: { position: "absolute", top: 8, right: 8, zIndex: 1 },

  itemEmojiCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginTop: 24, marginBottom: 8, position: "relative" },
  itemEmoji: { fontSize: 34 },
  lockOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 32, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
  },
  itemName: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.textPrimary, textAlign: "center", marginBottom: 3 },
  itemDesc: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted, textAlign: "center", marginBottom: 10, lineHeight: 15 },
  lockedText: { color: Colors.textMuted },

  actionBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 10, gap: 4 },
  actionEquipped: { backgroundColor: Colors.emerald + "18" },
  actionEquip: { backgroundColor: "#60A5FA18" },
  actionBuy: { backgroundColor: Colors.gold + "22" },
  actionCantBuy: { backgroundColor: Colors.cardBorder },
  actionBtnText: { fontFamily: "Cairo_700Bold", fontSize: 12 },

  // Background card
  bgPreview: { width: "100%", height: 70, borderRadius: 10, justifyContent: "center", alignItems: "center", marginTop: 22, marginBottom: 8 },
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
