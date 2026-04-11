import React, { useEffect, useRef, useState, memo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ImageBackground,
} from "react-native";
const BG_HOME = require("@/assets/images/bg_home.png");
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

// ── Daily login reward coin animation ─────────────────────────────────────────
function LoginRewardPopup({ onClaim }: { onClaim: () => void }) {
  const { theme } = useTheme();
  const coinY   = useRef(new Animated.Value(0)).current;
  const coinRot = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(0.7)).current;
  const popOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(popScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(popOp, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(coinY, { toValue: -12, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(coinY, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(coinRot, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })).start();
    return () => { [coinY, coinRot, popScale, popOp].forEach(a => a.stopAnimation()); };
  }, []);

  const COIN_PARTICLES = [
    { dx: -60, dy: -50, delay: 0 }, { dx: 60, dy: -50, delay: 150 },
    { dx: -80, dy: 10, delay: 100 }, { dx: 80, dy: 10, delay: 250 },
    { dx: -30, dy: -80, delay: 200 }, { dx: 30, dy: -80, delay: 50 },
  ];

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: theme.overlay,
      justifyContent: "center", alignItems: "center", padding: 24,
      opacity: popOp,
    }}>
      <Animated.View style={{
        width: "100%", backgroundColor: "#130B2B",
        borderRadius: 30, padding: 28, alignItems: "center",
        borderWidth: 4, borderColor: "#F5C842" + "80",
        borderBottomWidth: 6, borderBottomColor: "#C4A010",
        shadowColor: "#F5C842", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.7, shadowRadius: 35, elevation: 35,
        transform: [{ scale: popScale }],
      }}>
        {/* Corner decorations */}
        <Text style={{ position: "absolute", top: 12, left: 16, fontSize: 18, opacity: 0.7 }}>✦</Text>
        <Text style={{ position: "absolute", top: 12, right: 16, fontSize: 18, opacity: 0.7 }}>✦</Text>
        <Text style={{ position: "absolute", bottom: 70, left: 14, fontSize: 14, opacity: 0.5 }}>⭐</Text>
        <Text style={{ position: "absolute", bottom: 70, right: 14, fontSize: 14, opacity: 0.5 }}>⭐</Text>

        {/* Coin particles */}
        {COIN_PARTICLES.map((p, i) => (
          <Animated.Text key={i} style={{
            position: "absolute", fontSize: 20,
            transform: [{ translateX: p.dx }, { translateY: p.dy }],
            opacity: 0.8,
          }}>🪙</Animated.Text>
        ))}

        {/* Animated coin */}
        <Animated.Text style={{
          fontSize: 80, marginBottom: 16,
          transform: [
            { translateY: coinY },
            { rotate: coinRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
          ],
        }}>🎁</Animated.Text>

        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 24, color: "#F5C842", marginBottom: 6, textAlign: "center" }}>
          مكافأة الدخول اليومية
        </Text>
        <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 10, textAlign: "center" }}>
          حصلت على 🎉
        </Text>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: "#F5C842" + "28", borderRadius: 20,
          paddingHorizontal: 28, paddingVertical: 12, marginBottom: 24,
          borderWidth: 3, borderColor: "#F5C842" + "60",
          borderBottomWidth: 5, borderBottomColor: "#C4A010",
        }}>
          <Text style={{ fontSize: 28 }}>🪙</Text>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 30, color: "#F5C842" }}>250 عملة!</Text>
        </View>

        <TouchableOpacity
          style={{
            width: "100%", minHeight: 54, justifyContent: "center", borderRadius: 20,
            backgroundColor: "#F5C842", alignItems: "center",
            borderWidth: 3, borderColor: "rgba(255,255,255,0.30)",
            borderBottomWidth: 5, borderBottomColor: "#C4A010",
            shadowColor: "#F5C842", shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.6, shadowRadius: 12, elevation: 10,
          }}
          onPress={onClaim}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 17, color: "#000" }}>✨ استلم المكافأة</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");

// Main game mode card
const CARD_WIDTH = width * 0.72;
const CARD_MARGIN = 10;

const LOGO = {
  cyan:   "#00F5FF",
  pink:   "#FF006E",
  purple: "#BF00FF",
  yellow: "#F5C842",
  green:  "#00FF87",
};

// ── Background blob shapes (abstract decoration) ──────────────────────────────
const BG_BLOBS = [
  { top: -60,  left: -50,  size: 200, color: LOGO.cyan   + "28" },
  { top: 80,   right: -60, size: 180, color: LOGO.pink   + "22" },
  { top: 300,  left: -70,  size: 220, color: LOGO.purple + "24" },
  { top: 520,  right: -50, size: 170, color: LOGO.yellow + "20" },
  { top: 760,  left: -40,  size: 190, color: LOGO.cyan   + "1E" },
  { top: 1000, right: -70, size: 210, color: LOGO.pink   + "20" },
  { top: 1260, left: -50,  size: 180, color: LOGO.purple + "1C" },
];

// ── Background floating particle ───────────────────────────────────────────────
type BgParticleProps = { color: string; startX: number; startY: number; size: number; delay: number; duration: number };
const BgParticle = memo(({ color, startX, startY, size, delay, duration }: BgParticleProps) => {
  const posY = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      posY.setValue(0); op.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(posY, { toValue: -height * 0.35, duration, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(op, { toValue: 0.55, duration: 500, useNativeDriver: true }),
          Animated.delay(duration - 900),
          Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => { posY.stopAnimation(); op.stopAnimation(); };
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left: startX, top: startY,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      opacity: op,
      transform: [{ translateY: posY }],
    }} />
  );
});

const BG_PARTICLES: BgParticleProps[] = [
  { color: LOGO.cyan,   startX: width * 0.1,  startY: height * 0.7,  size: 6, delay: 0,    duration: 6000 },
  { color: LOGO.pink,   startX: width * 0.25, startY: height * 0.65, size: 5, delay: 800,  duration: 7200 },
  { color: LOGO.purple, startX: width * 0.55, startY: height * 0.75, size: 7, delay: 1600, duration: 5800 },
  { color: LOGO.yellow, startX: width * 0.75, startY: height * 0.68, size: 5, delay: 400,  duration: 6600 },
  { color: LOGO.cyan,   startX: width * 0.4,  startY: height * 0.8,  size: 6, delay: 2200, duration: 7000 },
  { color: LOGO.pink,   startX: width * 0.85, startY: height * 0.72, size: 4, delay: 1200, duration: 6200 },
  { color: LOGO.purple, startX: width * 0.15, startY: height * 0.82, size: 5, delay: 3000, duration: 5600 },
  { color: LOGO.yellow, startX: width * 0.62, startY: height * 0.6,  size: 6, delay: 1800, duration: 6800 },
  { color: LOGO.cyan,   startX: width * 0.92, startY: height * 0.85, size: 4, delay: 500,  duration: 6400 },
  { color: LOGO.pink,   startX: width * 0.05, startY: height * 0.55, size: 5, delay: 2600, duration: 7400 },
  { color: LOGO.yellow, startX: width * 0.48, startY: height * 0.9,  size: 7, delay: 1000, duration: 5400 },
  { color: LOGO.purple, startX: width * 0.72, startY: height * 0.5,  size: 4, delay: 3400, duration: 6000 },
];

