import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";
import { MAPS } from "@/constants/i18n";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 64;
const CARD_MARGIN = 12;

const COIN_ENTRIES = [
  { entry: 0, reward: 0, label: "مجاني" },
  { entry: 50, reward: 100, label: "50" },
  { entry: 100, reward: 200, label: "100" },
  { entry: 500, reward: 1000, label: "500" },
  { entry: 1000, reward: 2500, label: "1000" },
];

type GameMode = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  bg: string;
  onPress: () => void;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, selectedMap } = useLanguage();
  const { profile, setPlayerName } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [showCoinEntryModal, setShowCoinEntryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(0);
  const [tournamentWins, setTournamentWins] = useState(0);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const mapConfig = MAPS.find((m) => m.id === selectedMap) || MAPS[0];
  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];
  const xpProgress = (profile.xp % 100) / 100;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
    (async () => {
      try {
        const { getApiUrl } = await import("@/lib/query-client");
        const res = await fetch(new URL(`/api/player/${profile.id}/tournaments`, getApiUrl()).toString());
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (data.tournaments || []);
          const wins = arr.filter((t: { placement: number | null }) => t.placement === 1).length;
          setTournamentWins(wins);
        }
      } catch {}
    })();
  }, []);

  const handleQuickMatchPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCoinEntryModal(true);
  };

  const handleStartMatch = () => {
    setShowCoinEntryModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (selectedEntry > 0 && profile.coins < selectedEntry) {
      return;
    }
    router.push({ pathname: "/lobby", params: { coinEntry: String(selectedEntry) } });
  };

  const gameModes: GameMode[] = [
    {
      id: "quick",
      title: "مباراة سريعة",
      subtitle: "العب مع لاعبين عشوائيين فوراً",
      icon: "flash",
      iconColor: Colors.gold,
      bg: Colors.gold + "18",
      onPress: handleQuickMatchPress,
    },
    {
      id: "rapid",
      title: "الوضع السريع",
      subtitle: "أول كلمة صحيحة تربح! 5 جولات بـ10 ثوان",
      icon: "timer",
      iconColor: Colors.ruby,
      bg: Colors.ruby + "18",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/rapid"); },
    },
    {
      id: "tournament",
      title: "البطولة",
      subtitle: "8 لاعبين، 3 جولات إقصائية، جائزة كبرى!",
      icon: "trophy",
      iconColor: Colors.gold,
      bg: Colors.gold + "18",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/tournament"); },
    },
    {
      id: "friends",
      title: "غرفة أصدقاء",
      subtitle: "أنشئ غرفة وادعو أصدقاءك",
      icon: "people",
      iconColor: Colors.emerald,
      bg: Colors.emerald + "18",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/lobby"); },
    },
    {
      id: "offline",
      title: "وضع محلي",
      subtitle: "العب بدون إنترنت ضد الذكاء الاصطناعي",
      icon: "person",
      iconColor: Colors.sapphire,
      bg: Colors.sapphire + "18",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/offline"); },
    },
  ];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / (CARD_WIDTH + CARD_MARGIN * 2));
    setActiveModeIdx(Math.max(0, Math.min(idx, gameModes.length - 1)));
  };

  const streakIcon = profile.winStreak >= 10 ? "🔥🔥🔥" : profile.winStreak >= 5 ? "🔥🔥" : profile.winStreak >= 3 ? "🔥" : "";

  return (
    <View style={[styles.container, { backgroundColor: mapConfig.color }]}>
      <View style={styles.hexDecorTopRight} />
      <View style={styles.hexDecorBottomLeft} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => { setShowNameModal(true); setNameInput(profile.name); }}
            activeOpacity={0.8}
          >
            <View style={[styles.avatarCircle, { backgroundColor: equippedSkin.color + "33" }]}>
              <Text style={styles.avatarEmoji}>{equippedSkin.emoji}</Text>
            </View>
            <View style={styles.profileMeta}>
              <View style={styles.nameEditRow}>
                <Text style={styles.playerName} numberOfLines={1}>{profile.name}</Text>
                <Ionicons name="pencil" size={11} color={Colors.textMuted} style={{ marginLeft: 4 }} />
              </View>
              <View style={styles.levelRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv.{profile.level}</Text>
                </View>
                <View style={styles.xpBarContainer}>
                  <View style={[styles.xpBar, { width: `${xpProgress * 100}%` as any }]} />
                </View>
                <Text style={styles.xpText}>{profile.xp % 100}/100</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.topRight}>
            <TouchableOpacity
              style={styles.coinsBadge}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/shop"); }}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={14} color={Colors.gold} />
              <Text style={styles.coinsText}>{profile.coins}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => router.push("/settings")}
            >
              <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* WIN STREAK BAR */}
        {profile.winStreak >= 2 && (
          <View style={styles.streakBar}>
            <Ionicons name="flame" size={18} color={Colors.ruby} />
            <Text style={styles.streakText}>{streakIcon} سلسلة {profile.winStreak} انتصارات</Text>
            {profile.winStreak >= 3 && (
              <View style={styles.streakRewardHint}>
                <Text style={styles.streakRewardHintText}>
                  {profile.winStreak < 5 ? "3 ← +50🪙" : profile.winStreak < 10 ? "5 ← +100🪙" : "10 ← +300🪙"} ✓
                </Text>
              </View>
            )}
          </View>
        )}

        {/* LOGO */}
        <Animated.View style={[styles.logoContainer, { transform: [{ translateY: floatAnim }] }]}>
          <View style={styles.letterCircle}>
            <Text style={styles.logoLetter}>ح</Text>
          </View>
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.appSubtitle}>{t.homeSubtitle}</Text>
        </Animated.View>

        {/* GAME MODES CAROUSEL */}
        <View style={styles.carouselSection}>
          <Text style={styles.carouselTitle}>اختر وضع اللعب</Text>
          <FlatList
            ref={carouselRef}
            data={gameModes}
            horizontal
            pagingEnabled={false}
            snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modeCard, { backgroundColor: item.bg, borderColor: item.iconColor + "40" }]}
                onPress={item.onPress}
                activeOpacity={0.85}
              >
                <View style={[styles.modeIconCircle, { backgroundColor: item.iconColor + "22" }]}>
                  <Ionicons name={item.icon as any} size={36} color={item.iconColor} />
                </View>
                <Text style={[styles.modeTitle, { color: item.iconColor }]}>{item.title}</Text>
                <Text style={styles.modeSubtitle}>{item.subtitle}</Text>
                <View style={[styles.modePlayBtn, { backgroundColor: item.iconColor }]}>
                  <Ionicons name="play" size={14} color={Colors.black} />
                  <Text style={styles.modePlayText}>العب الآن</Text>
                </View>
              </TouchableOpacity>
            )}
          />
          <View style={styles.dotsRow}>
            {gameModes.map((_, idx) => (
              <View
                key={idx}
                style={[styles.dot, activeModeIdx === idx && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* QUICK ACCESS BUTTONS */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push("/leaderboard")}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy" size={22} color={Colors.gold} />
            <Text style={styles.quickBtnText}>{t.leaderboard}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, styles.spinBtn]}
            onPress={() => router.push("/spin")}
            activeOpacity={0.85}
          >
            <Ionicons name="gift" size={22} color={Colors.ruby} />
            <Text style={styles.quickBtnText}>العجلة</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push("/shop")}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="shopping" size={22} color={Colors.emerald} />
            <Text style={styles.quickBtnText}>{t.shop}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push("/settings")}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            <Text style={styles.quickBtnText}>{t.settings}</Text>
          </TouchableOpacity>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.gamesPlayed}</Text>
            <Text style={styles.statLabel}>مباريات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.wins}</Text>
            <Text style={styles.statLabel}>انتصارات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalScore}</Text>
            <Text style={styles.statLabel}>نقاط كلية</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.bestStreak}</Text>
            <Text style={styles.statLabel}>أفضل سلسلة</Text>
          </View>
          {tournamentWins > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.gold }]}>🏆 {tournamentWins}</Text>
                <Text style={styles.statLabel}>بطولات</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* NAME MODAL */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>اسم اللاعب</Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={20}
              textAlign="right"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNameModal(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  if (nameInput.trim()) setPlayerName(nameInput.trim());
                  setShowNameModal(false);
                }}
              >
                <Text style={styles.modalConfirmText}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* COIN ENTRY MODAL */}
      <Modal visible={showCoinEntryModal} transparent animationType="fade" onRequestClose={() => setShowCoinEntryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>اختر رسم الدخول</Text>
            <Text style={styles.coinEntryBalance}>رصيدك: {profile.coins} 🪙</Text>
            <View style={styles.coinEntryGrid}>
              {COIN_ENTRIES.map((opt) => {
                const selected = selectedEntry === opt.entry;
                const canAfford = profile.coins >= opt.entry;
                return (
                  <TouchableOpacity
                    key={opt.entry}
                    style={[
                      styles.coinEntryOption,
                      selected && styles.coinEntryOptionSelected,
                      !canAfford && opt.entry > 0 && styles.coinEntryOptionDisabled,
                    ]}
                    onPress={() => { if (canAfford || opt.entry === 0) setSelectedEntry(opt.entry); }}
                    disabled={!canAfford && opt.entry > 0}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.coinEntryLabel, selected && styles.coinEntryLabelSelected]}>
                      {opt.entry === 0 ? "🆓" : `🪙 ${opt.label}`}
                    </Text>
                    {opt.reward > 0 && (
                      <Text style={[styles.coinEntryReward, selected && styles.coinEntryRewardSelected]}>
                        الجائزة: {opt.reward}
                      </Text>
                    )}
                    {opt.entry === 0 && (
                      <Text style={styles.coinEntryFree}>بدون رسوم</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCoinEntryModal(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, selectedEntry > profile.coins && { opacity: 0.5 }]}
                onPress={handleStartMatch}
                disabled={selectedEntry > profile.coins}
              >
                <Text style={styles.modalConfirmText}>
                  {selectedEntry > 0 ? `ادفع ${selectedEntry} والعب` : "ابدأ"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, alignItems: "center" },
  hexDecorTopRight: {
    position: "absolute", top: -60, right: -60, width: 180, height: 180,
    borderRadius: 30, borderWidth: 2, borderColor: Colors.gold + "20",
    transform: [{ rotate: "30deg" }],
  },
  hexDecorBottomLeft: {
    position: "absolute", bottom: -80, left: -80, width: 220, height: 220,
    borderRadius: 40, borderWidth: 2, borderColor: Colors.emerald + "15",
    transform: [{ rotate: "15deg" }],
  },

  topBar: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12, gap: 10,
  },
  profileRow: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card + "80", borderRadius: 16,
    padding: 10, gap: 10,
  },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center",
  },
  avatarEmoji: { fontSize: 24 },
  profileMeta: { flex: 1 },
  nameEditRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  playerName: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textPrimary, flex: 1 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadge: {
    backgroundColor: Colors.gold + "25", paddingHorizontal: 7,
    paddingVertical: 1, borderRadius: 7,
  },
  levelText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.gold },
  xpBarContainer: { flex: 1, height: 4, backgroundColor: Colors.cardBorder, borderRadius: 2, overflow: "hidden" },
  xpBar: { height: "100%", backgroundColor: Colors.emerald, borderRadius: 2 },
  xpText: { fontFamily: "Cairo_400Regular", fontSize: 9, color: Colors.textMuted },

  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  coinsBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card + "90", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, gap: 5,
    borderWidth: 1, borderColor: Colors.gold + "30",
  },
  coinsText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.gold },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.card + "80", justifyContent: "center", alignItems: "center",
  },

  streakBar: {
    width: "100%", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.ruby + "18", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.ruby + "30",
  },
  streakText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: Colors.ruby, flex: 1 },
  streakRewardHint: {
    backgroundColor: Colors.ruby + "22", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  streakRewardHintText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.ruby },

  logoContainer: { alignItems: "center", marginBottom: 28 },
  letterCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center", marginBottom: 12,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  logoLetter: { fontFamily: "Cairo_700Bold", fontSize: 44, color: Colors.black, lineHeight: 56 },
  appName: { fontFamily: "Cairo_700Bold", fontSize: 26, color: Colors.textPrimary, textAlign: "center" },
  appSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", marginTop: 3 },

  carouselSection: { width: "100%", marginBottom: 20 },
  carouselTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textSecondary, marginBottom: 12, textAlign: "right" },
  carouselContent: { paddingHorizontal: 0, gap: 0 },
  modeCard: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  modeIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  modeTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "center" },
  modeSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  modePlayBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 6,
  },
  modePlayText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.black },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.cardBorder },
  dotActive: { width: 20, backgroundColor: Colors.gold },

  quickRow: { flexDirection: "row", width: "100%", gap: 10, marginBottom: 16 },
  quickBtn: {
    flex: 1, backgroundColor: Colors.card + "90", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
    gap: 6, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  spinBtn: { borderColor: Colors.ruby + "30" },
  quickBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: Colors.textSecondary },

  statsRow: {
    flexDirection: "row", backgroundColor: Colors.card + "70", borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 20, width: "100%",
    justifyContent: "space-around", borderWidth: 1, borderColor: Colors.cardBorder + "40",
  },
  statItem: { alignItems: "center", gap: 2 },
  statValue: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary },
  statLabel: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: Colors.cardBorder },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: 20, padding: 24,
    width: "100%", borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary, textAlign: "center", marginBottom: 16 },
  nameInput: {
    backgroundColor: Colors.inputBg, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.inputBorder, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, fontFamily: "Cairo_400Regular", color: Colors.inputText, marginBottom: 16,
  },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.card, alignItems: "center" },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.gold, alignItems: "center" },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.black },

  coinEntryBalance: {
    fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.gold,
    textAlign: "center", marginBottom: 16,
  },
  coinEntryGrid: { gap: 10, marginBottom: 20 },
  coinEntryOption: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.cardBorder, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  coinEntryOptionSelected: {
    borderColor: Colors.gold, backgroundColor: Colors.gold + "15",
  },
  coinEntryOptionDisabled: { opacity: 0.4 },
  coinEntryLabel: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  coinEntryLabelSelected: { color: Colors.gold },
  coinEntryReward: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: Colors.textMuted },
  coinEntryRewardSelected: { color: Colors.gold },
  coinEntryFree: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.emerald },
});
