import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { usePlayer, SKINS, TITLES } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

const LOGO = {
  cyan:   "#00D4E8",
  pink:   "#FF3D9A",
  purple: "#A855F7",
  yellow: "#F5C842",
  green:  "#22C55E",
};

type TabFilter = "score" | "wins" | "xp";

type LeaderboardEntry = {
  rank: number;
  id: string;
  name: string;
  skin: string;
  equippedTitle: string;
  level: number;
  wins: number;
  score: number;
  xp: number;
  gamesPlayed: number;
};

const RANK_COLORS = [Colors.rank1, Colors.rank2, Colors.rank3];
const RANK_ICONS  = ["trophy", "medal", "ribbon"] as const;
const RANK_GLOWS  = ["#FFD70040", "#C0C0C040", "#CD7F3240"];
const RANK_LABELS = ["🥇", "🥈", "🥉"];

function getTitleLabel(titleId: string): { label: string; color: string } | null {
  const t = TITLES.find((tt) => tt.id === titleId);
  if (!t || t.id === "beginner") return null;
  const colors: Record<string, string> = {
    common: LOGO.cyan,
    rare: LOGO.purple,
    epic: LOGO.pink,
    legendary: LOGO.yellow,
  };
  return { label: t.nameAr, color: colors[t.rarity] || LOGO.cyan };
}

