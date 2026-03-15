import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { fetch } from "expo/fetch";
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
  red:    "#EF4444",
};

type Task = {
  key: string; icon: string; titleAr: string; descAr: string;
  target: number; type: string; rewardCoins: number; rewardXp: number;
  rowId?: string; progress: number; completed: boolean; claimed: boolean;
};

type ApiFetchOptions = { method?: string; body?: BodyInit; headers?: HeadersInit };
async function apiFetch(url: string, options?: ApiFetchOptions) {
  try {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch { return null; }
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

const ClaimButton = memo(({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
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
  }, []);
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

function TaskCard({ task, onClaim, isPending }: { task: Task; onClaim: () => void; isPending: boolean }) {
  const pct = Math.min(1, task.progress / task.target);
  const barColor = task.completed ? ACCENT.green : ACCENT.cyan;
  const borderColor = task.claimed ? ACCENT.green + "40"
    : task.completed ? ACCENT.gold + "60"
    : "rgba(255,255,255,0.07)";
  const bgGrad: [string, string] = task.claimed
    ? ["rgba(34,197,94,0.06)", "rgba(34,197,94,0.02)"]
    : task.completed
    ? ["rgba(245,200,66,0.10)", "rgba(245,200,66,0.03)"]
    : ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"];

  return (
    <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[tc.card, { borderColor }]}>
      <View style={[tc.iconWrap, { backgroundColor: task.completed ? ACCENT.gold + "22" : "rgba(255,255,255,0.06)" }]}>
        <Text style={tc.icon}>{task.icon}</Text>
      </View>
      <View style={tc.content}>
        <Text style={tc.title}>{task.titleAr}</Text>
        <Text style={tc.desc}>{task.descAr}</Text>
        <View style={tc.progressRow}>
          <AnimatedProgressBar pct={pct} color={barColor} />
          <Text style={tc.progressNum}>{task.progress}/{task.target}</Text>
        </View>
        <View style={tc.rewards}>
          {task.rewardCoins > 0 && (
            <View style={tc.rewardPill}>
              <Text style={tc.rewardText}>🪙 +{task.rewardCoins}</Text>
            </View>
          )}
          {task.rewardXp > 0 && (
            <View style={[tc.rewardPill, { backgroundColor: ACCENT.cyan + "18" }]}>
              <Text style={[tc.rewardText, { color: ACCENT.cyan }]}>⭐ +{task.rewardXp} XP</Text>
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
            <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.25)" />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}
const tc = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, padding: 14, borderWidth: 1, gap: 12,
  },
  iconWrap: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  icon: { fontSize: 26 },
  content: { flex: 1, gap: 4 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#F0E6D3" },
  desc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressNum: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "rgba(255,255,255,0.4)", minWidth: 32, textAlign: "right" },
  rewards: { flexDirection: "row", gap: 6, marginTop: 5 },
  rewardPill: { backgroundColor: ACCENT.gold + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: ACCENT.gold },
  action: { alignItems: "center", justifyContent: "center" },
  doneBadge: { alignItems: "center", justifyContent: "center" },
  lockCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
});

function TasksScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, addCoins, addXp } = usePlayer();
  const { isDark } = useTheme();
  const qc = useQueryClient();
  const countdown = useMidnightCountdown();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/tasks", playerId] });
      if (data?.coinsEarned) addCoins(data.coinsEarned);
      if (data?.xpEarned) addXp(data.xpEarned);
    },
  });

  const claimedCount = tasks.filter((t) => t.claimed).length;
  const totalPct = tasks.length > 0 ? claimedCount / tasks.length : 0;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0C0A1E", "#100C28", "#0A1428"] : ["#F8F6FF", "#EEF2FF", "#F8F6FF"]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ paddingTop: topInset + 8, paddingBottom: bottomInset, flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#F0E6D3" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>مهام اليوم</Text>
            <Text style={s.headerSub}>🎯 {claimedCount}/{tasks.length} مكتملة</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => refetch()}>
            <Ionicons name="refresh" size={18} color={ACCENT.cyan} />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={["rgba(0,212,232,0.10)", "rgba(168,85,247,0.08)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.summaryCard}
        >
          <View style={s.summaryTop}>
            <Text style={s.summaryLabel}>تجدد بعد</Text>
            <Text style={s.summaryCountdown}>{countdown}</Text>
          </View>
          <View style={s.summaryBarTrack}>
            <Animated.View style={[s.summaryBarFill, { width: `${totalPct * 100}%` as any }]} />
          </View>
          <View style={s.summaryStats}>
            <View style={s.summaryStat}>
              <Text style={s.summaryStatNum}>{claimedCount}</Text>
              <Text style={s.summaryStatLabel}>مستلمة</Text>
            </View>
            <View style={[s.summaryDivider]} />
            <View style={s.summaryStat}>
              <Text style={s.summaryStatNum}>{tasks.filter(t => t.completed && !t.claimed).length}</Text>
              <Text style={s.summaryStatLabel}>جاهزة</Text>
            </View>
            <View style={[s.summaryDivider]} />
            <View style={s.summaryStat}>
              <Text style={s.summaryStatNum}>{tasks.filter(t => !t.completed).length}</Text>
              <Text style={s.summaryStatLabel}>قيد التقدم</Text>
            </View>
          </View>
        </LinearGradient>

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={ACCENT.gold} size="large" />
          </View>
        ) : tasks.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>لا توجد مهام حالياً</Text>
            <Text style={s.emptySubText}>تُجدَّد المهام يومياً</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {tasks.map((task) => (
              <TaskCard
                key={task.key}
                task={task}
                onClaim={() => claimTask.mutate(task.key)}
                isPending={claimTask.isPending}
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
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 19, color: "#F0E6D3" },
  headerSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 },
  refreshBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: ACCENT.cyan + "18",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: ACCENT.cyan + "30",
  },

  summaryCard: {
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 22, padding: 18,
    borderWidth: 1, borderColor: "rgba(0,212,232,0.18)",
  },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  summaryLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "rgba(255,255,255,0.5)" },
  summaryCountdown: { fontFamily: "Cairo_700Bold", fontSize: 16, color: ACCENT.gold },
  summaryBarTrack: { height: 7, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden", marginBottom: 14 },
  summaryBarFill: { height: "100%", backgroundColor: ACCENT.gold, borderRadius: 4, shadowColor: ACCENT.gold, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  summaryStats: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryStat: { alignItems: "center", gap: 2 },
  summaryStatNum: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#F0E6D3" },
  summaryStatLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "rgba(255,255,255,0.45)" },
  summaryDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.10)" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "rgba(255,255,255,0.7)" },
  emptySubText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
});

export default function TasksScreen() {
  return (
    <ScreenErrorBoundary screenName="مهام اليوم">
      <TasksScreenInner />
    </ScreenErrorBoundary>
  );
}
