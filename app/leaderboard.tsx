import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";

type LeaderboardEntry = {
  name: string;
  score: number;
  level: number;
  wins: number;
  gamesPlayed: number;
  skin: string;
};

const MOCK_PLAYERS: LeaderboardEntry[] = [
  { name: "البطل الكبير", score: 2840, level: 12, wins: 45, gamesPlayed: 78, skin: "champion" },
  { name: "نجم المغرب", score: 2310, level: 9, wins: 32, gamesPlayed: 65, skin: "sport" },
  { name: "فارس الكلمات", score: 1950, level: 8, wins: 28, gamesPlayed: 55, skin: "djellaba" },
  { name: "سلطان اللغة", score: 1720, level: 7, wins: 22, gamesPlayed: 48, skin: "student" },
  { name: "حافظ الحروف", score: 1480, level: 6, wins: 18, gamesPlayed: 40, skin: "champion" },
  { name: "رائد الألفاظ", score: 1250, level: 5, wins: 14, gamesPlayed: 35, skin: "sport" },
  { name: "أمير الكلام", score: 980, level: 4, wins: 10, gamesPlayed: 28, skin: "djellaba" },
  { name: "ملك الحروف", score: 720, level: 3, wins: 7, gamesPlayed: 22, skin: "student" },
  { name: "خبير اللغة", score: 530, level: 2, wins: 4, gamesPlayed: 15, skin: "champion" },
  { name: "طالب العلم", score: 290, level: 1, wins: 2, gamesPlayed: 10, skin: "student" },
];

type TabFilter = "score" | "wins" | "level";

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { profile } = usePlayer();
  const [tab, setTab] = useState<TabFilter>("score");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // Insert local player into leaderboard
  const localEntry: LeaderboardEntry = {
    name: profile.name + " (أنت)",
    score: profile.totalScore,
    level: profile.level,
    wins: profile.wins,
    gamesPlayed: profile.gamesPlayed,
    skin: profile.equippedSkin,
  };

  const allEntries = [...MOCK_PLAYERS, localEntry];

  const sorted = [...allEntries].sort((a, b) =>
    tab === "score" ? b.score - a.score
      : tab === "wins" ? b.wins - a.wins
      : b.level - a.level
  );

  const myRank = sorted.findIndex((e) => e.name === localEntry.name);

  const rankColors = [Colors.rank1, Colors.rank2, Colors.rank3];
  const rankIcons = ["trophy", "medal", "ribbon"] as const;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.leaderboard}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Podium top 3 */}
      <View style={styles.podium}>
        {sorted.slice(0, 3).map((entry, idx) => {
          const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
          const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
          const podiumHeights = [70, 90, 55];
          const orderedIdx = podiumOrder.indexOf(idx);
          return (
            <View key={entry.name} style={[styles.podiumItem, { order: podiumOrder[idx] }]}>
              <Text style={styles.podiumEmoji}>{skin.emoji}</Text>
              <Text style={styles.podiumName} numberOfLines={1}>{entry.name}</Text>
              <Text style={styles.podiumScore}>{tab === "score" ? entry.score : tab === "wins" ? entry.wins : entry.level}</Text>
              <View
                style={[
                  styles.podiumBlock,
                  {
                    height: podiumHeights[idx],
                    backgroundColor: rankColors[idx] + "30",
                    borderTopColor: rankColors[idx],
                  },
                ]}
              >
                <Ionicons
                  name={rankIcons[idx]}
                  size={20}
                  color={rankColors[idx]}
                />
                <Text style={[styles.podiumRankNum, { color: rankColors[idx] }]}>{idx + 1}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterTabs}>
        {(["score", "wins", "level"] as TabFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, tab === f && styles.filterTabActive]}
            onPress={() => setTab(f)}
          >
            <Text style={[styles.filterTabText, tab === f && styles.filterTabTextActive]}>
              {f === "score" ? t.score : f === "wins" ? "انتصارات" : t.level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank banner */}
      {profile.gamesPlayed > 0 && (
        <View style={styles.myRankBanner}>
          <Text style={styles.myRankText}>{t.yourRank}: </Text>
          <Text style={styles.myRankNum}>{myRank + 1}</Text>
          <Text style={styles.myRankSeparator}> · </Text>
          <Text style={styles.myRankText}>
            {tab === "score" ? profile.totalScore : tab === "wins" ? profile.wins : profile.level}
          </Text>
        </View>
      )}

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {sorted.slice(3).map((entry, idx) => {
          const actualRank = idx + 4;
          const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
          const isMe = entry.name === localEntry.name;
          return (
            <View key={entry.name} style={[styles.rankRow, isMe && styles.rankRowMe]}>
              <Text style={styles.rankRowNum}>{actualRank}</Text>
              <View style={[styles.rankRowAvatar, { backgroundColor: skin.color + "33" }]}>
                <Text style={styles.rankRowEmoji}>{skin.emoji}</Text>
              </View>
              <View style={styles.rankRowInfo}>
                <Text style={styles.rankRowName}>{entry.name}</Text>
                <Text style={styles.rankRowSub}>
                  {t.level} {entry.level} · {entry.gamesPlayed} مباراة
                </Text>
              </View>
              <Text style={styles.rankRowValue}>
                {tab === "score" ? entry.score : tab === "wins" ? entry.wins : entry.level}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
  podium: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  podiumEmoji: {
    fontSize: 28,
    marginBottom: 2,
  },
  podiumName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    maxWidth: 80,
  },
  podiumScore: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  podiumBlock: {
    width: "100%",
    borderTopWidth: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 8,
  },
  podiumRankNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: Colors.backgroundTertiary,
  },
  filterTabText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.textMuted,
  },
  filterTabTextActive: {
    color: Colors.gold,
  },
  myRankBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gold + "15",
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.gold + "30",
    justifyContent: "center",
  },
  myRankText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: Colors.gold,
  },
  myRankNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.gold,
  },
  myRankSeparator: {
    color: Colors.gold,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  rankRowMe: {
    borderColor: Colors.gold + "60",
    backgroundColor: Colors.gold + "08",
  },
  rankRowNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textMuted,
    width: 28,
    textAlign: "center",
  },
  rankRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  rankRowEmoji: {
    fontSize: 20,
  },
  rankRowInfo: {
    flex: 1,
  },
  rankRowName: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textPrimary,
  },
  rankRowSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rankRowValue: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
});
