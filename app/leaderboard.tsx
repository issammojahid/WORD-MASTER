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
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

type TabFilter = "score" | "wins" | "xp";

type LeaderboardEntry = {
  rank: number;
  id: string;
  name: string;
  skin: string;
  level: number;
  wins: number;
  score: number;
  xp: number;
  gamesPlayed: number;
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId } = usePlayer();
  const { theme } = useTheme();
  const [tab, setTab] = useState<TabFilter>("score");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", tab],
    queryFn: async () => {
      const url = new URL(`/api/leaderboard?type=${tab}`, getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const myEntry = entries.find((e) => e.id === playerId);
  const myRank = myEntry ? myEntry.rank : null;

  const rankColors = [Colors.rank1, Colors.rank2, Colors.rank3];
  const rankIcons = ["trophy", "medal", "ribbon"] as const;

  const getValue = (e: LeaderboardEntry) =>
    tab === "wins" ? e.wins : tab === "xp" ? e.xp : e.score;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>المتصدرون</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.filterTabs, { backgroundColor: theme.card }]}>
        {(["score", "wins", "xp"] as TabFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, tab === f && [styles.filterTabActive, { backgroundColor: theme.backgroundTertiary }]]}
            onPress={() => setTab(f)}
          >
            <Text style={[styles.filterTabText, { color: theme.textMuted }, tab === f && styles.filterTabTextActive]}>
              {f === "score" ? "النقاط" : f === "wins" ? "الانتصارات" : "الخبرة"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : (
        <>
          {top3.length >= 3 && (
            <View style={styles.podium}>
              {[top3[1], top3[0], top3[2]].map((entry, podiumPos) => {
                const realIdx = podiumPos === 0 ? 1 : podiumPos === 1 ? 0 : 2;
                const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
                const podiumHeights = [70, 90, 55];
                const isMe = entry.id === playerId;
                return (
                  <View key={entry.id} style={styles.podiumItem}>
                    <Text style={styles.podiumEmoji}>{skin.emoji}</Text>
                    {isMe && <Text style={styles.youBadge}>أنت</Text>}
                    <Text style={[styles.podiumName, { color: theme.textPrimary }]} numberOfLines={1}>{entry.name}</Text>
                    <Text style={[styles.podiumScore, { color: theme.textSecondary }]}>{getValue(entry)}</Text>
                    <View
                      style={[
                        styles.podiumBlock,
                        {
                          height: podiumHeights[podiumPos],
                          backgroundColor: rankColors[realIdx] + "30",
                          borderTopColor: rankColors[realIdx],
                        },
                      ]}
                    >
                      <Ionicons name={rankIcons[realIdx]} size={20} color={rankColors[realIdx]} />
                      <Text style={[styles.podiumRankNum, { color: rankColors[realIdx] }]}>{realIdx + 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {myRank && myRank > 3 && (
            <View style={styles.myRankBanner}>
              <Text style={styles.myRankText}>ترتيبك: </Text>
              <Text style={styles.myRankNum}>#{myRank}</Text>
              <Text style={styles.myRankSeparator}> · </Text>
              <Text style={styles.myRankText}>{myEntry ? getValue(myEntry) : 0}</Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {rest.map((entry) => {
              const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
              const isMe = entry.id === playerId;
              return (
                <View key={entry.id} style={[styles.rankRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }, isMe && styles.rankRowMe]}>
                  <Text style={[styles.rankRowNum, { color: theme.textMuted }]}>{entry.rank}</Text>
                  <View style={[styles.rankRowAvatar, { backgroundColor: skin.color + "33" }]}>
                    <Text style={styles.rankRowEmoji}>{skin.emoji}</Text>
                  </View>
                  <View style={styles.rankRowInfo}>
                    <Text style={[styles.rankRowName, { color: theme.textPrimary }]}>{entry.name}{isMe ? " (أنت)" : ""}</Text>
                    <Text style={[styles.rankRowSub, { color: theme.textMuted }]}>
                      المستوى {entry.level} · {entry.gamesPlayed} مباراة
                    </Text>
                  </View>
                  <Text style={[styles.rankRowValue, { color: theme.textPrimary }]}>{getValue(entry)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  podium: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  podiumItem: { flex: 1, alignItems: "center", gap: 4 },
  podiumEmoji: { fontSize: 28, marginBottom: 2 },
  youBadge: {
    fontFamily: "Cairo_700Bold", fontSize: 9, color: Colors.gold,
    backgroundColor: Colors.gold + "20", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  podiumName: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.textSecondary, textAlign: "center", maxWidth: 80 },
  podiumScore: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary },
  podiumBlock: {
    width: "100%", borderTopWidth: 3, borderRadius: 8,
    alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8,
  },
  podiumRankNum: { fontFamily: "Cairo_700Bold", fontSize: 20 },
  filterTabs: {
    flexDirection: "row", backgroundColor: Colors.card,
    borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 12,
  },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  filterTabActive: { backgroundColor: Colors.backgroundTertiary },
  filterTabText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  filterTabTextActive: { color: Colors.gold },
  myRankBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.gold + "15", marginHorizontal: 16,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.gold + "30",
    justifyContent: "center",
  },
  myRankText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: Colors.gold },
  myRankNum: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },
  myRankSeparator: { color: Colors.gold, fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },
  rankRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  rankRowMe: { borderColor: Colors.gold + "60", backgroundColor: Colors.gold + "08" },
  rankRowNum: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textMuted, width: 28, textAlign: "center" },
  rankRowAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 10 },
  rankRowEmoji: { fontSize: 20 },
  rankRowInfo: { flex: 1 },
  rankRowName: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  rankRowSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  rankRowValue: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
});
