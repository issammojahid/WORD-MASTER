import { FantasySectionBanner } from "@/components/FantasySectionBanner";
import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { getApiUrl } from "@/lib/query-client";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { EmptyState, GameHeader, GameScreenBackground, LoadingState, useReducedMotion } from "@/components/GameUi";
import { GameIcon } from "@/components/GameIcon";
import { gameDesign } from "@/constants/game-design";

const ACCENT = {
  gold: gameDesign.colors.achievements,
  cyan: gameDesign.colors.missions,
  purple: gameDesign.colors.online,
  green: gameDesign.colors.success,
};

type Achievement = {
  key: string; icon: string; titleAr: string; descAr: string;
  target: number; type: string; rewardCoins: number; rewardXp: number;
  rowId?: string; progress: number; unlocked: boolean; claimed: boolean;
};
type AppTheme = ReturnType<typeof useTheme>["theme"];

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

function AnimatedProgressBar({ pct, color, trackColor }: { pct: number; color: string; trackColor: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) {
      widthAnim.setValue(pct);
      return;
    }
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, reduceMotion, widthAnim]);
  return (
    <View style={[pb.track, { backgroundColor: trackColor }]}>
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

const ClaimButton = memo(function ClaimButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(-80)).current;
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) return;
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
  }, [pulse, reduceMotion, shine]);
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

