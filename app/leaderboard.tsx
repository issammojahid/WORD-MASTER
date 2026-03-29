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
import { COUNTRIES, getCountryInfo, CountryPickerModal } from "@/lib/countries";

const LOGO = {
  cyan:   "#00F5FF",
  pink:   "#FF006E",
  purple: "#BF00FF",
  yellow: "#F5C842",
  green:  "#00FF87",
};

type TabFilter = "score" | "wins" | "xp" | "ranked";
type GeoFilter = "national" | "international";

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
  isVip?: boolean;
  elo?: number;
  division?: string;
  seasonWins?: number;
  seasonLosses?: number;
  country?: string;
};

const DIVISION_META: Record<string, { emoji: string; nameAr: string; color: string }> = {
  bronze:   { emoji: "🥉", nameAr: "برونز",   color: "#CD7F32" },
  silver:   { emoji: "🥈", nameAr: "فضة",     color: "#A8A8A8" },
  gold:     { emoji: "🥇", nameAr: "ذهب",     color: "#FFD700" },
  platinum: { emoji: "💠", nameAr: "بلاتين",  color: "#00E5FF" },
  diamond:  { emoji: "💎", nameAr: "ماسة",    color: "#BF00FF" },
};

const RANK_COLORS = [Colors.rank1, Colors.rank2, Colors.rank3];
const RANK_GLOWS  = ["#FFD70040", "#C0C0C040", "#CD7F3240"];
const RANK_LABELS = ["🥇", "🥈", "🥉"];

function getTitleLabel(titleId: string): { label: string; color: string } | null {
  const t = TITLES.find((tt) => tt.id === titleId);
  if (!t || t.id === "beginner") return null;
  const colors: Record<string, string> = {
    common: LOGO.cyan, rare: LOGO.purple, epic: LOGO.pink, legendary: LOGO.yellow,
  };
  return { label: t.nameAr, color: colors[t.rarity] || LOGO.cyan };
}

