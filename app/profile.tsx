import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { usePlayer, getXpProgress } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { CoinBalance, GameHeader, GameModal, GameScreenBackground, PlayerAvatar } from "@/components/GameUi";
import { CosmeticArtwork } from "@/components/CosmeticArtwork";
import { getPlayerDisplayId, getDisplayCode } from "@/lib/player-code";
import { gameDesign } from "@/constants/game-design";
import { getAvatarCosmetic, getCosmetic } from "@shared/cosmetics";

const LOGO = {
  cyan: gameDesign.colors.profile,
  pink: gameDesign.colors.danger,
  purple: gameDesign.colors.online,
  yellow: gameDesign.colors.coins,
  green: gameDesign.colors.success,
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

  const xpData = getXpProgress(profile.xp);
  const avatarCosmetic = getAvatarCosmetic(profile.equippedSkin);
  const profileBackground = getCosmetic("background", profile.equippedCosmetics.background);
  const nameplate = getCosmetic("nameplate", profile.equippedCosmetics.nameplate);
  const seasonalCosmetic = getCosmetic("seasonal", profile.equippedCosmetics.seasonal);

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

  const STATS = [
    { label: "مباريات", value: profile.gamesPlayed, color: LOGO.cyan,   icon: "game-controller" as const },
    { label: "انتصارات", value: profile.wins,         color: LOGO.green,  icon: "trophy" as const },
    { label: "خسارات",  value: losses,                color: LOGO.pink,   icon: "close-circle" as const },
    { label: "نسبة الفوز", value: `${winRate}%`,      color: LOGO.yellow, icon: "stats-chart" as const },
  ];

  return (
    <View style={[s.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <GameScreenBackground accent="online" />
      <GameHeader
        title="بروفايلي"
        onBack={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        icon={<Ionicons name="person-circle-outline" size={23} color={LOGO.cyan} />}
        trailing={<View style={s.headerTrailing}><CoinBalance amount={profile.coins} /></View>}
      />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View style={[s.avatarSection, profileBackground ? { backgroundColor: `${profileBackground.colors[0]}18` } : null]}>
          {profileBackground ? (
            <View style={[s.profileBackgroundArtwork, { pointerEvents: "none" }]}>
              <CosmeticArtwork kind="background" itemId={profile.equippedCosmetics.background} size={190} height={136} />
            </View>
          ) : null}
          <View style={[s.avatarOuter, { borderColor: avatarCosmetic.colors[0], shadowColor: avatarCosmetic.colors[0] }]}>
            <PlayerAvatar size={88} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame} accessibilityLabel={profile.name} />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Edit player name: ${profile.name}`}
            style={s.nameRow}
            onPress={() => { setNameInput(profile.name); setShowEditModal(true); }}
            activeOpacity={0.8}
          >
            {nameplate ? (
              <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
                <CosmeticArtwork kind="nameplate" itemId={profile.equippedCosmetics.nameplate} size={240} height={68} />
              </View>
            ) : null}
            <Text style={[s.playerName, { color: theme.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
            <Ionicons name="pencil" size={14} color={LOGO.cyan} />
          </TouchableOpacity>
          {seasonalCosmetic && profile.equippedCosmetics.seasonal !== "no_seasonal" ? (
            <View style={[s.seasonalBadge, { backgroundColor: `${seasonalCosmetic.colors[0]}20` }]}>
              <CosmeticArtwork kind="seasonal" itemId={profile.equippedCosmetics.seasonal} size={28} />
              <Text style={[s.seasonalText, { color: theme.textSecondary }]}>{profile.equippedCosmetics.seasonal.replace(/_/g, " ")}</Text>
            </View>
          ) : null}

        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="فتح متجر المظاهر"
          style={[s.storeCard, { backgroundColor: theme.card, borderColor: `${gameDesign.colors.coins}70` }]}
          onPress={() => router.push("/store" as Href)}
          activeOpacity={0.82}
        >
          <View style={[s.storeIcon, { backgroundColor: `${gameDesign.colors.coins}20` }]}>
            <Ionicons name="color-palette-outline" size={22} color={gameDesign.colors.coinsText} />
          </View>
          <View style={s.storeCopy}>
            <Text style={[s.storeTitle, { color: theme.textPrimary }]}>متجر المظاهر</Text>
            <Text style={[s.storeDescription, { color: theme.textSecondary }]}>أفاتارات أصلية وإطارات بتأثيرات جميلة</Text>
          </View>
          <CoinBalance amount={profile.coins} />
          <Ionicons name="chevron-back" size={18} color={theme.textMuted} />
        </TouchableOpacity>

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

      </ScrollView>

      {/* Edit Name Modal */}
      <GameModal
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
      >
        <Text style={s.modalTitle}>تغيير الاسم</Text>
        <TextInput
          style={[s.nameInput, { color: theme.inputText, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          value={nameInput}
          onChangeText={setNameInput}
          maxLength={20}
          textAlign="right"
          autoFocus
          selectTextOnFocus
          placeholderTextColor={theme.inputPlaceholder}
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
      </GameModal>
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
    fontFamily: "Cairo_700Bold", fontSize: 20, color: "#F6F7FF",
  },
  headerTrailing: { minWidth: 48, alignItems: "flex-end" },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },

  avatarSection: { alignItems: "center", paddingVertical: 12, gap: 10, borderRadius: 24, overflow: "hidden" },
  profileBackgroundArtwork: { position: "absolute", top: 0, width: 190, height: 136, opacity: 0.3 },
  seasonalBadge: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  seasonalText: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
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
  nameRow: {
    width: 240, minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 32, paddingVertical: 8, borderRadius: 16, overflow: "hidden",
  },
  playerName: { maxWidth: 160, fontFamily: "Cairo_700Bold", fontSize: 20, color: "#F6F7FF" },
  storeCard: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 18, borderWidth: 1.5 },
  storeIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  storeCopy: { flex: 1, gap: 2 },
  storeTitle: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  storeDescription: { fontFamily: "Cairo_400Regular", fontSize: 10 },

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


  modalTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 20, color: LOGO.cyan, textAlign: "center",
  },
  nameInput: {
    borderWidth: 2.5, borderColor: LOGO.cyan + "60", borderRadius: 16,
    borderBottomWidth: 4, borderBottomColor: LOGO.cyan + "99",
    padding: 14, fontFamily: "Cairo_400Regular", fontSize: 16,
    color: "#F6F7FF", backgroundColor: "rgba(255,255,255,0.06)",
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
    borderBottomWidth: 4, borderBottomColor: "#D59A3F",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#000" },
});
