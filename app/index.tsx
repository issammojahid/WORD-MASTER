import React, { useEffect, useRef, useState, memo } from "react";
import {
  View,
  Text,
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
  type GestureResponderEvent,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { MAPS } from "@/constants/i18n";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.82;
const CARD_MARGIN = 10;

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

// ── Popup particle ─────────────────────────────────────────────────────────────
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

// ── Feature popup component ───────────────────────────────────────────────────
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
    <Animated.View style={[pStyles.overlay, { opacity: popupOpacity }]}>
      {/* Floating particles */}
      <View style={pStyles.particlesLayer} pointerEvents="none">
        {particles.map((p, i) => <PopupParticle key={i} {...p} />)}
      </View>

      {/* Card with glow shadow */}
      <Animated.View
        style={[
          pStyles.cardWrapper,
          { transform: [{ scale: popupScale }], shadowColor: panel.color },
        ]}
      >
        <LinearGradient
          colors={[panel.gradientFrom, panel.gradientMid, "#1A2E43"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[pStyles.card, { borderColor: panel.color + "55" }]}
        >
          {/* Close */}
          <TouchableOpacity
            style={pStyles.closeBtn}
            onPress={() => onDismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* Icon circle */}
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

          {/* Titles */}
          <Text style={[pStyles.title, { color: panel.color }]}>{panel.title}</Text>
          <Text style={pStyles.subtitle}>{panel.subtitle}</Text>

          {/* Reward badge */}
          <View
            style={[
              pStyles.rewardBadge,
              { backgroundColor: panel.color + "18", borderColor: panel.color + "45" },
            ]}
          >
            <Text style={[pStyles.rewardText, { color: panel.color }]}>{panel.reward}</Text>
          </View>

          {/* Buttons */}
          <View style={pStyles.buttonsRow}>
            <TouchableOpacity style={pStyles.skipBtn} onPress={() => onDismiss()} activeOpacity={0.7}>
              <Text style={pStyles.skipText}>تخطي</Text>
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

          {/* Step dots */}
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
    backgroundColor: "rgba(0,0,0,0.75)",
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
    color: Colors.textSecondary, textAlign: "center",
    marginBottom: 16, lineHeight: 22,
  },
  rewardBadge: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1, marginBottom: 24,
  },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  buttonsRow: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 20 },
  skipBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  skipText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  playBtnWrapper: { flex: 2 },
  playBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
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

// ── Card floating particle ─────────────────────────────────────────────────────
const CARD_SYMBOLS = ["✦", "★", "·", "✦", "·", "★", "✦", "·"];

const CardParticle = memo(({ x, symbol, delay, accent, size }: {
  x: number; symbol: string; delay: number; accent: string; size: number;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      anim.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 3200 + Math.random() * 2000, easing: Easing.linear, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => anim.stopAnimation();
  }, []);
  return (
    <Animated.Text
      style={{
        position: "absolute", left: x, bottom: 8, fontSize: size,
        color: accent, pointerEvents: "none" as any,
        opacity: anim.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 0.55, 0.45, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) }],
      }}
    >
      {symbol}
    </Animated.Text>
  );
});

function makeParticles(accent: string) {
  return Array.from({ length: 8 }, (_, i) => ({
    x: 12 + i * ((CARD_WIDTH - 24) / 7),
    symbol: CARD_SYMBOLS[i],
    delay: i * 350,
    accent,
    size: 7 + (i % 3) * 3,
  }));
}

// ── Card-level styles (defined once outside component) ────────────────────────
const cardStyles = StyleSheet.create({
  cardShineBar: {
    position: "absolute", top: -20, width: 28, height: "140%" as any,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 6,
  },
  btnWrapper: {
    marginTop: 4, overflow: "visible",
  },
  btnShineBar: {
    position: "absolute", top: -14, width: 20, height: 60,
    backgroundColor: "rgba(255,255,255,0.30)", borderRadius: 4,
  },
});