function AnimatedRow({ entry, index, isMe, getValue, tab }: {
  entry: LeaderboardEntry;
  index: number;
  isMe: boolean;
  getValue: (e: LeaderboardEntry) => number;
  tab: TabFilter;
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
  const divMeta = tab === "ranked" && entry.division ? DIVISION_META[entry.division] : null;
  const countryInfo = entry.country ? getCountryInfo(entry.country) : null;

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
        <Text style={[styles.rankRowNum, { color: theme.textMuted }]}>{entry.rank}</Text>
        <View style={[styles.rankRowAvatar, {
          backgroundColor: divMeta ? divMeta.color + "22" : skin.color + "33",
          borderColor: divMeta ? divMeta.color + "66" : skin.color + "55",
        }]}>
          <Text style={styles.rankRowEmoji}>{skin.emoji}</Text>
        </View>
        <View style={styles.rankRowInfo}>
          <View style={styles.rankRowNameRow}>
            {entry.isVip && <Text style={{ fontSize: 12, marginRight: 3 }}>👑</Text>}
            {divMeta && <Text style={{ fontSize: 12, marginRight: 3 }}>{divMeta.emoji}</Text>}
            {countryInfo && <Text style={{ fontSize: 13, marginRight: 3 }}>{countryInfo.flag}</Text>}
            <Text style={[styles.rankRowName, { color: theme.textPrimary }]} numberOfLines={1}>
              {entry.name}{isMe ? " (أنت)" : ""}
            </Text>
          </View>
          <View style={styles.rankRowSubRow}>
            {divMeta ? (
              <View style={[styles.titlePill, { backgroundColor: divMeta.color + "20", borderColor: divMeta.color + "50" }]}>
                <Text style={[styles.titlePillText, { color: divMeta.color }]}>{divMeta.nameAr}</Text>
              </View>
            ) : titleInfo ? (
              <View style={[styles.titlePill, { backgroundColor: titleInfo.color + "20", borderColor: titleInfo.color + "50" }]}>
                <Text style={[styles.titlePillText, { color: titleInfo.color }]}>{titleInfo.label}</Text>
              </View>
            ) : null}
            <Text style={[styles.rankRowSub, { color: theme.textMuted }]}>
              {tab === "ranked"
                ? `${entry.seasonWins ?? 0}ف · ${entry.seasonLosses ?? 0}خ`
                : `Lv.${entry.level} · ${entry.gamesPlayed} مباراة`}
            </Text>
          </View>
        </View>
        <Text style={[styles.rankRowValue, { color: isMe ? LOGO.yellow : (divMeta ? divMeta.color : theme.textPrimary) }]}>
          {tab === "ranked" ? (getValue(entry) || 1000).toLocaleString() : getValue(entry).toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, updateProfile } = usePlayer();
  const { theme } = useTheme();
  const [tab, setTab] = useState<TabFilter>("score");
  const [geo, setGeo] = useState<GeoFilter>("international");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const headerGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(headerGlow, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(headerGlow, { toValue: 0, duration: 2000, useNativeDriver: false }),
    ])).start();
  }, []);

  const myCountry = profile.country || "MA";
  const myCountryInfo = getCountryInfo(myCountry);

  const countryParam = geo === "national" ? myCountry : null;

  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", tab, geo, myCountry],
    queryFn: async () => {
      let path: string;
      if (tab === "ranked") {
        path = countryParam
          ? `/api/ranked/leaderboard?country=${encodeURIComponent(countryParam)}`
          : "/api/ranked/leaderboard";
      } else {
        path = countryParam
          ? `/api/leaderboard?type=${tab}&country=${encodeURIComponent(countryParam)}`
          : `/api/leaderboard?type=${tab}`;
      }
      const url = new URL(path, getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: seasonData } = useQuery<{ season: { name: string; daysLeft: number } | null }>({
    queryKey: ["/api/ranked/season"],
    queryFn: async () => {
      const url = new URL("/api/ranked/season", getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
    enabled: tab === "ranked",
  });

  const myEntry = entries.find((e) => e.id === playerId);
  const myRank = myEntry ? myEntry.rank : null;

  const getValue = (e: LeaderboardEntry) =>
    tab === "wins" ? e.wins : tab === "xp" ? e.xp : tab === "ranked" ? (e.elo ?? 1000) : e.score;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const TAB_ICONS: Record<TabFilter, { icon: string; color: string; label: string }> = {
    score:  { icon: "star",   color: LOGO.yellow, label: "النقاط" },
    wins:   { icon: "trophy", color: LOGO.cyan,   label: "الانتصارات" },
    xp:     { icon: "flash",  color: LOGO.purple, label: "الخبرة" },
    ranked: { icon: "shield", color: "#FFD700",   label: "المرتبة" },
  };

  const handleSelectCountry = (code: string) => {
    updateProfile({ country: code });
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient colors={["#0A0A1A", "#0E0E24", "#0A0A1A"]} style={StyleSheet.absoluteFillObject} />

      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.blob, { top: -40, left: -60, width: 200, height: 200, backgroundColor: LOGO.purple + "14" }]} />
        <View style={[styles.blob, { top: 200, right: -60, width: 180, height: 180, backgroundColor: LOGO.cyan + "10" }]} />
        <View style={[styles.blob, { top: 500, left: -40, width: 160, height: 160, backgroundColor: LOGO.pink + "0E" }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <LinearGradient colors={[LOGO.cyan + "20", LOGO.purple + "18"]} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🏆</Text>
          <Text style={styles.headerTitle}>المتصدرون</Text>
        </View>
        <TouchableOpacity
          style={[styles.countryBtn, { borderColor: LOGO.cyan + "50" }]}
          onPress={() => setShowCountryPicker(true)}
        >
          <Text style={{ fontSize: 18 }}>{myCountryInfo.flag}</Text>
        </TouchableOpacity>
      </View>

      {/* Geo filter: National / International */}
      <View style={styles.geoRow}>
        {(["national", "international"] as GeoFilter[]).map((g) => {
          const active = geo === g;
          const label = g === "national" ? `وطني ${myCountryInfo.flag}` : "دولي 🌍";
          const color = g === "national" ? LOGO.cyan : LOGO.purple;
          return (
            <TouchableOpacity
              key={g}
              style={[styles.geoTab, active && { backgroundColor: color + "20", borderColor: color + "70" }]}
              onPress={() => setGeo(g)}
              activeOpacity={0.75}
            >
              {active && (
                <LinearGradient
                  colors={[color + "28", color + "0C"]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
              )}
              <Text style={[styles.geoTabText, { color: active ? color : theme.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stat filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: theme.card + "CC" }]}>
        {(["score", "wins", "xp", "ranked"] as TabFilter[]).map((f) => {
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

      {/* Season countdown banner */}
      {tab === "ranked" && seasonData?.season && (
        <View style={{ marginHorizontal: 16, marginBottom: 6, borderRadius: 10, overflow: "hidden" }}>
          <LinearGradient
            colors={["#BF00FF22", "#FFD70018", "#00E5FF14"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#BF00FF30", borderRadius: 10 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 14 }}>🏆</Text>
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 13, color: "#FFD700" }}>{seasonData.season.name}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 12 }}>⏳</Text>
              <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: "#00E5FF" }}>{seasonData.season.daysLeft} يوم متبقي</Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={LOGO.yellow} size="large" />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>جاري التحميل...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Podium */}
          {top3.length >= 3 && (
            <View style={styles.podiumSection}>
              <LinearGradient colors={[LOGO.yellow + "12", LOGO.purple + "0A", "transparent"]} style={styles.podiumBg} />
              {([top3[1], top3[0], top3[2]] as LeaderboardEntry[]).map((entry, podiumPos) => {
                const realIdx = podiumPos === 0 ? 1 : podiumPos === 1 ? 0 : 2;
                const skin = SKINS.find((s) => s.id === entry.skin) || SKINS[0];
                const isMe = entry.id === playerId;
                const podiumHeights = [72, 96, 56];
                const rankColor = RANK_COLORS[realIdx];
                const titleInfo = getTitleLabel(entry.equippedTitle);
                const cInfo = entry.country ? getCountryInfo(entry.country) : null;
                return (
                  <View key={entry.id} style={styles.podiumItem}>
                    <Text style={styles.rankMedal}>{RANK_LABELS[realIdx]}</Text>
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
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }}>
                      {entry.isVip && <Text style={{ fontSize: 10 }}>👑</Text>}
                      {cInfo && <Text style={{ fontSize: 12 }}>{cInfo.flag}</Text>}
                      <Text style={[styles.podiumName, { color: theme.textPrimary }]} numberOfLines={1}>{entry.name}</Text>
                    </View>
                    {titleInfo && (
                      <View style={[styles.titlePill, { backgroundColor: titleInfo.color + "20", borderColor: titleInfo.color + "50", marginBottom: 2 }]}>
                        <Text style={[styles.titlePillText, { color: titleInfo.color }]}>{titleInfo.label}</Text>
                      </View>
                    )}
                    <Text style={[styles.podiumScore, { color: rankColor }]}>{getValue(entry).toLocaleString()}</Text>
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

          {/* My rank banner */}
          {myRank && myRank > 3 && myEntry && (
            <View style={styles.myRankBanner}>
              <LinearGradient colors={[LOGO.yellow + "20", LOGO.yellow + "08"]} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              <Ionicons name="person" size={16} color={LOGO.yellow} />
              <Text style={styles.myRankText}>ترتيبك: </Text>
              <Text style={styles.myRankNum}>#{myRank}</Text>
              <Text style={styles.myRankSep}> · </Text>
              <Text style={styles.myRankText}>{getValue(myEntry).toLocaleString()}</Text>
            </View>
          )}

          {/* National empty hint */}
          {geo === "national" && entries.length === 0 && !isLoading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{myCountryInfo.flag}</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>لا يوجد لاعبون من {myCountryInfo.nameAr} بعد</Text>
              <Text style={[{ fontFamily: "Cairo_400Regular", fontSize: 12, color: theme.textMuted, textAlign: "center" }]}>كن أول لاعب!</Text>
            </View>
          )}

          {/* List */}
          <View style={styles.listContainer}>
            {rest.map((entry, i) => (
              <AnimatedRow key={entry.id} entry={entry} index={i} isMe={entry.id === playerId} getValue={getValue} tab={tab} />
            ))}
            {entries.length === 0 && geo === "international" && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>لا توجد بيانات بعد</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <CountryPickerModal
        visible={showCountryPicker}
        onClose={() => setShowCountryPicker(false)}
        onSelect={handleSelectCountry}
        currentCode={myCountry}
      />
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
  headerTitle:  { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  countryBtn: {
    width: 40, height: 40, borderRadius: 12, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1,
  },

  geoRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10, gap: 10,
  },
  geoTab: {
    flex: 1, paddingVertical: 9, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  geoTabText: { fontFamily: "Cairo_700Bold", fontSize: 13 },

  filterRow: {
    flexDirection: "row", borderRadius: 16, padding: 4,
    marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden",
  },
  filterTab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    alignItems: "center", flexDirection: "row",
    justifyContent: "center", gap: 5, overflow: "hidden",
  },
  filterTabText: { fontFamily: "Cairo_600SemiBold", fontSize: 11 },

  podiumSection: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 12,
    paddingBottom: 16, gap: 6, overflow: "hidden", borderRadius: 24,
    marginHorizontal: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  podiumBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24 },
  podiumItem:        { flex: 1, alignItems: "center", gap: 3 },
  rankMedal:         { fontSize: 20, marginBottom: 2 },
  podiumAvatarRing:  {
    width: 52, height: 52, borderRadius: 26, borderWidth: 2,
    justifyContent: "center", alignItems: "center",
    shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  podiumAvatarInner: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  podiumEmoji:       { fontSize: 24 },
  youBadge:          { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  youBadgeText:      { fontFamily: "Cairo_700Bold", fontSize: 9 },
  podiumName:        { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#9898CC", textAlign: "center", maxWidth: 80 },
  podiumScore:       { fontFamily: "Cairo_700Bold", fontSize: 13 },
  podiumBlock:       { width: "100%", borderTopWidth: 2, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingTop: 6 },
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
  rankRowNameRow:  { flexDirection: "row", alignItems: "center", gap: 3 },
  rankRowName:     { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  rankRowSubRow:   { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rankRowSub:      { fontFamily: "Cairo_400Regular", fontSize: 11 },
  rankRowValue:    { fontFamily: "Cairo_700Bold", fontSize: 17 },

  titlePill: {
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, alignSelf: "flex-start",
  },
  titlePillText: { fontFamily: "Cairo_700Bold", fontSize: 9 },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontFamily: "Cairo_600SemiBold", fontSize: 15 },
});
