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
  SKINS, EMOTES, EFFECTS, TITLES,
  RARITY_COLORS, RARITY_LABELS,
  type MysteryBoxPrize, type Rarity,
  type SkinId, type EmoteId, type EffectId, type TitleId,
} from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = (SW - 52) / 2;

// ── Shop Design Tokens (Dark Theme) ──────────────────────────────────────────
const L = {
  bg:         "#0D1B2A",
  card:       "#1E3448",
  cardBorder: "#2A4560",
  shadow:     "#00000060",
  textMain:   "#F0E6D3",
  textSub:    "#A8B8CC",
  purple:     "#7C5CFC",
  purpleLight:"#2D1B69",
  gold:       "#F59E0B",
  goldLight:  "#3A2800",
  cyan:       "#06B6D4",
  green:      "#10B981",
  pink:       "#EC4899",
  tabBg:      "#142233",
  tabActive:  "#7C5CFC",
};

// ── Sound helper ─────────────────────────────────────────────────────────────
function playShopSound(type: "open" | "click" | "unlock" | "error" | "sparkle" | "select") {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const ACtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (ACtx) {
        const ctx = new ACtx();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        const t = ctx.currentTime;
        if (type === "open")    { osc.type = "sine"; osc.frequency.setValueAtTime(440, t); osc.frequency.linearRampToValueAtTime(880, t + 0.15); gain.gain.setValueAtTime(0.12, t); gain.gain.linearRampToValueAtTime(0, t + 0.25); osc.start(t); osc.stop(t + 0.25); }
        else if (type === "click" || type === "select") { osc.type = "sine"; osc.frequency.setValueAtTime(660, t); gain.gain.setValueAtTime(0.07, t); gain.gain.linearRampToValueAtTime(0, t + 0.08); osc.start(t); osc.stop(t + 0.08); }
        else if (type === "unlock") { osc.type = "triangle"; osc.frequency.setValueAtTime(523, t); osc.frequency.setValueAtTime(784, t + 0.18); osc.frequency.setValueAtTime(1047, t + 0.28); gain.gain.setValueAtTime(0.18, t); gain.gain.linearRampToValueAtTime(0, t + 0.45); osc.start(t); osc.stop(t + 0.45); }
        else if (type === "error")   { osc.type = "sawtooth"; osc.frequency.setValueAtTime(220, t); osc.frequency.linearRampToValueAtTime(160, t + 0.18); gain.gain.setValueAtTime(0.09, t); gain.gain.linearRampToValueAtTime(0, t + 0.18); osc.start(t); osc.stop(t + 0.18); }
        else if (type === "sparkle") { osc.type = "sine"; osc.frequency.setValueAtTime(1200, t); osc.frequency.linearRampToValueAtTime(1600, t + 0.12); gain.gain.setValueAtTime(0.07, t); gain.gain.linearRampToValueAtTime(0, t + 0.18); osc.start(t); osc.stop(t + 0.18); }
      }
    } catch (_) {}
  }
  try {
    switch (type) {
      case "open":    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case "click":   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  break;
      case "select":  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case "unlock":  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case "error":   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);   break;
      case "sparkle": Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  break;
    }
  } catch (_) {}
}

// ── Daily Shop ────────────────────────────────────────────────────────────────
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
  return pool.slice(0, 4);
}

function rollMysteryBox(tier: "basic" | "rare" | "legendary", profile: ReturnType<typeof usePlayer>["profile"]): MysteryBoxPrize {
  const r = Math.random();
  if (tier === "basic") {
    if (r < 0.5) { const amt = Math.floor(Math.random() * 101) + 50; return { type: "coins", coins: amt, emoji: "🪙", nameAr: `${amt} عملة` }; }
    if (r < 0.8) { const av = SKINS.filter(s => s.rarity === "common" && s.price > 0 && !profile.ownedSkins.includes(s.id)); if (av.length) { const s = av[Math.floor(Math.random()*av.length)]; return { type: "skin", id: s.id, emoji: s.emoji, nameAr: s.nameAr }; } return { type: "coins", coins: 80, emoji: "🪙", nameAr: "80 عملة" }; }
    const av = EMOTES.filter(e => e.price > 0 && !profile.ownedEmotes.includes(e.id)); if (av.length) { const e = av[Math.floor(Math.random()*av.length)]; return { type: "emote", id: e.id, emoji: e.emoji, nameAr: e.nameAr }; } return { type: "coins", coins: 60, emoji: "🪙", nameAr: "60 عملة" };
  }
  if (tier === "rare") {
    if (r < 0.3) { const amt = Math.floor(Math.random() * 201) + 150; return { type: "coins", coins: amt, emoji: "🪙", nameAr: `${amt} عملة` }; }
    if (r < 0.65) { const av = SKINS.filter(s => (s.rarity === "rare" || s.rarity === "epic") && s.price > 0 && !profile.ownedSkins.includes(s.id)); if (av.length) { const s = av[Math.floor(Math.random()*av.length)]; return { type: "skin", id: s.id, emoji: s.emoji, nameAr: s.nameAr }; } return { type: "coins", coins: 200, emoji: "🪙", nameAr: "200 عملة" }; }
    const av = EFFECTS.filter(e => e.price > 0 && !profile.ownedEffects.includes(e.id)); if (av.length) { const e = av[Math.floor(Math.random()*av.length)]; return { type: "effect", id: e.id, emoji: e.emoji, nameAr: e.nameAr }; } return { type: "coins", coins: 150, emoji: "🪙", nameAr: "150 عملة" };
  }
  // legendary
  if (r < 0.2) { const amt = Math.floor(Math.random() * 401) + 300; return { type: "coins", coins: amt, emoji: "🪙", nameAr: `${amt} عملة` }; }
  const av = SKINS.filter(s => (s.rarity === "epic" || s.rarity === "legendary") && !profile.ownedSkins.includes(s.id)); if (av.length) { const s = av[Math.floor(Math.random()*av.length)]; return { type: "skin", id: s.id, emoji: s.emoji, nameAr: s.nameAr }; } return { type: "coins", coins: 500, emoji: "🪙", nameAr: "500 عملة" };
}

