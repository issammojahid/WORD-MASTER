import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { usePlayer, SKINS, getXpProgress } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getPlayerDisplayId, getDisplayCode } from "@/lib/player-code";

const LOGO = {
  cyan:   "#00F5FF",
  pink:   "#FF006E",
  purple: "#BF00FF",
  yellow: "#F5C842",
  green:  "#00FF87",
};

const DIVISION_MAP: Record<string, { emoji: string; nameAr: string; color: string }> = {
  bronze:   { emoji: "🥉", nameAr: "برونز",  color: "#CD7F32" },
  silver:   { emoji: "🥈", nameAr: "فضة",    color: "#A8A8A8" },
  gold:     { emoji: "🥇", nameAr: "ذهب",    color: "#FFD700" },
  platinum: { emoji: "💠", nameAr: "بلاتين", color: "#00E5FF" },
  diamond:  { emoji: "💎", nameAr: "ماسة",   color: "#BF00FF" },
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, playerId, setPlayerName } = usePlayer();
  const { theme } = useTheme();

  const [codeCopied, setCodeCopied] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];
  const xpData = getXpProgress(profile.xp);
  const div = DIVISION_MAP[profile.division ?? "bronze"] ?? DIVISION_MAP.bronze;

  const displayId = getPlayerDisplayId(profile.playerTag);
  const displayCode = getDisplayCode(profile.name, playerId, profile.playerTag);

  const winRate = profile.gamesPlayed > 0
    ? Math.round((profile.wins / profile.gamesPlayed) * 100)
    : 0;
  const losses = profile.gamesPlayed - profile.wins;

  const handleCopyId = async () => {
    await Clipboard.setStringAsync(displayId || displayCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCodeCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleSaveName = () => {
    if (nameInput.trim().length < 2) {
      Alert.alert("", "الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    setPlayerName(nameInput.trim());
    setShowEditModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const skinRarityColors: Record<string, string> = {
    common: LOGO.cyan, rare: LOGO.purple, epic: LOGO.pink, legendary: LOGO.yellow,
  };
  const ringColor = skinRarityColors[equippedSkin.rarity] || LOGO.cyan;

  const STATS = [
    { label: "مباريات", value: profile.gamesPlayed, color: LOGO.cyan,   icon: "game-controller" as const },
    { label: "انتصارات", value: profile.wins,         color: LOGO.green,  icon: "trophy" as const },
    { label: "خسارات",  value: losses,                color: LOGO.pink,   icon: "close-circle" as const },
    { label: "نسبة الفوز", value: `${winRate}%`,      color: LOGO.yellow, icon: "stats-chart" as const },
  ];

  return (
    <View style={[s.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient
        colors={["#0A0E1A", "#0D1526", "#0A0E1A"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[LOGO.cyan + "20", LOGO.purple + "18"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>بروفايلي</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View style={s.avatarSection}>
          <View style={[s.avatarOuter, { borderColor: ringColor + "CC", shadowColor: ringColor }]}>
            <LinearGradient
              colors={[ringColor + "22", equippedSkin.color + "33"]}
              style={s.avatarInner}
            >
              <Text style={s.avatarEmoji}>{equippedSkin.emoji}</Text>
            </LinearGradient>
          </View>

          <TouchableOpacity
            style={s.nameRow}
            onPress={() => { setNameInput(profile.name); setShowEditModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={[s.playerName, { color: theme.textPrimary }]}>{profile.name}</Text>
            <Ionicons name="pencil" size={14} color={LOGO.cyan} style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {/* Division badge */}
          <View style={[s.divisionBadge, { backgroundColor: div.color + "18", borderColor: div.color + "55" }]}>
            <Text style={{ fontSize: 14 }}>{div.emoji}</Text>
            <Text style={[s.divisionText, { color: div.color }]}>{div.nameAr}</Text>
            <Text style={[s.eloText, { color: div.color + "BB" }]}>{profile.elo ?? 1000} ELO</Text>
          </View>
        </View>

        {/* Player ID */}
        <View style={[s.idCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={s.idRow}>
            <Ionicons name="id-card" size={18} color={LOGO.cyan} />
            <Text style={[s.idLabel, { color: theme.textMuted }]}>كود اللاعب</Text>
          </View>
          <View style={s.idValueRow}>
            <Text style={s.idValue}>{displayId || displayCode}</Text>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopyId} activeOpacity={0.7}>
              <Ionicons
                name={codeCopied ? "checkmark-circle" : "copy-outline"}
                size={20}
                color={codeCopied ? LOGO.green : theme.textMuted}
              />
              <Text style={[s.copyText, { color: codeCopied ? LOGO.green : theme.textMuted }]}>
                {codeCopied ? "تم النسخ" : "نسخ"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats 2x2 grid */}
        <View style={s.statsGrid}>
          {STATS.map((stat, i) => (
            <View
              key={i}
              style={[s.statCell, { backgroundColor: stat.color + "12", borderColor: stat.color + "40" }]}
            >
              <Ionicons name={stat.icon} size={20} color={stat.color} style={{ marginBottom: 4 }} />
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Level + XP */}
        <View style={[s.levelCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={s.levelHeader}>
            <LinearGradient
              colors={[LOGO.yellow + "30", LOGO.yellow + "18"]}
              style={s.levelBadge}
            >
              <Text style={s.levelBadgeText}>Lv.{profile.level}</Text>
            </LinearGradient>
            <Text style={[s.levelTitle, { color: theme.textPrimary }]}>المستوى والتقدم</Text>
            <Text style={[s.xpLabel, { color: theme.textMuted }]}>
              {xpData.current} / {xpData.needed} XP
            </Text>
          </View>
          <View style={s.xpBarBg}>
            <LinearGradient
              colors={[LOGO.cyan, LOGO.purple]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.xpBarFill, { width: `${xpData.progress * 100}%` as `${number}%` }]}
            />
          </View>
          <Text style={[s.xpHint, { color: theme.textMuted }]}>
            {xpData.needed - xpData.current} XP للمستوى {profile.level + 1}
          </Text>
        </View>

        {/* Season Stats */}
        <View style={[s.seasonCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={s.seasonHeader}>
            <Ionicons name="calendar" size={16} color={LOGO.purple} />
            <Text style={[s.seasonTitle, { color: theme.textPrimary }]}>الموسم الحالي</Text>
          </View>
          <View style={s.seasonRow}>
            <View style={s.seasonStat}>
              <Text style={[s.seasonVal, { color: LOGO.green }]}>{profile.seasonWins ?? 0}</Text>
              <Text style={[s.seasonLbl, { color: theme.textMuted }]}>فوز</Text>
            </View>
            <View style={[s.seasonDivider, { backgroundColor: theme.cardBorder }]} />
            <View style={s.seasonStat}>
              <Text style={[s.seasonVal, { color: LOGO.pink }]}>{profile.seasonLosses ?? 0}</Text>
              <Text style={[s.seasonLbl, { color: theme.textMuted }]}>خسارة</Text>
            </View>
            <View style={[s.seasonDivider, { backgroundColor: theme.cardBorder }]} />
            <View style={s.seasonStat}>
              <Text style={[s.seasonVal, { color: LOGO.yellow }]}>{profile.bestStreak}</Text>
              <Text style={[s.seasonLbl, { color: theme.textMuted }]}>أفضل سلسلة</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>تغيير الاسم</Text>
            <TextInput
              style={s.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={20}
              textAlign="right"
              autoFocus
              selectTextOnFocus
              placeholderTextColor="#5A5A88"
              placeholder="اكتب اسمك..."
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={s.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleSaveName}>
                <Text style={s.modalConfirmText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.14)",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF",
  },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },

  avatarSection: { alignItems: "center", paddingVertical: 12, gap: 10 },
  avatarOuter: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
    justifyContent: "center", alignItems: "center",
  },
  avatarInner: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: "center", alignItems: "center",
  },
  avatarEmoji: { fontSize: 44 },
  nameRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
  },
  playerName: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  divisionBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1.5,
  },
  divisionText: { fontFamily: "Cairo_700Bold", fontSize: 13 },
  eloText: { fontFamily: "Cairo_400Regular", fontSize: 11 },

  idCard: {
    borderRadius: 20, padding: 16,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.10)",
    gap: 8,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  idLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
  idValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  idValue: {
    fontFamily: "Cairo_700Bold", fontSize: 18, color: LOGO.cyan,
    letterSpacing: 1,
  },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  copyText: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  statCell: {
    flex: 1, minWidth: "45%",
    borderRadius: 18, padding: 16,
    borderWidth: 2,
    alignItems: "center", gap: 2,
  },
  statValue: { fontFamily: "Cairo_700Bold", fontSize: 26 },
  statLabel: { fontFamily: "Cairo_400Regular", fontSize: 11 },

  levelCard: {
    borderRadius: 20, padding: 16,
    borderWidth: 2,
    gap: 10,
  },
  levelHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  levelBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  levelBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: LOGO.yellow },
  levelTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, flex: 1 },
  xpLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
  xpBarBg: {
    height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  xpBarFill: { height: "100%", borderRadius: 4 },
  xpHint: { fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "center" },

  seasonCard: {
    borderRadius: 20, padding: 16,
    borderWidth: 2,
    gap: 12,
  },
  seasonHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  seasonTitle: { fontFamily: "Cairo_700Bold", fontSize: 15 },
  seasonRow: { flexDirection: "row", alignItems: "center" },
  seasonStat: { flex: 1, alignItems: "center" },
  seasonVal: { fontFamily: "Cairo_700Bold", fontSize: 22 },
  seasonLbl: { fontFamily: "Cairo_400Regular", fontSize: 11 },
  seasonDivider: { width: 1, height: 36 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.70)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#160D33", borderRadius: 26, padding: 24,
    borderWidth: 3, borderColor: LOGO.purple + "70",
    borderBottomWidth: 5, borderBottomColor: LOGO.purple + "99",
    gap: 16,
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 20, color: LOGO.cyan, textAlign: "center",
  },
  nameInput: {
    borderWidth: 2.5, borderColor: LOGO.cyan + "60", borderRadius: 16,
    borderBottomWidth: 4, borderBottomColor: LOGO.cyan + "99",
    padding: 14, fontFamily: "Cairo_400Regular", fontSize: 16,
    color: "#E8E8FF", backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalBtns: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.18)",
    borderBottomWidth: 4, borderBottomColor: "rgba(0,0,0,0.25)",
  },
  modalCancelText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#9898CC" },
  modalConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 18,
    backgroundColor: LOGO.yellow, alignItems: "center",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.30)",
    borderBottomWidth: 4, borderBottomColor: "#C4A010",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#000" },
});
