import React, { useEffect, useRef, useState, memo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
  Easing,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS, TITLES } from "@/contexts/PlayerContext";
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
        width: "100%", backgroundColor: theme.modalBg,
        borderRadius: 28, padding: 28, alignItems: "center",
        borderWidth: 1.5, borderColor: "#F5C842" + "50",
        shadowColor: "#F5C842", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5, shadowRadius: 30, elevation: 30,
        transform: [{ scale: popScale }],
      }}>
        {/* Coin particles */}
        {COIN_PARTICLES.map((p, i) => (
          <Animated.Text key={i} style={{
            position: "absolute", fontSize: 18,
            transform: [{ translateX: p.dx }, { translateY: p.dy }],
            opacity: 0.7,
          }}>🪙</Animated.Text>
        ))}

        {/* Animated coin */}
        <Animated.Text style={{
          fontSize: 72, marginBottom: 16,
          transform: [
            { translateY: coinY },
            { rotate: coinRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
          ],
        }}>🎁</Animated.Text>

        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 22, color: "#F5C842", marginBottom: 8, textAlign: "center" }}>
          مكافأة الدخول اليومية
        </Text>
        <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 14, color: theme.textSecondary, marginBottom: 6, textAlign: "center" }}>
          حصلت على
        </Text>
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: "#F5C842" + "20", borderRadius: 16,
          paddingHorizontal: 24, paddingVertical: 10, marginBottom: 24,
          borderWidth: 1, borderColor: "#F5C842" + "40",
        }}>
          <Text style={{ fontSize: 24 }}>🪙</Text>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 26, color: "#F5C842" }}>250 عملة!</Text>
        </View>

        <TouchableOpacity
          style={{
            width: "100%", minHeight: 48, justifyContent: "center", borderRadius: 16,
            backgroundColor: "#F5C842", alignItems: "center",
            shadowColor: "#F5C842", shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
          }}
          onPress={onClaim}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 16, color: "#000" }}>✨ استلم المكافأة</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");

// Reduced card size by ~23%
const CARD_WIDTH = width * 0.63;
const CARD_MARGIN = 10;

const LOGO = {
  cyan:   "#00F5FF",
  pink:   "#FF006E",
  purple: "#BF00FF",
  yellow: "#F5C842",
};

