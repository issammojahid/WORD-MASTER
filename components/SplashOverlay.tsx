import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const LOGO = {
  cyan:   "#00D4E8",
  pink:   "#FF3D9A",
  purple: "#A855F7",
  yellow: "#F5C842",
};

// ── Sparkle particle ─────────────────────────────────────────────────────────
type SparkleProps = { x: number; y: number; color: string; delay: number; size: number };
function Sparkle({ x, y, color, delay, size }: SparkleProps) {
  const op  = useRef(new Animated.Value(0)).current;
  const scl = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = () => {
      op.setValue(0); scl.setValue(0.3);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(op,  { toValue: 1,   duration: 450, useNativeDriver: true }),
          Animated.timing(scl, { toValue: 1.3, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        ]),
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(op,  { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(scl, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
        Animated.delay(800 + delay * 0.4),
      ]).start(({ finished }) => { if (finished) loop(); });
    };
    loop();
    return () => { op.stopAnimation(); scl.stopAnimation(); };
  }, []);

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: "absolute", left: x, top: y, fontSize: size,
        color, opacity: op, transform: [{ scale: scl }],
      }}
    >✦</Animated.Text>
  );
}

// ── Floating particle ─────────────────────────────────────────────────────────
type FloatParticleProps = { x: number; startY: number; color: string; delay: number; size: number };
function FloatParticle({ x, startY, color, delay, size }: FloatParticleProps) {
  const posY = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      posY.setValue(0); op.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(op, { toValue: 0.8, duration: 400, useNativeDriver: true }),
          Animated.timing(posY, { toValue: -160, duration: 2800, easing: Easing.linear, useNativeDriver: true }),
        ]),
        Animated.timing(op, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => { posY.stopAnimation(); op.stopAnimation(); };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: x, top: startY,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        opacity: op,
        transform: [{ translateY: posY }],
      }}
    />
  );
}

// ── Loading bar ───────────────────────────────────────────────────────────────
function LoadingBar({ duration }: { duration: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, []);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const glowLeft = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.barTrack}>
      <Animated.View style={{ width: barWidth, height: "100%", overflow: "hidden", borderRadius: 4 }}>
        <LinearGradient
          colors={[LOGO.cyan, LOGO.purple, LOGO.pink]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.View style={[styles.barGlow, { left: glowLeft }]} />
    </View>
  );
}

// ── Sparkle ring around logo ──────────────────────────────────────────────────
const SPARKLE_RING: SparkleProps[] = [
  { x: width / 2 - 130, y: height / 2 - 80,  color: LOGO.cyan,   delay: 0,    size: 14 },
  { x: width / 2 + 108, y: height / 2 - 70,  color: LOGO.pink,   delay: 600,  size: 12 },
  { x: width / 2 - 100, y: height / 2 + 50,  color: LOGO.yellow, delay: 300,  size: 10 },
  { x: width / 2 + 80,  y: height / 2 + 60,  color: LOGO.purple, delay: 900,  size: 13 },
  { x: width / 2 - 40,  y: height / 2 - 115, color: LOGO.cyan,   delay: 1200, size: 9  },
  { x: width / 2 + 20,  y: height / 2 - 120, color: LOGO.pink,   delay: 450,  size: 11 },
  { x: width / 2 - 20,  y: height / 2 + 110, color: LOGO.purple, delay: 750,  size: 10 },
  { x: width / 2 + 60,  y: height / 2 - 95,  color: LOGO.yellow, delay: 1050, size: 8  },
];

const FLOAT_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  x:      (i * (width / 12)) + (i % 3) * 8,
  startY: height * 0.55 + (i % 4) * 15,
  color:  [LOGO.cyan + "99", LOGO.purple + "99", LOGO.pink + "88", LOGO.yellow + "88"][i % 4],
  delay:  i * 220,
  size:   2 + (i % 3),
}));