// ── Arabic floating letters ───────────────────────────────────────────────────
type ArabicFloatProps = { letter: string; color: string; startX: number; startY: number; fontSize: number; delay: number; duration: number };
const ArabicLetterFloat = memo(({ letter, color, startX, startY, fontSize, delay, duration }: ArabicFloatProps) => {
  const posY = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;
  const rot  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      posY.setValue(0); op.setValue(0); rot.setValue(-15 + Math.random() * 30);
      Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(posY, { toValue: -height * 0.28, duration, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(op,  { toValue: 0.18, duration: 600, useNativeDriver: true }),
          Animated.delay(duration - 1100),
          Animated.timing(op,  { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => { posY.stopAnimation(); op.stopAnimation(); };
  }, []);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: "absolute", left: startX, top: startY,
      fontSize, color, fontFamily: "Cairo_700Bold",
      opacity: op,
      transform: [{ translateY: posY }, { rotate: rot.interpolate({ inputRange: [-15, 15], outputRange: ["-15deg", "15deg"] }) }],
    }}>{letter}</Animated.Text>
  );
});

const BG_ARABIC: ArabicFloatProps[] = [
  { letter: "أ", color: LOGO.cyan,   startX: width * 0.08, startY: height * 0.6,  fontSize: 28, delay: 0,    duration: 8000 },
  { letter: "ب", color: LOGO.pink,   startX: width * 0.22, startY: height * 0.72, fontSize: 22, delay: 1200, duration: 7000 },
  { letter: "ح", color: LOGO.purple, startX: width * 0.68, startY: height * 0.58, fontSize: 32, delay: 600,  duration: 9000 },
  { letter: "ر", color: LOGO.yellow, startX: width * 0.82, startY: height * 0.78, fontSize: 24, delay: 2000, duration: 7500 },
  { letter: "و", color: LOGO.cyan,   startX: width * 0.45, startY: height * 0.85, fontSize: 26, delay: 1800, duration: 8500 },
  { letter: "ف", color: LOGO.pink,   startX: width * 0.88, startY: height * 0.62, fontSize: 20, delay: 3000, duration: 6800 },
  { letter: "م", color: LOGO.purple, startX: width * 0.12, startY: height * 0.82, fontSize: 30, delay: 900,  duration: 8200 },
  { letter: "غ", color: LOGO.yellow, startX: width * 0.58, startY: height * 0.7,  fontSize: 22, delay: 2400, duration: 7200 },
  { letter: "ن", color: LOGO.cyan,   startX: width * 0.35, startY: height * 0.68, fontSize: 26, delay: 400,  duration: 9200 },
  { letter: "ك", color: LOGO.pink,   startX: width * 0.75, startY: height * 0.88, fontSize: 28, delay: 1500, duration: 7800 },
];

// ── Logo sparkle ──────────────────────────────────────────────────────────────
type LogoSparkleProps = { symbol: string; color: string; x: number; y: number; delay: number };
const LogoSparkle = memo(({ symbol, color, x, y, delay }: LogoSparkleProps) => {
  const op  = useRef(new Animated.Value(0)).current;
  const scl = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const run = () => {
      op.setValue(0); scl.setValue(0.5);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(op,  { toValue: 0.9, duration: 400, useNativeDriver: true }),
          Animated.timing(scl, { toValue: 1.2, duration: 400, useNativeDriver: true }),
        ]),
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(op,  { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.timing(scl, { toValue: 0.5, duration: 350, useNativeDriver: true }),
        ]),
        Animated.delay(1200 + Math.random() * 800),
      ]).start(() => run());
    };
    run();
    return () => { op.stopAnimation(); scl.stopAnimation(); };
  }, []);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: "absolute", left: x, top: y, fontSize: 14, color,
      opacity: op, transform: [{ scale: scl }],
    }}>{symbol}</Animated.Text>
  );
});

const LOGO_SPARKLES: LogoSparkleProps[] = [
  { symbol: "✦", color: LOGO.cyan,   x: -22, y: 18,  delay: 0    },
  { symbol: "⭐", color: LOGO.yellow, x: -16, y: 65,  delay: 700  },
  { symbol: "✦", color: LOGO.pink,   x: 110, y: -14, delay: 1400 },
  { symbol: "✨", color: LOGO.purple, x: 120, y: 105, delay: 400  },
  { symbol: "✦", color: LOGO.cyan,   x: 125, y: 20,  delay: 1100 },
  { symbol: "⭐", color: LOGO.pink,   x: 118, y: 68,  delay: 900  },
];

// ── Popup panels ──────────────────────────────────────────────────────────────
const POPUP_PANELS = [
  {
    id: "road",
    icon: "📦",
    image: require("@/assets/home-popups/treasure-road.png"),
    title: "طريق الكنز",
    subtitle: "أكمل المراحل واربح جوائز حصرية",
    reward: "🪙 حتى 500 عملة",
    color: "#F59E0B",
    gradientFrom: "#3D1500",
    gradientMid: "#2B1A00",
    onPress: () => router.push("/shop"),
  },
  {
    id: "daily",
    icon: "🎁",
    image: require("@/assets/home-popups/daily-reward.png"),
    title: "مكافأة يومية",
    subtitle: "العب يومياً واحصل على مكافأتك",
    reward: "🎁 مكافأة يومية مجانية",
    color: "#10B981",
    gradientFrom: "#003D20",
    gradientMid: "#002B18",
    onPress: () => router.push("/spin"),
  },
  {
    id: "challenges",
    icon: "🎯",
    image: require("@/assets/home-popups/challenges.png"),
    title: "التحديات",
    subtitle: "أتمم تحديات اليوم واكسب المزيد",
    reward: "⭐ نقاط XP مضاعفة",
    color: "#8B5CF6",
    gradientFrom: "#1E0040",
    gradientMid: "#12002C",
    onPress: () => router.push("/tasks"),
  },
];

// ── Popup particle ────────────────────────────────────────────────────────────
type PopupParticleProps = { symbol: string; color: string; startX: number; delay: number };

function PopupParticle({ symbol, color, startX, delay }: PopupParticleProps) {
  const posY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      posY.setValue(0);
      opacity.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(posY, { toValue: -260, duration: 3400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(opacity, { toValue: 0.95, duration: 350, useNativeDriver: true }),
          Animated.delay(2700),
          Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => { if (finished) loop(); });
    };
    loop();
    return () => { posY.stopAnimation(); opacity.stopAnimation(); };
  }, []);

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: startX,
        bottom: 70,
        fontSize: 15,
        color,
        opacity,
        transform: [{ translateY: posY }],
      }}
    >
      {symbol}
    </Animated.Text>
  );
}

const POPUP_PARTICLE_DEFS: Record<string, PopupParticleProps[]> = {
  road: [
    { symbol: "🪙", color: "#F59E0B", startX: 18,  delay: 0    },
    { symbol: "✦",  color: "#FCD34D", startX: 70,  delay: 500  },
    { symbol: "💰", color: "#F59E0B", startX: 140,  delay: 900  },
    { symbol: "⭐", color: "#FDE68A", startX: 210, delay: 300  },
    { symbol: "✦",  color: "#F59E0B", startX: 50,  delay: 1400 },
    { symbol: "🪙", color: "#FCD34D", startX: 260, delay: 700  },
    { symbol: "✨", color: "#FDE68A", startX: 105,  delay: 1800 },
    { symbol: "💫", color: "#F59E0B", startX: 310, delay: 1100 },
  ],
  daily: [
    { symbol: "✨", color: "#10B981", startX: 18,  delay: 0    },
    { symbol: "⭐", color: "#A3E635", startX: 70,  delay: 500  },
    { symbol: "✦",  color: "#34D399", startX: 140,  delay: 900  },
    { symbol: "💫", color: "#6EE7B7", startX: 210, delay: 300  },
    { symbol: "✨", color: "#10B981", startX: 50,  delay: 1400 },
    { symbol: "⭐", color: "#34D399", startX: 260, delay: 700  },
    { symbol: "✦",  color: "#A3E635", startX: 105,  delay: 1800 },
    { symbol: "💫", color: "#6EE7B7", startX: 310, delay: 1100 },
  ],
  challenges: [
    { symbol: "⭐", color: "#A78BFA", startX: 18,  delay: 0    },
    { symbol: "✦",  color: "#60A5FA", startX: 70,  delay: 500  },
    { symbol: "💫", color: "#C4B5FD", startX: 140,  delay: 900  },
    { symbol: "✨", color: "#818CF8", startX: 210, delay: 300  },
    { symbol: "⭐", color: "#A78BFA", startX: 50,  delay: 1400 },
    { symbol: "✦",  color: "#60A5FA", startX: 260, delay: 700  },
    { symbol: "💫", color: "#C4B5FD", startX: 105,  delay: 1800 },
    { symbol: "✨", color: "#818CF8", startX: 310, delay: 1100 },
  ],
};

