import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const GOLD = "#F5A623";
const NAVY = "#0D1B2A";
const CREAM = "#F0E6D3";
const MUTED = "#6B7E91";
const GOLD_DIM = "#F5A62340";

// Pre-computed zellige tile positions (seeded for determinism)
const TILES = (() => {
  const COLS = 8;
  const ROWS = 15;
  const colSpacing = width / COLS;
  const rowSpacing = height / ROWS;
  let s = 1337;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: { x: number; y: number; size: number; opacity: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      out.push({
        x: col * colSpacing + (row % 2 === 1 ? colSpacing / 2 : 0),
        y: row * rowSpacing,
        size: rng() * 10 + 8,
        opacity: rng() * 0.07 + 0.02,
      });
    }
  }
  return out;
})();

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 4100,
      useNativeDriver: false,
    }).start();
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width: barWidth }]} />
      {/* Shimmer dot at the leading edge */}
      <Animated.View
        style={[
          styles.progressGlow,
          {
            left: barWidth,
            transform: [{ translateX: -6 }],
          },
        ]}
      />
    </View>
  );
}

// ── Pulsing loading dots ──────────────────────────────────────────────────────
function PulsingDots() {
  const d1 = useRef(new Animated.Value(0.25)).current;
  const d2 = useRef(new Animated.Value(0.25)).current;
  const d3 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(d1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(d2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(d3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(d1, { toValue: 0.25, duration: 300, useNativeDriver: true }),
          Animated.timing(d2, { toValue: 0.25, duration: 300, useNativeDriver: true }),
          Animated.timing(d3, { toValue: 0.25, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.dotsRow}>
      {[d1, d2, d3].map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

// ── Decorative divider ────────────────────────────────────────────────────────
function GoldenDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <View style={styles.dividerDiamond} />
      <View style={styles.dividerLine} />
    </View>
  );
}

// ── Moroccan 8-pointed star motif ─────────────────────────────────────────────
function StarMotif() {
  const glow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1.12, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    return () => glow.stopAnimation();
  }, []);

  return (
    <Animated.View style={[styles.starWrapper, { transform: [{ scale: glow }] }]}>
      <View style={[styles.starSquare, styles.starSquare0]} />
      <View style={[styles.starSquare, styles.starSquare45]} />
    </Animated.View>
  );
}

// ── Main splash overlay ───────────────────────────────────────────────────────
export default function SplashOverlay() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || (typeof window !== "undefined" ? 0 : 44);

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(28)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(titleTranslateY, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.timing(subOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(150),
      Animated.timing(bottomOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* ── Zellige background tiles ── */}
      {TILES.map((tile, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: tile.x,
            top: tile.y,
            width: tile.size,
            height: tile.size,
            backgroundColor: GOLD,
            opacity: tile.opacity,
            transform: [{ rotate: "45deg" }],
          }}
        />
      ))}

      {/* ── Corner ornaments ── */}
      <View style={[styles.cornerOrnament, styles.cornerTL]} />
      <View style={[styles.cornerOrnament, styles.cornerTR]} />
      <View style={[styles.cornerOrnament, styles.cornerBL]} />
      <View style={[styles.cornerOrnament, styles.cornerBR]} />

      {/* ── Central content ── */}
      <View style={[styles.center, { paddingTop: topInset }]}>
        <StarMotif />

        <View style={styles.titleCard}>
          <GoldenDivider />

          <Animated.Text
            style={[
              styles.arabicTitle,
              { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
            ]}
          >
            حروف المغرب
          </Animated.Text>

          <Animated.View style={{ opacity: subOpacity, alignItems: "center", gap: 4 }}>
            <Text style={styles.englishTitle}>Huroof Al Maghrib</Text>
          </Animated.View>

          <GoldenDivider />
        </View>

        <Animated.Text style={[styles.byline, { opacity: subOpacity }]}>
          by AisoTeam
        </Animated.Text>
      </View>

      {/* ── Loading area at bottom ── */}
      <Animated.View
        style={[
          styles.loadingArea,
          { paddingBottom: insets.bottom + 48, opacity: bottomOpacity },
        ]}
      >
        <Text style={styles.loadingLabel}>جاري التحميل...</Text>
        <ProgressBar />
        <PulsingDots />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
    justifyContent: "center",
    alignItems: "center",
  },

  cornerOrnament: {
    position: "absolute",
    width: 80,
    height: 80,
    borderColor: GOLD + "25",
  },
  cornerTL: { top: 40, left: 16, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 16 },
  cornerTR: { top: 40, right: 16, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 16 },
  cornerBL: { bottom: 40, left: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 40, right: 16, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 16 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 20,
  },

  starWrapper: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  starSquare: {
    position: "absolute",
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: GOLD,
    borderRadius: 4,
  },
  starSquare0: {},
  starSquare45: { transform: [{ rotate: "45deg" }] },

  titleCard: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  arabicTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 48,
    color: GOLD,
    textAlign: "center",
    letterSpacing: 1,
    textShadowColor: GOLD + "60",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  englishTitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 16,
    color: CREAM,
    textAlign: "center",
    letterSpacing: 3,
    opacity: 0.85,
  },

  byline: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    letterSpacing: 2,
    marginTop: -8,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: GOLD + "50",
  },
  dividerDiamond: {
    width: 8,
    height: 8,
    backgroundColor: GOLD,
    transform: [{ rotate: "45deg" }],
  },

  // Loading area
  loadingArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
  },
  loadingLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1,
  },

  // Progress bar
  progressTrack: {
    width: 200,
    height: 4,
    backgroundColor: GOLD + "28",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  progressGlow: {
    position: "absolute",
    top: -3,
    width: 12,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    opacity: 0.6,
  },

  // Pulsing dots
  dotsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: GOLD,
  },
});
