import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Animated,
  Easing,
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
  gold: gameDesign.colors.coins,
  cyan: gameDesign.colors.missions,
  purple: gameDesign.colors.online,
  green: gameDesign.colors.success,
  red: gameDesign.colors.danger,
};

type Task = {
  key: string; icon: string; titleAr: string; descAr: string;
  target: number; type: string; rewardCoins: number; rewardXp: number;
  rowId?: string; progress: number; completed: boolean; claimed: boolean;
  isWeekly?: boolean;
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

function useMidnightCountdown() {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return countdown;
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
        shadowOpacity: 0.6,
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
      Animated.timing(pulse, { toValue: 1.06, duration: 600, useNativeDriver: true }),
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
        <LinearGradient colors={[ACCENT.gold, "#E6A800"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cb.btn}>
          <Text style={cb.text}>استلم</Text>
          <Animated.View style={[cb.shine, { transform: [{ translateX: shine }, { rotate: "20deg" }] }]} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});
const cb = StyleSheet.create({
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  text: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#000" },
  shine: { position: "absolute", top: 0, bottom: 0, width: 28, backgroundColor: "rgba(255,255,255,0.35)" },
});

function TaskCard({ task, onClaim, isPending, theme }: { task: Task; onClaim: () => void; isPending: boolean; theme: AppTheme }) {
  const pct = Math.min(1, task.progress / task.target);
  const barColor = task.completed ? ACCENT.green : ACCENT.cyan;
  const borderColor = task.claimed ? ACCENT.green + "40"
    : task.completed ? ACCENT.gold + "60"
    : theme.cardBorder;
  const bgGrad: [string, string] = task.claimed
    ? [`${ACCENT.green}10`, theme.card]
    : task.completed
    ? [`${ACCENT.gold}16`, theme.card]
    : [theme.card, theme.card];

  return (
    <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[tc.card, { borderColor }]}>
      <View style={[tc.iconWrap, { backgroundColor: task.completed ? ACCENT.gold + "22" : `${ACCENT.cyan}18` }]}>
        <GameIcon name="missions" size={25} color={task.completed ? ACCENT.gold : ACCENT.cyan} />
      </View>
      <View style={tc.content}>
        <Text style={[tc.title, { color: theme.textPrimary }]}>{task.titleAr}</Text>
        <Text style={[tc.desc, { color: theme.textSecondary }]}>{task.descAr}</Text>
        <View style={tc.progressRow}>
          <AnimatedProgressBar pct={pct} color={barColor} trackColor={theme.cardBorder} />
          <Text style={[tc.progressNum, { color: theme.textMuted }]}>{task.progress}/{task.target}</Text>
        </View>
        <View style={tc.rewards}>
          {task.rewardCoins > 0 && (
            <View style={tc.rewardPill}>
              <View style={tc.rewardIcon}><GameIcon name="coins" size={15} color={ACCENT.gold} /></View>
              <Text style={tc.rewardText}>+{task.rewardCoins}</Text>
            </View>
          )}
          {task.rewardXp > 0 && (
            <View style={[tc.rewardPill, { backgroundColor: ACCENT.cyan + "18" }]}>
              <Ionicons name="sparkles-outline" size={14} color={ACCENT.cyan} />
              <Text style={[tc.rewardText, { color: ACCENT.cyan }]}>+{task.rewardXp} XP</Text>
            </View>
          )}
        </View>
      </View>
      <View style={tc.action}>
        {task.claimed ? (
          <View style={tc.doneBadge}>
            <Ionicons name="checkmark-circle" size={30} color={ACCENT.green} />
          </View>
        ) : task.completed ? (
          <ClaimButton onPress={onClaim} disabled={isPending} />
        ) : (
          <View style={tc.lockCircle}>
            <Ionicons name="lock-closed" size={14} color={theme.textMuted} />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}
const tc = StyleSheet.create({
  card: {
    flexDirection: "column", alignItems: "stretch",
    borderRadius: 18, padding: 12, borderWidth: 1, gap: 8, minHeight:210,
  },
  iconWrap: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  icon: { fontSize: 26 },
  content: { gap: 4, width:"100%" },
  title: { fontFamily: "Cairo_700Bold", fontSize: 13, textAlign:"right" },
  desc: { fontFamily: "Cairo_400Regular", fontSize: 11, textAlign:"right" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressNum: { fontFamily: "Cairo_400Regular", fontSize: 10, minWidth: 32, textAlign: "right" },
  rewards: { flexDirection: "row", flexWrap:"wrap", gap: 6, marginTop: 5 },
  rewardPill: { backgroundColor: ACCENT.gold + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  rewardIcon: { alignItems: "center", justifyContent: "center" },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: ACCENT.gold },
  action: { alignItems: "center", justifyContent: "center" },
  doneBadge: { alignItems: "center", justifyContent: "center" },
  lockCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
});

function TasksScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, addCoins, addXp } = usePlayer();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const countdown = useMidnightCountdown();

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: tasksRaw, isLoading, refetch } = useQuery<Task[]>({
    queryKey: ["/api/tasks", playerId],
    queryFn: async () => {
      const url = new URL(`/api/tasks/${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: !!playerId, staleTime: 0, initialData: [],
  });

  useFocusEffect(useCallback(() => { if (playerId) refetch(); }, [playerId, refetch]));

  const tasks: Task[] = Array.isArray(tasksRaw) ? tasksRaw : [];

  const claimTask = useMutation({
    mutationFn: async (taskKey: string) => {
      const url = new URL(`/api/tasks/${playerId}/${taskKey}/claim`, getApiUrl());
      return apiFetch(url.toString(), { method: "POST" });
    },
    onSuccess: (data, taskKey) => {
      if (!data) {
        Alert.alert("خطأ في الاتصال", "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.");
        return;
      }
      if (!data.success) {
        const errorMessages: Record<string, string> = {
          already_claimed: "لقد استلمت مكافأة هذه المهمة مسبقاً.",
          not_completed: "لم تُكمل هذه المهمة بعد.",
          player_not_found: "لم يتم العثور على ملفك الشخصي. أعد تشغيل التطبيق.",
          unknown_task: "مهمة غير معروفة.",
          server_error: "حدث خطأ في الخادم. حاول مجدداً.",
        };
        const msg = errorMessages[data.error] ?? "حدث خطأ غير متوقع.";
        Alert.alert("تعذّر استلام المكافأة", msg);
        return;
      }
      if ((data.coinsEarned ?? 0) > 0) addCoins(data.coinsEarned);
      if ((data.xpEarned ?? 0) > 0) addXp(data.xpEarned);

      qc.invalidateQueries({ queryKey: ["/api/tasks", playerId] });
      const parts: string[] = [];
      if ((data.coinsEarned ?? 0) > 0) parts.push(`+${data.coinsEarned} عملة`);
      if ((data.xpEarned ?? 0) > 0) parts.push(`+${data.xpEarned} XP`);
      if (data.titleAwarded) parts.push("لقب نادر مُنح!");
      Alert.alert("تم الاستلام", parts.length > 0 ? parts.join("  |  ") : "تم استلام المكافأة بنجاح");
    },
    onError: () => {
      Alert.alert("خطأ في الاتصال", "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.");
    },
  });

  const claimedCount = tasks.filter((t) => t.claimed).length;
  const totalPct = tasks.length > 0 ? claimedCount / tasks.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <GameScreenBackground accent="offline" />
      <View style={{ paddingTop: topInset + 8, paddingBottom: bottomInset, flex: 1 }}>
        <GameHeader
          title="مهام اليوم"
          subtitle={`${claimedCount}/${tasks.length} مكتملة`}
          onBack={() => router.back()}
          icon={<GameIcon name="missions" size={23} color={ACCENT.cyan} />}
          trailing={
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="تحديث المهام" style={s.refreshBtn} onPress={() => refetch()}>
              <Ionicons name="refresh" size={18} color={ACCENT.cyan} />
            </TouchableOpacity>
          }
        />


        <LinearGradient
          colors={[theme.card, theme.backgroundSecondary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.summaryCard, { borderColor: theme.cardBorder }]}
        >
          <View style={s.summaryTop}>
            <Text style={[s.summaryLabel, { color: theme.textSecondary }]}>تجدد بعد</Text>
            <Text style={s.summaryCountdown}>{countdown}</Text>
          </View>
          <View style={[s.summaryBarTrack, { backgroundColor: theme.cardBorder }]}>
            <Animated.View style={[s.summaryBarFill, { width: `${totalPct * 100}%` }]} />
          </View>
          <View style={s.summaryStats}>
            <View style={s.summaryStat}>
              <Text style={[s.summaryStatNum, { color: theme.textPrimary }]}>{claimedCount}</Text>
              <Text style={[s.summaryStatLabel, { color: theme.textSecondary }]}>مستلمة</Text>
            </View>
            <View style={[s.summaryDivider]} />
            <View style={s.summaryStat}>
              <Text style={[s.summaryStatNum, { color: theme.textPrimary }]}>{tasks.filter(t => t.completed && !t.claimed).length}</Text>
              <Text style={[s.summaryStatLabel, { color: theme.textSecondary }]}>جاهزة</Text>
            </View>
            <View style={[s.summaryDivider]} />
            <View style={s.summaryStat}>
              <Text style={[s.summaryStatNum, { color: theme.textPrimary }]}>{tasks.filter(t => !t.completed).length}</Text>
              <Text style={[s.summaryStatLabel, { color: theme.textSecondary }]}>قيد التقدم</Text>
            </View>
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={s.center}>
            <LoadingState label="جارٍ تحميل المهام" />
          </View>
        ) : tasks.length === 0 ? (
          <View style={s.center}>
            <EmptyState title="لا توجد مهام حالياً" description="تُجدَّد المهام يومياً" icon="missions" />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {tasks.filter(t => t.isWeekly).map((task) => (
              <View key={task.key}>
                <View style={s.sectionHeader}>
                  <Ionicons name="calendar" size={16} color={ACCENT.purple} />
                  <Text style={[s.sectionTitle, { color: ACCENT.purple }]}>تحدي الأسبوع</Text>
                </View>
                <LinearGradient
                  colors={[`${ACCENT.purple}12`, `${ACCENT.cyan}08`]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.weeklyWrap}
                >
                  <TaskCard
                    task={task}
                    onClaim={() => claimTask.mutate(task.key)}
                    isPending={claimTask.isPending}
                    theme={theme}
                  />
                </LinearGradient>
              </View>
            ))}
            <View style={s.sectionHeader}>
              <Ionicons name="today" size={16} color={ACCENT.cyan} />
              <Text style={[s.sectionTitle, { color: ACCENT.cyan }]}>المهام اليومية</Text>
            </View>
            <View style={{flexDirection:"row-reverse",flexWrap:"wrap",gap:10}}>{tasks.filter(t => !t.isWeekly).map((task) => (
              <View key={task.key} style={{width:"48%"}}>
              <TaskCard
                key={task.key}
                task={task}
                onClaim={() => claimTask.mutate(task.key)}
                isPending={claimTask.isPending}
                theme={theme}
              /></View>
            ))}</View>
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
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 19 },
  headerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 },
  refreshBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: ACCENT.cyan + "18",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: ACCENT.cyan + "30",
  },

  summaryCard: {
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: "rgba(87,200,245,0.18)",
  },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  summaryLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "rgba(255,255,255,0.5)" },
  summaryCountdown: { fontFamily: "Cairo_700Bold", fontSize: 16, color: ACCENT.gold },
  summaryBarTrack: { height: 7, borderRadius: 4, overflow: "hidden", marginBottom: 14 },
  summaryBarFill: { height: "100%", backgroundColor: ACCENT.gold, borderRadius: 4, shadowColor: ACCENT.gold, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  summaryStats: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryStat: { alignItems: "center", gap: 2 },
  summaryStatNum: { fontFamily: "Cairo_700Bold", fontSize: 20 },
  summaryStatLabel: { fontFamily: "Cairo_400Regular", fontSize: 10 },
  summaryDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.10)" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "rgba(255,255,255,0.7)" },
  emptySubText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, paddingHorizontal: 2 },
  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  weeklyWrap: { borderRadius: 22, padding: 3, borderWidth: 1.5, borderColor: "rgba(156,140,255,0.25)" },
});

export default function TasksScreen() {
  return (
    <ScreenErrorBoundary screenName="مهام اليوم">
      <TasksScreenInner />
    </ScreenErrorBoundary>
  );
}