// ── Main splash ───────────────────────────────────────────────────────────────
export default function SplashOverlay() {
  const insets = useSafeAreaInsets();

  // Full title animation
  const titleOp    = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.75)).current;
  // "ح" letter animation
  const letterOp    = useRef(new Animated.Value(0)).current;
  const letterScale = useRef(new Animated.Value(2.5)).current;
  // Sub elements
  const subOp      = useRef(new Animated.Value(0)).current;
  const barOp      = useRef(new Animated.Value(0)).current;
  // Ring glow pulse
  const ringPulse  = useRef(new Animated.Value(1)).current;

  const LOADING_DURATION = 3400;

  useEffect(() => {
    // Ring pulse loop
    Animated.loop(Animated.sequence([
      Animated.timing(ringPulse, { toValue: 1.12, duration: 1100, useNativeDriver: true }),
      Animated.timing(ringPulse, { toValue: 1,    duration: 1100, useNativeDriver: true }),
    ])).start();

    // Main sequence
    Animated.sequence([
      Animated.delay(200),
      // Phase 1: Fade in full title
      Animated.parallel([
        Animated.timing(titleOp,    { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(titleScale, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      // Phase 2: Show sub-text and loading bar
      Animated.parallel([
        Animated.timing(subOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(barOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      // Phase 3: Wait for loading bar to fill (hold for most of LOADING_DURATION)
      Animated.delay(LOADING_DURATION - 700),
      // Phase 4: Shrink title out → reveal "ح"
      Animated.parallel([
        Animated.timing(titleOp,    { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 0.15, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(subOp,      { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      // Phase 5: "ح" zooms in from large → normal
      Animated.parallel([
        Animated.timing(letterOp,    { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(letterScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
      // Hold for parent fade-out
      Animated.delay(300),
      // Phase 6: Letter shrinks out before parent fades
      Animated.parallel([
        Animated.timing(letterOp,    { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(letterScale, { toValue: 0.3, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    return () => {
      [titleOp, titleScale, letterOp, letterScale, subOp, barOp, ringPulse].forEach(a => a.stopAnimation());
    };
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0C0A1E", "#160D33", "#0A1428"]}
        start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background blobs */}
      <View style={[styles.blob, { top: -80, left: -60, width: 220, height: 220, backgroundColor: LOGO.cyan + "14" }]} />
      <View style={[styles.blob, { top: 180, right: -70, width: 200, height: 200, backgroundColor: LOGO.pink + "12" }]} />
      <View style={[styles.blob, { bottom: 100, left: -50, width: 180, height: 180, backgroundColor: LOGO.purple + "16" }]} />

      {/* Floating particles */}
      {FLOAT_PARTICLES.map((p, i) => <FloatParticle key={i} {...p} />)}

      {/* Sparkle ring */}
      {SPARKLE_RING.map((s, i) => <Sparkle key={i} {...s} />)}

      {/* Center content */}
      <View style={[styles.center, { paddingTop: insets.top }]}>

        {/* Ring glow behind the text */}
        <Animated.View style={[styles.ringGlow, { transform: [{ scale: ringPulse }] }]} />

        {/* Full title "حروف المغرب" */}
        <Animated.Text style={[styles.fullTitle, { opacity: titleOp, transform: [{ scale: titleScale }] }]}>
          حروف المغرب
        </Animated.Text>

        {/* Single letter "ح" — shown during transformation */}
        <Animated.Text
          style={[styles.singleLetter, { opacity: letterOp, transform: [{ scale: letterScale }] }]}
        >
          ح
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: subOp }]}>
          لعبة الكلمات العربية
        </Animated.Text>
      </View>

      {/* Loading bar at bottom */}
      <Animated.View style={[styles.loadingArea, { paddingBottom: insets.bottom + 50, opacity: barOp }]}>
        <Text style={styles.loadingLabel}>جاري التحميل...</Text>
        <LoadingBar duration={LOADING_DURATION} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },

  blob: {
    position: "absolute",
    borderRadius: 999,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  ringGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: LOGO.purple + "14",
    borderWidth: 1.5,
    borderColor: LOGO.cyan + "28",
  },

  fullTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 46,
    color: LOGO.cyan,
    textAlign: "center",
    letterSpacing: 1,
    position: "absolute",
  },

  singleLetter: {
    fontFamily: "Cairo_700Bold",
    fontSize: 96,
    color: LOGO.cyan,
    textAlign: "center",
    position: "absolute",
  },

  subtitle: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 15,
    color: LOGO.purple,
    textAlign: "center",
    letterSpacing: 0.5,
    marginTop: 80,
  },

  loadingArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 10,
  },
  loadingLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: LOGO.purple + "BB",
    letterSpacing: 1.5,
  },
  barTrack: {
    width: 200,
    height: 4,
    backgroundColor: LOGO.purple + "28",
    borderRadius: 4,
    overflow: "visible",
  },
  barGlow: {
    position: "absolute",
    top: -4,
    width: 14,
    height: 12,
    borderRadius: 6,
    backgroundColor: LOGO.cyan,
    opacity: 0.7,
    transform: [{ translateX: -7 }],
  },
});