// ── Feature popup ─────────────────────────────────────────────────────────────
type PopupPanel = {
  id: string; icon: string; image?: number; title: string; subtitle: string;
  reward: string; color: string; gradientFrom: string; gradientMid: string;
  onPress: () => void;
};

function FeaturePopup({
  panel, idx, popupOpacity, popupScale, onDismiss,
}: {
  panel: PopupPanel;
  idx: number;
  popupOpacity: Animated.Value;
  popupScale: Animated.Value;
  onDismiss: (nav?: () => void) => void;
}) {
  const { theme } = useTheme();
  const particles = POPUP_PARTICLE_DEFS[panel.id] || [];
  const iconY    = useRef(new Animated.Value(0)).current;
  const iconRot  = useRef(new Animated.Value(0)).current;
  const iconGlow = useRef(new Animated.Value(1)).current;
  const btnShine = useRef(new Animated.Value(-160)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (panel.id === "challenges") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconY, { toValue: -10, duration: 340, useNativeDriver: true }),
          Animated.timing(iconY, { toValue: 0,   duration: 340, useNativeDriver: true }),
          Animated.delay(900),
        ])
      ).start();
    } else if (panel.id === "daily") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconRot, { toValue: -12, duration: 80, useNativeDriver: true }),
          Animated.timing(iconRot, { toValue:  12, duration: 80, useNativeDriver: true }),
          Animated.timing(iconRot, { toValue:  -8, duration: 80, useNativeDriver: true }),
          Animated.timing(iconRot, { toValue:   8, duration: 80, useNativeDriver: true }),
          Animated.timing(iconRot, { toValue:   0, duration: 80, useNativeDriver: true }),
          Animated.delay(2000),
        ])
      ).start();
    } else if (panel.id === "road") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconGlow, { toValue: 1.18, duration: 750, useNativeDriver: true }),
          Animated.timing(iconGlow, { toValue: 1,    duration: 750, useNativeDriver: true }),
        ])
      ).start();
    }

    const runShine = () => {
      btnShine.setValue(-160);
      Animated.sequence([
        Animated.timing(btnShine, { toValue: 270, duration: 750, useNativeDriver: true }),
        Animated.delay(2200),
      ]).start(() => runShine());
    };
    runShine();

    Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulse, { toValue: 1.05, duration: 650, useNativeDriver: true }),
        Animated.timing(btnPulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      [iconY, iconRot, iconGlow, btnShine, btnPulse].forEach((a) => a.stopAnimation());
    };
  }, []);

  const iconTransform: any[] =
    panel.id === "challenges" ? [{ translateY: iconY }]
    : panel.id === "daily"    ? [{ rotate: iconRot.interpolate({ inputRange: [-12, 12], outputRange: ["-12deg", "12deg"] }) }]
    :                           [{ scale: iconGlow }];

  return (
    <Animated.View style={[pStyles.overlay, { opacity: popupOpacity, backgroundColor: theme.overlay }]}>
      <View style={pStyles.particlesLayer} pointerEvents="none">
        {particles.map((p, i) => <PopupParticle key={i} {...p} />)}
      </View>

      <Animated.View
        style={[
          pStyles.cardWrapper,
          { transform: [{ scale: popupScale }], shadowColor: panel.color },
        ]}
      >
        <LinearGradient
          colors={[panel.gradientFrom, panel.gradientMid, theme.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[pStyles.card, { borderColor: panel.color + "80", borderBottomColor: panel.color + "CC" }]}
        >
          <TouchableOpacity
            style={pStyles.closeBtn}
            onPress={() => onDismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={20} color={theme.textPrimary} />
          </TouchableOpacity>

          {/* Corner stars */}
          <Text style={{ position: "absolute", top: 14, left: 18, fontSize: 16, opacity: 0.55 }}>✦</Text>
          <Text style={{ position: "absolute", bottom: 80, right: 16, fontSize: 13, opacity: 0.4 }}>✦</Text>

          <View
            style={[
              pStyles.iconCircle,
              {
                backgroundColor: panel.color + "30",
                borderColor: panel.color + "80",
                borderBottomColor: panel.color + "BB",
                shadowColor: panel.color,
              },
            ]}
          >
            {panel.image != null ? (
              <Animated.Image
                source={panel.image}
                style={[pStyles.popupIconImage, { transform: iconTransform }]}
                resizeMode="contain"
              />
            ) : (
              <Animated.Text style={[pStyles.iconEmoji, { transform: iconTransform }]}>
                {panel.icon}
              </Animated.Text>
            )}
          </View>

          <Text style={[pStyles.title, { color: panel.color }]}>{panel.title}</Text>
          <Text style={[pStyles.subtitle, { color: theme.textSecondary }]}>{panel.subtitle}</Text>

          <View
            style={[
              pStyles.rewardBadge,
              { backgroundColor: panel.color + "22", borderColor: panel.color + "65", borderBottomColor: panel.color + "99" },
            ]}
          >
            <Text style={[pStyles.rewardText, { color: panel.color }]}>{panel.reward}</Text>
          </View>

          <View style={pStyles.buttonsRow}>
            <TouchableOpacity style={[pStyles.skipBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => onDismiss()} activeOpacity={0.7}>
              <Text style={[pStyles.skipText, { color: theme.textSecondary }]}>تخطي</Text>
            </TouchableOpacity>

            <Animated.View style={[pStyles.playBtnWrapper, { transform: [{ scale: btnPulse }] }]}>
              <TouchableOpacity
                style={[
                  pStyles.playBtn,
                  { backgroundColor: panel.color, shadowColor: panel.color },
                ]}
                onPress={() => onDismiss(panel.onPress)}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={pStyles.playBtnText}>العب الآن</Text>
                <Animated.View
                  style={[
                    pStyles.shineOverlay,
                    { transform: [{ translateX: btnShine }, { rotate: "20deg" }] },
                  ]}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={pStyles.dotsRow}>
            {POPUP_PANELS.map((_, di) => (
              <View
                key={di}
                style={[pStyles.dot, di === idx && [pStyles.dotActive, { backgroundColor: panel.color }]]}
              />
            ))}
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const pStyles = StyleSheet.create({
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center", alignItems: "center",
    padding: 22,
  },
  particlesLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  cardWrapper: {
    width: "100%",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 30,
    elevation: 30,
  },
  card: {
    width: "100%", borderRadius: 30, padding: 26,
    alignItems: "center", borderWidth: 3.5,
    borderBottomWidth: 6,
  },
  closeBtn: {
    position: "absolute", top: 14, right: 14, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.18)",
  },
  iconCircle: {
    width: 110, height: 110, borderRadius: 30,
    justifyContent: "center", alignItems: "center",
    marginBottom: 18, marginTop: 10,
    borderWidth: 3.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 20,
    elevation: 16,
  },
  iconEmoji: { fontSize: 56 },
  popupIconImage: { width: 82, height: 82 },
  title: {
    fontFamily: "Cairo_700Bold", fontSize: 26,
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Cairo_400Regular", fontSize: 13,
    color: "#AAAACC", textAlign: "center",
    marginBottom: 16, lineHeight: 22,
  },
  rewardBadge: {
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 22, borderWidth: 2.5, marginBottom: 24,
    borderBottomWidth: 4,
  },
  rewardText: { fontFamily: "Cairo_700Bold", fontSize: 15 },
  buttonsRow: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 20 },
  skipBtn: {
    flex: 1, minHeight: 52, justifyContent: "center", borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.18)",
    borderBottomWidth: 4, borderBottomColor: "rgba(0,0,0,0.3)",
  },
  skipText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#9898CC" },
  playBtnWrapper: { flex: 2 },
  playBtn: {
    flex: 1, minHeight: 52, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.65, shadowRadius: 16, elevation: 12,
  },
  playBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },
  shineOverlay: {
    position: "absolute",
    top: -20, width: 22, height: 80,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 4,
  },
  dotsRow: { flexDirection: "row", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.18)" },
  dotActive: { width: 24, borderRadius: 4 },
});

