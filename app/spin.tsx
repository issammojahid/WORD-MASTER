import Svg, { Path, Circle } from "react-native-svg";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { GameHeader, GameScreenBackground, useReducedMotion } from "@/components/GameUi";
import { GameIcon } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";
import { useLanguage } from "@/contexts/LanguageContext";

const LOGO = {
  cyan: gameDesign.colors.profile,
  pink: gameDesign.colors.danger,
  purple: gameDesign.colors.online,
  yellow: gameDesign.colors.coins,
};

const WHEEL_SEGMENTS = [
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "coins" },
  { type: "xp",        amount: 100,  label: "100 XP",    color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "sparkles" },
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "coins" },
  { type: "coins",     amount: 100,  label: "100",       color: LOGO.purple + "50", textColor: LOGO.purple,  icon: "coins" },
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "coins" },
  { type: "powerCard", amount: 1,    label: "قوة", color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "flash" },
  { type: "coins",     amount: 50,   label: "50",        color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "coins" },
  { type: "coins",     amount: 100,  label: "100",       color: LOGO.purple + "50", textColor: LOGO.purple,  icon: "coins" },
  { type: "coins",     amount: 200,  label: "200",       color: LOGO.yellow + "50", textColor: LOGO.yellow,  icon: "coins" },
  { type: "xp",        amount: 200,  label: "XP", color: LOGO.cyan   + "50", textColor: LOGO.cyan,    icon: "sparkles" },
  { type: "coins",     amount: 100,  label: "100",       color: LOGO.pink   + "50", textColor: LOGO.pink,    icon: "coins" },
  { type: "coins",     amount: 500,  label: "500",       color: LOGO.purple + "50", textColor: LOGO.yellow,  icon: "coins" },
];

const SEG_COUNT = WHEEL_SEGMENTS.length;
const SEG_ANGLE = SEG_COUNT > 0 ? 360 / SEG_COUNT : 45;

