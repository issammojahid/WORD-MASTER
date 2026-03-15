import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";

const ACCENT = {
  gold:   "#F5C842",
  cyan:   "#00D4E8",
  purple: "#A855F7",
  green:  "#22C55E",
};

type Achievement = {
  key: string; icon: string; titleAr: string; descAr: string;
  target: number; type: string; rewardCoins: number; rewardXp: number;
  rowId?: string; progress: number; unlocked: boolean; claimed: boolean;
};

type ApiFetchOptions = { method?: string; body?: BodyInit; headers?: HeadersInit };
async function apiFetch(url: string, options?: ApiFetchOptions) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("[apiFetch] non-OK status:", res.status, url);
      return null;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (e: unknown) {
    console.error("[apiFetch] error:", e instanceof Error ? e.message : String(e), url);
    return null;
  }
}

function AnimatedProgressBar({ pct, color }: { pct: number; color: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, {
        width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.7,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});

const ClaimButton = memo(({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ])).start();
    const runShine = () => {
      shine.setValue(-80);
      Animated.sequence([
        Animated.timing(shine, { toValue: 110, duration: 700, useNativeDriver: true }),
        Animated.delay(2500),
      ]).start(() => runShine());
    };
    runShine();
    return () => { pulse.stopAnimation(); shine.stopAnimation(); };
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={{ overflow: "hidden", borderRadius: 12 }}>
        <LinearGradient colors={[ACCENT.gold, "#E6A800"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={clb.btn}>
          <Text style={clb.text}>استلم</Text>
          <Animated.View style={[clb.shine, { transform: [{ translateX: shine }, { rotate: "20deg" }] }]} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});
const clb = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  text: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#000" },
  shine: { position: "absolute", top: 0, bottom: 0, width: 28, backgroundColor: "rgba(255,255,255,0.35)" },
});

function AchCard({ ach, onClaim, isPending }: { ach: Achievement; onClaim: () => void; isPending: boolean }) {
  const pct = Math.min(1, ach.progress / ach.target);
  const barColor = ach.unlocked ? ACCENT.gold : ACCENT.cyan;
  const borderColor = ach.claimed
    ? ACCENT.green + "40"
    : ach.unlocked
    ? ACCENT.gold + "55"
    : "rgba(255,255,255,0.06)";
  const bgGrad: [string, string] = ach.claimed
    ? ["rgba(34,197,94,0.06)", "rgba(34,197,94,0.01)"]
    : ach.unlocked
    ? ["rgba(245,200,66,0.12)", "rgba(245,200,66,0.03)"]
    : ["rgba(255,255,255,0.03)", "rgba(255,255,255,0.01)"];

  return (
    <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[ac.card, { borderColor, opacity: ach.claimed ? 0.65 : 1 }]}>
      <View style={[ac.iconWrap, {
        backgroundColor: ach.unlocked ? ACCENT.gold + "22" : "rgba(255,255,255,0.05)",
        borderColor: ach.unlocked ? ACCENT.gold + "40" : "rgba(255,255,255,0.08)",
        shadowColor: ach.unlocked ? ACCENT.gold : "transparent",
        shadowOpacity: ach.unlocked ? 0.4 : 0,
        shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }]}>
        <Text style={[ac.icon, { opacity: ach.unlocked ? 1 : 0.35 }]}>{ach.icon}</Text>
        {ach.unlocked && !ach.claimed && (
          <View style={ac.unlockedDot} />
        )}
      </View>

      <View style={ac.content}>
        <Text style={[ac.title, { color: ach.unlocked ? "#F0E6D3" : "rgba(255,255,255,0.4)" }]}>
          {ach.titleAr}
        </Text>
        <Text style={ac.desc}>{ach.descAr}</Text>
        <View style={ac.progressRow}>
          <AnimatedProgressBar pct={pct} color={barColor} />
          <Text style={ac.progressNum}>{ach.progress}/{ach.target}</Text>
        </View>
        <View style={ac.rewards}>
          {ach.rewardCoins > 0 && (
            <View style={ac.rewardPill}>
              <Text style={ac.rewardText}>🪙 {ach.rewardCoins}</Text>
            </View>
          )}
          {ach.rewardXp > 0 && (
            <View style={[ac.rewardPill, { backgroundColor: ACCENT.cyan + "18" }]}>
              <Text style={[ac.rewardText, { color: ACCENT.cyan }]}>⭐ {ach.rewardXp} XP</Text>
            </View>
          )}
        </View>
      </View>

      <View style={ac.action}>
        {ach.claimed ? (
          <Ionicons name="checkmark-circle" size={32} color={ACCENT.green} />
        ) : ach.unlocked ? (
          <ClaimButton onPress={onClaim} disabled={isPending} />
        ) : (
          <View style={ac.lockCircle}>
            <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.2)" />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}
const ac = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, padding: 14, borderWidth: 1, gap: 12,
  },
  iconWrap: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, elevation: 4,
  },
  icon: { fontSize: 26 },
  unlockedDot: {
    position: "absolute", top: 3, right: 3,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: ACCENT.gold,
    borderWidth: 1.5, borderColor: "#0C0A1E",
  },
  content: { flex: 1, gap: 4 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  desc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "rgba(255,255,255,0.38)" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressNum: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "rgba(255,255,255,0.38)", minWidth: 32, textAlign: "right" },
  rewards: { flexDirection: "row", gap: 6, marginTop: 5 },
  rewardPill: { backgroundColor: ACCENT.gold + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: ACCENT.gold },
  action: { alignItems: "center", justifyContent: "center" },
  lockCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
});

function AchievementsScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, addCoins, addXp } = usePlayer();
  const { isDark } = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: achievementsRaw, isLoading, refetch } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements", playerId],
    queryFn: async () => {
      const url = new URL(`/api/achievements/${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: !!playerId, staleTime: 0, initialData: [],
  });

  useFocusEffect(useCallback(() => { if (playerId) refetch(); }, [playerId, refetch]));

  const achievements: Achievement[] = Array.isArray(achievementsRaw) ? achievementsRaw : [];

  const claimAchievement = useMutation({
    mutationFn: async (key: string) => {
      const url = new URL(`/api/achievements/${playerId}/claim/${key}`, getApiUrl());
      const data = await apiFetch(url.toString(), { method: "POST" });
      return data;
    },
    onSuccess: (data) => {
      if (!data) {
        Alert.alert("خطأ في الاتصال", "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.");
        return;
      }
      if (!data.success) {
        const errorMessages: Record<string, string> = {
          already_claimed: "لقد استلمت هذه المكافأة مسبقاً.",
          not_unlocked: "لم تُكمل هذا الإنجاز بعد.",
          player_not_found: "لم يتم العثور على ملفك الشخصي. أعد تشغيل التطبيق.",
          unknown_achievement: "إنجاز غير معروف.",
          server_error: "حدث خطأ في الخادم. حاول مجدداً.",
        };
        const msg = errorMessages[data.error] || "حدث خطأ غير متوقع.";
        Alert.alert("تعذّر استلام المكافأة", msg);
        return;
      }
      if (data.coinsEarned > 0) addCoins(data.coinsEarned);
      if (data.xpEarned > 0) addXp(data.xpEarned);
      qc.invalidateQueries({ queryKey: ["/api/achievements", playerId] });
      const parts: string[] = [];
      if (data.coinsEarned > 0) parts.push(`🪙 +${data.coinsEarned} عملة`);
      if (data.xpEarned > 0) parts.push(`⭐ +${data.xpEarned} XP`);
      Alert.alert("تم الاستلام! 🎉", parts.length > 0 ? parts.join("  |  ") : "تم استلام المكافأة بنجاح");
    },
    onError: () => {
      Alert.alert("خطأ في الاتصال", "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مجدداً.");
    },
  });

  const filtered = achievements.filter((a) => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "locked") return !a.unlocked;
    return true;
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const claimedCount = achievements.filter((a) => a.claimed).length;
  const readyToClaim = achievements.filter((a) => a.unlocked && !a.claimed).length;

  const FILTER_LABELS = { all: "الكل", unlocked: "مفتوحة", locked: "مقفلة" } as const;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0C0A1E", "#10092A", "#0A1428"] : ["#F8F6FF", "#EEF2FF", "#F8F6FF"]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ paddingTop: topInset + 8, paddingBottom: bottomInset, flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#F0E6D3" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>الإنجازات</Text>
            {readyToClaim > 0 && (
              <View style={s.readyBadge}>
                <Text style={s.readyBadgeText}>{readyToClaim} جاهزة للاستلام</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => refetch()}>
            <Ionicons name="refresh" size={18} color={ACCENT.purple} />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={["rgba(168,85,247,0.10)", "rgba(0,212,232,0.07)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.summaryCard}
        >
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: ACCENT.gold }]}>{unlockedCount}</Text>
              <Text style={s.summaryLabel}>مفتوحة</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: ACCENT.cyan }]}>{achievements.length - unlockedCount}</Text>
              <Text style={s.summaryLabel}>متبقية</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: ACCENT.green }]}>{claimedCount}</Text>
              <Text style={s.summaryLabel}>استُلمت</Text>
            </View>
          </View>
          <View style={s.overallBar}>
            <View style={[s.overallFill, {
              width: `${achievements.length > 0 ? (claimedCount / achievements.length) * 100 : 0}%` as any,
            }]} />
          </View>
        </LinearGradient>

        <View style={s.filterRow}>
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              {filter === f ? (
                <LinearGradient colors={[ACCENT.purple + "40", ACCENT.cyan + "30"]} style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]} />
              ) : null}
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={ACCENT.gold} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyIcon}>🏆</Text>
            <Text style={s.emptyText}>لا توجد إنجازات هنا</Text>
            <Text style={s.emptySubText}>العب وتقدم للحصول على الإنجازات</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {filtered.map((ach) => (
              <AchCard
                key={ach.key}
                ach={ach}
                onClaim={() => claimAchievement.mutate(ach.key)}
                isPending={claimAchievement.isPending}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 19, color: "#F0E6D3" },
  readyBadge: {
    backgroundColor: ACCENT.gold + "25", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: ACCENT.gold + "40",
  },
  readyBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: ACCENT.gold },
  refreshBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: ACCENT.purple + "18",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: ACCENT.purple + "30",
  },

  summaryCard: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 22, padding: 18,
    borderWidth: 1, borderColor: "rgba(168,85,247,0.20)",
    gap: 14,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryItem: { alignItems: "center", gap: 3 },
  summaryNum: { fontFamily: "Cairo_700Bold", fontSize: 24 },
  summaryLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)" },
  summaryDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.10)" },
  overallBar: { height: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" },
  overallFill: { height: "100%", borderRadius: 3, backgroundColor: ACCENT.purple },

  filterRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 4, gap: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  filterTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", overflow: "hidden" },
  filterTabActive: { },
  filterText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "rgba(255,255,255,0.4)" },
  filterTextActive: { color: "#F0E6D3" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "rgba(255,255,255,0.7)" },
  emptySubText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
});

export default function AchievementsScreen() {
  return (
    <ScreenErrorBoundary screenName="الإنجازات">
      <AchievementsScreenInner />
    </ScreenErrorBoundary>
  );
}