// ── Game mode type ────────────────────────────────────────────────────────────
type GameMode = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  image: number;
  gradient: string[];
  accent: string;
  onPress: () => void;
};

// ── Shared card constants ─────────────────────────────────────────────────────
const ICON_SZ    = 68;
const ICON_OUTER = ICON_SZ + 24;

// Deterministic background dot positions
const DOT_CFG = Array.from({ length: 8 }, (_, i) => ({
  x:   ((i * 47 + 18) % (CARD_WIDTH - 24)) + 12,
  bot: ((i * 31) % 30) + 4,
  sz:  1.5 + (i % 3),
  del: i * 320,
}));

// ── Shared card StyleSheet ─────────────────────────────────────────────────────
const cSt = StyleSheet.create({
  shineBar:  { position: "absolute", top: -30, width: 26, height: "160%" as any, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 6 },
  btnWrap:   { marginTop: 6, width: "100%" },
  btnShine:  { position: "absolute", top: -14, width: 18, height: 56, backgroundColor: "rgba(255,255,255,0.30)", borderRadius: 4 },
  iconOuter: { width: ICON_OUTER, height: ICON_OUTER, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  iconCircle:{ width: ICON_SZ, height: ICON_SZ, borderRadius: ICON_SZ / 2, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  iconGlow:  { position: "absolute", width: ICON_OUTER, height: ICON_OUTER, borderRadius: ICON_OUTER / 2, opacity: 0.55 },
  sparkle:   { position: "absolute", fontSize: 9 },
  inner:     { paddingHorizontal: 20, paddingVertical: 22, alignItems: "center", gap: 6, minHeight: 210, justifyContent: "center" },
});

// ── Background floating dot ────────────────────────────────────────────────────
const CardDot = memo(({ x, bot, sz, del, accent }: { x: number; bot: number; sz: number; del: number; accent: string }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      a.setValue(0);
      Animated.sequence([
        Animated.delay(del),
        Animated.timing(a, { toValue: 1, duration: 3000 + sz * 400, easing: Easing.linear, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => a.stopAnimation();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left: x, bottom: bot, width: sz, height: sz, borderRadius: sz / 2,
      backgroundColor: accent,
      opacity: a.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.5, 0.4, 0] }),
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -110] }) }],
    }} />
  );
});

// ── Quick Match icon ───────────────────────────────────────────────────────────
const QuickIcon = memo(({ accent }: { accent: string }) => {
  const flicker = useRef(new Animated.Value(1)).current;
  const glowScl = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const runFlick = () => {
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0.55, duration: 55, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1,    duration: 55, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.70, duration: 40, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1,    duration: 40, useNativeDriver: true }),
        Animated.delay(3200),
      ]).start(() => runFlick());
    };
    runFlick();
    Animated.loop(Animated.sequence([
      Animated.timing(glowScl, { toValue: 1.22, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowScl, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    return () => [flicker, glowScl].forEach(a => a.stopAnimation());
  }, []);
  return (
    <View style={cSt.iconOuter}>
      <Animated.View style={[cSt.iconGlow, { backgroundColor: accent + "30", transform: [{ scale: glowScl }] }]} />
      <LinearGradient colors={[accent + "55", accent + "28"]} style={cSt.iconCircle}>
        <Animated.View style={{ opacity: flicker }}>
          <Ionicons name="flash" size={36} color={accent} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
});

// ── Fast Mode icon ─────────────────────────────────────────────────────────────
const FastIcon = memo(({ accent }: { accent: string }) => {
  const bobY   = useRef(new Animated.Value(0)).current;
  const fScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue: -5, duration: 560, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bobY, { toValue: 0,  duration: 560, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(fScale, { toValue: 1.35, duration: 190, useNativeDriver: true }),
      Animated.timing(fScale, { toValue: 0.75, duration: 190, useNativeDriver: true }),
      Animated.timing(fScale, { toValue: 1.0,  duration: 190, useNativeDriver: true }),
    ])).start();
    return () => [bobY, fScale].forEach(a => a.stopAnimation());
  }, []);
  return (
    <View style={cSt.iconOuter}>
      <LinearGradient colors={[accent + "55", accent + "28"]} style={cSt.iconCircle}>
        <Animated.View style={{ transform: [{ translateY: bobY }, { rotate: "-42deg" }] }}>
          <Ionicons name="rocket" size={32} color={accent} />
        </Animated.View>
        <Animated.Text pointerEvents="none" style={{ position: "absolute", bottom: 4, fontSize: 10, transform: [{ scale: fScale }] }}>🔥</Animated.Text>
      </LinearGradient>
    </View>
  );
});

