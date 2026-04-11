import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  ImageBackground,
} from "react-native";
const BG_SPIN = require("@/assets/images/bg_spin.png");
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const LOGO = {
  cyan:   "#00F5FF",
  pink:   "#FF006E",
  purple: "#BF00FF",
  yellow: "#F5C842",
};

const WHEEL_SEGMENTS = [
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "🪙" },
  { type: "xp",        amount: 100,  label: "100 XP",    color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "⭐" },
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "🪙" },
  { type: "coins",     amount: 100,  label: "100",       color: LOGO.purple + "50", textColor: LOGO.purple,  icon: "🪙" },
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "🪙" },
  { type: "powerCard", amount: 1,    label: "بطاقة قوة", color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "🃏" },
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "🪙" },
  { type: "coins",     amount: 100,  label: "100",       color: LOGO.purple + "50", textColor: LOGO.purple,  icon: "🪙" },
  { type: "coins",     amount: 200,  label: "200",       color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "🪙" },
  { type: "xp",        amount: 200,  label: "XP مضاعف", color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "🚀" },
  { type: "coins",     amount: 100,  label: "100",       color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "🪙" },
  { type: "coins",     amount: 500,  label: "500",       color: LOGO.purple + "50", textColor: LOGO.yellow,  icon: "💰" },
];

const SEG_COUNT = WHEEL_SEGMENTS.length;
const SEG_ANGLE = SEG_COUNT > 0 ? 360 / SEG_COUNT : 45;

