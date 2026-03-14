import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { fetch } from "expo/fetch";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";

type Task = {
  key: string;
  icon: string;
  titleAr: string;
  descAr: string;
  target: number;
  type: string;
  rewardCoins: number;
  rewardXp: number;
  rowId?: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

async function apiFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function TasksScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, addCoins, addXp } = usePlayer();
  const { theme } = useTheme();
  const qc = useQueryClient();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: tasksRaw, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", playerId],
    queryFn: async () => {
      const url = new URL(`/api/tasks/${playerId}`, getApiUrl());
      const result = await apiFetch(url.toString());
      return Array.isArray(result) ? result : [];
    },
    enabled: !!playerId,
    staleTime: 30_000,
    initialData: [],
  });

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

  const completedCount = tasks.filter((t) => t.completed).length;
  const claimedCount = tasks.filter((t) => t.claimed).length;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>مهام اليوم</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={styles.summaryText}>
          {claimedCount}/{tasks.length} تم استلامها
        </Text>
        <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
          <View style={[styles.progressFill, { width: `${tasks.length > 0 ? (claimedCount / tasks.length) * 100 : 0}%` }]} />
        </View>
        <Text style={[styles.summarySubText, { color: theme.textMuted }]}>تُجدَّد المهام يومياً</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>لا توجد مهام حالياً</Text>
          <Text style={[styles.emptySubText, { color: theme.textMuted }]}>تُجدَّد المهام يومياً</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {tasks.map((task) => {
            const pct = Math.min(1, task.progress / task.target);
            return (
              <View key={task.key} style={[styles.taskCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }, task.claimed && styles.taskClaimed]}>
                <Text style={styles.taskIcon}>{task.icon}</Text>
                <View style={styles.taskContent}>
                  <Text style={[styles.taskTitle, { color: theme.textPrimary }]}>{task.titleAr}</Text>
                  <Text style={[styles.taskDesc, { color: theme.textMuted }]}>{task.descAr}</Text>
                  <View style={styles.taskProgressRow}>
                    <View style={[styles.taskProgressBar, { backgroundColor: theme.cardBorder }]}>
                      <View style={[styles.taskProgressFill, { width: `${pct * 100}%` }]} />
                    </View>
                    <Text style={[styles.taskProgressText, { color: theme.textMuted }]}>{task.progress}/{task.target}</Text>
                  </View>
                  <View style={styles.taskRewards}>
                    {task.rewardCoins > 0 && (
                      <View style={styles.rewardBadge}>
                        <Text style={styles.rewardText}>🪙 +{task.rewardCoins}</Text>
                      </View>
                    )}
                    {task.rewardXp > 0 && (
                      <View style={[styles.rewardBadge, { backgroundColor: Colors.emerald + "20" }]}>
                        <Text style={[styles.rewardText, { color: Colors.emerald }]}>⭐ +{task.rewardXp} XP</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.taskAction}>
                  {task.claimed ? (
                    <View style={styles.doneCircle}>
                      <Ionicons name="checkmark" size={18} color={Colors.emerald} />
                    </View>
                  ) : task.completed ? (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => claimTask.mutate(task.key)}
                      disabled={claimTask.isPending}
                    >
                      <Text style={styles.claimBtnText}>استلم</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockCircle}>
                      <Ionicons name="lock-closed" size={14} color={theme.textMuted} />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1B2A" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#1E3448", justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#F0E6D3" },
  summary: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "#1E3448", borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: "#2A4560",
    gap: 8,
  },
  summaryText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.gold },
  progressBar: {
    height: 6, backgroundColor: "#2A4560", borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: Colors.gold, borderRadius: 3 },
  summarySubText: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#6B7E91" },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  taskCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1E3448", borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: "#2A4560",
    gap: 12,
  },
  taskClaimed: { opacity: 0.6 },
  taskIcon: { fontSize: 28 },
  taskContent: { flex: 1, gap: 4 },
  taskTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#F0E6D3" },
  taskDesc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#6B7E91" },
  taskProgressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  taskProgressBar: { flex: 1, height: 4, backgroundColor: "#2A4560", borderRadius: 2, overflow: "hidden" },
  taskProgressFill: { height: "100%", backgroundColor: Colors.gold, borderRadius: 2 },
  taskProgressText: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#6B7E91", minWidth: 30 },
  taskRewards: { flexDirection: "row", gap: 6, marginTop: 4 },
  rewardBadge: {
    backgroundColor: Colors.gold + "20", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.gold },
  taskAction: { alignItems: "center", justifyContent: "center" },
  claimBtn: {
    backgroundColor: Colors.gold, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  claimBtnText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#000" },
  doneCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.emerald + "20",
    justifyContent: "center", alignItems: "center",
  },
  lockCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#2A4560",
    justifyContent: "center", alignItems: "center",
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#A8B8CC" },
  emptySubText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#6B7E91", marginTop: 4 },
});

export default function TasksScreen() {
  return (
    <ScreenErrorBoundary screenName="مهام اليوم">
      <TasksScreenInner />
    </ScreenErrorBoundary>
  );
}