// ── Friends icon ───────────────────────────────────────────────────────────────
const FriendsIcon = memo(({ accent }: { accent: string }) => {
  const bounce = useRef(new Animated.Value(0)).current;
  const glowScl = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const runBounce = () => {
      Animated.sequence([
        Animated.spring(bounce, { toValue: -8, tension: 450, friction: 8, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 0,  tension: 450, friction: 8, useNativeDriver: true }),
        Animated.delay(3000),
      ]).start(() => runBounce());
    };
    runBounce();
    Animated.loop(Animated.sequence([
      Animated.timing(glowScl, { toValue: 1.20, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowScl, { toValue: 1,    duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    return () => [bounce, glowScl].forEach(a => a.stopAnimation());
  }, []);
  return (
    <View style={cSt.iconOuter}>
      <Animated.View style={[cSt.iconGlow, { backgroundColor: accent + "28", transform: [{ scale: glowScl }] }]} />
      <LinearGradient colors={[accent + "55", accent + "28"]} style={cSt.iconCircle}>
        <Animated.View style={{ transform: [{ translateY: bounce }] }}>
          <Ionicons name="people" size={36} color={accent} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
});

// ── Tournament icon ────────────────────────────────────────────────────────────
const SPARKLE_OFF = [
  { dx: 40, dy: 0 }, { dx: 20, dy: -36 }, { dx: -20, dy: -36 },
  { dx: -40, dy: 0 }, { dx: -20, dy: 36 }, { dx: 20, dy: 36 },
];
const TrophySparkle = memo(({ dx, dy, delay, accent }: { dx: number; dy: number; delay: number; accent: string }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      a.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(a, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(1100),
      ]).start(() => run());
    };
    run();
    return () => a.stopAnimation();
  }, []);
  const cx = ICON_OUTER / 2 + dx - 5;
  const cy = ICON_OUTER / 2 + dy - 5;
  return (
    <Animated.Text style={[cSt.sparkle, {
      left: cx, top: cy, color: accent, opacity: a,
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] }) }],
    }]}>✦</Animated.Text>
  );
});
const TrophyIcon = memo(({ accent }: { accent: string }) => {
  const shineX = useRef(new Animated.Value(-50)).current;
  useEffect(() => {
    const run = () => {
      shineX.setValue(-50);
      Animated.sequence([
        Animated.timing(shineX, { toValue: 90, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(2800),
      ]).start(() => run());
    };
    run();
    return () => shineX.stopAnimation();
  }, []);
  return (
    <View style={cSt.iconOuter}>
      <LinearGradient colors={[accent + "55", accent + "28"]} style={[cSt.iconCircle, { overflow: "hidden" }]}>
        <Ionicons name="trophy" size={36} color={accent} />
        <Animated.View pointerEvents="none" style={[cSt.btnShine, { transform: [{ translateX: shineX }, { rotate: "20deg" }], backgroundColor: "rgba(255,255,255,0.36)" }]} />
      </LinearGradient>
      {SPARKLE_OFF.map((o, i) => <TrophySparkle key={i} dx={o.dx} dy={o.dy} delay={i * 280} accent={accent} />)}
    </View>
  );
});

// ── AI icon ────────────────────────────────────────────────────────────────────
const AI_DOTS = [{ r: 8, b: 7 }, { r: 15, b: 5 }, { r: 22, b: 9 }];
const AIIcon = memo(({ accent }: { accent: string }) => {
  const blink    = useRef(new Animated.Value(1)).current;
  const dotPhase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const runBlink = () => {
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.05, duration: 65, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1,    duration: 65, useNativeDriver: true }),
        Animated.delay(3800),
      ]).start(() => runBlink());
    };
    runBlink();
    Animated.loop(Animated.timing(dotPhase, { toValue: 3, duration: 1100, easing: Easing.linear, useNativeDriver: false })).start();
    return () => [blink, dotPhase].forEach(a => a.stopAnimation());
  }, []);
  return (
    <View style={cSt.iconOuter}>
      <LinearGradient colors={[accent + "55", accent + "28"]} style={cSt.iconCircle}>
        <Animated.View style={{ opacity: blink }}>
          <MaterialCommunityIcons name="robot" size={38} color={accent} />
        </Animated.View>
        {AI_DOTS.map((d, i) => (
          <Animated.View key={i} style={{
            position: "absolute", right: d.r, bottom: d.b, width: 4, height: 4, borderRadius: 2,
            backgroundColor: accent,
            opacity: dotPhase.interpolate({ inputRange: [i, i + 0.5, i + 1, 3], outputRange: [0, 0.9, 0, 0], extrapolate: "clamp" }),
          }} />
        ))}
      </LinearGradient>
    </View>
  );
});

// ── Icon map ───────────────────────────────────────────────────────────────────
type IconFC = React.MemoExoticComponent<(p: { accent: string }) => React.JSX.Element>;
const MODE_ICONS: Record<string, IconFC> = {
  quick: QuickIcon, rapid: FastIcon, friends: FriendsIcon, tournament: TrophyIcon, ai: AIIcon,
};

