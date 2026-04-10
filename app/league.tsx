import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 64;
const CARD_MARGIN = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN;

type EntryOption = {
  entry: number;
  win: number;
};

type League = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  glowColor: string;
  minCoins: number;
  entries: EntryOption[];
};

const LEAGUES: League[] = [
  {
    id: "bronze",
    name: "البرونز",
    emoji: "🥉",
    color: "#CD7F32",
    glowColor: "#CD7F3240",
    minCoins: 50,
    entries: [
      { entry: 50, win: 100 },
      { entry: 100, win: 200 },
      { entry: 250, win: 500 },
    ],
  },
  {
    id: "silver",
    name: "الفضة",
    emoji: "🥈",
    color: "#C0C0C0",
    glowColor: "#C0C0C040",
    minCoins: 500,
    entries: [
      { entry: 500, win: 1000 },
      { entry: 1000, win: 2000 },
      { entry: 1500, win: 3000 },
      { entry: 2000, win: 4000 },
    ],
  },
  {
    id: "gold",
    name: "الذهب",
    emoji: "🥇",
    color: "#F5A623",
    glowColor: "#F5A62340",
    minCoins: 3000,
    entries: [
      { entry: 3000, win: 6000 },
      { entry: 5000, win: 10000 },
      { entry: 10000, win: 20000 },
    ],
  },
  {
    id: "diamond",
    name: "الماس",
    emoji: "💎",
    color: "#00D4FF",
    glowColor: "#00D4FF40",
    minCoins: 50000,
    entries: [
      { entry: 50000, win: 100000 },
      { entry: 100000, win: 200000 },
    ],
  },
];