function getTimeUntilMidnight(): string {
  const now = new Date(); const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000); const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}س ${m}د`;
}

// ── Box tiers ─────────────────────────────────────────────────────────────────
const BOX_TIERS = [
  { id: "basic" as const,     nameAr: "صندوق أساسي",   emoji: "🎁", price: 100, glowColor: "#9CA3AF", lightGlow: "#9CA3AF40", gradient: ["#1A2D42", "#142233"] as [string,string], accentColor: "#A8B8CC", poolLabel: "عادي · نادر",    coinMin: 50,  coinMax: 150 },
  { id: "rare" as const,      nameAr: "صندوق نادر",     emoji: "💜", price: 300, glowColor: "#8B5CF6", lightGlow: "#8B5CF630", gradient: ["#2D1B69", "#1A1040"] as [string,string], accentColor: "#A78BFA", poolLabel: "نادر · ملحمي",  coinMin: 150, coinMax: 350 },
  { id: "legendary" as const, nameAr: "صندوق أسطوري",  emoji: "⭐", price: 600, glowColor: "#F59E0B", lightGlow: "#F59E0B30", gradient: ["#3A2800", "#4A3200"] as [string,string], accentColor: "#F59E0B", poolLabel: "ملحمي · أسطوري", coinMin: 300, coinMax: 700 },
] as const;
type BoxTierId = typeof BOX_TIERS[number]["id"];

// ── Coin packs ────────────────────────────────────────────────────────────────
const COIN_PACKS = [
  { id: "starter",  coins: 500,   bonus: 0,   price: "مجاناً مع الإعلان", priceCoins: 0,   emoji: "🪙", gradient: ["#1A1040","#2D1B69"] as [string,string], accent: "#7C5CFC", badge: null },
  { id: "medium",   coins: 1200,  bonus: 200, price: "عرض خاص",           priceCoins: 0,   emoji: "💰", gradient: ["#0A2918","#0D3320"] as [string,string], accent: "#10B981", badge: "الأكثر شراءً" },
  { id: "premium",  coins: 3000,  bonus: 800, price: "قيمة مضاعفة",       priceCoins: 0,   emoji: "💎", gradient: ["#3A2800","#4A3200"] as [string,string], accent: "#F59E0B", badge: "الأفضل قيمة" },
] as const;

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "daily",   label: "العروض",    emoji: "🛒",  color: "#10B981" },
  { id: "avatars", label: "الأفاتار",  emoji: "🦁",  color: "#6C63FF" },
  { id: "effects", label: "تأثيرات",   emoji: "✨",  color: "#EC4899" },
  { id: "titles",  label: "ألقاب",     emoji: "🎖️", color: "#F59E0B" },
  { id: "mystery", label: "صناديق",    emoji: "📦",  color: "#8B5CF6" },
  { id: "spin",    label: "العجلة",    emoji: "🎡",  color: "#06B6D4" },
  { id: "coins",   label: "حزم",       emoji: "💎",  color: "#F59E0B" },
] as const;
type TabId = typeof TABS[number]["id"];

// ── AnimatedCard ──────────────────────────────────────────────────────────────
const AnimatedCard = memo(({ children, style, onPress, disabled }: {
  children: React.ReactNode; style?: any; onPress: () => void; disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPressIn={() => { Animated.spring(scale, { toValue: 0.96, tension: 400, friction: 12, useNativeDriver: true }).start(); playShopSound("click"); }}
        onPressOut={() => Animated.spring(scale, { toValue: 1, tension: 400, friction: 12, useNativeDriver: true }).start()}
        onPress={onPress}
        activeOpacity={1}
        disabled={disabled}
        style={{ flex: 1 }}
      >{children}</TouchableOpacity>
    </Animated.View>
  );
});

// ── Sparkle Particles (light) ─────────────────────────────────────────────────
const PARTICLE_SYMS = ["⭐", "✨", "🪙", "💫", "⭐"];
const ShopParticles = memo(() => {
  const particles = useRef(Array.from({ length: 10 }, (_, i) => ({
    x: Math.random() * (SW - 30),
    sym: PARTICLE_SYMS[i % PARTICLE_SYMS.length],
    size: 9 + Math.random() * 8,
    op: 0.06 + Math.random() * 0.10,
    dur: 5000 + Math.random() * 5000,
    delay: Math.random() * 4000,
    anim: new Animated.Value(Math.random()),
  }))).current;
  useEffect(() => {
    particles.forEach(p => {
      const loop = () => { p.anim.setValue(1); Animated.timing(p.anim, { toValue: 0, duration: p.dur, delay: p.delay, easing: Easing.linear, useNativeDriver: true }).start(() => loop()); };
      loop();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.Text key={i} style={{ position: "absolute", left: p.x, fontSize: p.size, opacity: p.op, transform: [{ translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, SH + 20] }) }] }}>{p.sym}</Animated.Text>
      ))}
    </View>
  );
});

// ── Burst reward popup ────────────────────────────────────────────────────────
function BurstOverlay({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.3, tension: 200, friction: 6, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.8, duration: 300, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(onDone);
    playShopSound("sparkle");
  }, []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center", zIndex: 999 }]}>
      <Animated.Text style={{ fontSize: 72, transform: [{ scale }], opacity: op }}>{emoji}</Animated.Text>
    </View>
  );
}

// ── Mystery Box Opening Modal ─────────────────────────────────────────────────
type BoxPhase = "idle" | "shake" | "burst" | "reward";

function BoxOpeningModal({
  visible, tier, onClose, onReward,
}: {
  visible: boolean;
  tier: typeof BOX_TIERS[number];
  onClose: () => void;
  onReward: (prize: MysteryBoxPrize) => void;
}) {
  const { profile, addCoins, purchaseSkin, purchaseBackground, purchaseEmote, purchaseEffect } = usePlayer();
  const [phase, setPhase] = useState<BoxPhase>("idle");
  const [prize, setPrize] = useState<MysteryBoxPrize | null>(null);

  const boxScale    = useRef(new Animated.Value(0)).current;
  const boxOpacity  = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const burstScale  = useRef(new Animated.Value(0)).current;
  const burstOp     = useRef(new Animated.Value(0)).current;
  const rewardScale = useRef(new Animated.Value(0)).current;
  const rewardOp    = useRef(new Animated.Value(0)).current;

  const PARTICLES = ["✨","⭐","💫","🌟","✦","⭐","✨","💫","🌟","✦","⭐","💫"];

  useEffect(() => {
    if (visible) {
      setPhase("idle"); setPrize(null);
      boxScale.setValue(0); boxOpacity.setValue(0);
      burstScale.setValue(0); burstOp.setValue(0);
      rewardScale.setValue(0); rewardOp.setValue(0);
      Animated.parallel([
        Animated.spring(boxScale, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
        Animated.timing(boxOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleOpenTap = () => {
    if (phase !== "idle") return;
    setPhase("shake");
    playShopSound("open");

    // Shake sequence
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setPhase("burst");
      const rolled = rollMysteryBox(tier.id, profile);
      setPrize(rolled);

      // Apply reward
      if (rolled.type === "coins" && rolled.coins) addCoins(rolled.coins);
      else if (rolled.type === "skin" && rolled.id) purchaseSkin(rolled.id as SkinId);
      else if (rolled.type === "background" && rolled.id) purchaseBackground(rolled.id as any);
      else if (rolled.type === "emote" && rolled.id) purchaseEmote(rolled.id as EmoteId);
      else if (rolled.type === "effect" && rolled.id) purchaseEffect(rolled.id as EffectId);

      playShopSound("unlock");

      // Box burst + fade out
      Animated.parallel([
        Animated.timing(boxScale, { toValue: 0.1, duration: 250, useNativeDriver: true }),
        Animated.timing(boxOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.spring(burstScale, { toValue: 1.5, tension: 120, friction: 5, useNativeDriver: true }),
        Animated.timing(burstOp, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(burstOp, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        setTimeout(() => {
          setPhase("reward");
          Animated.parallel([
            Animated.spring(rewardScale, { toValue: 1, tension: 100, friction: 7, useNativeDriver: true }),
            Animated.timing(rewardOp, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]).start();
        }, 200);
      });
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.boxModalOverlay}>
        <View style={styles.boxModalContent}>
          <LinearGradient colors={["#1A1040", "#0D1B2A", "#142233"]} style={StyleSheet.absoluteFillObject} />

          {/* Floating particles inside modal */}
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {PARTICLES.map((sym, i) => (
              <Text key={i} style={[styles.boxParticle, {
                top: 20 + ((i * 47) % 320),
                left: 10 + ((i * 83) % (SW - 100)),
                opacity: 0.15 + (i % 3) * 0.06,
                fontSize: 10 + (i % 3) * 5,
              }]}>{sym}</Text>
            ))}
          </View>

          {/* Phase: Box (idle / shake) */}
          {(phase === "idle" || phase === "shake") && (
            <View style={styles.boxPhaseContainer}>
              <Text style={styles.boxModalTitle}>{tier.nameAr}</Text>
              <Text style={styles.boxModalSub}>اضغط على الصندوق لفتحه!</Text>

              <TouchableOpacity onPress={handleOpenTap} activeOpacity={0.85} disabled={phase === "shake"}>
                <Animated.View style={[styles.boxBigWrapper, {
                  transform: [{ scale: boxScale }, { translateX: shakeAnim }],
                  opacity: boxOpacity,
                }]}>
                  <LinearGradient colors={tier.gradient} style={styles.boxBigCard}>
                    <View style={[styles.boxGlowRing, { borderColor: tier.glowColor + "80", shadowColor: tier.glowColor }]}>
                      <Text style={styles.boxBigEmoji}>{tier.emoji}</Text>
                    </View>
                    {phase === "idle" && (
                      <View style={styles.boxTapHint}>
                        <Text style={[styles.boxTapText, { color: tier.accentColor }]}>اضغط للفتح</Text>
                      </View>
                    )}
                    {phase === "shake" && (
                      <View style={styles.boxTapHint}>
                        <Text style={[styles.boxTapText, { color: tier.accentColor }]}>يفتح...</Text>
                      </View>
                    )}
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>

              <View style={[styles.boxTierBadge, { backgroundColor: tier.lightGlow }]}>
                <Text style={[styles.boxTierBadgeText, { color: tier.accentColor }]}>{tier.poolLabel}</Text>
              </View>
            </View>
          )}

          {/* Phase: Light burst */}
          {phase === "burst" && (
            <Animated.View style={[styles.burstCircle, {
              backgroundColor: tier.glowColor + "30",
              transform: [{ scale: burstScale }],
              opacity: burstOp,
            }]} />
          )}

          {/* Phase: Reward */}
          {phase === "reward" && prize && (
            <Animated.View style={[styles.rewardPhase, { transform: [{ scale: rewardScale }], opacity: rewardOp }]}>
              <Text style={styles.rewardCongrats}>🎉 مبروك!</Text>

              <LinearGradient colors={[tier.gradient[0], tier.gradient[1]]} style={styles.rewardCard}>
                <View style={[styles.rewardGlow, { backgroundColor: tier.glowColor + "25", borderColor: tier.glowColor + "60" }]}>
                  <Text style={styles.rewardEmoji}>{prize.emoji}</Text>
                </View>
                <Text style={[styles.rewardName, { color: L.textMain }]}>{prize.nameAr}</Text>
                <Text style={[styles.rewardType, { color: L.textSub }]}>
                  {prize.type === "coins"  ? "🪙 أُضيفت لرصيدك" :
                   prize.type === "skin"   ? "🦁 أفاتار جديد!" :
                   prize.type === "emote"  ? "😂 تفاعل جديد!" : "✨ تأثير جديد!"}
                </Text>
              </LinearGradient>

              {/* Spark particles */}
              {Array.from({ length: 8 }, (_, i) => (
                <Text key={i} style={[styles.sparkParticle, {
                  top: SH * 0.25 + Math.sin(i * Math.PI / 4) * 100,
                  left: SW * 0.5 + Math.cos(i * Math.PI / 4) * 100 - 15,
                  fontSize: 16 + (i % 3) * 6,
                }]}>{"✨⭐💫"[i % 3]}</Text>
              ))}

              <TouchableOpacity
                style={[styles.rewardCloseBtn, { backgroundColor: tier.accentColor }]}
                onPress={() => { onReward(prize); onClose(); }}
                activeOpacity={0.85}
              >
                <Text style={styles.rewardCloseBtnText}>رائع! متابعة</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Close X button */}
          {phase !== "shake" && (
            <TouchableOpacity style={styles.boxCloseX} onPress={onClose}>
              <Ionicons name="close-circle" size={32} color={L.textSub} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Main Shop Screen ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const {
    profile,
    purchaseSkin, equipSkin,
    purchaseEmote,
    purchaseEffect, equipEffect,
    purchaseTitle, equipTitle,
    addCoins,
  } = usePlayer();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<TabId>("daily");
  const [selectedBoxTier, setSelectedBoxTier] = useState<BoxTierId>("basic");
  const [boxModalVisible, setBoxModalVisible] = useState(false);
  const [skinFilter, setSkinFilter] = useState<"الكل" | "مغربية" | "عالمية" | "حصرية">("الكل");
  const [burstEmoji, setBurstEmoji] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());
  const [dailyItems] = useState<DailyItem[]>(() => getDailyItems());
  const [todayBought, setTodayBought] = useState<string[]>([]);
  const [coinPackLoading, setCoinPackLoading] = useState<string | null>(null);

  const tabScrollRef = useRef<ScrollView>(null);
  const contentScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeUntilMidnight()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const activeTier = BOX_TIERS.find(t => t.id === selectedBoxTier) || BOX_TIERS[0];

  // ── Coin Pack handler ─────────────────────────────────────────────────────
  const handleCoinPack = (pack: typeof COIN_PACKS[number]) => {
    if (coinPackLoading) return;
    setCoinPackLoading(pack.id);
    playShopSound("open");
    setTimeout(() => {
      addCoins(pack.coins + pack.bonus);
      setBurstEmoji("💰");
      setCoinPackLoading(null);
      Alert.alert("✅ تمت الإضافة", `حصلت على ${pack.coins + pack.bonus} عملة!`);
    }, 1200);
  };

  // ── Avatar (skin) handlers ────────────────────────────────────────────────
  const handleSkinAction = (id: SkinId) => {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return;
    if (profile.ownedSkins.includes(id)) { equipSkin(id); playShopSound("select"); return; }
    const unlockCond = skin.unlockCondition;
    if (unlockCond) {
      const cur = unlockCond.type === "wins" ? profile.wins : unlockCond.type === "level" ? profile.level : profile.bestStreak;
      if (cur < unlockCond.value) { playShopSound("error"); Alert.alert("غير مفتوح", `${unlockCond.label} (${cur}/${unlockCond.value})`); return; }
      purchaseSkin(id); setBurstEmoji(skin.emoji); return;
    }
    if (profile.coins < skin.price) { playShopSound("error"); Alert.alert("رصيد غير كافٍ", `تحتاج ${skin.price} عملة`); return; }
    Alert.alert("شراء الأفاتار", `شراء "${skin.nameAr}" مقابل ${skin.price} عملة؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseSkin(id); setBurstEmoji(skin.emoji); } },
    ]);
  };

  const handleEffectAction = (id: EffectId) => {
    const e = EFFECTS.find(x => x.id === id);
    if (!e) return;
    if (profile.ownedEffects.includes(id)) { equipEffect(id); playShopSound("select"); return; }
    if (profile.coins < e.price) { playShopSound("error"); Alert.alert("رصيد غير كافٍ", `تحتاج ${e.price} عملة`); return; }
    if (e.price === 0) { equipEffect(id); return; }
    Alert.alert("شراء التأثير", `شراء "${e.nameAr}" مقابل ${e.price} عملة؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "شراء", onPress: () => { purchaseEffect(id); setBurstEmoji(e.emoji); } },
    ]);
  };

  const handleDailyBuy = (item: DailyItem) => {
    if (todayBought.includes(item.id)) return;
    if (profile.coins < item.discountedPrice) { playShopSound("error"); Alert.alert("رصيد غير كافٍ", `تحتاج ${item.discountedPrice} عملة`); return; }
    addCoins(-item.discountedPrice);
    if (item.type === "skin")   purchaseSkin(item.id as SkinId);
    else if (item.type === "emote")  purchaseEmote(item.id as EmoteId);
    else if (item.type === "effect") purchaseEffect(item.id as EffectId);
    setTodayBought(prev => [...prev, item.id]);
    setBurstEmoji(item.emoji);
  };

  const isItemOwned = (item: DailyItem) => {
    if (item.type === "skin")   return profile.ownedSkins.includes(item.id as SkinId);
    if (item.type === "emote")  return profile.ownedEmotes.includes(item.id as EmoteId);
    if (item.type === "effect") return profile.ownedEffects.includes(item.id as EffectId);
    return false;
  };

  const handleBoxOpen = (tierId: BoxTierId) => {
    const tier = BOX_TIERS.find(t => t.id === tierId)!;
    if (profile.coins < tier.price) { playShopSound("error"); Alert.alert("رصيد غير كافٍ", `تحتاج ${tier.price} عملة`); return; }
    addCoins(-tier.price);
    setSelectedBoxTier(tierId);
    setBoxModalVisible(true);
  };

  // ── Tab scroll helper ─────────────────────────────────────────────────────
  const changeTab = (id: TabId) => {
    setActiveTab(id);
    playShopSound("click");
    contentScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // ─────────────────── RENDERS ─────────────────────────────────────────────

  // ── Render: Daily ─────────────────────────────────────────────────────────
  const renderDaily = () => (
    <>
      {/* Timer banner */}
      <LinearGradient colors={["#0A2918", "#0D3320"]} style={styles.dailyBanner}>
        <View>
          <Text style={styles.dailyBannerTitle}>عروض اليوم 🏷️</Text>
          <Text style={styles.dailyBannerSub}>خصم 30% على المنتجات المختارة</Text>
        </View>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={13} color={L.green} />
          <Text style={styles.timerText}>{timeLeft}</Text>
        </View>
      </LinearGradient>

      {dailyItems.map((item, idx) => {
        const owned = isItemOwned(item);
        const bought = todayBought.includes(item.id);
        const canAfford = profile.coins >= item.discountedPrice;
        const discount = Math.round((1 - item.discountedPrice / item.originalPrice) * 100);
        return (
          <View key={idx} style={styles.dailyCard}>
            <LinearGradient colors={[item.color + "12", "transparent"]} style={StyleSheet.absoluteFillObject} />
            <View style={[styles.discountBubble, { backgroundColor: L.green }]}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
            <View style={[styles.dailyAvatarCircle, { backgroundColor: item.color + "25", borderColor: RARITY_COLORS[item.rarity] + "50" }]}>
              <Text style={styles.dailyAvatarEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.dailyItemMeta}>
              <View style={styles.dailyItemTopRow}>
                <View style={[styles.rarityPill, { backgroundColor: RARITY_COLORS[item.rarity] + "20" }]}>
                  <Text style={[styles.rarityPillText, { color: RARITY_COLORS[item.rarity] }]}>{RARITY_LABELS[item.rarity]}</Text>
                </View>
                <Text style={styles.dailyItemCat}>{item.type === "skin" ? "أفاتار" : item.type === "emote" ? "تفاعل" : "تأثير"}</Text>
              </View>
              <Text style={styles.dailyItemName}>{item.nameAr}</Text>
              <View style={styles.dailyPriceRow}>
                <Text style={styles.originalPrice}>{item.originalPrice}</Text>
                <View style={styles.discountedPriceRow}>
                  <Ionicons name="star" size={12} color={L.gold} />
                  <Text style={styles.discountedPrice}>{item.discountedPrice}</Text>
                </View>
              </View>
            </View>
            {owned || bought ? (
              <View style={[styles.dailyActionBtn, { backgroundColor: "#0A2918" }]}>
                <Text style={[styles.dailyActionText, { color: L.green }]}>✓ {owned ? "تملكه" : "مشترى"}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dailyActionBtn, { backgroundColor: canAfford ? L.purple : "#2A4560" }]}
                onPress={() => handleDailyBuy(item)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dailyActionText, { color: canAfford ? "#FFF" : L.textSub }]}>{canAfford ? "شراء" : "لا يكفي"}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Earn guide */}
      <View style={styles.earnCard}>
        <Text style={styles.earnTitle}>💡 كيف تكسب عملات؟</Text>
        {[
          { rank: "🥇", color: Colors.rank1, text: "المركز الأول = 20 عملة" },
          { rank: "🥈", color: Colors.rank2, text: "المركز الثاني = 15 عملة" },
          { rank: "🥉", color: Colors.rank3, text: "المركز الثالث = 10 عملة" },
          { rank: "🎯", color: L.textSub,    text: "باقي المراكز = 5 عملة" },
          { rank: "🎡", color: L.purple,     text: "عجلة الحظ مجاناً كل يوم" },
        ].map((r, i) => (
          <View key={i} style={styles.earnRow}>
            <Text style={styles.earnRankEmoji}>{r.rank}</Text>
            <Text style={[styles.earnText, { color: L.textSub }]}>{r.text}</Text>
          </View>
        ))}
      </View>
    </>
  );

  // ── Render: Avatars ───────────────────────────────────────────────────────
  const renderAvatars = () => {
    const cur = SKINS.find(s => s.id === profile.equippedSkin) || SKINS[0];
    const FILTERS = ["الكل", "مغربية", "عالمية", "حصرية"] as const;
    const filtered = SKINS.filter(sk => {
      if (skinFilter === "الكل") return true;
      if (skinFilter === "مغربية") return sk.category === "moroccan";
      if (skinFilter === "عالمية") return sk.category === "global";
      return sk.category === "exclusive";
    });

    return (
      <>
        {/* Active avatar banner */}
        <TouchableOpacity style={styles.activeAvatarBanner} onPress={() => handleSkinAction(cur.id)} activeOpacity={0.85}>
          <LinearGradient colors={[RARITY_COLORS[cur.rarity] + "20", RARITY_COLORS[cur.rarity] + "06"]} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.activeAvatarRing, { borderColor: RARITY_COLORS[cur.rarity] + "80", shadowColor: RARITY_COLORS[cur.rarity] }]}>
            <View style={[styles.activeAvatarInner, { backgroundColor: cur.color + "30" }]}>
              <Text style={styles.activeAvatarEmoji}>{cur.emoji}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activeBannerLabel, { color: L.textSub }]}>أفاتارك الحالي</Text>
            <Text style={[styles.activeBannerName, { color: RARITY_COLORS[cur.rarity] }]}>{cur.nameAr}</Text>
            <View style={[styles.rarityPill, { backgroundColor: RARITY_COLORS[cur.rarity] + "20", alignSelf: "flex-start", marginTop: 4 }]}>
              <Text style={[styles.rarityPillText, { color: RARITY_COLORS[cur.rarity] }]}>{RARITY_LABELS[cur.rarity]}</Text>
            </View>
          </View>
          <Ionicons name="pencil" size={18} color={L.textSub} />
        </TouchableOpacity>

        {/* Filter row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, skinFilter === f && { backgroundColor: L.purple }]}
              onPress={() => { setSkinFilter(f as any); playShopSound("click"); }}
            >
              <Text style={[styles.filterChipText, skinFilter === f && { color: "#FFF" }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cards grid */}
        <View style={styles.avatarGrid}>
          {filtered.map(skin => {
            const owned = profile.ownedSkins.includes(skin.id);
            const equipped = profile.equippedSkin === skin.id;
            const canAfford = profile.coins >= skin.price;
            const locked = !owned && !canAfford && !skin.unlockCondition && skin.price > 0;
            const unlockCond = skin.unlockCondition;
            const unlockCurrent = !unlockCond ? 0 :
              unlockCond.type === "wins" ? profile.wins :
              unlockCond.type === "level" ? profile.level : profile.bestStreak;
            const rarityColor = RARITY_COLORS[skin.rarity];

            return (
              <AnimatedCard key={skin.id} style={{ width: CARD_W }} onPress={() => handleSkinAction(skin.id)}>
                <View style={[styles.avatarCard, equipped && { borderColor: rarityColor + "80" }]}>
                  {/* Soft rarity glow top strip */}
                  <LinearGradient colors={[rarityColor + "25", "transparent"]} style={styles.cardGlowTop} />

                  {/* Rarity label */}
                  <View style={[styles.rarityPill, { backgroundColor: rarityColor + "18", alignSelf: "center", marginBottom: 4 }]}>
                    <Text style={[styles.rarityPillText, { color: rarityColor }]}>{RARITY_LABELS[skin.rarity]}</Text>
                  </View>

                  {/* Status icon */}
                  {equipped && <View style={styles.statusBadge}><Ionicons name="checkmark-circle" size={18} color={L.green} /></View>}
                  {!owned && unlockCond && !equipped && <View style={styles.statusBadge}><Ionicons name="trophy" size={15} color="#8B5CF6" /></View>}

                  {/* Avatar circular icon with glow ring */}
                  <View style={[styles.avatarCircleOuter, {
                    borderColor: rarityColor + (skin.rarity === "legendary" ? "CC" : skin.rarity === "epic" ? "99" : "55"),
                    shadowColor: rarityColor,
                    shadowOpacity: skin.rarity === "legendary" ? 0.6 : skin.rarity === "epic" ? 0.4 : skin.rarity === "rare" ? 0.25 : 0,
                    shadowRadius: skin.rarity === "legendary" ? 16 : skin.rarity === "epic" ? 10 : 6,
                  }]}>
                    <LinearGradient colors={[skin.color + "35", skin.color + "12"]} style={styles.avatarCircleInner}>
                      <Text style={[styles.avatarEmoji, locked && { opacity: 0.5 }]}>{skin.emoji}</Text>
                      {locked && (
                        <View style={styles.lockOverlay}>
                          <Ionicons name="lock-closed" size={18} color="#FFF" />
                        </View>
                      )}
                    </LinearGradient>
                  </View>

                  <Text style={[styles.avatarCardName, locked && { color: L.textSub }]}>{skin.nameAr}</Text>

                  {/* Action button */}
                  {owned ? (
                    <View style={[styles.cardActionBtn, equipped ? { backgroundColor: "#0A2918" } : { backgroundColor: "#1A1040" }]}>
                      <Text style={[styles.cardActionText, equipped ? { color: L.green } : { color: L.purple }]}>{equipped ? "✓ مُجهَّز" : "تجهيز"}</Text>
                    </View>
                  ) : unlockCond ? (
                    <View style={[styles.cardActionBtn, { backgroundColor: "#2D1B69" }]}>
                      <Text style={[styles.cardActionText, { color: "#A78BFA" }]} numberOfLines={1}>{unlockCurrent}/{unlockCond.value}</Text>
                    </View>
                  ) : (
                    <View style={[styles.cardActionBtn, canAfford ? { backgroundColor: L.goldLight } : { backgroundColor: "#2A4560" }]}>
                      <Ionicons name="star" size={11} color={canAfford ? L.gold : L.textSub} />
                      <Text style={[styles.cardActionText, { color: canAfford ? L.gold : L.textSub }]}>{skin.price}</Text>
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

  // ── Render: Effects ───────────────────────────────────────────────────────
  const renderEffects = () => (
    <>
      <Text style={styles.sectionHint}>تأثيرات بصرية رائعة تظهر عند الفوز بمباراة ✨</Text>
      <View style={styles.avatarGrid}>
        {EFFECTS.map(effect => {
          const owned = profile.ownedEffects.includes(effect.id);
          const equipped = profile.equippedEffect === effect.id;
          const canAfford = profile.coins >= effect.price;
          const rarityColor = RARITY_COLORS[effect.rarity];

          return (
            <AnimatedCard key={effect.id} style={{ width: CARD_W }} onPress={() => handleEffectAction(effect.id)}>
              <View style={[styles.avatarCard, equipped && { borderColor: rarityColor + "80" }]}>
                <LinearGradient colors={[rarityColor + "20", "transparent"]} style={styles.cardGlowTop} />
                {effect.price > 0 && (
                  <View style={[styles.rarityPill, { backgroundColor: rarityColor + "18", alignSelf: "center", marginBottom: 4 }]}>
                    <Text style={[styles.rarityPillText, { color: rarityColor }]}>{RARITY_LABELS[effect.rarity]}</Text>
                  </View>
                )}
                {equipped && <View style={styles.statusBadge}><Ionicons name="checkmark-circle" size={18} color={L.green} /></View>}

                <View style={[styles.avatarCircleOuter, { borderColor: rarityColor + "50", shadowColor: rarityColor, shadowOpacity: 0.3, shadowRadius: 8 }]}>
                  <LinearGradient colors={[effect.color + "30", effect.color + "10"]} style={styles.avatarCircleInner}>
                    <Text style={styles.avatarEmoji}>{effect.emoji}</Text>
                  </LinearGradient>
                </View>

                <Text style={styles.avatarCardName}>{effect.nameAr}</Text>
                {effect.descAr && <Text style={styles.avatarCardDesc} numberOfLines={2}>{effect.descAr}</Text>}

                {owned ? (
                  <View style={[styles.cardActionBtn, equipped ? { backgroundColor: "#0A2918" } : { backgroundColor: "#1A1040" }]}>
                    <Text style={[styles.cardActionText, equipped ? { color: L.green } : { color: L.purple }]}>{equipped ? "✓ مُجهَّز" : "تجهيز"}</Text>
                  </View>
                ) : effect.price === 0 ? (
                  <View style={[styles.cardActionBtn, { backgroundColor: "#1A1040" }]}>
                    <Text style={[styles.cardActionText, { color: L.purple }]}>تجهيز</Text>
                  </View>
                ) : (
                  <View style={[styles.cardActionBtn, canAfford ? { backgroundColor: L.goldLight } : { backgroundColor: "#2A4560" }]}>
                    <Ionicons name="star" size={11} color={canAfford ? L.gold : L.textSub} />
                    <Text style={[styles.cardActionText, { color: canAfford ? L.gold : L.textSub }]}>{effect.price}</Text>
                  </View>
                )}
              </View>
            </AnimatedCard>
          );
        })}
      </View>
    </>
  );

  // ── Render: Titles ────────────────────────────────────────────────────────
  const renderTitles = () => {
    const eqId = profile.equippedTitle as TitleId | null;
    const activeTitleData = TITLES.find(t => t.id === eqId);
    return (
      <>
        <Text style={styles.sectionHint}>الألقاب تظهر تحت اسمك في المتصدرين والمباريات 🎖️</Text>

        {activeTitleData && (
          <View style={[styles.activeTitleBanner, { borderColor: RARITY_COLORS[activeTitleData.rarity] + "50" }]}>
            <LinearGradient colors={[RARITY_COLORS[activeTitleData.rarity] + "15", "transparent"]} style={StyleSheet.absoluteFillObject} />
            <Text style={{ fontSize: 28 }}>{activeTitleData.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeBannerLabel}>لقبك الحالي</Text>
              <Text style={[styles.activeBannerName, { color: RARITY_COLORS[activeTitleData.rarity] }]}>{activeTitleData.nameAr}</Text>
            </View>
            <View style={[styles.rarityPill, { backgroundColor: RARITY_COLORS[activeTitleData.rarity] + "20" }]}>
              <Text style={[styles.rarityPillText, { color: RARITY_COLORS[activeTitleData.rarity] }]}>{RARITY_LABELS[activeTitleData.rarity]}</Text>
            </View>
          </View>
        )}

        <View style={styles.avatarGrid}>
          {TITLES.map(title => {
            const owned = (profile.ownedTitles as string[]).includes(title.id);
            const equipped = eqId === title.id;
            const canAfford = profile.coins >= title.price;
            const unlockCond = title.unlockCondition;
            const unlockCur = !unlockCond ? 0 :
              unlockCond.type === "wins" ? profile.wins :
              unlockCond.type === "level" ? profile.level : profile.bestStreak;
            const condMet = !unlockCond || unlockCur >= unlockCond.value;
            const rarityColor = RARITY_COLORS[title.rarity];

            const handleTitleAction = () => {
              if (owned) { equipTitle(title.id); playShopSound("select"); return; }
              if (unlockCond) {
                if (!condMet) { playShopSound("error"); Alert.alert("غير مفتوح بعد", `${unlockCond.label} (${unlockCur}/${unlockCond.value})`); return; }
                const ok = purchaseTitle(title.id); if (ok) setBurstEmoji(title.emoji); return;
              }
              if (!canAfford) { playShopSound("error"); Alert.alert("رصيد غير كافٍ", `تحتاج ${title.price} عملة`); return; }
              Alert.alert("شراء اللقب", `شراء "${title.nameAr}" مقابل ${title.price} عملة؟`, [
                { text: "إلغاء", style: "cancel" },
                { text: "شراء", onPress: () => { const ok = purchaseTitle(title.id); if (ok) setBurstEmoji(title.emoji); } },
              ]);
            };

            return (
              <AnimatedCard key={title.id} style={{ width: CARD_W }} onPress={handleTitleAction}>
                <View style={[styles.avatarCard, equipped && { borderColor: rarityColor + "80" }]}>
                  <LinearGradient colors={[rarityColor + "20", "transparent"]} style={styles.cardGlowTop} />
                  <View style={[styles.rarityPill, { backgroundColor: rarityColor + "18", alignSelf: "center", marginBottom: 4 }]}>
                    <Text style={[styles.rarityPillText, { color: rarityColor }]}>{RARITY_LABELS[title.rarity]}</Text>
                  </View>
                  {equipped && <View style={styles.statusBadge}><Ionicons name="checkmark-circle" size={18} color={L.green} /></View>}
                  {!owned && unlockCond && <View style={styles.statusBadge}><Ionicons name="trophy" size={15} color="#8B5CF6" /></View>}

                  <View style={[styles.avatarCircleOuter, { borderColor: rarityColor + "60", shadowColor: rarityColor, shadowOpacity: 0.3, shadowRadius: 8 }]}>
                    <LinearGradient colors={[title.color + "30", title.color + "10"]} style={styles.avatarCircleInner}>
                      <Text style={styles.avatarEmoji}>{title.emoji}</Text>
                    </LinearGradient>
                  </View>

                  <Text style={styles.avatarCardName}>{title.nameAr}</Text>
                  <Text style={styles.avatarCardDesc} numberOfLines={2}>{title.descAr}</Text>

                  {owned ? (
                    <View style={[styles.cardActionBtn, equipped ? { backgroundColor: "#0A2918" } : { backgroundColor: "#1A1040" }]}>
                      <Text style={[styles.cardActionText, equipped ? { color: L.green } : { color: L.purple }]}>{equipped ? "✓ مُفعَّل" : "تفعيل"}</Text>
                    </View>
                  ) : unlockCond ? (
                    <View style={[styles.cardActionBtn, { backgroundColor: condMet ? "#0A2918" : "#2D1B69" }]}>
                      <Text style={[styles.cardActionText, { color: condMet ? L.green : "#A78BFA" }]}>{condMet ? "افتح الآن" : `${unlockCur}/${unlockCond.value}`}</Text>
                    </View>
                  ) : (
                    <View style={[styles.cardActionBtn, canAfford ? { backgroundColor: L.goldLight } : { backgroundColor: "#2A4560" }]}>
                      <Ionicons name="star" size={11} color={canAfford ? L.gold : L.textSub} />
                      <Text style={[styles.cardActionText, { color: canAfford ? L.gold : L.textSub }]}>{title.price}</Text>
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

  // ── Render: Mystery Boxes ─────────────────────────────────────────────────
  const renderMystery = () => (
    <View style={styles.mysteryContainer}>
      <Text style={styles.mysteryTitle}>صناديق الغموض 📦</Text>
      <Text style={styles.mysterySub}>اختر صندوقاً وافتحه للحصول على جوائز مفاجئة!</Text>

      {BOX_TIERS.map(tier => {
        const canAfford = profile.coins >= tier.price;
        const active = selectedBoxTier === tier.id;
        return (
          <TouchableOpacity
            key={tier.id}
            style={[styles.boxTierCard, active && { borderColor: tier.glowColor + "70", borderWidth: 2 }]}
            onPress={() => { setSelectedBoxTier(tier.id); playShopSound("click"); }}
            activeOpacity={0.88}
          >
            <LinearGradient colors={tier.gradient} style={StyleSheet.absoluteFillObject} />
            {active && (
              <LinearGradient colors={[tier.glowColor + "20", "transparent"]} style={StyleSheet.absoluteFillObject} />
            )}

            <View style={[styles.boxTierIcon, { borderColor: tier.glowColor + "70", shadowColor: tier.glowColor, backgroundColor: tier.gradient[0] }]}>
              <Text style={styles.boxTierEmoji}>{tier.emoji}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.boxTierName, { color: tier.accentColor }]}>{tier.nameAr}</Text>
              <Text style={[styles.boxTierPool, { color: L.textSub }]}>{tier.poolLabel}</Text>
              <Text style={[styles.boxTierCoins, { color: L.textSub }]}>{tier.coinMin}–{tier.coinMax} عملة محتملة</Text>
            </View>

            <View style={styles.boxTierRight}>
              <View style={[styles.priceBadge, { backgroundColor: canAfford ? L.goldLight : "#2A4560" }]}>
                <Ionicons name="star" size={12} color={canAfford ? L.gold : L.textSub} />
                <Text style={[styles.priceText, { color: canAfford ? L.gold : L.textSub }]}>{tier.price}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color={tier.accentColor} style={{ marginTop: 6 }} />}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Possible rewards */}
      <Text style={styles.possibleTitle}>الجوائز الممكنة</Text>
      <View style={styles.possibleRow}>
        {[{ e:"🦁",l:"أفاتار"}, {e:"✨",l:"تأثير"}, {e:"😂",l:"تفاعل"}, {e:"🪙",l:"عملات"}].map((r,i) => (
          <View key={i} style={styles.possibleItem}>
            <Text style={styles.possibleEmoji}>{r.e}</Text>
            <Text style={styles.possibleLabel}>{r.l}</Text>
          </View>
        ))}
      </View>

      {/* Open button */}
      <TouchableOpacity
        style={[styles.openBoxBtn, !BOX_TIERS.find(t=>t.id===selectedBoxTier) && { opacity: 0.5 }]}
        onPress={() => handleBoxOpen(selectedBoxTier)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={profile.coins >= (BOX_TIERS.find(t=>t.id===selectedBoxTier)?.price || 999) ? [L.purple, "#4F46E5"] : ["#CBD5E1","#94A3B8"]}
          style={styles.openBoxBtnGrad}
        >
          <Text style={styles.openBoxBtnText}>
            {profile.coins >= (BOX_TIERS.find(t=>t.id===selectedBoxTier)?.price || 999)
              ? `✨ فتح الصندوق · ${BOX_TIERS.find(t=>t.id===selectedBoxTier)?.price} عملة`
              : `رصيد غير كافٍ (يلزم ${BOX_TIERS.find(t=>t.id===selectedBoxTier)?.price} عملة)`}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── Render: Spin Wheel ────────────────────────────────────────────────────
  const renderSpin = () => (
    <TouchableOpacity
      style={styles.spinHeroBtn}
      onPress={() => { playShopSound("select"); router.push("/spin"); }}
      activeOpacity={0.88}
    >
      <LinearGradient colors={["#4F46E5", "#7C3AED", "#9333EA"]} style={styles.spinHeroGrad}>
        {["✨","⭐","💫","🌟","✦","⭐","✨","💫"].map((sym, i) => (
          <Text key={i} style={[styles.spinParticle, { top: 8 + (i * 22) % 80, left: (i * 53) % (SW - 80), opacity: 0.3 + (i % 3) * 0.12 }]}>{sym}</Text>
        ))}
        <Text style={styles.spinHeroEmoji}>🎡</Text>
        <Text style={styles.spinHeroTitle}>عجلة الحظ</Text>
        <Text style={styles.spinHeroSub}>دوّر مجاناً مرة كل 24 ساعة · فرصتك للفوز بجوائز رائعة</Text>
        <View style={styles.spinHeroBtn2}>
          <Text style={styles.spinHeroBtn2Text}>الدوران الآن 🎰</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  // ── Render: Coin Packs ────────────────────────────────────────────────────
  const renderCoinPacks = () => (
    <>
      <Text style={styles.sectionHint}>اشحن رصيدك واحصل على عملات إضافية مجانية! 💰</Text>

      {COIN_PACKS.map(pack => (
        <TouchableOpacity
          key={pack.id}
          style={styles.coinPackCard}
          onPress={() => handleCoinPack(pack)}
          activeOpacity={0.88}
          disabled={!!coinPackLoading}
        >
          <LinearGradient colors={pack.gradient} style={StyleSheet.absoluteFillObject} />
          {pack.badge && (
            <View style={[styles.packBadge, { backgroundColor: pack.accent }]}>
              <Text style={styles.packBadgeText}>{pack.badge}</Text>
            </View>
          )}
          <Text style={styles.coinPackEmoji}>{pack.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.coinPackAmount, { color: pack.accent }]}>{pack.coins.toLocaleString()} عملة</Text>
            {pack.bonus > 0 && (
              <View style={[styles.bonusBadge, { backgroundColor: pack.accent + "20" }]}>
                <Text style={[styles.bonusText, { color: pack.accent }]}>+ {pack.bonus} مكافأة!</Text>
              </View>
            )}
            <Text style={[styles.coinPackPrice, { color: L.textSub }]}>{pack.price}</Text>
          </View>
          <View style={[styles.claimBtn, { backgroundColor: pack.accent, opacity: coinPackLoading === pack.id ? 0.6 : 1 }]}>
            <Text style={styles.claimBtnText}>{coinPackLoading === pack.id ? "⏳" : "احصل عليه"}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Info */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color={L.purple} />
        <Text style={styles.infoText}>الحزم الحالية تُضاف مباشرة لرصيدك. في المستقبل ستكون متاحة بالدفع الإلكتروني.</Text>
      </View>
    </>
  );

  // ── Tab content router ────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case "daily":   return renderDaily();
      case "avatars": return renderAvatars();
      case "effects": return renderEffects();
      case "titles":  return renderTitles();
      case "mystery": return renderMystery();
      case "spin":    return renderSpin();
      case "coins":   return renderCoinPacks();
    }
  };

  // ── Main return ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Dark gradient background */}
      <LinearGradient colors={["#0D1B2A", "#142233", "#0D1B2A"]} style={StyleSheet.absoluteFillObject} />
      <ShopParticles />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={L.textMain} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>المتجر</Text>
        </View>
        <View style={styles.coinsBadge}>
          <Ionicons name="star" size={14} color={L.gold} />
          <Text style={styles.coinsText}>{profile.coins}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, active && { backgroundColor: L.card }]}
              onPress={() => changeTab(tab.id)}
              activeOpacity={0.75}
            >
              {active && (
                <LinearGradient colors={[tab.color + "18", tab.color + "08"]} style={StyleSheet.absoluteFillObject} />
              )}
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text style={[styles.tabLabel, { color: active ? tab.color : L.textSub }, active && { fontFamily: "Cairo_700Bold" }]}>
                {tab.label}
              </Text>
              {active && <View style={[styles.tabDot, { backgroundColor: tab.color }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView
        ref={contentScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* Burst overlay */}
      {burstEmoji && <BurstOverlay emoji={burstEmoji} onDone={() => setBurstEmoji(null)} />}

      {/* Mystery box modal */}
      <BoxOpeningModal
        visible={boxModalVisible}
        tier={activeTier}
        onClose={() => setBoxModalVisible(false)}
        onReward={(prize) => { setBurstEmoji(prize.emoji); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1B2A" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10, justifyContent: "space-between",
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: L.card,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: L.textMain },
  coinsBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: L.goldLight, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: L.gold + "40",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: L.gold },

  tabsBar: { maxHeight: 72, flexGrow: 0 },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tabItem: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, gap: 2, overflow: "hidden", position: "relative",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: L.textSub },
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },

  scrollContent: { padding: 16, gap: 12 },

  // ── Daily ────────────────────────────────────────────────────────────────
  dailyBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 16, padding: 16, marginBottom: 4,
    borderWidth: 1, borderColor: "#1A5C3A",
  },
  dailyBannerTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: L.textMain },
  dailyBannerSub: { fontFamily: "Cairo_400Regular", fontSize: 12, color: L.textSub },
  timerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#0A2918", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  timerText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: L.green },
  dailyCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: L.card, borderRadius: 16, padding: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    overflow: "hidden",
  },
  discountBubble: { position: "absolute", top: 8, left: 8, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  discountText: { fontFamily: "Cairo_700Bold", fontSize: 10, color: "#FFF" },
  dailyAvatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2,
  },
  dailyAvatarEmoji: { fontSize: 26 },
  dailyItemMeta: { flex: 1, gap: 2 },
  dailyItemTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dailyItemCat: { fontFamily: "Cairo_400Regular", fontSize: 10, color: L.textSub },
  dailyItemName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: L.textMain },
  dailyPriceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  originalPrice: { fontFamily: "Cairo_400Regular", fontSize: 11, color: L.textSub, textDecorationLine: "line-through" },
  discountedPriceRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  discountedPrice: { fontFamily: "Cairo_700Bold", fontSize: 14, color: L.gold },
  dailyActionBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, justifyContent: "center", alignItems: "center", minWidth: 70 },
  dailyActionText: { fontFamily: "Cairo_700Bold", fontSize: 12 },
  earnCard: {
    backgroundColor: L.card, borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    gap: 10, marginTop: 8,
  },
  earnTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: L.textMain },
  earnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  earnRankEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  earnText: { fontFamily: "Cairo_400Regular", fontSize: 13 },

  // ── Avatars / Effects / Titles shared ────────────────────────────────────
  sectionHint: { fontFamily: "Cairo_400Regular", fontSize: 13, color: L.textSub, textAlign: "center", marginBottom: 4 },
  activeAvatarBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: L.card, borderRadius: 16, padding: 14,
    overflow: "hidden", borderWidth: 1, borderColor: L.cardBorder,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  activeAvatarRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2.5, justifyContent: "center", alignItems: "center",
    shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  activeAvatarInner: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  activeAvatarEmoji: { fontSize: 26 },
  activeBannerLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: L.textSub },
  activeBannerName: { fontFamily: "Cairo_700Bold", fontSize: 16 },
  activeTitleBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: L.card, borderRadius: 16, padding: 14,
    overflow: "hidden", borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  filterScroll: { marginBottom: 8 },
  filterContent: { gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: L.card, borderRadius: 20,
    borderWidth: 1, borderColor: L.cardBorder,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  filterChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: L.textSub },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  avatarCard: {
    width: CARD_W, backgroundColor: L.card, borderRadius: 18,
    padding: 12, alignItems: "center", gap: 6,
    shadowColor: "#6C63FF", shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    borderWidth: 1, borderColor: L.cardBorder, overflow: "hidden", position: "relative",
  },
  cardGlowTop: { position: "absolute", top: 0, left: 0, right: 0, height: 50 },
  rarityPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  rarityPillText: { fontFamily: "Cairo_700Bold", fontSize: 9 },
  statusBadge: { position: "absolute", top: 8, right: 8 },
  avatarCircleOuter: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2.5, justifyContent: "center", alignItems: "center",
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  avatarCircleInner: { width: 58, height: 58, borderRadius: 29, justifyContent: "center", alignItems: "center" },
  avatarEmoji: { fontSize: 30 },
  lockOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 29, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
  },
  avatarCardName: { fontFamily: "Cairo_700Bold", fontSize: 13, color: L.textMain, textAlign: "center" },
  avatarCardDesc: { fontFamily: "Cairo_400Regular", fontSize: 10, color: L.textSub, textAlign: "center" },
  cardActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, width: "100%", justifyContent: "center",
  },
  cardActionText: { fontFamily: "Cairo_700Bold", fontSize: 12 },

  // ── Mystery Box ───────────────────────────────────────────────────────────
  mysteryContainer: { gap: 12 },
  mysteryTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: L.textMain, textAlign: "center" },
  mysterySub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: L.textSub, textAlign: "center" },
  boxTierCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 18, padding: 14, overflow: "hidden",
    borderWidth: 1, borderColor: L.cardBorder,
    shadowColor: "#6C63FF", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  boxTierIcon: {
    width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center",
    borderWidth: 2, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 5,
  },
  boxTierEmoji: { fontSize: 24 },
  boxTierName: { fontFamily: "Cairo_700Bold", fontSize: 16 },
  boxTierPool: { fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 1 },
  boxTierCoins: { fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 2 },
  boxTierRight: { alignItems: "center" },
  priceBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  priceText: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  possibleTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: L.textMain, textAlign: "center", marginTop: 4 },
  possibleRow: { flexDirection: "row", justifyContent: "space-around", backgroundColor: L.card, borderRadius: 16, padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  possibleItem: { alignItems: "center", gap: 4 },
  possibleEmoji: { fontSize: 26 },
  possibleLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: L.textSub },
  openBoxBtn: { overflow: "hidden", borderRadius: 18 },
  openBoxBtnGrad: { paddingVertical: 16, alignItems: "center", borderRadius: 18 },
  openBoxBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#FFF" },

  // ── Spin ─────────────────────────────────────────────────────────────────
  spinHeroBtn: { borderRadius: 24, overflow: "hidden", shadowColor: "#6C63FF", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  spinHeroGrad: { padding: 32, alignItems: "center", gap: 12, position: "relative", borderRadius: 24, minHeight: 280 },
  spinParticle: { position: "absolute", fontSize: 14 },
  spinHeroEmoji: { fontSize: 72 },
  spinHeroTitle: { fontFamily: "Cairo_700Bold", fontSize: 28, color: "#FFF", textAlign: "center" },
  spinHeroSub: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  spinHeroBtn2: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 16, paddingHorizontal: 28, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  spinHeroBtn2Text: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#FFF" },

  // ── Coin Packs ────────────────────────────────────────────────────────────
  coinPackCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 18, padding: 16, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    position: "relative",
  },
  packBadge: {
    position: "absolute", top: 8, right: 8,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  packBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 9, color: "#FFF" },
  coinPackEmoji: { fontSize: 38 },
  coinPackAmount: { fontFamily: "Cairo_700Bold", fontSize: 18 },
  bonusBadge: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 },
  bonusText: { fontFamily: "Cairo_700Bold", fontSize: 11 },
  coinPackPrice: { fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 2 },
  claimBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: "center", alignItems: "center" },
  claimBtnText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#FFF" },
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: L.purpleLight, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: L.purple + "30",
  },
  infoText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: L.purple, flex: 1 },

  // ── Box Opening Modal ─────────────────────────────────────────────────────
  boxModalOverlay: {
    flex: 1, backgroundColor: "rgba(15,10,40,0.65)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  boxModalContent: {
    width: "100%", borderRadius: 28, overflow: "hidden",
    minHeight: SH * 0.55, justifyContent: "center", alignItems: "center",
    padding: 24, position: "relative",
    shadowColor: "#6C63FF", shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 20,
  },
  boxParticle: { position: "absolute" },
  boxPhaseContainer: { alignItems: "center", gap: 16, width: "100%" },
  boxModalTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, color: L.textMain, textAlign: "center" },
  boxModalSub: { fontFamily: "Cairo_400Regular", fontSize: 14, color: L.textSub, textAlign: "center" },
  boxBigWrapper: { alignItems: "center" },
  boxBigCard: {
    width: 180, height: 200, borderRadius: 24, alignItems: "center", justifyContent: "center",
    gap: 12, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  boxGlowRing: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3,
    justifyContent: "center", alignItems: "center",
    shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  boxBigEmoji: { fontSize: 52 },
  boxTapHint: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10 },
  boxTapText: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  boxTierBadge: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  boxTierBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 12 },
  burstCircle: {
    width: 300, height: 300, borderRadius: 150,
    position: "absolute",
  },
  rewardPhase: { alignItems: "center", gap: 16, width: "100%" },
  rewardCongrats: { fontFamily: "Cairo_700Bold", fontSize: 26, color: L.textMain },
  rewardCard: {
    width: "90%", borderRadius: 20, padding: 24, alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  rewardGlow: {
    width: 90, height: 90, borderRadius: 45, borderWidth: 2,
    justifyContent: "center", alignItems: "center",
  },
  rewardEmoji: { fontSize: 46 },
  rewardName: { fontFamily: "Cairo_700Bold", fontSize: 20 },
  rewardType: { fontFamily: "Cairo_400Regular", fontSize: 13 },
  sparkParticle: { position: "absolute", zIndex: 10 },
  rewardCloseBtn: {
    borderRadius: 16, paddingHorizontal: 36, paddingVertical: 14,
    shadowColor: "#6C63FF", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  rewardCloseBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#FFF" },
  boxCloseX: { position: "absolute", top: 14, right: 14, zIndex: 100 },
});
