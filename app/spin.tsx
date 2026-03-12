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
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const WHEEL_SEGMENTS = [
  { type: "coins", amount: 25, label: "25", color: Colors.gold + "40", textColor: Colors.gold },
  { type: "xp", amount: 50, label: "50 XP", color: Colors.sapphire + "40", textColor: Colors.sapphire },
  { type: "coins", amount: 100, label: "100", color: Colors.emerald + "40", textColor: Colors.emerald },
  { type: "xp", amount: 100, label: "100 XP", color: Colors.sapphire + "40", textColor: Colors.sapphire },
  { type: "coins", amount: 200, label: "200", color: Colors.gold + "40", textColor: Colors.gold },
  { type: "coins", amount: 50, label: "50", color: Colors.emerald + "40", textColor: Colors.emerald },
  { type: "xp", amount: 200, label: "200 XP", color: Colors.sapphire + "40", textColor: Colors.sapphire },
  { type: "coins", amount: 500, label: "500", color: Colors.ruby + "40", textColor: Colors.ruby },
];

export default function SpinScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, addCoins, addXp, updateProfile } = usePlayer();
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<{ type: string; amount: number; label: string } | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [countdown, setCountdown] = useState("");
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
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
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const checkSpinAvailability = () => {
    if (!profile.lastSpinAt) {
      setCanSpin(true);
      return;
    }
    const last = new Date(profile.lastSpinAt).getTime();
    const elapsed = Date.now() - last;
    setCanSpin(elapsed >= 24 * 60 * 60 * 1000);
  };

  const updateCountdown = () => {
    if (!profile.lastSpinAt) {
      setCountdown("");
      return;
    }
    const next = new Date(profile.lastSpinAt).getTime() + 24 * 60 * 60 * 1000;
    const remaining = next - Date.now();
    if (remaining <= 0) {
      setCanSpin(true);
      setCountdown("");
      return;
    }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
  };

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setReward(null);
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

      const targetIdx = serverReward ? WHEEL_SEGMENTS.findIndex(s => s.type === serverReward!.type && s.amount === serverReward!.amount) : 0;
      const segAngle = 360 / WHEEL_SEGMENTS.length;
      const targetAngle = 360 * 5 + (360 - targetIdx * segAngle - segAngle / 2);

      Animated.timing(spinAnim, {
        toValue: targetAngle,
        duration: 4000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setReward(serverReward);
        setSpinning(false);
        setCanSpin(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.timing(rewardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>العجلة اليومية</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
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
                    {
                      transform: [{ rotate: `${angle}deg` }, { translateY: -80 }],
                      backgroundColor: seg.color,
                    },
                  ]}
                >
                  <Text style={[styles.segmentText, { color: seg.textColor }]}>
                    {seg.type === "coins" ? "🪙" : "⭐"} {seg.label}
                  </Text>
                </View>
              );
            })}
            <View style={styles.wheelCenter}>
              <Ionicons name="gift" size={28} color={Colors.gold} />
            </View>
          </Animated.View>
        </View>

        {reward && (
          <Animated.View style={[styles.rewardBanner, { opacity: rewardOpacity }]}>
            <Text style={styles.rewardTitle}>🎉 مبروك!</Text>
            <Text style={styles.rewardValue}>
              {reward.type === "coins" ? "🪙" : "⭐"} +{reward.amount} {reward.type === "coins" ? "عملة" : "XP"}
            </Text>
          </Animated.View>
        )}

        {!canSpin && countdown ? (
          <View style={styles.countdownContainer}>
            <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.countdownLabel}>الدورة القادمة بعد</Text>
            <Text style={styles.countdownTime}>{countdown}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.spinBtn, (!canSpin || spinning) && styles.spinBtnDisabled]}
          onPress={handleSpin}
          disabled={!canSpin || spinning}
          activeOpacity={0.8}
        >
          <Ionicons name="sync" size={22} color={canSpin && !spinning ? Colors.black : Colors.textMuted} />
          <Text style={[styles.spinBtnText, (!canSpin || spinning) && styles.spinBtnTextDisabled]}>
            {spinning ? "جارٍ الدوران..." : canSpin ? "ادر العجلة!" : "غداً إن شاء الله"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.card, justifyContent: "center", alignItems: "center",
  },
  title: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  wheelContainer: { width: 280, height: 280, alignItems: "center", justifyContent: "center", marginBottom: 30 },
  pointerContainer: { position: "absolute", top: -10, zIndex: 10, alignItems: "center" },
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 20,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: Colors.gold,
  },
  wheel: {
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: Colors.card, borderWidth: 4, borderColor: Colors.gold + "60",
    alignItems: "center", justifyContent: "center",
  },
  segment: {
    position: "absolute", width: 80, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  segmentText: { fontFamily: "Cairo_700Bold", fontSize: 11 },
  wheelCenter: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 2, borderColor: Colors.gold + "40",
    alignItems: "center", justifyContent: "center",
  },
  rewardBanner: {
    backgroundColor: Colors.gold + "20", borderRadius: 16,
    paddingHorizontal: 30, paddingVertical: 16, alignItems: "center",
    borderWidth: 1, borderColor: Colors.gold + "40", marginBottom: 20,
  },
  rewardTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.gold, marginBottom: 4 },
  rewardValue: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  countdownContainer: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.card + "80", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 20,
  },
  countdownLabel: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textMuted },
  countdownTime: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  spinBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.gold, paddingHorizontal: 40, paddingVertical: 16,
    borderRadius: 16, marginTop: 10,
  },
  spinBtnDisabled: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  spinBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.black },
  spinBtnTextDisabled: { color: Colors.textMuted },
});