// ── Premium mode card ─────────────────────────────────────────────────────────
const MAX_TILT = 8;

const ModeCard = memo(({ item, index, isActive }: {
  item: GameMode; index: number; isActive: boolean;
}) => {
  const rotateX  = useRef(new Animated.Value(0)).current;
  const rotateY  = useRef(new Animated.Value(0)).current;
  const pressScl = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const cardShine = useRef(new Animated.Value(-CARD_WIDTH)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;
  const btnShine = useRef(new Animated.Value(-120)).current;
  const entrY    = useRef(new Animated.Value(55)).current;
  const entrOp   = useRef(new Animated.Value(0)).current;
  const particles = useRef(makeParticles(item.accent)).current;

  useEffect(() => {
    // ── Entrance (staggered per index) ───────────────────────────────────────
    Animated.sequence([
      Animated.delay(index * 90),
      Animated.parallel([
        Animated.spring(entrY, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(entrOp, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();

    // ── Glow pulse ───────────────────────────────────────────────────────────
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2600, useNativeDriver: false }),
      ])
    ).start();

    // ── Card gloss sweep ────────────────────────────────────────────────────
    const runCardShine = () => {
      cardShine.setValue(-CARD_WIDTH * 0.6);
      Animated.sequence([
        Animated.timing(cardShine, { toValue: CARD_WIDTH * 1.6, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(4500 + index * 700),
      ]).start(() => runCardShine());
    };
    const t0 = setTimeout(() => runCardShine(), index * 500 + 600);

    // ── Button pulse ────────────────────────────────────────────────────────
    Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulse, { toValue: 1.065, duration: 680, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(btnPulse, { toValue: 1,     duration: 680, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // ── Button shine ────────────────────────────────────────────────────────
    const runBtnShine = () => {
      btnShine.setValue(-120);
      Animated.sequence([
        Animated.timing(btnShine, { toValue: 220, duration: 650, useNativeDriver: true }),
        Animated.delay(2600 + index * 300),
      ]).start(() => runBtnShine());
    };
    runBtnShine();

    return () => {
      clearTimeout(t0);
      [rotateX, rotateY, pressScl, glowAnim, cardShine, btnPulse, btnShine, entrY, entrOp]
        .forEach(a => a.stopAnimation());
    };
  }, []);

  // ── 3D tilt on press ────────────────────────────────────────────────────────
  const onPressIn = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const tx = ((locationY - 115) / 115) * -MAX_TILT;
    const ty = ((locationX - CARD_WIDTH / 2) / (CARD_WIDTH / 2)) * MAX_TILT;
    Animated.spring(rotateX, { toValue: tx, tension: 320, friction: 10, useNativeDriver: true }).start();
    Animated.spring(rotateY, { toValue: ty, tension: 320, friction: 10, useNativeDriver: true }).start();
    Animated.spring(pressScl, { toValue: 0.96, tension: 320, friction: 10, useNativeDriver: true }).start();
  };

  const onPressOut = () => {
    Animated.spring(rotateX, { toValue: 0, tension: 180, friction: 8, useNativeDriver: true }).start();
    Animated.spring(rotateY, { toValue: 0, tension: 180, friction: 8, useNativeDriver: true }).start();
    Animated.spring(pressScl, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }).start();
  };

  const rotXDeg = rotateX.interpolate({ inputRange: [-MAX_TILT, MAX_TILT], outputRange: [`-${MAX_TILT}deg`, `${MAX_TILT}deg`] });
  const rotYDeg = rotateY.interpolate({ inputRange: [-MAX_TILT, MAX_TILT], outputRange: [`-${MAX_TILT}deg`, `${MAX_TILT}deg`] });
  const glowOp  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [isActive ? 0.1 : 0.05, isActive ? 0.22 : 0.12] });

  return (
    <Animated.View style={{
      width: CARD_WIDTH, marginHorizontal: CARD_MARGIN,
      opacity: entrOp,
      borderRadius: 24,
      shadowColor: item.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isActive ? 0.55 : 0.28,
      shadowRadius: isActive ? 22 : 12,
      elevation: isActive ? 14 : 7,
      transform: [
        { translateY: entrY },
        { scale: pressScl },
        { perspective: 900 },
        { rotateX: rotXDeg },
        { rotateY: rotYDeg },
      ],
    }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={item.onPress}
        activeOpacity={1}
        style={[
          styles.modeCard,
          {
            overflow: "hidden",
            borderColor: item.accent + (isActive ? "75" : "45"),
            backgroundColor: isActive ? item.accent + "1E" : Colors.card + "92",
          },
        ]}
      >
        {/* Glow overlay */}
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: item.accent, opacity: glowOp }]}
          pointerEvents="none"
        />

        {/* Card gloss sweep */}
        <Animated.View
          style={[cardStyles.cardShineBar, { transform: [{ translateX: cardShine }, { rotate: "20deg" }] }]}
          pointerEvents="none"
        />

        {/* Floating particles */}
        {particles.map((p, i) => <CardParticle key={i} {...p} />)}

        {/* Emoji */}
        <View style={[styles.modeEmojiCircle, { backgroundColor: item.accent + "22" }]}>
          <Text style={styles.modeEmoji}>{item.emoji}</Text>
        </View>

        <Text style={[styles.modeTitle, { color: item.accent }]}>{item.title}</Text>
        <Text style={styles.modeSubtitle}>{item.subtitle}</Text>

        {/* Animated play button */}
        <Animated.View style={[cardStyles.btnWrapper, { transform: [{ scale: btnPulse }] }]}>
          <LinearGradient
            colors={[item.accent, item.accent + "BB"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.modePlayBtn, { overflow: "hidden" }]}
          >
            <Ionicons name="play" size={15} color="#fff" />
            <Text style={styles.modePlayText}>العب الآن</Text>
            {/* Button shine streak */}
            <Animated.View
              style={[cardStyles.btnShineBar, { transform: [{ translateX: btnShine }, { rotate: "20deg" }] }]}
              pointerEvents="none"
            />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, selectedMap } = useLanguage();
  const { profile, playerId, setPlayerName } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [tournamentWins, setTournamentWins] = useState(0);
  const [currentPopupIdx, setCurrentPopupIdx] = useState<number | null>(null);
  const hasShownPopup = useRef(false);
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const popupScale = useRef(new Animated.Value(0.85)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const NAV_BAR_HEIGHT = 60 + bottomInset;

  const mapConfig = MAPS.find((m) => m.id === selectedMap) || MAPS[0];
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
        Animated.timing(floatAnim, { toValue: -6, duration: 2400, useNativeDriver: true }),
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
      subtitle: "العب مع لاعبين عشوائيين فوراً",
      emoji: "⚡",
      gradient: [Colors.gold + "30", Colors.gold + "10"],
      accent: Colors.gold,
      onPress: handleQuickMatchPress,
    },
    {
      id: "rapid",
      title: "الوضع السريع",
      subtitle: "أول كلمة صحيحة تربح في 10 ثوان",
      emoji: "🚀",
      gradient: [Colors.ruby + "30", Colors.ruby + "10"],
      accent: Colors.ruby,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/rapid"); },
    },
    {
      id: "friends",
      title: "اللعب مع الأصدقاء",
      subtitle: "أنشئ غرفة وادعُ أصدقاءك",
      emoji: "👥",
      gradient: [Colors.emerald + "30", Colors.emerald + "10"],
      accent: Colors.emerald,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/friends"); },
    },
    {
      id: "tournament",
      title: "البطولات",
      subtitle: "8 لاعبين، 3 جولات إقصائية، جائزة كبرى",
      emoji: "🏆",
      gradient: ["#7C3AED30", "#7C3AED10"],
      accent: "#7C3AED",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/tournament"); },
    },
    {
      id: "ai",
      title: "اللعب ضد الذكاء الاصطناعي",
      subtitle: "تحدّى الذكاء الاصطناعي بمستويات صعوبة مختلفة",
      emoji: "🤖",
      gradient: ["#0EA5E930", "#0EA5E910"],
      accent: "#0EA5E9",
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
    <View style={[styles.container, { backgroundColor: mapConfig.color }]}>
      <View style={styles.hexDecorTopRight} />
      <View style={styles.hexDecorBottomLeft} />

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
            <View style={[styles.avatarCircle, { backgroundColor: equippedSkin.color + "33" }]}>
              <Text style={styles.avatarEmoji}>{equippedSkin.emoji}</Text>
            </View>
            <View style={styles.profileMeta}>
              <View style={styles.nameEditRow}>
                <Text style={styles.playerName} numberOfLines={1}>{profile.name}</Text>
                <Ionicons name="pencil" size={11} color={Colors.textMuted} style={{ marginLeft: 4 }} />
              </View>
              <View style={styles.levelRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv.{profile.level}</Text>
                </View>
                <View style={styles.xpBarContainer}>
                  <View style={[styles.xpBar, { width: `${xpProgress * 100}%` as any }]} />
                </View>
                <Text style={styles.xpText}>{profile.xp % 100}/100</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.topRight}>
            <TouchableOpacity
              style={styles.coinsBadge}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/shop"); }}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={14} color={Colors.gold} />
              <Text style={styles.coinsText}>{profile.coins}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/settings")}>
              <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
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
          <View style={styles.letterCircle}>
            <Text style={styles.logoLetter}>ح</Text>
          </View>
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.appSubtitle}>{t.homeSubtitle}</Text>
        </Animated.View>

        {/* ── GAME MODES CAROUSEL ─────────────────────────── */}
        <View style={styles.carouselSection}>
          <Text style={styles.carouselTitle}>اختر وضع اللعب</Text>
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
              <ModeCard item={item} index={index} isActive={activeModeIdx === index} />
            )}
          />
          <View style={styles.dotsRow}>
            {gameModes.map((m, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  activeModeIdx === idx && [styles.dotActive, { backgroundColor: gameModes[idx].accent }],
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── STATS ROW ───────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.gamesPlayed}</Text>
            <Text style={styles.statLabel}>مباريات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.wins}</Text>
            <Text style={styles.statLabel}>انتصارات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalScore}</Text>
            <Text style={styles.statLabel}>نقاط</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.bestStreak}</Text>
            <Text style={styles.statLabel}>سلسلة</Text>
          </View>
          {tournamentWins > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.gold }]}>🏆 {tournamentWins}</Text>
                <Text style={styles.statLabel}>بطولات</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── BOTTOM NAVIGATION BAR ───────────────────────── */}
      <View style={[styles.bottomNav, { paddingBottom: bottomInset, height: NAV_BAR_HEIGHT }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/shop")} activeOpacity={0.7}>
          <MaterialCommunityIcons name="shopping" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>المتجر</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/friends")} activeOpacity={0.7}>
          <Ionicons name="people-outline" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>الأصدقاء</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={() => {}} activeOpacity={0.9}>
          <View style={styles.navHomeBtn}>
            <Ionicons name="home" size={26} color={Colors.black} />
          </View>
          <Text style={[styles.navLabel, { color: Colors.gold }]}>الرئيسية</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/tasks")} activeOpacity={0.7}>
          <Ionicons name="star-outline" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>المهام</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/achievements")} activeOpacity={0.7}>
          <Ionicons name="trophy-outline" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>الإنجازات</Text>
        </TouchableOpacity>
      </View>

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
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>اسم اللاعب</Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={20}
              textAlign="right"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNameModal(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, alignItems: "center" },
  hexDecorTopRight: {
    position: "absolute", top: -60, right: -60, width: 180, height: 180,
    borderRadius: 30, borderWidth: 2, borderColor: Colors.gold + "20",
    transform: [{ rotate: "30deg" }],
  },
  hexDecorBottomLeft: {
    position: "absolute", bottom: -80, left: -80, width: 220, height: 220,
    borderRadius: 40, borderWidth: 2, borderColor: Colors.emerald + "15",
    transform: [{ rotate: "15deg" }],
  },

  topBar: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12, gap: 10,
  },
  profileRow: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card + "80", borderRadius: 16,
    padding: 10, gap: 10,
  },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center",
  },
  avatarEmoji: { fontSize: 24 },
  profileMeta: { flex: 1 },
  nameEditRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  playerName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary, flex: 1 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadge: {
    backgroundColor: Colors.gold + "25", paddingHorizontal: 7,
    paddingVertical: 1, borderRadius: 7,
  },
  levelText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.gold },
  xpBarContainer: { flex: 1, height: 4, backgroundColor: Colors.cardBorder, borderRadius: 2, overflow: "hidden" },
  xpBar: { height: "100%", backgroundColor: Colors.emerald, borderRadius: 2 },
  xpText: { fontFamily: "Cairo_400Regular", fontSize: 9, color: Colors.textMuted },

  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  coinsBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card + "90", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, gap: 5,
    borderWidth: 1, borderColor: Colors.gold + "30",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.card + "80", justifyContent: "center", alignItems: "center",
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

  logoContainer: { alignItems: "center", marginBottom: 22 },
  letterCircle: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  logoLetter: { fontFamily: "Cairo_700Bold", fontSize: 42, color: Colors.black, lineHeight: 54 },
  appName: { fontFamily: "Cairo_700Bold", fontSize: 24, color: Colors.textPrimary, textAlign: "center" },
  appSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textSecondary, textAlign: "center", marginTop: 2 },

  carouselSection: { width: "100%", marginBottom: 20 },
  carouselTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textSecondary,
    marginBottom: 12, textAlign: "right",
  },
  carouselContent: { paddingHorizontal: 0 },
  modeCard: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 10,
    minHeight: 230,
    justifyContent: "center",
  },
  modeEmojiCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  modeEmoji: { fontSize: 40 },
  modeTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "center" },
  modeSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  modePlayBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 4,
  },
  modePlayText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.cardBorder },
  dotActive: { width: 22, borderRadius: 4 },

  statsRow: {
    flexDirection: "row", backgroundColor: Colors.card + "70", borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16, width: "100%",
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  statLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.cardBorder, marginVertical: 4 },

  bottomNav: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around",
    backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
    paddingTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 20,
  },
  navItem: { alignItems: "center", gap: 3, flex: 1 },
  navItemCenter: { alignItems: "center", gap: 3, flex: 1, marginTop: -16 },
  navHomeBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 12,
  },
  navLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.textMuted },

  popupOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center",
    padding: 28,
  },
  popupCard: {
    width: "100%", backgroundColor: Colors.card, borderRadius: 28,
    padding: 28, alignItems: "center", borderWidth: 1.5,
  },
  popupClose: {
    position: "absolute", top: 14, right: 14, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.cardBorder,
    justifyContent: "center", alignItems: "center",
  },
  popupIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16, marginTop: 8,
  },
  popupIconEmoji: { fontSize: 48 },
  popupTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 24, textAlign: "center", marginBottom: 8,
  },
  popupSubtitle: {
    fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", marginBottom: 16, lineHeight: 22,
  },
  popupRewardBadge: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, marginBottom: 24,
  },
  popupRewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  popupButtons: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 20 },
  popupSkipBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    backgroundColor: Colors.cardBorder, alignItems: "center",
  },
  popupSkipText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  popupActionBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  popupActionText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },
  popupDots: { flexDirection: "row", gap: 7 },
  popupDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cardBorder },
  popupDotActive: { width: 24, borderRadius: 4 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: Colors.card, borderRadius: 20, padding: 24,
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary,
    textAlign: "center", marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12,
    padding: 12, fontFamily: "Cairo_400Regular", fontSize: 16,
    color: Colors.textPrimary, marginBottom: 16,
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.cardBorder, alignItems: "center",
  },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.gold, alignItems: "center",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.black },

});