export default function SpinScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, addCoins, addXp, updateProfile, addPowerCard } = usePlayer();
  const { theme } = useTheme();
  const [spinning, setSpinning]     = useState(false);
  const [reward, setReward]         = useState<{ type: string; amount: number; label: string; icon: string } | null>(null);
  const [canSpin, setCanSpin]       = useState(true);
  const [countdown, setCountdown]   = useState("");

  // Tracks the accumulated rotation so each new spin starts from the correct angle.
  const currentAngleRef = useRef(0);

  // spinAnim drives a continuous, ever-increasing value.
  const spinAnim      = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const rewardScale   = useRef(new Animated.Value(0)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;

  const topInset    = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // ─── Cooldown checks ───────────────────────────────────────────────────────
  useEffect(() => {
    checkSpinAvailability();
  }, [profile.lastSpinAt]);

  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [profile.lastSpinAt]);

  // ─── Idle pulse animation ──────────────────────────────────────────────────
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = () => {
    if (pulseLoopRef.current) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current = loop;
    loop.start();
  };

  const stopPulse = () => {
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }
    pulseAnim.setValue(1);
  };

  useEffect(() => {
    startPulse();
    return () => stopPulse();
  }, []);

  const checkSpinAvailability = () => {
    try {
      if (!profile?.lastSpinAt) { setCanSpin(true); return; }
      const last = new Date(profile.lastSpinAt).getTime();
      setCanSpin(Date.now() - last >= 24 * 60 * 60 * 1000);
    } catch {
      setCanSpin(true);
    }
  };

  const updateCountdown = () => {
    try {
      if (!profile?.lastSpinAt) { setCountdown(""); return; }
      const next = new Date(profile.lastSpinAt).getTime() + 24 * 60 * 60 * 1000;
      const remaining = next - Date.now();
      if (remaining <= 0) { setCanSpin(true); setCountdown(""); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    } catch {
      setCountdown("");
    }
  };

  // ─── Spin logic ────────────────────────────────────────────────────────────
  const handleSpin = async () => {
    if (spinning || !canSpin || SEG_COUNT === 0) return;

    setSpinning(true);
    setReward(null);
    rewardScale.setValue(0);
    rewardOpacity.setValue(0);
    stopPulse();

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(
        new URL(`/api/player/${playerId}/spin`, baseUrl).toString(),
        { method: "POST" }
      );

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        if (data.nextSpinAt) {
          updateProfile({ lastSpinAt: new Date(data.nextSpinAt - 24 * 60 * 60 * 1000).toISOString() });
        }
        setCanSpin(false);
        setSpinning(false);
        startPulse();
        return;
      }

      let targetIdx = -1;
      if (res.ok) {
        const data = await res.json();
        const serverReward: { type: string; amount: number } | null = data.reward ?? null;

        // Sync updated profile (coins, xp, lastSpinAt) from server
        if (data.profile) {
          updateProfile({
            coins:      data.profile.coins,
            xp:         data.profile.xp,
            level:      data.profile.level,
            lastSpinAt: data.profile.lastSpinAt,
          });
        }

        // Find the wheel segment that matches the server reward
        if (serverReward) {
          targetIdx = WHEEL_SEGMENTS.findIndex(
            s => s.type === serverReward.type && s.amount === serverReward.amount
          );
        }
      }

      // Fallback: pick a random segment if server didn't match any
      if (targetIdx < 0) {
        targetIdx = Math.floor(Math.random() * SEG_COUNT);
      }

      runSpinAnimation(targetIdx);
    } catch {
      // Network error — still spin to a random reward so the screen doesn't freeze
      const targetIdx = Math.floor(Math.random() * SEG_COUNT);
      runSpinAnimation(targetIdx);
    }
  };

  const runSpinAnimation = (targetIdx: number) => {
    // The pointer is at the top (0°).  Each segment i occupies degrees [i*SEG_ANGLE, (i+1)*SEG_ANGLE].
    // To land segment targetIdx under the pointer we need its centre at 0°.
    // Segment centre = targetIdx * SEG_ANGLE + SEG_ANGLE/2 (measured clockwise from 0°).
    // We want to rotate the wheel CLOCKWISE so that centre ends at top (0°).
    // Clockwise rotation needed = 360 - (targetIdx * SEG_ANGLE + SEG_ANGLE/2)
    const segmentCentre = targetIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const landingAngle  = 360 - segmentCentre;

    // Add 6 full extra rotations for a satisfying spin, then land on the target.
    const nextAngle = currentAngleRef.current + 360 * 6 + ((landingAngle - currentAngleRef.current % 360) + 360) % 360;
    currentAngleRef.current = nextAngle;

    Animated.timing(spinAnim, {
      toValue:        nextAngle,
      duration:       4000,
      easing:         Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;

      const seg = WHEEL_SEGMENTS[targetIdx];
      if (!seg) { setSpinning(false); startPulse(); return; }

      const finalReward = { type: seg.type, amount: seg.amount, label: seg.label, icon: seg.icon };
      setReward(finalReward);

      // Apply reward locally as a UI-layer safety net
      try {
        if (seg.type === "coins")     addCoins(seg.amount);
        else if (seg.type === "xp")   addXp(seg.amount);
        else if (seg.type === "powerCard") {
          const cards: ("time" | "freeze" | "hint")[] = ["time", "freeze", "hint"];
          addPowerCard(cards[Math.floor(Math.random() * cards.length)], 1);
        }
      } catch {}

      setSpinning(false);
      setCanSpin(false);

      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

      Animated.parallel([
        Animated.spring(rewardScale,   { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
        Animated.timing(rewardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();

      startPulse();
    });
  };

  // KEY FIX: extrapolate: "extend" allows values beyond [0,360] to map correctly
  // Without this the interpolation clamps at 360° and the wheel barely moves.
  const spinRotation = spinAnim.interpolate({
    inputRange:  [0, 360],
    outputRange: ["0deg", "360deg"],
    extrapolate: "extend",
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <ImageBackground source={BG_SPIN} style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]} resizeMode="cover">
      <LinearGradient
        colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.60)", "rgba(0,0,0,0.72)"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient glow blobs */}
      <View style={{ position: "absolute", top: 80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: LOGO.purple + "18" }} />
      <View style={{ position: "absolute", bottom: 100, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: LOGO.cyan + "10" }} />
      <View style={{ position: "absolute", top: "40%", left: "30%", width: 140, height: 140, borderRadius: 70, backgroundColor: LOGO.yellow + "08" }} />

      {/* Floating particles */}
      {["✨","⭐","💫","✦","🌟","✨","💫","⭐"].map((sym, i) => (
        <Text key={i} style={{ position: "absolute", fontSize: 14 + (i % 3) * 4, opacity: 0.15 + (i % 4) * 0.06,
          top: 60 + (i * 55) % 400, left: (i * 73) % 340 }}>{sym}</Text>
      ))}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>العجلة اليومية 🎰</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>

        {/* Wheel */}
        <View style={styles.wheelContainer}>
          {/* Pointer triangle */}
          <View style={styles.pointerContainer}>
            <View style={styles.pointer} />
          </View>

          <Animated.View
            style={[
              styles.wheel,
              { transform: [{ rotate: spinRotation }, { scale: pulseAnim }] },
            ]}
          >
            {WHEEL_SEGMENTS.map((seg, idx) => {
              const angle = (idx * 360) / SEG_COUNT;
              return (
                <View
                  key={idx}
                  style={[
                    styles.segment,
                    {
                      transform: [{ rotate: `${angle}deg` }, { translateY: -88 }],
                      backgroundColor: seg.color,
                    },
                  ]}
                >
                  <Text style={styles.segmentIcon}>{seg.icon}</Text>
                  <Text style={[styles.segmentText, { color: seg.textColor }]}>{seg.label}</Text>
                </View>
              );
            })}

            <LinearGradient
              colors={[LOGO.yellow + "60", LOGO.yellow + "30"]}
              style={styles.wheelCenter}
            >
              <Ionicons name="gift" size={28} color={LOGO.yellow} />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Reward banner */}
        {reward && (
          <Animated.View
            style={[
              styles.rewardBanner,
              { opacity: rewardOpacity, transform: [{ scale: rewardScale }] },
            ]}
          >
            <Text style={styles.rewardEmoji}>{reward.icon}</Text>
            <View>
              <Text style={styles.rewardTitle}>🎉 مبروك!</Text>
              <Text style={[styles.rewardValue, { color: theme.textPrimary }]}>
                {reward.type === "powerCard"
                  ? "بطاقة قوة إضافية! 🃏"
                  : reward.type === "xp"
                  ? `⭐ +${reward.amount} XP`
                  : `🪙 +${reward.amount} عملة`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Cooldown message + countdown */}
        {!canSpin && (
          <View style={styles.cooldownContainer}>
            <Text style={[styles.cooldownMsg, { color: theme.textMuted }]}>يمكنك تدوير العجلة مرة واحدة يومياً</Text>
            {countdown ? (
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                <Text style={[styles.countdownLabel, { color: theme.textMuted }]}>الدورة القادمة بعد</Text>
                <Text style={styles.countdownTime}>{countdown}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Spin button */}
        <TouchableOpacity
          style={[styles.spinBtnWrapper, (!canSpin || spinning) && { opacity: 0.6 }]}
          onPress={handleSpin}
          disabled={!canSpin || spinning}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={canSpin && !spinning ? [LOGO.yellow, LOGO.pink] : ["#333", "#222"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.spinBtn}
          >
            <Ionicons
              name="sync"
              size={22}
              color={canSpin && !spinning ? "#000" : theme.textMuted}
            />
            <Text style={[styles.spinBtnText, (!canSpin || spinning) && { color: theme.textMuted }]}>
              {spinning ? "جارٍ الدوران..." : canSpin ? "ادر العجلة!" : "غداً إن شاء الله"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Reward types info */}
        <View style={styles.infoRow}>
          {[
            { icon: "🪙", label: "50-500 عملة" },
            { icon: "⭐", label: "XP مضاعف" },
            { icon: "🃏", label: "بطاقة قوة" },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              <Text style={styles.infoIcon}>{item.icon}</Text>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center",
  },
  title: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 20 },

  wheelContainer: { width: 300, height: 300, alignItems: "center", justifyContent: "center" },
  pointerContainer: { position: "absolute", top: -12, zIndex: 10, alignItems: "center" },
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 22,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: LOGO.yellow,
  },
  wheel: {
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 4, borderColor: LOGO.purple + "88",
    alignItems: "center", justifyContent: "center",
    shadowColor: LOGO.purple, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 32, elevation: 20,
  },
  segment: {
    position: "absolute", width: 86, height: 42, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  segmentIcon: { fontSize: 14 },
  segmentText: { fontFamily: "Cairo_700Bold", fontSize: 10 },
  wheelCenter: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: LOGO.yellow + "60",
  },

  rewardBanner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18,
    paddingHorizontal: 24, paddingVertical: 16,
    borderWidth: 1, borderColor: LOGO.yellow + "40",
  },
  rewardEmoji: { fontSize: 36 },
  rewardTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: LOGO.yellow },
  rewardValue: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#E8E8FF" },

  cooldownContainer: { alignItems: "center", gap: 6 },
  cooldownMsg: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#5A5A88", textAlign: "center" },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  countdownLabel: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#5A5A88" },
  countdownTime: { fontFamily: "Cairo_700Bold", fontSize: 15, color: LOGO.yellow },

  spinBtnWrapper: { width: "100%", borderRadius: 18, overflow: "hidden" },
  spinBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, paddingHorizontal: 40,
  },
  spinBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000" },

  infoRow: { flexDirection: "row", gap: 16 },
  infoItem: { alignItems: "center", gap: 4 },
  infoIcon: { fontSize: 22 },
  infoLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#5A5A88" },
});
