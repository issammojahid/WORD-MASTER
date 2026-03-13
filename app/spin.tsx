import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const LOGO = {
  cyan:   "#00D4E8",
  pink:   "#FF3D9A",
  purple: "#A855F7",
  yellow: "#F5C842",
};

const WHEEL_SEGMENTS = [
  { type: "coins",     amount: 50,   label: "50",         color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "🪙" },
  { type: "xp",        amount: 100,  label: "100 XP",     color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "⭐" },
  { type: "coins",     amount: 100,  label: "100",        color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "🪙" },
  { type: "powerCard", amount: 1,    label: "بطاقة قوة",  color: LOGO.purple + "50", textColor: LOGO.purple,  icon: "🃏" },
  { type: "coins",     amount: 200,  label: "200",        color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "🪙" },
  { type: "xp",        amount: 200,  label: "XP مضاعف",  color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "🚀" },
  { type: "coins",     amount: 500,  label: "500",        color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "💰" },
  { type: "coins",     amount: 50,   label: "50",         color: LOGO.purple + "50", textColor: LOGO.purple,  icon: "🪙" },
];

export default function SpinScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, addCoins, addXp, updateProfile, addPowerCard } = usePlayer();
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<{ type: string; amount: number; label: string; icon: string } | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [countdown, setCountdown] = useState("");
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rewardScale = useRef(new Animated.Value(0)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    checkSpinAvailability();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [profile.lastSpinAt]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const checkSpinAvailability = () => {
    if (!profile.lastSpinAt) { setCanSpin(true); return; }
    const last = new Date(profile.lastSpinAt).getTime();
    setCanSpin(Date.now() - last >= 24 * 60 * 60 * 1000);
  };

  const updateCountdown = () => {
    if (!profile.lastSpinAt) { setCountdown(""); return; }
    const next = new Date(profile.lastSpinAt).getTime() + 24 * 60 * 60 * 1000;
    const remaining = next - Date.now();
    if (remaining <= 0) { setCanSpin(true); setCountdown(""); return; }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
  };

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setReward(null);
    rewardScale.setValue(0);
    rewardOpacity.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/player/${playerId}/spin`, baseUrl).toString(), { method: "POST" });

      let serverReward: { type: string; amount: number; label: string } | null = null;
      if (res.ok) {
        const data = await res.json();
        serverReward = data.reward;
        if (data.profile) {
          updateProfile({
            coins: data.profile.coins,
            xp: data.profile.xp,
            level: data.profile.level,
            lastSpinAt: data.profile.lastSpinAt,
          });
        }
      } else if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        if (data.nextSpinAt) {
          updateProfile({ lastSpinAt: new Date(data.nextSpinAt - 24 * 60 * 60 * 1000).toISOString() });
        }
        setCanSpin(false);
        setSpinning(false);
        return;
      } else {
        setSpinning(false);
        return;
      }

      // Find matching segment or pick a random one
      let targetIdx = serverReward
        ? WHEEL_SEGMENTS.findIndex(s => s.type === serverReward!.type && s.amount === serverReward!.amount)
        : -1;
      if (targetIdx < 0) targetIdx = Math.floor(Math.random() * WHEEL_SEGMENTS.length);

      const segAngle = 360 / WHEEL_SEGMENTS.length;
      const currentAngle = (spinAnim as any).__getValue() % 360;
      const targetAngle = (spinAnim as any).__getValue() - currentAngle + 360 * 6 + (360 - targetIdx * segAngle - segAngle / 2);

      Animated.timing(spinAnim, {
        toValue: targetAngle,
        duration: 4200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        const seg = WHEEL_SEGMENTS[targetIdx];
        const finalReward = { type: seg.type, amount: seg.amount, label: seg.label, icon: seg.icon };
        setReward(finalReward);

        // Apply reward client-side if not applied by server
        if (seg.type === "powerCard") {
          const cards: ("time" | "freeze" | "hint")[] = ["time", "freeze", "hint"];
          addPowerCard(cards[Math.floor(Math.random() * cards.length)], 1);
        }

        setSpinning(false);
        setCanSpin(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.parallel([
          Animated.spring(rewardScale, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
          Animated.timing(rewardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
      });
    } catch {
      setSpinning(false);
    }
  };

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient
        colors={["#0C0A1E", "#160D33", "#0A1428"]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>العجلة اليومية 🎰</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        {/* Wheel */}
        <View style={styles.wheelContainer}>
          <View style={styles.pointerContainer}>
            <View style={styles.pointer} />
          </View>
          <Animated.View style={[styles.wheel, { transform: [{ rotate: spinRotation }, { scale: pulseAnim }] }]}>
            {WHEEL_SEGMENTS.map((seg, idx) => {
              const angle = (idx * 360) / WHEEL_SEGMENTS.length;
              return (
                <View
                  key={idx}
                  style={[
                    styles.segment,
                    { transform: [{ rotate: `${angle}deg` }, { translateY: -88 }], backgroundColor: seg.color },
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
          <Animated.View style={[styles.rewardBanner, { opacity: rewardOpacity, transform: [{ scale: rewardScale }] }]}>
            <Text style={styles.rewardEmoji}>{reward.icon}</Text>
            <View>
              <Text style={styles.rewardTitle}>🎉 مبروك!</Text>
              <Text style={styles.rewardValue}>
                {reward.type === "powerCard"
                  ? "بطاقة قوة إضافية! 🃏"
                  : reward.type === "xp"
                    ? `⭐ +${reward.amount} XP`
                    : `🪙 +${reward.amount} عملة`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Countdown */}
        {!canSpin && countdown ? (
          <View style={styles.countdownContainer}>
            <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.countdownLabel}>الدورة القادمة بعد</Text>
            <Text style={styles.countdownTime}>{countdown}</Text>
          </View>
        ) : null}

        {/* Spin button */}
        <TouchableOpacity
          style={[styles.spinBtnWrapper, (!canSpin || spinning) && { opacity: 0.6 }]}
          onPress={handleSpin}
          disabled={!canSpin || spinning}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={canSpin && !spinning ? [LOGO.yellow, LOGO.pink] : ["#333", "#222"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.spinBtn}
          >
            <Ionicons name="sync" size={22} color={canSpin && !spinning ? "#000" : Colors.textMuted} />
            <Text style={[styles.spinBtnText, (!canSpin || spinning) && { color: Colors.textMuted }]}>
              {spinning ? "جارٍ الدوران..." : canSpin ? "ادر العجلة!" : "غداً إن شاء الله"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Rewards info */}
        <View style={styles.infoRow}>
          {[
            { icon: "🪙", label: "50-500 عملة" },
            { icon: "⭐", label: "XP مضاعف" },
            { icon: "🃏", label: "بطاقة قوة" },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              <Text style={styles.infoIcon}>{item.icon}</Text>
              <Text style={styles.infoLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
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
  title: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary },
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
    borderWidth: 3, borderColor: LOGO.purple + "60",
    alignItems: "center", justifyContent: "center",
    shadowColor: LOGO.purple, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
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
  rewardValue: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: Colors.textPrimary },

  countdownContainer: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  countdownLabel: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textMuted },
  countdownTime: { fontFamily: "Cairo_700Bold", fontSize: 16, color: LOGO.yellow },

  spinBtnWrapper: { width: "100%", borderRadius: 18, overflow: "hidden" },
  spinBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, paddingHorizontal: 40,
  },
  spinBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000" },

  infoRow: { flexDirection: "row", gap: 16 },
  infoItem: { alignItems: "center", gap: 4 },
  infoIcon: { fontSize: 22 },
  infoLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted },
});