function AnimatedRow({ entry, index, isMe, getValue }: {
  entry: LeaderboardEntry;
  index: number;
  isMe: boolean;
  getValue: (e: LeaderboardEntry) => number;
}) {
  const { theme } = useTheme();
  const slideX = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 320, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
  const titleInfo = getTitleLabel(entry.equippedTitle);

  return (
    <Animated.View style={{ transform: [{ translateX: slideX }], opacity }}>
      <View style={[
        styles.rankRow,
        { backgroundColor: isMe ? LOGO.yellow + "0E" : theme.card },
        isMe && styles.rankRowMe,
      ]}>
        <LinearGradient
          colors={isMe ? [LOGO.yellow + "14", LOGO.yellow + "06"] : ["transparent", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
        <Text style={[styles.rankRowNum, { color: theme.textMuted }]}>
          {entry.rank}
        </Text>
        <View style={[styles.rankRowAvatar, { backgroundColor: skin.color + "33", borderColor: skin.color + "55" }]}>
          <Text style={styles.rankRowEmoji}>{skin.emoji}</Text>
        </View>
        <View style={styles.rankRowInfo}>
          <View style={styles.rankRowNameRow}>
            <Text style={[styles.rankRowName, { color: theme.textPrimary }]} numberOfLines={1}>
              {entry.name}
              {isMe ? " (أنت)" : ""}
            </Text>
          </View>
          <View style={styles.rankRowSubRow}>
            {titleInfo && (
              <View style={[styles.titlePill, { backgroundColor: titleInfo.color + "20", borderColor: titleInfo.color + "50" }]}>
                <Text style={[styles.titlePillText, { color: titleInfo.color }]}>{titleInfo.label}</Text>
              </View>
            )}
            <Text style={[styles.rankRowSub, { color: theme.textMuted }]}>
              Lv.{entry.level} · {entry.gamesPlayed} مباراة
            </Text>
          </View>
        </View>
        <Text style={[styles.rankRowValue, { color: isMe ? LOGO.yellow : theme.textPrimary }]}>
          {getValue(entry).toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId } = usePlayer();
  const { theme } = useTheme();
  const [tab, setTab] = useState<TabFilter>("score");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const headerGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(headerGlow, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(headerGlow, { toValue: 0, duration: 2000, useNativeDriver: false }),
    ])).start();
  }, []);

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

  const getValue = (e: LeaderboardEntry) =>
    tab === "wins" ? e.wins : tab === "xp" ? e.xp : e.score;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const TAB_ICONS: Record<TabFilter, { icon: string; color: string; label: string }> = {
    score:  { icon: "star",       color: LOGO.yellow, label: "النقاط" },
    wins:   { icon: "trophy",     color: LOGO.cyan,   label: "الانتصارات" },
    xp:     { icon: "flash",      color: LOGO.purple, label: "الخبرة" },
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient
        colors={["#0A0E1A", "#0D1526", "#0A0E1A"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative blobs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.blob, { top: -40, left: -60, width: 200, height: 200, backgroundColor: LOGO.purple + "14" }]} />
        <View style={[styles.blob, { top: 200, right: -60, width: 180, height: 180, backgroundColor: LOGO.cyan + "10" }]} />
        <View style={[styles.blob, { top: 500, left: -40, width: 160, height: 160, backgroundColor: LOGO.pink + "0E" }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <LinearGradient
            colors={[LOGO.cyan + "20", LOGO.purple + "18"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🏆</Text>
          <Text style={styles.headerTitle}>المتصدرون</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: theme.card + "CC" }]}>
        {(["score", "wins", "xp"] as TabFilter[]).map((f) => {
          const info = TAB_ICONS[f];
          const active = tab === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, active && { backgroundColor: info.color + "1A" }]}
              onPress={() => setTab(f)}
              activeOpacity={0.7}
            >
              {active && (
                <LinearGradient
                  colors={[info.color + "30", info.color + "10"]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
              )}
              <Ionicons name={info.icon as any} size={14} color={active ? info.color : theme.textMuted} />
              <Text style={[styles.filterTabText, { color: active ? info.color : theme.textMuted }, active && { fontFamily: "Cairo_700Bold" }]}>
                {info.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={LOGO.yellow} size="large" />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>جاري التحميل...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Podium ── */}
          {top3.length >= 3 && (
            <View style={styles.podiumSection}>
              <LinearGradient
                colors={[LOGO.yellow + "12", LOGO.purple + "0A", "transparent"]}
                style={styles.podiumBg}
              />
              {/* Order: 2nd, 1st, 3rd */}
              {([top3[1], top3[0], top3[2]] as LeaderboardEntry[]).map((entry, podiumPos) => {
                const realIdx = podiumPos === 0 ? 1 : podiumPos === 1 ? 0 : 2;
                const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
                const isMe = entry.id === playerId;
                const podiumHeights = [72, 96, 56];
                const rankColor = RANK_COLORS[realIdx];
                const glow = RANK_GLOWS[realIdx];
                const titleInfo = getTitleLabel(entry.equippedTitle);

                return (
                  <View key={entry.id} style={styles.podiumItem}>
                    {/* Rank emoji */}
                    <Text style={styles.rankMedal}>{RANK_LABELS[realIdx]}</Text>

                    {/* Avatar with glow ring */}
                    <View style={[styles.podiumAvatarRing, { borderColor: rankColor + "80", shadowColor: rankColor }]}>
                      <View style={[styles.podiumAvatarInner, { backgroundColor: skin.color + "33" }]}>
                        <Text style={styles.podiumEmoji}>{skin.emoji}</Text>
                      </View>
                    </View>

                    {isMe && (
                      <View style={[styles.youBadge, { backgroundColor: LOGO.yellow + "30", borderColor: LOGO.yellow + "60" }]}>
                        <Text style={[styles.youBadgeText, { color: LOGO.yellow }]}>أنت</Text>
                      </View>
                    )}

                    <Text style={[styles.podiumName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {entry.name}
                    </Text>

                    {titleInfo && (
                      <View style={[styles.titlePill, { backgroundColor: titleInfo.color + "20", borderColor: titleInfo.color + "50", marginBottom: 2 }]}>
                        <Text style={[styles.titlePillText, { color: titleInfo.color }]}>{titleInfo.label}</Text>
                      </View>
                    )}

                    <Text style={[styles.podiumScore, { color: rankColor }]}>
                      {getValue(entry).toLocaleString()}
                    </Text>

                    {/* Podium block */}
                    <LinearGradient
                      colors={[rankColor + "40", rankColor + "18"]}
                      style={[styles.podiumBlock, { height: podiumHeights[podiumPos], borderTopColor: rankColor }]}
                    >
                      <Text style={[styles.podiumRankNum, { color: rankColor }]}>{realIdx + 1}</Text>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── My rank banner (if outside top 3) ── */}
          {myRank && myRank > 3 && myEntry && (
            <View style={styles.myRankBanner}>
              <LinearGradient
                colors={[LOGO.yellow + "20", LOGO.yellow + "08"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
              <Ionicons name="person" size={16} color={LOGO.yellow} />
              <Text style={styles.myRankText}>ترتيبك: </Text>
              <Text style={styles.myRankNum}>#{myRank}</Text>
              <Text style={styles.myRankSep}> · </Text>
              <Text style={styles.myRankText}>{getValue(myEntry).toLocaleString()}</Text>
            </View>
          )}

          {/* ── Rest of list ── */}
          <View style={styles.listContainer}>
            {rest.map((entry, i) => (
              <AnimatedRow
                key={entry.id}
                entry={entry}
                index={i}
                isMe={entry.id === playerId}
                getValue={getValue}
              />
            ))}

            {entries.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>لا توجد بيانات بعد</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:  { fontFamily: "Cairo_400Regular", fontSize: 14 },
  blob:         { position: "absolute", borderRadius: 999 },
  scrollContent:{ paddingBottom: 32 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerEmoji:  { fontSize: 22 },
  headerTitle:  { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#F0E6D3" },

  filterRow: {
    flexDirection: "row", borderRadius: 16, padding: 4,
    marginHorizontal: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden",
  },
  filterTab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    alignItems: "center", flexDirection: "row",
    justifyContent: "center", gap: 5, overflow: "hidden",
  },
  filterTabText: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },

  podiumSection: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 12,
    paddingBottom: 16, gap: 6, overflow: "hidden", borderRadius: 24,
    marginHorizontal: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  podiumBg: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24,
  },
  podiumItem:        { flex: 1, alignItems: "center", gap: 3 },
  rankMedal:         { fontSize: 20, marginBottom: 2 },
  podiumAvatarRing:  {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, justifyContent: "center", alignItems: "center",
    shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  podiumAvatarInner: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  podiumEmoji:       { fontSize: 24 },
  youBadge:          { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  youBadgeText:      { fontFamily: "Cairo_700Bold", fontSize: 9 },
  podiumName:        { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#A8B8CC", textAlign: "center", maxWidth: 85 },
  podiumScore:       { fontFamily: "Cairo_700Bold", fontSize: 13 },
  podiumBlock:       {
    width: "100%", borderTopWidth: 2, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingTop: 6,
  },
  podiumRankNum:     { fontFamily: "Cairo_700Bold", fontSize: 22 },

  myRankBanner: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
    marginBottom: 12, borderWidth: 1, borderColor: LOGO.yellow + "35",
    justifyContent: "center", gap: 4, overflow: "hidden",
  },
  myRankText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: LOGO.yellow },
  myRankNum:  { fontFamily: "Cairo_700Bold", fontSize: 16, color: LOGO.yellow },
  myRankSep:  { color: LOGO.yellow, fontSize: 16 },

  listContainer:   { paddingHorizontal: 12, gap: 8 },
  rankRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, padding: 12, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)", overflow: "hidden",
  },
  rankRowMe:       { borderColor: LOGO.yellow + "55" },
  rankRowNum:      { fontFamily: "Cairo_700Bold", fontSize: 15, width: 28, textAlign: "center" },
  rankRowAvatar:   { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", marginRight: 10, borderWidth: 1.5 },
  rankRowEmoji:    { fontSize: 22 },
  rankRowInfo:     { flex: 1, gap: 2 },
  rankRowNameRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  rankRowName:     { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  rankRowSubRow:   { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rankRowSub:      { fontFamily: "Cairo_400Regular", fontSize: 11 },
  rankRowValue:    { fontFamily: "Cairo_700Bold", fontSize: 17 },

  titlePill: {
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, alignSelf: "flex-start",
  },
  titlePillText: { fontFamily: "Cairo_700Bold", fontSize: 9 },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontFamily: "Cairo_600SemiBold", fontSize: 15 },
});
