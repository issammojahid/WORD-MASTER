import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";

type Achievement = {
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
  unlocked: boolean;
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

function AchievementsScreenInner() {
  const insets = useSafeAreaInsets();
  const { playerId, addCoins, addXp } = usePlayer();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: achievements = [], isLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements", playerId],
    queryFn: async () => {
      const url = new URL(`/api/achievements/${playerId}`, getApiUrl());
      return apiFetch(url.toString());
    },
    enabled: !!playerId,
    staleTime: 60_000,
  });

  const claimAchievement = useMutation({
    mutationFn: async (key: string) => {
      const url = new URL(`/api/achievements/${playerId}/claim/${key}`, getApiUrl());
      return apiFetch(url.toString(), { method: "POST" });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/achievements", playerId] });
      if (data.coinsEarned) addCoins(data.coinsEarned);
      if (data.xpEarned) addXp(data.xpEarned);
    },
  });

  const filtered = achievements.filter((a) => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "locked") return !a.unlocked;
    return true;
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const claimedCount = achievements.filter((a) => a.claimed).length;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإنجازات</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{unlockedCount}</Text>
            <Text style={styles.summaryLabel}>تم فتحها</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{achievements.length - unlockedCount}</Text>
            <Text style={styles.summaryLabel}>متبقية</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{claimedCount}</Text>
            <Text style={styles.summaryLabel}>استُلمت</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterTabs}>
        {(["all", "unlocked", "locked"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === "all" ? "الكل" : f === "unlocked" ? "مفتوحة" : "مقفلة"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.map((ach) => {
            const pct = Math.min(1, ach.progress / ach.target);
            return (
              <View key={ach.key} style={[styles.achCard, ach.claimed && styles.achClaimed, !ach.unlocked && styles.achLocked]}>
                <View style={[styles.achIconWrap, { backgroundColor: ach.unlocked ? Colors.gold + "20" : Colors.cardBorder }]}>
                  <Text style={[styles.achIcon, !ach.unlocked && styles.achIconLocked]}>{ach.icon}</Text>
                </View>
                <View style={styles.achContent}>
                  <Text style={[styles.achTitle, !ach.unlocked && styles.achTitleLocked]}>{ach.titleAr}</Text>
                  <Text style={styles.achDesc}>{ach.descAr}</Text>
                  <View style={styles.achProgressRow}>
                    <View style={styles.achProgressBar}>
                      <View style={[styles.achProgressFill, { width: `${pct * 100}%`, backgroundColor: ach.unlocked ? Colors.gold : Colors.emerald }]} />
                    </View>
                    <Text style={styles.achProgressText}>{ach.progress}/{ach.target}</Text>
                  </View>
                  <View style={styles.achRewards}>
                    {ach.rewardCoins > 0 && (
                      <Text style={styles.rewardText}>🪙 {ach.rewardCoins}</Text>
                    )}
                    {ach.rewardXp > 0 && (
                      <Text style={[styles.rewardText, { color: Colors.emerald }]}>⭐ {ach.rewardXp} XP</Text>
                    )}
                  </View>
                </View>
                <View style={styles.achAction}>
                  {ach.claimed ? (
                    <View style={styles.doneCircle}>
                      <Ionicons name="checkmark" size={18} color={Colors.emerald} />
                    </View>
                  ) : ach.unlocked ? (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => claimAchievement.mutate(ach.key)}
                      disabled={claimAchievement.isPending}
                    >
                      <Text style={styles.claimBtnText}>استلم</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockCircle}>
                      <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.card, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  summary: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryNum: { fontFamily: "Cairo_700Bold", fontSize: 22, color: Colors.gold },
  summaryLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },
  summaryDivider: { width: 1, height: 30, backgroundColor: Colors.cardBorder },
  filterTabs: {
    flexDirection: "row", backgroundColor: Colors.card,
    borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 12,
  },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  filterTabActive: { backgroundColor: Colors.backgroundTertiary },
  filterTabText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  filterTabTextActive: { color: Colors.gold },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  achCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: Colors.cardBorder, gap: 12,
  },
  achClaimed: { opacity: 0.55 },
  achLocked: { opacity: 0.8 },
  achIconWrap: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  achIcon: { fontSize: 26 },
  achIconLocked: { opacity: 0.4 },
  achContent: { flex: 1, gap: 4 },
  achTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary },
  achTitleLocked: { color: Colors.textMuted },
  achDesc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },
  achProgressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  achProgressBar: { flex: 1, height: 4, backgroundColor: Colors.cardBorder, borderRadius: 2, overflow: "hidden" },
  achProgressFill: { height: "100%", borderRadius: 2 },
  achProgressText: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted, minWidth: 30 },
  achRewards: { flexDirection: "row", gap: 10, marginTop: 2 },
  rewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.gold },
  achAction: { alignItems: "center", justifyContent: "center" },
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
    backgroundColor: Colors.cardBorder,
    justifyContent: "center", alignItems: "center",
  },
});

export default function AchievementsScreen() {
  return (
    <ScreenErrorBoundary screenName="الإنجازات">
      <AchievementsScreenInner />
    </ScreenErrorBoundary>
  );
}