// ── Mode card ─────────────────────────────────────────────────────────────────
const ModeCard = memo(({ item, index, isActive, isDark, theme }: {
  item: GameMode; index: number; isActive: boolean; isDark: boolean; theme: any;
}) => {
  const pressScl  = useRef(new Animated.Value(1)).current;
  const activeScl = useRef(new Animated.Value(isActive ? 1.04 : 0.94)).current;
  const cardShine = useRef(new Animated.Value(-CARD_WIDTH)).current;
  const btnPulse  = useRef(new Animated.Value(1)).current;
  const btnShine  = useRef(new Animated.Value(-120)).current;
  const entrY     = useRef(new Animated.Value(50)).current;
  const entrOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 90),
      Animated.parallel([
        Animated.spring(entrY, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(entrOp, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();

    const runShine = () => {
      cardShine.setValue(-CARD_WIDTH * 0.6);
      Animated.sequence([
        Animated.timing(cardShine, { toValue: CARD_WIDTH * 1.6, duration: 820, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(4600 + index * 700),
      ]).start(() => runShine());
    };
    const t0 = setTimeout(() => runShine(), index * 500 + 700);

    Animated.loop(Animated.sequence([
      Animated.timing(btnPulse, { toValue: 1.06, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(btnPulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    const runBtnShine = () => {
      btnShine.setValue(-120);
      Animated.sequence([
        Animated.timing(btnShine, { toValue: 230, duration: 660, useNativeDriver: true }),
        Animated.delay(2700 + index * 300),
      ]).start(() => runBtnShine());
    };
    runBtnShine();

    return () => {
      clearTimeout(t0);
      [pressScl, activeScl, cardShine, btnPulse, btnShine, entrY, entrOp].forEach(a => a.stopAnimation());
    };
  }, []);

  useEffect(() => {
    Animated.spring(activeScl, {
      toValue: isActive ? 1.04 : 0.93,
      tension: 160, friction: 12, useNativeDriver: true,
    }).start();
  }, [isActive]);

  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(pressScl, { toValue: 0.96, tension: 320, friction: 10, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressScl, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
  };

  const Icon = MODE_ICONS[item.id] ?? QuickIcon;

  const cardGrad: [string, string, string] = [item.accent + "50", item.accent + "28", "#0A0A1E"];

  return (
    <Animated.View style={{
      width: CARD_WIDTH, marginHorizontal: CARD_MARGIN,
      opacity: entrOp, borderRadius: 26,
      shadowColor: item.accent,
      shadowOffset: { width: 0, height: isActive ? 14 : 6 },
      shadowOpacity: isActive ? 0.60 : 0.25,
      shadowRadius: isActive ? 26 : 10,
      elevation: isActive ? 20 : 6,
      transform: [{ translateY: entrY }, { scale: Animated.multiply(pressScl, activeScl) as any }],
    }}>
      {/* 3D base layer */}
      <View style={{
        position: "absolute", bottom: -6, left: 8, right: 8, height: 14,
        borderRadius: 20, backgroundColor: item.accent + "35",
      }} />
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={item.onPress}
        activeOpacity={0.92}
        style={{
          borderRadius: 26, overflow: "hidden",
          borderWidth: 3,
          borderColor: isActive ? item.accent + "CC" : item.accent + "70",
          borderBottomWidth: 5,
          borderBottomColor: item.accent + "FF",
        }}
      >
        <LinearGradient
          colors={cardGrad}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top accent stripe */}
        <LinearGradient
          colors={[item.accent + "90", item.accent + "30"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        />

        {/* Corner stars */}
        <Text pointerEvents="none" style={{ position: "absolute", top: 8, right: 10, fontSize: 12, opacity: 0.6 }}>✦</Text>
        <Text pointerEvents="none" style={{ position: "absolute", bottom: 40, left: 8, fontSize: 10, opacity: 0.4 }}>✦</Text>

        {/* Gloss sweep */}
        <Animated.View
          pointerEvents="none"
          style={[cSt.shineBar, { transform: [{ translateX: cardShine }, { rotate: "20deg" }] }]}
        />

        {/* Tiny floating dots */}
        {DOT_CFG.map((d, i) => (
          <CardDot key={i} x={d.x} bot={d.bot} sz={d.sz} del={d.del} accent={item.accent} />
        ))}

        {/* Content */}
        <View style={cSt.inner}>
          {/* Mode icon pill */}
          <View style={{
            backgroundColor: item.accent + "30",
            borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10,
            borderWidth: 2.5, borderColor: item.accent + "80",
            borderBottomWidth: 4, borderBottomColor: item.accent + "CC",
            marginBottom: 4,
            alignItems: "center", justifyContent: "center",
          }}>
            <Image source={item.image} style={styles.modeCardImage} resizeMode="contain" />
          </View>

          <Text style={[styles.modeTitle, { color: "#fff", marginTop: 6 }]}>{item.title}</Text>
          <Text style={[styles.modeSubtitle, { color: item.accent + "CC" }]}>{item.subtitle}</Text>

          {/* Play button */}
          <Animated.View style={[cSt.btnWrap, { transform: [{ scale: btnPulse }] }]}>
            <LinearGradient
              colors={[item.accent, item.accent + "CC"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.modePlayBtn, {
                overflow: "hidden",
                shadowColor: item.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.6,
                shadowRadius: 10,
                elevation: 8,
                width: "100%",
                justifyContent: "center",
              }]}
            >
              <Ionicons name="play-circle" size={19} color="#fff" />
              <Text style={styles.modePlayText}>العب الآن</Text>
              <Animated.View
                pointerEvents="none"
                style={[cSt.btnShine, { transform: [{ translateX: btnShine }, { rotate: "20deg" }] }]}
              />
            </LinearGradient>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Home screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { profile, playerId, claimLoginReward } = usePlayer();
  const { theme, isDark } = useTheme();
  const [showLoginReward, setShowLoginReward] = useState(false);
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [tournamentWins, setTournamentWins] = useState(0);
  const [currentPopupIdx, setCurrentPopupIdx] = useState<number | null>(null);
  const [pendingGiftsCount, setPendingGiftsCount] = useState(0);
  const [dailyCountdown, setDailyCountdown] = useState("");
  const hasShownPopup = useRef(false);
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const popupScale = useRef(new Animated.Value(0.85)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const NAV_BAR_HEIGHT = 60 + bottomInset;

  useEffect(() => {
    if (!playerId) return;
    const pollGifts = async () => {
      try {
        const url = new URL(`/api/friends/gifts/pending/${playerId}`, getApiUrl());
        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setPendingGiftsCount(Array.isArray(data) ? data.length : 0);
        }
      } catch {}
    };
    pollGifts();
    const interval = setInterval(pollGifts, 20_000);
    return () => clearInterval(interval);
  }, [playerId]);

  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];

  const showPopupAt = (idx: number) => {
    popupOpacity.setValue(0);
    popupScale.setValue(0.85);
    setCurrentPopupIdx(idx);
  };

  useEffect(() => {
    if (currentPopupIdx === null) return;
    Animated.parallel([
      Animated.timing(popupOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(popupScale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [currentPopupIdx]);

  // Show daily login reward after profile loads
  useEffect(() => {
    const last = profile.lastLoginRewardAt ? new Date(profile.lastLoginRewardAt).getTime() : 0;
    const eligible = Date.now() - last >= 24 * 60 * 60 * 1000;
    if (eligible) {
      const timer = setTimeout(() => setShowLoginReward(true), 800);
      return () => clearTimeout(timer);
    }
  }, [profile.lastLoginRewardAt]);

  const dismissPopup = (fromIdx: number, onNavigate?: () => void) => {
    Animated.parallel([
      Animated.timing(popupOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(popupScale, { toValue: 0.88, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setCurrentPopupIdx(null);
      if (onNavigate) {
        onNavigate();
        return;
      }
      const nextIdx = fromIdx + 1;
      if (nextIdx < POPUP_PANELS.length) {
        setTimeout(() => showPopupAt(nextIdx), 500);
      }
    });
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -7, duration: 2400, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => {
      if (!hasShownPopup.current) {
        hasShownPopup.current = true;
        showPopupAt(0);
      }
    }, 500);

    (async () => {
      try {
        const { getApiUrl } = await import("@/lib/query-client");
        const res = await fetch(new URL(`/api/player/${playerId}/tournaments`, getApiUrl()).toString());
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (data.tournaments || []);
          const wins = arr.filter((t: { placement: number | null }) => t.placement === 1).length;
          setTournamentWins(wins);
        }
      } catch {}
    })();

    const updateDailyCountdown = () => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDailyCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    updateDailyCountdown();
    const countdownInterval = setInterval(updateDailyCountdown, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleQuickMatchPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/league");
  };

  const gameModes: GameMode[] = [
    {
      id: "quick",
      title: "مباراة سريعة",
      subtitle: "العب فوراً وكسب العملات",
      emoji: "⚡",
      image: require("@/assets/game-modes/quick-match.png"),
      gradient: [Colors.gold + "30", Colors.gold + "10"],
      accent: LOGO.yellow,
      onPress: handleQuickMatchPress,
    },
    {
      id: "rapid",
      title: "الوضع السريع",
      subtitle: "أول كلمة صحيحة تربح — 10 ثوانٍ فقط!",
      emoji: "🚀",
      image: require("@/assets/game-modes/rapid-mode.png"),
      gradient: [Colors.ruby + "30", Colors.ruby + "10"],
      accent: "#FF5733",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/rapid"); },
    },
    {
      id: "friends",
      title: "مع الأصدقاء",
      subtitle: "أنشئ غرفة وادعُ أصدقاءك للمنافسة",
      emoji: "👥",
      image: require("@/assets/game-modes/friends.png"),
      gradient: [Colors.emerald + "30", Colors.emerald + "10"],
      accent: "#22C55E",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/lobby"); },
    },
    {
      id: "tournament",
      title: "البطولات",
      subtitle: "8 لاعبين — جولات إقصائية وجوائز كبرى",
      emoji: "🏆",
      image: require("@/assets/game-modes/tournament.png"),
      gradient: ["#7C3AED30", "#7C3AED10"],
      accent: LOGO.purple,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/tournament"); },
    },
    {
      id: "ai",
      title: "ضد الذكاء الاصطناعي",
      subtitle: "تحدّى الذكاء الاصطناعي بمستويات متعددة",
      emoji: "🤖",
      image: require("@/assets/game-modes/ai-bot.png"),
      gradient: ["#0EA5E930", "#0EA5E910"],
      accent: LOGO.cyan,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/ai-game"); },
    },
    {
      id: "daily",
      title: "تحدي اليوم",
      subtitle: "6 محاولات لتخمين الكلمة — مع لاعبين حول العالم",
      emoji: "🌍",
      image: require("@/assets/game-modes/daily-challenge.png"),
      gradient: ["#F59E0B30", "#10B98110"],
      accent: "#10B981",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/daily-challenge"); },
    },
    {
      id: "word-chain",
      title: "سلسلة الكلمات",
      subtitle: "كل كلمة تبدأ من آخر حرف السابقة — من يتوقف يخسر!",
      emoji: "🔗",
      image: require("@/assets/game-modes/word-chain.png"),
      gradient: ["#8B5CF630", "#8B5CF610"],
      accent: "#8B5CF6",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/word-chain"); },
    },
  ];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / (CARD_WIDTH + CARD_MARGIN * 2));
    setActiveModeIdx(Math.max(0, Math.min(idx, gameModes.length - 1)));
  };

  const streakIcon = profile.winStreak >= 10 ? "🔥🔥🔥" : profile.winStreak >= 5 ? "🔥🔥" : profile.winStreak >= 3 ? "🔥" : "";

  return (
    <ImageBackground source={BG_HOME} style={styles.container} resizeMode="cover">
      {/* Colorful gradient background */}
      <LinearGradient
        colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.58)", "rgba(0,0,0,0.72)"]}
        start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Abstract background blobs (dark mode only) */}
      {isDark && BG_BLOBS.map((b, i) => (
        <View key={i} pointerEvents="none" style={{
          position: "absolute",
          ...(b.top !== undefined ? { top: b.top } : {}),
          ...("left" in b ? { left: (b as any).left } : { right: (b as any).right }),
          width: b.size, height: b.size, borderRadius: b.size / 2,
          backgroundColor: b.color,
        }} />
      ))}

      {/* Floating background particles (dark mode only) */}
      {isDark && BG_PARTICLES.map((p, i) => <BgParticle key={i} {...p} />)}
      {/* Floating Arabic letters */}
      {isDark && BG_ARABIC.map((a, i) => <ArabicLetterFloat key={i} {...a} />)}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + 8, paddingBottom: NAV_BAR_HEIGHT + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ─────────────────────────────────────── */}
        <View style={styles.topBar}>
          {/* Left cluster: avatar + store */}
          <View style={styles.topLeft}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/profile"); }}
              activeOpacity={0.8}
            >
              {(() => {
                const skinRarityColors: Record<string, string> = { common: "#00F5FF", rare: "#BF00FF", epic: "#FF006E", legendary: "#F5C842" };
                const skinRingColor = skinRarityColors[equippedSkin.rarity] || "#00F5FF";
                const isSpecialRarity = equippedSkin.rarity !== "common";
                return (
                  <View style={[styles.avatarCircle, {
                    borderWidth: isSpecialRarity ? 2 : 1.5,
                    borderColor: skinRingColor + (equippedSkin.rarity === "legendary" ? "CC" : equippedSkin.rarity === "epic" ? "99" : "60"),
                    shadowColor: skinRingColor,
                    shadowOpacity: equippedSkin.rarity === "legendary" ? 0.55 : equippedSkin.rarity === "epic" ? 0.35 : equippedSkin.rarity === "rare" ? 0.20 : 0,
                    shadowRadius: equippedSkin.rarity === "legendary" ? 12 : equippedSkin.rarity === "epic" ? 8 : 4,
                    shadowOffset: { width: 0, height: 0 }, elevation: isSpecialRarity ? 6 : 1,
                    backgroundColor: equippedSkin.color + "33",
                  }]}>
                    <Image source={equippedSkin.image} style={styles.avatarImage} resizeMode="contain" />
                  </View>
                );
              })()}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/shop"); }}
              activeOpacity={0.8}
              style={styles.storeBtn}
            >
              <Image source={require("@/assets/shop-tabs/store.png")} style={{ width: 24, height: 24 }} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          {/* Right cluster: coins + settings */}
          <View style={styles.topRight}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/shop"); }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[LOGO.yellow + "30", LOGO.yellow + "18"]}
                style={styles.coinsBadge}
              >
                <Ionicons name="star" size={14} color={LOGO.yellow} />
                <Text style={styles.coinsText}>{profile.coins}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: theme.card }]} onPress={() => router.push("/settings")}>
              <Ionicons name="settings-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── WIN STREAK ──────────────────────────────────── */}
        {profile.winStreak >= 2 && (
          <View style={styles.streakBar}>
            <Ionicons name="flame" size={18} color={Colors.ruby} />
            <Text style={styles.streakText}>{streakIcon} سلسلة {profile.winStreak} انتصارات</Text>
            {profile.winStreak >= 3 && (
              <View style={styles.streakRewardHint}>
                <Text style={styles.streakRewardHintText}>
                  {profile.winStreak < 5 ? "3 ← +50🪙" : profile.winStreak < 10 ? "5 ← +100🪙" : "10 ← +300🪙"} ✓
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── LOGO ────────────────────────────────────────── */}
        <Animated.View style={[styles.logoContainer, { transform: [{ translateY: floatAnim }] }]}>
          {LOGO_SPARKLES.map((s, i) => <LogoSparkle key={i} {...s} />)}
          <View style={styles.logoGlowRing} />
          <Text style={styles.logoLetter}>ح</Text>
          <Text style={styles.appSubtitle}>{t.homeSubtitle}</Text>
        </Animated.View>

        {/* ── GAME MODES CAROUSEL ─────────────────────────── */}
        <View style={styles.carouselSection}>
          <Text style={[styles.carouselTitle, { color: theme.textPrimary }]}>اختر وضع اللعب</Text>
          <FlatList
            ref={carouselRef}
            data={gameModes}
            horizontal
            pagingEnabled={false}
            snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ModeCard item={item} index={index} isActive={activeModeIdx === index} isDark={isDark} theme={theme} />
            )}
          />
          <View style={styles.dotsRow}>
            {gameModes.map((m, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.15)" },
                  activeModeIdx === idx && [styles.dotActive, { backgroundColor: gameModes[idx].accent }],
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── STATS ROW ───────────────────────────────────── */}
        <LinearGradient
          colors={[LOGO.cyan + "18", LOGO.purple + "14", LOGO.pink + "10"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.statsRow}
        >
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>🎮 {profile.gamesPlayed}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>مباريات</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>🏆 {profile.wins}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>انتصارات</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>⭐ {profile.totalScore}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>نقاط</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>🔥 {profile.bestStreak}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>سلسلة</Text>
          </View>
          {tournamentWins > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.gold }]}>🏅 {tournamentWins}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>بطولات</Text>
              </View>
            </>
          )}
        </LinearGradient>

        {/* ── DAILY CHALLENGE BANNER ──────────────────── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/daily-challenge"); }}
          style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 6 }}
        >
          <View style={{
            position: "absolute", bottom: -4, left: 8, right: 8, height: 10,
            borderRadius: 16, backgroundColor: "#10B98130",
          }} />
          <LinearGradient
            colors={["#002A18", "#005030", "#002A18"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14,
              borderRadius: 20, borderWidth: 2.5, borderColor: "#10B98165",
              borderBottomWidth: 4, borderBottomColor: "#10B98190",
              gap: 12,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 13, backgroundColor: "#10B98125",
              borderWidth: 1.5, borderColor: "#10B98155", alignItems: "center", justifyContent: "center",
            }}>
              <Image source={require("@/assets/banners/daily-challenge.png")} style={{ width: 36, height: 36 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" }}>🗓 تحدي اليوم</Text>
              <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                6 محاولات لتخمين الكلمة العربية
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 3 }}>
              <View style={{ backgroundColor: "#10B98130", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#10B98155" }}>
                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 11, color: "#10B981" }}>⏱ {dailyCountdown}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#10B981" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── BATTLE PASS BANNER ──────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/battle-pass"); }}
          style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 6 }}
        >
          <View style={{
            position: "absolute", bottom: -4, left: 8, right: 8, height: 10,
            borderRadius: 16, backgroundColor: "#00CFFF25",
          }} />
          <LinearGradient
            colors={["#00243F", "#004A80", "#00243F"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14,
              borderRadius: 20, borderWidth: 2.5, borderColor: "#00CFFF65",
              borderBottomWidth: 4, borderBottomColor: "#00CFFF90",
              gap: 12,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 13, backgroundColor: "#00CFFF20",
              borderWidth: 2, borderColor: "#00CFFF55", alignItems: "center", justifyContent: "center",
            }}>
              <Image source={require("@/assets/banners/battle-pass.png")} style={{ width: 36, height: 36 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" }}>🎯 باس الموسم</Text>
              <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>30 مكافأة • العب واكسب XP</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#00CFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── CLAN WARS BANNER ────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/clans"); }}
          style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 12 }}
        >
          <View style={{
            position: "absolute", bottom: -4, left: 8, right: 8, height: 10,
            borderRadius: 16, backgroundColor: "#BF00FF25",
          }} />
          <LinearGradient
            colors={["#250050", "#4A0099", "#250050"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14,
              borderRadius: 20, borderWidth: 2.5, borderColor: "#BF00FF65",
              borderBottomWidth: 4, borderBottomColor: "#BF00FF90",
              gap: 12,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 13, backgroundColor: "#BF00FF20",
              borderWidth: 1.5, borderColor: "#BF00FF55", alignItems: "center", justifyContent: "center",
            }}>
              <Image source={require("@/assets/banners/clan-wars.png")} style={{ width: 36, height: 36 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" }}>⚡ حروب العصابات</Text>
              <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>انضم أو أنشئ عصابة وتنافس أسبوعياً</Text>
            </View>
            <View style={{
              backgroundColor: "#BF00FF25", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
              borderWidth: 1.5, borderColor: "#BF00FF55", alignItems: "center",
            }}>
              <Ionicons name="chevron-forward" size={20} color="#BF00FF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ── BOTTOM NAVIGATION ───────────────────────────── */}
      <LinearGradient
        colors={isDark ? ["rgba(10,8,26,0.98)", "rgba(16,10,38,1.0)"] : [theme.card + "FA", theme.backgroundSecondary + "FA"]}
        style={[styles.bottomNav, { paddingBottom: bottomInset, height: NAV_BAR_HEIGHT }]}
      >
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/leaderboard")} activeOpacity={0.7}>
          <Ionicons name="podium" size={24} color={LOGO.green} />
          <Text style={[styles.navLabel, { color: LOGO.green }]}>المتصدرون</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/friends")} activeOpacity={0.7}>
          <View style={{ position: "relative" }}>
            <Ionicons name="people" size={24} color={LOGO.pink} />
            {pendingGiftsCount > 0 && (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{pendingGiftsCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navLabel, { color: LOGO.pink }]}>الأصدقاء</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={() => {}} activeOpacity={0.9}>
          <LinearGradient
            colors={[LOGO.yellow, "#E6A800"]}
            style={styles.navHomeBtn}
          >
            <Ionicons name="home" size={26} color="#000" />
          </LinearGradient>
          <Text style={[styles.navLabel, { color: LOGO.yellow }]}>الرئيسية</Text>
          <View style={[styles.navActiveIndicator, { backgroundColor: LOGO.yellow }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/tasks")} activeOpacity={0.7}>
          <Ionicons name="star" size={24} color={LOGO.purple} />
          <Text style={[styles.navLabel, { color: LOGO.purple }]}>المهام</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/achievements")} activeOpacity={0.7}>
          <Ionicons name="trophy" size={24} color={LOGO.yellow} />
          <Text style={[styles.navLabel, { color: LOGO.yellow }]}>الإنجازات</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── SEQUENTIAL POPUP OVERLAY ────────────────────── */}
      {currentPopupIdx !== null && (
        <FeaturePopup
          key={currentPopupIdx}
          panel={POPUP_PANELS[currentPopupIdx] as PopupPanel}
          idx={currentPopupIdx}
          popupOpacity={popupOpacity}
          popupScale={popupScale}
          onDismiss={(nav) => dismissPopup(currentPopupIdx, nav)}
        />
      )}

      {/* Daily Login Reward Popup */}
      {showLoginReward && (
        <LoginRewardPopup
          onClaim={() => {
            claimLoginReward();
            setShowLoginReward(false);
          }}
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, alignItems: "center" },

  topBar: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
    paddingVertical: 4,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  storeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(245,200,66,0.12)", justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(245,200,66,0.35)",
    borderBottomWidth: 3, borderBottomColor: "rgba(245,200,66,0.15)",
  },

  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  coinsBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 22, gap: 5,
    borderWidth: 2, borderColor: LOGO.yellow + "60",
    borderBottomWidth: 3, borderBottomColor: "#C4A010",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: LOGO.yellow },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.18)",
    borderBottomWidth: 3, borderBottomColor: "rgba(255,255,255,0.08)",
  },

  streakBar: {
    width: "100%", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.ruby + "22", borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
    borderWidth: 2.5, borderColor: Colors.ruby + "55",
    borderBottomWidth: 4, borderBottomColor: Colors.ruby + "80",
  },
  streakText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#FF6B6B", flex: 1 },
  streakRewardHint: {
    backgroundColor: Colors.ruby + "28", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1.5, borderColor: Colors.ruby + "55",
  },
  streakRewardHintText: { fontFamily: "Cairo_700Bold", fontSize: 10, color: Colors.ruby },

  logoContainer: { alignItems: "center", marginBottom: 2, position: "relative", paddingHorizontal: 20 },
  logoGlowRing: {
    position: "absolute",
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: LOGO.cyan + "1E",
  },
  logoLetter: {
    fontFamily: "Cairo_700Bold",
    fontSize: 64,
    color: LOGO.cyan,
    textAlign: "center",
    lineHeight: 74,
  },
  appSubtitle: {
    fontFamily: "Cairo_600SemiBold", fontSize: 13,
    color: LOGO.cyan, textAlign: "center", marginTop: 2,
    letterSpacing: 0.5, opacity: 0.9,
  },

  carouselSection: { width: "100%", marginBottom: 16, marginHorizontal: -16 },
  carouselTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 15,
    color: LOGO.purple,
    marginBottom: 12, textAlign: "right", paddingHorizontal: 16,
  },
  carouselContent: { paddingHorizontal: Math.max(0, Math.round((width - CARD_WIDTH) / 2 - CARD_MARGIN)) },
  modeCardImage: { width: 52, height: 52 },
  modeTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "center" },
  modeSubtitle: {
    fontFamily: "Cairo_400Regular", fontSize: 12,
    textAlign: "center",
    lineHeight: 18, marginTop: 2,
  },
  modePlayBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 20, paddingVertical: 16, borderRadius: 20,
    borderBottomWidth: 4,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.20)",
  },
  modePlayText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#fff" },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.20)" },
  dotActive: { width: 20, borderRadius: 3 },

  statsRow: {
    flexDirection: "row", borderRadius: 20,
    paddingVertical: 10, paddingHorizontal: 8, width: "100%",
    borderWidth: 2.5, borderColor: LOGO.cyan + "45",
    borderBottomWidth: 4, borderBottomColor: LOGO.cyan + "65",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#E8E8FF" },
  statLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#8888CC", marginTop: 1 },
  statDivider: { width: 2, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 4, borderRadius: 1 },

  bottomNav: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around",
    borderTopWidth: 1, borderTopColor: LOGO.purple + "22",
    paddingTop: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.30, shadowRadius: 18, elevation: 28,
  },
  navItem: { alignItems: "center", gap: 3, flex: 1 },
  navItemCenter: { alignItems: "center", gap: 3, flex: 1, marginTop: -20 },
  navBadge: {
    position: "absolute", top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#FF006E", justifyContent: "center", alignItems: "center",
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#0A0A1A",
  },
  navBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 9, color: "#fff" },
  navHomeBtn: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.25)",
    borderBottomWidth: 5, borderBottomColor: "#C4A010",
    shadowColor: LOGO.yellow, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65, shadowRadius: 14, elevation: 16,
  },
  navLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10 },
  navActiveIndicator: {
    width: 20, height: 2, borderRadius: 1, marginTop: 2,
    opacity: 0.85,
  },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#160D33", borderRadius: 26, padding: 24,
    borderWidth: 3, borderColor: LOGO.purple + "70",
    borderBottomWidth: 5, borderBottomColor: LOGO.purple + "99",
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 20, color: LOGO.cyan,
    textAlign: "center", marginBottom: 16,
  },
  nameInput: {
    borderWidth: 2.5, borderColor: LOGO.cyan + "60", borderRadius: 16,
    borderBottomWidth: 4, borderBottomColor: LOGO.cyan + "99",
    padding: 14, fontFamily: "Cairo_400Regular", fontSize: 16,
    color: "#E8E8FF", marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.18)",
    borderBottomWidth: 4, borderBottomColor: "rgba(0,0,0,0.25)",
  },
  modalCancelText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#9898CC" },
  modalConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 18,
    backgroundColor: LOGO.yellow, alignItems: "center",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.30)",
    borderBottomWidth: 4, borderBottomColor: "#C4A010",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#000" },
});