export default function SpinScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();
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

  const topInset    = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const wheelSize = Math.min(Math.max(width - 48, 236), 280);

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
    if (reduceMotion) return;
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
  }, [reduceMotion]);

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
      duration:       reduceMotion ? 0 : 4000,
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

      if (reduceMotion) {
        rewardScale.setValue(1);
        rewardOpacity.setValue(1);
      } else Animated.parallel([
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
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <GameScreenBackground accent="reward" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.background+"A8"}]}/>
      <GameHeader
        title={isRTL ? "عجلة الحظ" : "Daily Spin"}
        subtitle={isRTL?"دورة مجانية واحدة كل يوم":"One free spin every day"}
        onBack={() => router.back()}
        icon={<Ionicons name="gift-outline" size={23} color={LOGO.yellow} />}
        trailing={<View style={styles.headerBalance}><GameIcon name="coins" size={21} color={LOGO.yellow} /><Text style={[styles.headerCoins, { color: theme.textPrimary }]}>{profile.coins.toLocaleString()}</Text></View>}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.introTitle,{color:theme.textPrimary}]}>{isRTL?"مكافأتك اليومية تنتظرك":"Your daily reward awaits"}</Text>

        {/* Wheel */}
        <View style={[styles.wheelContainer,{width:wheelSize,height:wheelSize,marginVertical:8}]}>
          {/* Pointer triangle */}
          <View style={styles.pointerContainer}>
            <View style={styles.pointer} />
          </View>

          <Animated.View
            style={[
              styles.wheel,
              { width: wheelSize, height: wheelSize, borderRadius: wheelSize / 2 },
              { transform: [{ rotate: spinRotation }, { scale: pulseAnim }] },
            ]}
          >
            <Svg width={wheelSize} height={wheelSize} viewBox="0 0 280 280" style={StyleSheet.absoluteFill}>
              {WHEEL_SEGMENTS.map((_,index)=>{const start=(index*360/SEG_COUNT-90-180/SEG_COUNT)*Math.PI/180,end=(index*360/SEG_COUNT-90+180/SEG_COUNT)*Math.PI/180;return <Path key={index} d={"M140 140 L"+(140+132*Math.cos(start))+" "+(140+132*Math.sin(start))+" A132 132 0 0 1 "+(140+132*Math.cos(end))+" "+(140+132*Math.sin(end))+" Z"} fill={index%2?"#382246":"#193B48"} stroke="#B28B57" strokeWidth={1}/>;})}
              <Circle cx={140} cy={140} r={133} fill="none" stroke="#F2D18D" strokeWidth={3}/>
            </Svg>
            {WHEEL_SEGMENTS.map((seg, idx) => {
              const angle = (idx * 360) / SEG_COUNT;
              return (
                <View
                  key={idx}
                  style={[
                    styles.segment,
                    {
                      width: wheelSize * 0.31,
                      height: wheelSize * 0.15,
                      transform: [{ rotate: `${angle}deg` }, { translateY: -wheelSize * 0.314 }],
                      backgroundColor: "transparent",
                    },
                  ]}
                >
                  {seg.icon === "coins"
                    ? <GameIcon name="coins" size={15} color={seg.textColor} />
                    : <Ionicons name={seg.icon === "sparkles" ? "sparkles-outline" : "flash-outline"} size={15} color={seg.textColor} />}
                  <Text style={[styles.segmentText, { color: seg.textColor }]}>{isRTL?seg.label.replace("XP","خبرة"):seg.label}</Text>
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
            <GameIcon name={reward.type === "coins" ? "coins" : "achievements"} size={36} color={LOGO.yellow} />
            <View>
              <Text style={styles.rewardTitle}>{isRTL ? "مبروك!" : "Congratulations!"}</Text>
              <Text style={[styles.rewardValue, { color: theme.textPrimary }]}>
                {reward.type === "powerCard"
                  ? (isRTL ? "بطاقة قوة إضافية!" : "Power card earned!")
                  : reward.type === "xp"
                  ? `+${reward.amount} ${isRTL?"نقطة خبرة":"XP"}`
                  : `+${reward.amount} ${isRTL ? "عملة" : "coins"}`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Cooldown message + countdown */}
        {!canSpin && (
          <View style={styles.cooldownContainer}>
            <Text style={[styles.cooldownMsg, { color: theme.textMuted }]}>{isRTL ? "يمكنك تدوير العجلة مرة واحدة يومياً" : "You can spin once per day"}</Text>
            {countdown ? (
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                <Text style={[styles.countdownLabel, { color: theme.textMuted }]}>{isRTL ? "الدورة القادمة بعد" : "Next spin in"}</Text>
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
            colors={canSpin && !spinning ? [LOGO.yellow, "#DCA557"] : ["#333", "#222"]}
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
              {spinning ? (isRTL ? "جارٍ الدوران..." : "Spinning...") : canSpin ? (isRTL ? "أدر العجلة!" : "Spin now") : (isRTL ? "غداً إن شاء الله" : "Come back tomorrow")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Reward types info */}
        <View style={styles.infoRow}>
          {[
            { icon: "coins", label: isRTL ? "50-500 عملة" : "50-500 coins" },
            { icon: "sparkles", label: isRTL ? "نقاط خبرة" : "Bonus XP" },
            { icon: "flash", label: isRTL ? "بطاقة قوة" : "Power card" },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              {item.icon === "coins"
                ? <GameIcon name="coins" size={22} color={LOGO.yellow} />
                : <Ionicons name={item.icon === "sparkles" ? "sparkles-outline" : "flash-outline"} size={22} color={LOGO.cyan} />}
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBalance: { minWidth: 48, height: 46, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  headerCoins: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center",
  },
  title: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#F6F7FF" },
  content: { flexGrow:1,width:"100%",maxWidth:560,alignSelf:"center",alignItems:"center",padding:20,paddingBottom:28,gap:20 },
  introTitle:{fontFamily:"Cairo_700Bold",fontSize:19,textAlign:"center",marginVertical:4},

  wheelContainer: { width: 300, height: 300, alignItems: "center", justifyContent: "center" },
  pointerContainer: { position: "absolute", top: -12, zIndex: 10, alignItems: "center" },
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 22,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: LOGO.yellow,
  },
  wheel: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0, borderColor: "#E2BB75",
    alignItems: "center", justifyContent: "center",
    shadowColor: LOGO.purple, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 20,
  },
  segment: {
    position: "absolute", borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
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
  rewardTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: LOGO.yellow },
  rewardValue: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#F6F7FF" },

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