function AchCard({ ach, onClaim, isPending, theme }: { ach: Achievement; onClaim: () => void; isPending: boolean; theme: AppTheme }) {
  const pct = Math.min(1, ach.progress / ach.target);
  const barColor = ach.unlocked ? ACCENT.gold : ACCENT.cyan;
  const borderColor = ach.claimed
    ? ACCENT.green + "40"
    : ach.unlocked
    ? ACCENT.gold + "55"
    : theme.cardBorder;
  const bgGrad: [string, string] = ach.claimed
    ? [`${ACCENT.green}10`, theme.card]
    : ach.unlocked
    ? [`${ACCENT.gold}16`, theme.card]
    : [theme.card, theme.card];

  return (
    <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[ac.card, { borderColor, opacity: ach.claimed ? 0.65 : 1 }]}>
      <View style={[ac.iconWrap, {
        backgroundColor: ach.unlocked ? ACCENT.gold + "22" : `${ACCENT.cyan}12`,
        borderColor: ach.unlocked ? ACCENT.gold + "40" : theme.cardBorder,
        shadowColor: ach.unlocked ? ACCENT.gold : "transparent",
        shadowOpacity: ach.unlocked ? 0.4 : 0,
        shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }]}>
        <View style={{ opacity: ach.unlocked ? 1 : 0.35 }}>
          <GameIcon name="achievements" size={29} color={ach.unlocked ? ACCENT.gold : theme.textMuted} />
        </View>
        {ach.unlocked && !ach.claimed && (
          <View style={[ac.unlockedDot, { borderColor: theme.card }]} />
        )}
      </View>

      <View style={ac.content}>
        <Text style={[ac.title, { color: ach.unlocked ? theme.textPrimary : theme.textMuted }]}>
          {ach.titleAr}
        </Text>
        <Text style={[ac.desc, { color: theme.textSecondary }]}>{ach.descAr}</Text>
        <View style={ac.progressRow}>
          <AnimatedProgressBar pct={pct} color={barColor} trackColor={theme.cardBorder} />
          <Text style={[ac.progressNum, { color: theme.textMuted }]}>{ach.progress}/{ach.target}</Text>
        </View>
        <View style={ac.rewards}>
          {ach.rewardCoins > 0 && (
            <View style={ac.rewardPill}>
              <GameIcon name="coins" size={15} color={ACCENT.gold} />
              <Text style={ac.rewardText}>{ach.rewardCoins}</Text>
            </View>
          )}
          {ach.rewardXp > 0 && (
            <View style={[ac.rewardPill, { backgroundColor: ACCENT.cyan + "18" }]}>
              <Ionicons name="sparkles-outline" size={14} color={ACCENT.cyan} />
              <Text style={[ac.rewardText, { color: ACCENT.cyan }]}>{ach.rewardXp} XP</Text>
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
            <Ionicons name="lock-closed" size={14} color={theme.textMuted} />
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
    borderWidth: 1.5,
  },
  content: { flex: 1, gap: 4 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  desc: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressNum: { fontFamily: "Cairo_400Regular", fontSize: 10, minWidth: 32, textAlign: "right" },
  rewards: { flexDirection: "row", gap: 6, marginTop: 5 },
  rewardPill: { backgroundColor: ACCENT.gold + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: ACCENT.gold },
  action: { alignItems: "center", justifyContent: "center" },
  lockCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
});

function AchievementsScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, addCoins, addXp } = usePlayer();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const topInset = Platform.OS === "web" ? 20 : insets.top;
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
    onSuccess: (data, key) => {
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
      if (data.coinsEarned > 0) parts.push(`+${data.coinsEarned} عملة`);
      if (data.xpEarned > 0) parts.push(`+${data.xpEarned} XP`);
      Alert.alert("تم الاستلام", parts.length > 0 ? parts.join("  |  ") : "تم استلام المكافأة بنجاح");
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <GameScreenBackground accent="reward" />
      <View style={{ paddingTop: topInset + 8, paddingBottom: bottomInset, flex: 1 }}>
        <GameHeader
          title="الإنجازات"
          subtitle={readyToClaim > 0 ? `${readyToClaim} جاهزة للاستلام` : undefined}
          onBack={() => router.back()}
          icon={<GameIcon name="achievements" size={23} color={ACCENT.gold} />}
          trailing={
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="تحديث الإنجازات" style={s.refreshBtn} onPress={() => refetch()}>
              <Ionicons name="refresh" size={18} color={ACCENT.purple} />
            </TouchableOpacity>
          }
        />
        <FantasySectionBanner kind="achievements" />

        <LinearGradient
          colors={[theme.card, theme.backgroundSecondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.summaryCard, { borderColor: theme.cardBorder }]}
        >
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: ACCENT.gold }]}>{unlockedCount}</Text>
              <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>مفتوحة</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: ACCENT.cyan }]}>{achievements.length - unlockedCount}</Text>
              <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>متبقية</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryNum, { color: ACCENT.green }]}>{claimedCount}</Text>
              <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>استُلمت</Text>
            </View>
          </View>
          <View style={[s.overallBar, { backgroundColor: theme.cardBorder }]}>
            <View style={[s.overallFill, {
              width: `${achievements.length > 0 ? (claimedCount / achievements.length) * 100 : 0}%`,
            }]} />
          </View>
        </LinearGradient>

        <View style={s.filterRow}>
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, { backgroundColor: theme.card }, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              {filter === f ? (
                <LinearGradient colors={[ACCENT.purple + "40", ACCENT.cyan + "30"]} style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]} />
              ) : null}
              <Text style={[s.filterText, { color: theme.textSecondary }, filter === f && [s.filterTextActive, { color: theme.textPrimary }]]}>
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={s.center}>
            <LoadingState label="جارٍ تحميل الإنجازات" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.center}>
            <EmptyState title="لا توجد إنجازات هنا" description="العب وتقدم للحصول على الإنجازات" icon="achievements" />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {filtered.map((ach) => (
              <AchCard
                key={ach.key}
                ach={ach}
                onClaim={() => claimAchievement.mutate(ach.key)}
                isPending={claimAchievement.isPending}
                theme={theme}
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
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 19 },
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
    borderWidth: 1, borderColor: "rgba(156,140,255,0.20)",
    gap: 14,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryItem: { alignItems: "center", gap: 3 },
  summaryNum: { fontFamily: "Cairo_700Bold", fontSize: 24 },
  summaryLabel: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  summaryDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.10)" },
  overallBar: { height: 5, borderRadius: 3, overflow: "hidden" },
  overallFill: { height: "100%", borderRadius: 3, backgroundColor: ACCENT.purple },

  filterRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "transparent",
    borderRadius: 14, padding: 4, gap: 4,
    borderWidth: 1, borderColor: "transparent",
  },
  filterTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", overflow: "hidden" },
  filterTabActive: { },
  filterText: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
  filterTextActive: {},

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