function formatCoins(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function LeagueScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addCoins } = usePlayer();
  const { theme, isDark } = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSelectEntry = (entry: number) => {
    if (profile.coins < entry) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("رصيد غير كافٍ", `تحتاج ${formatCoins(entry)} عملة لهذا الخيار.\nرصيدك الحالي: ${formatCoins(profile.coins)} عملة.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Deduct the entry fee immediately so the balance is correct during matchmaking.
    // Rewards are added at game-end by reportGameResult (win only).
    if (entry > 0) addCoins(-entry);
    router.push({ pathname: "/lobby", params: { coinEntry: String(entry) } });
  };

  const renderLeagueCard = ({ item: league }: { item: League }) => {
    const canPlay = profile.coins >= league.minCoins;
    return (
      <View style={[styles.card, { borderColor: league.color + "50", shadowColor: league.color }]}>
        {/* Card header */}
        <LinearGradient
          colors={[league.color + "30", league.color + "10", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.cardHeader}
        >
          <Text style={styles.cardEmoji}>{league.emoji}</Text>
          <Text style={[styles.cardTitle, { color: league.color }]}>{league.name}</Text>
          {!canPlay && (
            <View style={[styles.lockedBadge, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
              <Ionicons name="lock-closed" size={12} color={theme.textMuted} />
              <Text style={styles.lockedText}>يلزم {formatCoins(league.minCoins)} 🪙</Text>
            </View>
          )}
        </LinearGradient>

        {/* Column headers */}
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>الدخول</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
          <Text style={styles.tableHeaderText}>الجائزة</Text>
        </View>

        {/* Entry options */}
        <View style={styles.entriesContainer}>
          {league.entries.map((opt) => {
            const affordable = profile.coins >= opt.entry;
            return (
              <TouchableOpacity
                key={opt.entry}
                style={[
                  styles.entryRow,
                  { borderColor: affordable ? league.color + "40" : theme.cardBorder },
                  affordable && styles.entryRowAffordable,
                  !affordable && styles.entryRowLocked,
                ]}
                onPress={() => handleSelectEntry(opt.entry)}
                activeOpacity={affordable ? 0.7 : 1}
                disabled={!affordable}
              >
                <View style={styles.entryLeft}>
                  <Text style={[styles.entryAmount, { color: affordable ? theme.textPrimary : theme.textMuted }]}>
                    🪙 {formatCoins(opt.entry)}
                  </Text>
                  <Text style={styles.entryLabel}>رسوم الدخول</Text>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={affordable ? league.color : theme.textMuted}
                />
                <View style={styles.entryRight}>
                  <Text style={[styles.winAmount, { color: affordable ? league.color : theme.textMuted }]}>
                    🏆 {formatCoins(opt.win)}
                  </Text>
                  <Text style={styles.winLabel}>جائزة الفوز</Text>
                </View>

                {!affordable && (
                  <View style={styles.entryLockOverlay}>
                    <Ionicons name="lock-closed" size={16} color={theme.textMuted} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom hint */}
        <Text style={styles.cardHint}>
          {canPlay ? "اختر مبلغ الدخول للبدء" : `تحتاج ${formatCoins(league.minCoins)} عملة للعب`}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient
        colors={["#0A0E1A", "#0D1526", "#0A0E1A"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <LinearGradient
            colors={["#00F5FF20", "#BF00FF18"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>⚔️</Text>
          <Text style={styles.headerTitle}>اختر الدوري</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Coin balance */}
      <View style={styles.balanceRow}>
        <LinearGradient
          colors={[Colors.gold + "22", Colors.gold + "10"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.balanceBadge}
        >
          <Ionicons name="star" size={16} color={Colors.gold} />
          <Text style={styles.balanceLabel}>رصيدك</Text>
          <Text style={styles.balanceValue}>{formatCoins(profile.coins)}</Text>
        </LinearGradient>
      </View>

      {/* League cards */}
      <FlatList
        ref={flatRef}
        data={LEAGUES}
        keyExtractor={(item) => item.id}
        renderItem={renderLeagueCard}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
          setActiveIdx(Math.max(0, Math.min(idx, LEAGUES.length - 1)));
        }}
        scrollEventThrottle={16}
        ItemSeparatorComponent={() => <View style={{ width: CARD_MARGIN }} />}
      />

      {/* Dot indicators */}
      <View style={styles.dots}>
        {LEAGUES.map((l, idx) => (
          <TouchableOpacity
            key={l.id}
            style={[styles.dot, idx === activeIdx && { backgroundColor: LEAGUES[activeIdx].color, width: 20 }]}
            onPress={() => {
              flatRef.current?.scrollToIndex({ index: idx, animated: true });
              setActiveIdx(idx);
            }}
          />
        ))}
      </View>

      {/* League names hint */}
      <View style={styles.leagueNames}>
        {LEAGUES.map((l, idx) => (
          <TouchableOpacity
            key={l.id}
            onPress={() => {
              flatRef.current?.scrollToIndex({ index: idx, animated: true });
              setActiveIdx(idx);
            }}
          >
            <Text style={[styles.leagueName, idx === activeIdx && { color: LEAGUES[activeIdx].color }]}>
              {l.emoji} {l.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  balanceRow: { alignItems: "center", marginBottom: 16 },
  balanceBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.gold + "40",
  },
  balanceLabel: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#9898CC" },
  balanceValue: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.gold },
  carouselContent: {
    paddingHorizontal: 32,
    paddingBottom: 8,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#12122A",
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 20, paddingBottom: 16,
  },
  cardEmoji: { fontSize: 40 },
  cardTitle: { fontFamily: "Cairo_700Bold", fontSize: 26, flex: 1 },
  lockedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#14142E", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  lockedText: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#5A5A88" },
  tableHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingHorizontal: 20, paddingBottom: 10,
  },
  tableHeaderText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#5A5A88" },
  entriesContainer: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  entryRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    position: "relative",
  },
  entryRowAffordable: { backgroundColor: "#14142E" },
  entryRowLocked: { backgroundColor: "#0E0E24", opacity: 0.55 },
  entryLeft: { flex: 1 },
  entryRight: { flex: 1, alignItems: "flex-end" },
  entryAmount: { fontFamily: "Cairo_700Bold", fontSize: 15 },
  entryLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#5A5A88", marginTop: 2 },
  winAmount: { fontFamily: "Cairo_700Bold", fontSize: 15 },
  winLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#5A5A88", marginTop: 2 },
  entryLockOverlay: {
    position: "absolute", right: 12, top: "50%",
    transform: [{ translateY: -8 }],
  },
  cardHint: {
    fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88",
    textAlign: "center", padding: 14, paddingTop: 10,
  },
  dots: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 6, marginTop: 12, marginBottom: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#5A5A88" + "60",
  },
  leagueNames: {
    flexDirection: "row", justifyContent: "center",
    flexWrap: "wrap", gap: 12, paddingHorizontal: 16,
    marginBottom: 8,
  },
  leagueName: {
    fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#5A5A88",
  },
});