// ── Background blob shapes (abstract decoration) ──────────────────────────────
const BG_BLOBS = [
  { top: -60,  left: -50,  size: 180, color: LOGO.cyan   + "1A" },
  { top: 120,  right: -50, size: 160, color: LOGO.pink   + "16" },
  { top: 320,  left: -60,  size: 200, color: LOGO.purple + "18" },
  { top: 560,  right: -40, size: 150, color: LOGO.yellow + "14" },
  { top: 800,  left: -30,  size: 170, color: LOGO.cyan   + "12" },
  { top: 1050, right: -60, size: 190, color: LOGO.pink   + "14" },
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
  { color: LOGO.cyan,   startX: width * 0.1,  startY: height * 0.7,  size: 5, delay: 0,    duration: 6000 },
  { color: LOGO.pink,   startX: width * 0.25, startY: height * 0.65, size: 4, delay: 800,  duration: 7200 },
  { color: LOGO.purple, startX: width * 0.55, startY: height * 0.75, size: 6, delay: 1600, duration: 5800 },
  { color: LOGO.yellow, startX: width * 0.75, startY: height * 0.68, size: 4, delay: 400,  duration: 6600 },
  { color: LOGO.cyan,   startX: width * 0.4,  startY: height * 0.8,  size: 5, delay: 2200, duration: 7000 },
  { color: LOGO.pink,   startX: width * 0.85, startY: height * 0.72, size: 3, delay: 1200, duration: 6200 },
  { color: LOGO.purple, startX: width * 0.15, startY: height * 0.82, size: 4, delay: 3000, duration: 5600 },
  { color: LOGO.yellow, startX: width * 0.62, startY: height * 0.6,  size: 5, delay: 1800, duration: 6800 },
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
  id: string; icon: string; title: string; subtitle: string;
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
          style={[pStyles.card, { borderColor: panel.color + "55" }]}
        >
          <TouchableOpacity
            style={pStyles.closeBtn}
            onPress={() => onDismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={20} color={theme.textPrimary} />
          </TouchableOpacity>

          <View
            style={[
              pStyles.iconCircle,
              {
                backgroundColor: panel.color + "22",
                borderColor: panel.color + "50",
                shadowColor: panel.color,
              },
            ]}
          >
            <Animated.Text style={[pStyles.iconEmoji, { transform: iconTransform }]}>
              {panel.icon}
            </Animated.Text>
          </View>

          <Text style={[pStyles.title, { color: panel.color }]}>{panel.title}</Text>
          <Text style={[pStyles.subtitle, { color: theme.textSecondary }]}>{panel.subtitle}</Text>

          <View
            style={[
              pStyles.rewardBadge,
              { backgroundColor: panel.color + "18", borderColor: panel.color + "45" },
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
    width: "100%", borderRadius: 28, padding: 26,
    alignItems: "center", borderWidth: 1.5,
  },
  closeBtn: {
    position: "absolute", top: 14, right: 14, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center",
  },
  iconCircle: {
    width: 104, height: 104, borderRadius: 52,
    justifyContent: "center", alignItems: "center",
    marginBottom: 18, marginTop: 10,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 18,
    elevation: 14,
  },
  iconEmoji: { fontSize: 52 },
  title: {
    fontFamily: "Cairo_700Bold", fontSize: 24,
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Cairo_400Regular", fontSize: 13,
    color: "#9898CC", textAlign: "center",
    marginBottom: 16, lineHeight: 22,
  },
  rewardBadge: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1, marginBottom: 24,
  },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  buttonsRow: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 20 },
  skipBtn: {
    flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  skipText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC" },
  playBtnWrapper: { flex: 2 },
  playBtn: {
    flex: 1, minHeight: 48, borderRadius: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
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

  const cardGrad: [string, string, string] = [item.accent + "38", "#0E0E24", "#0A0A1A"];

  return (
    <Animated.View style={{
      width: CARD_WIDTH, marginHorizontal: CARD_MARGIN,
      opacity: entrOp, borderRadius: 24,
      shadowColor: item.accent,
      shadowOffset: { width: 0, height: isActive ? 12 : 4 },
      shadowOpacity: isActive ? 0.45 : 0.12,
      shadowRadius: isActive ? 24 : 8,
      elevation: isActive ? 16 : 4,
      transform: [{ translateY: entrY }, { scale: Animated.multiply(pressScl, activeScl) as any }],
    }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={item.onPress}
        activeOpacity={0.92}
        style={{
          borderRadius: 24, overflow: "hidden",
          borderWidth: isActive ? 1.5 : 1,
          borderColor: isActive ? item.accent + (isDark ? "90" : "60") : item.accent + (isDark ? "28" : "25"),
        }}
      >
        <LinearGradient
          colors={cardGrad}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top accent stripe */}
        <LinearGradient
          colors={[item.accent + "60", item.accent + "00"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        />

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
          <View style={{
            backgroundColor: item.accent + (isDark ? "18" : "14"),
            borderRadius: ICON_OUTER / 2 + 10,
            padding: 8,
            borderWidth: 1.5,
            borderColor: item.accent + (isDark ? "35" : "25"),
          }}>
            <Icon accent={item.accent} />
          </View>

          <Text style={[styles.modeTitle, { color: item.accent, marginTop: 4 }]}>{item.title}</Text>
          <Text style={[styles.modeSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>

          {/* Play button */}
          <Animated.View style={[cSt.btnWrap, { transform: [{ scale: btnPulse }] }]}>
            <LinearGradient
              colors={[item.accent, item.accent + "CC"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.modePlayBtn, {
                overflow: "hidden",
                shadowColor: item.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 6,
                width: "100%",
                justifyContent: "center",
              }]}
            >
              <Ionicons name="play-circle" size={17} color="#fff" />
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
  const { profile, playerId, setPlayerName, claimLoginReward } = usePlayer();
  const { theme, isDark } = useTheme();
  const [showLoginReward, setShowLoginReward] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [tournamentWins, setTournamentWins] = useState(0);
  const [currentPopupIdx, setCurrentPopupIdx] = useState<number | null>(null);
  const [pendingGiftsCount, setPendingGiftsCount] = useState(0);
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
  const xpProgress = (profile.xp % 100) / 100;

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

    return () => clearTimeout(timer);
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
      gradient: [Colors.gold + "30", Colors.gold + "10"],
      accent: LOGO.yellow,
      onPress: handleQuickMatchPress,
    },
    {
      id: "rapid",
      title: "الوضع السريع",
      subtitle: "أول كلمة صحيحة تربح — 10 ثوانٍ فقط!",
      emoji: "🚀",
      gradient: [Colors.ruby + "30", Colors.ruby + "10"],
      accent: "#FF5733",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/rapid"); },
    },
    {
      id: "friends",
      title: "مع الأصدقاء",
      subtitle: "أنشئ غرفة وادعُ أصدقاءك للمنافسة",
      emoji: "👥",
      gradient: [Colors.emerald + "30", Colors.emerald + "10"],
      accent: "#22C55E",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/lobby"); },
    },
    {
      id: "tournament",
      title: "البطولات",
      subtitle: "8 لاعبين — جولات إقصائية وجوائز كبرى",
      emoji: "🏆",
      gradient: ["#7C3AED30", "#7C3AED10"],
      accent: LOGO.purple,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/tournament"); },
    },
    {
      id: "ai",
      title: "ضد الذكاء الاصطناعي",
      subtitle: "تحدّى الذكاء الاصطناعي بمستويات متعددة",
      emoji: "🤖",
      gradient: ["#0EA5E930", "#0EA5E910"],
      accent: LOGO.cyan,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/ai-game"); },
    },
  ];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / (CARD_WIDTH + CARD_MARGIN * 2));
    setActiveModeIdx(Math.max(0, Math.min(idx, gameModes.length - 1)));
  };

  const streakIcon = profile.winStreak >= 10 ? "🔥🔥🔥" : profile.winStreak >= 5 ? "🔥🔥" : profile.winStreak >= 3 ? "🔥" : "";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Colorful gradient background */}
      <LinearGradient
        colors={["#0A0A1A", "#0E0E24", "#0A0A1A"]}
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
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => { setShowNameModal(true); setNameInput(profile.name); }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[LOGO.cyan + "18", LOGO.purple + "14"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
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
                  <Text style={styles.avatarEmoji}>{equippedSkin.emoji}</Text>
                </View>
              );
            })()}
            <View style={styles.profileMeta}>
              <View style={styles.nameEditRow}>
                {profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date()) && (
                  <Text style={{ fontSize: 14, marginRight: 4 }}>👑</Text>
                )}
                <Text style={[styles.playerName, { color: theme.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
                <Ionicons name="pencil" size={11} color={theme.textMuted} style={{ marginLeft: 4 }} />
              </View>
              {(() => {
                const titleData = TITLES.find((t) => t.id === profile.equippedTitle);
                if (!titleData || titleData.id === "beginner") return null;
                const tColors: Record<string, string> = { common: "#00F5FF", rare: "#BF00FF", epic: "#FF006E", legendary: "#F5C842" };
                const tColor = tColors[titleData.rarity] || "#00F5FF";
                return (
                  <View style={[styles.equippedTitleBadge, { backgroundColor: tColor + "18", borderColor: tColor + "50" }]}>
                    <Text style={[styles.equippedTitleText, { color: tColor }]}>{titleData.nameAr}</Text>
                  </View>
                );
              })()}
              <View style={styles.levelRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv.{profile.level}</Text>
                </View>
                <View style={styles.xpBarContainer}>
                  <LinearGradient
                    colors={[LOGO.cyan, LOGO.purple]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.xpBar, { width: `${xpProgress * 100}%` as any }]}
                  />
                </View>
                <Text style={[styles.xpText, { color: theme.textMuted }]}>{profile.xp % 100}/100</Text>
              </View>
              {(() => {
                const DIVISION_MAP: Record<string, { emoji: string; nameAr: string; color: string }> = {
                  bronze:   { emoji: "🥉", nameAr: "برونز",  color: "#CD7F32" },
                  silver:   { emoji: "🥈", nameAr: "فضة",    color: "#A8A8A8" },
                  gold:     { emoji: "🥇", nameAr: "ذهب",    color: "#FFD700" },
                  platinum: { emoji: "💠", nameAr: "بلاتين", color: "#00E5FF" },
                  diamond:  { emoji: "💎", nameAr: "ماسة",   color: "#BF00FF" },
                };
                const div = DIVISION_MAP[profile.division ?? "bronze"] ?? DIVISION_MAP.bronze;
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 3,
                      backgroundColor: div.color + "18", borderRadius: 8,
                      paddingHorizontal: 7, paddingVertical: 2,
                      borderWidth: 1, borderColor: div.color + "40",
                    }}>
                      <Text style={{ fontSize: 11 }}>{div.emoji}</Text>
                      <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 10, color: div.color }}>
                        {div.nameAr}
                      </Text>
                      <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 9, color: div.color + "CC" }}>
                        {profile.elo ?? 1000}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 9, color: theme.textMuted }}>
                      {(profile.seasonWins ?? 0)}ف {(profile.seasonLosses ?? 0)}خ
                    </Text>
                  </View>
                );
              })()}
            </View>
          </TouchableOpacity>

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
          {/* Sparkles near letter */}
          {LOGO_SPARKLES.map((s, i) => <LogoSparkle key={i} {...s} />)}
          {/* Glow ring behind letter */}
          <View style={styles.logoGlowRing} />
          {/* The "ح" letter */}
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
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{profile.gamesPlayed}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>مباريات</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{profile.wins}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>انتصارات</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{profile.totalScore}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>نقاط</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{profile.bestStreak}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>سلسلة</Text>
          </View>
          {tournamentWins > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.gold }]}>🏆 {tournamentWins}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>بطولات</Text>
              </View>
            </>
          )}
        </LinearGradient>
      </ScrollView>

      {/* ── BOTTOM NAVIGATION ───────────────────────────── */}
      <LinearGradient
        colors={isDark ? ["rgba(12,10,30,0.97)", "rgba(18,11,42,0.99)"] : [theme.card + "FA", theme.backgroundSecondary + "FA"]}
        style={[styles.bottomNav, { paddingBottom: bottomInset, height: NAV_BAR_HEIGHT }]}
      >
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/shop")} activeOpacity={0.7}>
          <View style={styles.navIconWrap}>
            <MaterialCommunityIcons name="shopping" size={22} color={LOGO.cyan} />
          </View>
          <Text style={[styles.navLabel, { color: LOGO.cyan }]}>المتجر</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/friends")} activeOpacity={0.7}>
          <View style={styles.navIconWrap}>
            <Ionicons name="people" size={22} color={LOGO.pink} />
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
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/tasks")} activeOpacity={0.7}>
          <View style={styles.navIconWrap}>
            <Ionicons name="star" size={22} color={LOGO.purple} />
          </View>
          <Text style={[styles.navLabel, { color: LOGO.purple }]}>المهام</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/clans")} activeOpacity={0.7}>
          <View style={styles.navIconWrap}>
            <Text style={{ fontSize: 22 }}>⚔️</Text>
          </View>
          <Text style={[styles.navLabel, { color: "#FF6B00" }]}>العصابات</Text>
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

      {/* ── NAME MODAL ──────────────────────────────────── */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>اسم اللاعب</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={20}
              textAlign="right"
              autoFocus
              selectTextOnFocus
              placeholderTextColor={theme.inputPlaceholder}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalCancel, { backgroundColor: theme.card }]} onPress={() => setShowNameModal(false)}>
                <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  if (nameInput.trim()) setPlayerName(nameInput.trim());
                  setShowNameModal(false);
                }}
              >
                <Text style={styles.modalConfirmText}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daily Login Reward Popup */}
      {showLoginReward && (
        <LoginRewardPopup
          onClaim={() => {
            claimLoginReward();
            setShowLoginReward(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, alignItems: "center" },

  topBar: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12, gap: 10,
  },
  profileRow: {
    flex: 1, flexDirection: "row", alignItems: "center",
    borderRadius: 18, padding: 10, gap: 10,
    overflow: "hidden",
    borderWidth: 1, borderColor: LOGO.cyan + "30",
  },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center",
  },
  avatarEmoji: { fontSize: 24 },
  profileMeta: { flex: 1 },
  nameEditRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  playerName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#E8E8FF", flex: 1 },
  equippedTitleBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, alignSelf: "flex-start", marginTop: 1 },
  equippedTitleText: { fontFamily: "Cairo_700Bold", fontSize: 9 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadge: {
    backgroundColor: LOGO.yellow + "28", paddingHorizontal: 7,
    paddingVertical: 1, borderRadius: 7,
  },
  levelText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: LOGO.yellow },
  xpBarContainer: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 2, overflow: "hidden" },
  xpBar: { height: "100%", borderRadius: 2 },
  xpText: { fontFamily: "Cairo_400Regular", fontSize: 9, color: "#5A5A88" },

  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  coinsBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 5,
    borderWidth: 1, borderColor: LOGO.yellow + "40",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: LOGO.yellow },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },

  streakBar: {
    width: "100%", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.ruby + "18", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.ruby + "30",
  },
  streakText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.ruby, flex: 1 },
  streakRewardHint: {
    backgroundColor: Colors.ruby + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  streakRewardHintText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.ruby },

  logoContainer: { alignItems: "center", marginBottom: 6, position: "relative", paddingHorizontal: 20 },
  logoGlowRing: {
    position: "absolute",
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: LOGO.cyan + "1E",
  },
  logoLetter: {
    fontFamily: "Cairo_700Bold",
    fontSize: 88,
    color: LOGO.cyan,
    textAlign: "center",
    lineHeight: 100,
  },
  appSubtitle: {
    fontFamily: "Cairo_600SemiBold", fontSize: 15,
    color: LOGO.cyan, textAlign: "center", marginTop: 4,
    letterSpacing: 0.5, opacity: 0.9,
  },

  carouselSection: { width: "100%", marginBottom: 16, marginHorizontal: -16 },
  carouselTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 15,
    color: LOGO.purple,
    marginBottom: 12, textAlign: "right", paddingHorizontal: 16,
  },
  carouselContent: { paddingHorizontal: Math.max(0, Math.round((width - CARD_WIDTH) / 2 - CARD_MARGIN)) },
  modeTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "center" },
  modeSubtitle: {
    fontFamily: "Cairo_400Regular", fontSize: 12,
    textAlign: "center",
    lineHeight: 18, marginTop: 2,
  },
  modePlayBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
  },
  modePlayText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#fff" },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.20)" },
  dotActive: { width: 20, borderRadius: 3 },

  statsRow: {
    flexDirection: "row", borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 14, width: "100%",
    borderWidth: 1, borderColor: LOGO.cyan + "22",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#E8E8FF" },
  statLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#5A5A88", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 4 },

  bottomNav: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around",
    borderTopWidth: 1, borderTopColor: LOGO.purple + "28",
    paddingTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 24,
  },
  navItem: { alignItems: "center", gap: 4, flex: 1 },
  navItemCenter: { alignItems: "center", gap: 4, flex: 1, marginTop: -20 },
  navIconWrap: {
    width: 40, height: 36, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  navBadge: {
    position: "absolute", top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#FF006E", justifyContent: "center", alignItems: "center",
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#0A0A1A",
  },
  navBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 9, color: "#fff" },
  navHomeBtn: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    shadowColor: LOGO.yellow, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65, shadowRadius: 14, elevation: 16,
  },
  navLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#160D33", borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: LOGO.purple + "40",
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 18, color: "#E8E8FF",
    textAlign: "center", marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1, borderColor: LOGO.cyan + "40", borderRadius: 12,
    padding: 12, fontFamily: "Cairo_400Regular", fontSize: 16,
    color: "#E8E8FF", marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC" },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: LOGO.yellow, alignItems: "center",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#000" },
});
