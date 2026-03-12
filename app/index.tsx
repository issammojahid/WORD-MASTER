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
const CARD_WIDTH = width * 0.82;
const CARD_MARGIN = 10;

const COIN_ENTRIES = [
  { entry: 0, reward: 0, label: "مجاني" },
  { entry: 50, reward: 100, label: "50" },
  { entry: 100, reward: 200, label: "100" },
  { entry: 500, reward: 1000, label: "500" },
  { entry: 1000, reward: 2500, label: "1000" },
];

const POPUP_PANELS = [
  {
    id: "road",
    icon: "📦",
    title: "طريق الكنز",
    subtitle: "أكمل المراحل واربح جوائز حصرية",
    reward: "🪙 حتى 500 عملة",
    color: "#F59E0B",
    onPress: () => router.push("/shop"),
  },
  {
    id: "daily",
    icon: "🎁",
    title: "مكافأة يومية",
    subtitle: "العب يومياً واحصل على مكافأتك",
    reward: "🎁 مكافأة يومية مجانية",
    color: "#10B981",
    onPress: () => router.push("/spin"),
  },
  {
    id: "challenges",
    icon: "🎯",
    title: "التحديات",
    subtitle: "أتمم تحديات اليوم واكسب المزيد",
    reward: "⭐ نقاط XP مضاعفة",
    color: "#8B5CF6",
    onPress: () => router.push("/tasks"),
  },
];

type GameMode = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string[];
  accent: string;
  onPress: () => void;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, selectedMap } = useLanguage();
  const { profile, playerId, setPlayerName } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [showCoinEntryModal, setShowCoinEntryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(0);
  const [tournamentWins, setTournamentWins] = useState(0);
  const [currentPopupIdx, setCurrentPopupIdx] = useState<number | null>(null);
  const hasShownPopup = useRef(false);
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const popupScale = useRef(new Animated.Value(0.85)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const NAV_BAR_HEIGHT = 60 + bottomInset;

  const mapConfig = MAPS.find((m) => m.id === selectedMap) || MAPS[0];
  const equippedSkin = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];
  const xpProgress = (profile.xp % 100) / 100;

  const showPopupAt = (idx: number) => {
    popupOpacity.setValue(0);
    popupScale.setValue(0.85);
    setCurrentPopupIdx(idx);
  };

  useEffect(() => {
    if (currentPopupIdx === null) return;
    Animated.parallel([
      Animated.timing(popupOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(popupScale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [currentPopupIdx]);

  const dismissPopup = (fromIdx: number, onNavigate?: () => void) => {
    Animated.parallel([
      Animated.timing(popupOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(popupScale, { toValue: 0.88, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setCurrentPopupIdx(null);
      if (onNavigate) {
        onNavigate();
        return;
      }
      const nextIdx = fromIdx + 1;
      if (nextIdx < POPUP_PANELS.length) {
        setTimeout(() => showPopupAt(nextIdx), 500);
      }
    });
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 2400, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => {
      if (!hasShownPopup.current) {
        hasShownPopup.current = true;
        showPopupAt(0);
      }
    }, 500);

    (async () => {
      try {
        const { getApiUrl } = await import("@/lib/query-client");
        const res = await fetch(new URL(`/api/player/${playerId}/tournaments`, getApiUrl()).toString());
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (data.tournaments || []);
          const wins = arr.filter((t: { placement: number | null }) => t.placement === 1).length;
          setTournamentWins(wins);
        }
      } catch {}
    })();

    return () => clearTimeout(timer);
  }, []);

  const handleQuickMatchPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCoinEntryModal(true);
  };

  const handleStartMatch = () => {
    setShowCoinEntryModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (selectedEntry > 0 && profile.coins < selectedEntry) return;
    router.push({ pathname: "/lobby", params: { coinEntry: String(selectedEntry) } });
  };

  const gameModes: GameMode[] = [
    {
      id: "quick",
      title: "مباراة سريعة",
      subtitle: "العب مع لاعبين عشوائيين فوراً",
      emoji: "⚡",
      gradient: [Colors.gold + "30", Colors.gold + "10"],
      accent: Colors.gold,
      onPress: handleQuickMatchPress,
    },
    {
      id: "rapid",
      title: "الوضع السريع",
      subtitle: "أول كلمة صحيحة تربح في 10 ثوان",
      emoji: "🚀",
      gradient: [Colors.ruby + "30", Colors.ruby + "10"],
      accent: Colors.ruby,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/rapid"); },
    },
    {
      id: "friends",
      title: "اللعب مع الأصدقاء",
      subtitle: "أنشئ غرفة وادعُ أصدقاءك",
      emoji: "👥",
      gradient: [Colors.emerald + "30", Colors.emerald + "10"],
      accent: Colors.emerald,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/friends"); },
    },
    {
      id: "tournament",
      title: "البطولات",
      subtitle: "8 لاعبين، 3 جولات إقصائية، جائزة كبرى",
      emoji: "🏆",
      gradient: ["#7C3AED30", "#7C3AED10"],
      accent: "#7C3AED",
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/tournament"); },
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + 8, paddingBottom: NAV_BAR_HEIGHT + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ─────────────────────────────────────── */}
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
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push("/settings")}>
              <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── WIN STREAK ──────────────────────────────────── */}
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

        {/* ── LOGO ────────────────────────────────────────── */}
        <Animated.View style={[styles.logoContainer, { transform: [{ translateY: floatAnim }] }]}>
          <View style={styles.letterCircle}>
            <Text style={styles.logoLetter}>ح</Text>
          </View>
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.appSubtitle}>{t.homeSubtitle}</Text>
        </Animated.View>

        {/* ── GAME MODES CAROUSEL ─────────────────────────── */}
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
            renderItem={({ item, index }) => {
              const isActive = activeModeIdx === index;
              return (
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    {
                      borderColor: item.accent + "50",
                      backgroundColor: isActive ? item.accent + "20" : Colors.card + "90",
                      transform: [{ scale: isActive ? 1 : 0.95 }],
                    },
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.88}
                >
                  <View style={[styles.modeEmojiCircle, { backgroundColor: item.accent + "20" }]}>
                    <Text style={styles.modeEmoji}>{item.emoji}</Text>
                  </View>
                  <Text style={[styles.modeTitle, { color: item.accent }]}>{item.title}</Text>
                  <Text style={styles.modeSubtitle}>{item.subtitle}</Text>
                  <TouchableOpacity
                    style={[styles.modePlayBtn, { backgroundColor: item.accent }]}
                    onPress={item.onPress}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play" size={15} color="#fff" />
                    <Text style={styles.modePlayText}>العب الآن</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
          <View style={styles.dotsRow}>
            {gameModes.map((m, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  activeModeIdx === idx && [styles.dotActive, { backgroundColor: gameModes[idx].accent }],
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── STATS ROW ───────────────────────────────────── */}
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
            <Text style={styles.statLabel}>نقاط</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.bestStreak}</Text>
            <Text style={styles.statLabel}>سلسلة</Text>
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

      {/* ── BOTTOM NAVIGATION BAR ───────────────────────── */}
      <View style={[styles.bottomNav, { paddingBottom: bottomInset, height: NAV_BAR_HEIGHT }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/shop")} activeOpacity={0.7}>
          <MaterialCommunityIcons name="shopping" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>المتجر</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/friends")} activeOpacity={0.7}>
          <Ionicons name="people-outline" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>الأصدقاء</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={() => {}} activeOpacity={0.9}>
          <View style={styles.navHomeBtn}>
            <Ionicons name="home" size={26} color={Colors.black} />
          </View>
          <Text style={[styles.navLabel, { color: Colors.gold }]}>الرئيسية</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/tasks")} activeOpacity={0.7}>
          <Ionicons name="star-outline" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>المهام</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/achievements")} activeOpacity={0.7}>
          <Ionicons name="trophy-outline" size={24} color={Colors.textMuted} />
          <Text style={styles.navLabel}>الإنجازات</Text>
        </TouchableOpacity>
      </View>

      {/* ── SEQUENTIAL POPUP OVERLAY ────────────────────── */}
      {currentPopupIdx !== null && (() => {
        const panel = POPUP_PANELS[currentPopupIdx];
        const idx = currentPopupIdx;
        return (
          <Animated.View
            style={[styles.popupOverlay, { opacity: popupOpacity }]}
          >
            <Animated.View
              style={[
                styles.popupCard,
                { borderColor: panel.color + "40", transform: [{ scale: popupScale }] },
              ]}
            >
              {/* Close X */}
              <TouchableOpacity
                style={styles.popupClose}
                onPress={() => dismissPopup(idx)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>

              {/* Icon */}
              <View style={[styles.popupIconCircle, { backgroundColor: panel.color + "18" }]}>
                <Text style={styles.popupIconEmoji}>{panel.icon}</Text>
              </View>

              {/* Text */}
              <Text style={[styles.popupTitle, { color: panel.color }]}>{panel.title}</Text>
              <Text style={styles.popupSubtitle}>{panel.subtitle}</Text>

              {/* Reward badge */}
              <View style={[styles.popupRewardBadge, { backgroundColor: panel.color + "15", borderColor: panel.color + "30" }]}>
                <Text style={[styles.popupRewardText, { color: panel.color }]}>{panel.reward}</Text>
              </View>

              {/* Buttons */}
              <View style={styles.popupButtons}>
                <TouchableOpacity
                  style={styles.popupSkipBtn}
                  onPress={() => dismissPopup(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.popupSkipText}>تخطي</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.popupActionBtn, { backgroundColor: panel.color }]}
                  onPress={() => dismissPopup(idx, panel.onPress)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.popupActionText}>العب الآن</Text>
                </TouchableOpacity>
              </View>

              {/* Step dots */}
              <View style={styles.popupDots}>
                {POPUP_PANELS.map((_, di) => (
                  <View
                    key={di}
                    style={[
                      styles.popupDot,
                      di === idx && [styles.popupDotActive, { backgroundColor: panel.color }],
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        );
      })()}

      {/* ── NAME MODAL ──────────────────────────────────── */}
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

      {/* ── COIN ENTRY MODAL ────────────────────────────── */}
      <Modal
        visible={showCoinEntryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCoinEntryModal(false)}
      >
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
    backgroundColor: Colors.ruby + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  streakRewardHintText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.ruby },

  logoContainer: { alignItems: "center", marginBottom: 22 },
  letterCircle: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  logoLetter: { fontFamily: "Cairo_700Bold", fontSize: 42, color: Colors.black, lineHeight: 54 },
  appName: { fontFamily: "Cairo_700Bold", fontSize: 24, color: Colors.textPrimary, textAlign: "center" },
  appSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 12, color: Colors.textSecondary, textAlign: "center", marginTop: 2 },

  carouselSection: { width: "100%", marginBottom: 20 },
  carouselTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.textSecondary,
    marginBottom: 12, textAlign: "right",
  },
  carouselContent: { paddingHorizontal: 0 },
  modeCard: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 10,
    minHeight: 230,
    justifyContent: "center",
  },
  modeEmojiCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  modeEmoji: { fontSize: 40 },
  modeTitle: { fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "center" },
  modeSubtitle: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  modePlayBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 4,
  },
  modePlayText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.cardBorder },
  dotActive: { width: 22, borderRadius: 4 },

  statsRow: {
    flexDirection: "row", backgroundColor: Colors.card + "70", borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16, width: "100%",
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },
  statLabel: { fontFamily: "Cairo_400Regular", fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.cardBorder, marginVertical: 4 },

  bottomNav: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around",
    backgroundColor: Colors.card,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
    paddingTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 20,
  },
  navItem: { alignItems: "center", gap: 3, flex: 1 },
  navItemCenter: { alignItems: "center", gap: 3, flex: 1, marginTop: -16 },
  navHomeBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.gold,
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 12,
  },
  navLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: Colors.textMuted },

  popupOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center",
    padding: 28,
  },
  popupCard: {
    width: "100%", backgroundColor: Colors.card, borderRadius: 28,
    padding: 28, alignItems: "center", borderWidth: 1.5,
  },
  popupClose: {
    position: "absolute", top: 14, right: 14, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.cardBorder,
    justifyContent: "center", alignItems: "center",
  },
  popupIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16, marginTop: 8,
  },
  popupIconEmoji: { fontSize: 48 },
  popupTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 24, textAlign: "center", marginBottom: 8,
  },
  popupSubtitle: {
    fontFamily: "Cairo_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", marginBottom: 16, lineHeight: 22,
  },
  popupRewardBadge: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, marginBottom: 24,
  },
  popupRewardText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
  popupButtons: { flexDirection: "row", gap: 12, width: "100%", marginBottom: 20 },
  popupSkipBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    backgroundColor: Colors.cardBorder, alignItems: "center",
  },
  popupSkipText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  popupActionBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  popupActionText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },
  popupDots: { flexDirection: "row", gap: 7 },
  popupDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cardBorder },
  popupDotActive: { width: 24, borderRadius: 4 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: Colors.card, borderRadius: 20, padding: 24,
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary,
    textAlign: "center", marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12,
    padding: 12, fontFamily: "Cairo_400Regular", fontSize: 16,
    color: Colors.textPrimary, marginBottom: 16,
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.cardBorder, alignItems: "center",
  },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.gold, alignItems: "center",
  },
  modalConfirmText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: Colors.black },

  coinEntryBalance: {
    fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", marginBottom: 14,
  },
  coinEntryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16, justifyContent: "center" },
  coinEntryOption: {
    width: "44%", padding: 12, borderRadius: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: Colors.cardBorder, backgroundColor: Colors.background,
  },
  coinEntryOptionSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + "15" },
  coinEntryOptionDisabled: { opacity: 0.4 },
  coinEntryLabel: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textPrimary },
  coinEntryLabelSelected: { color: Colors.gold },
  coinEntryReward: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  coinEntryRewardSelected: { color: Colors.gold },
  coinEntryFree: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.emerald, marginTop: 3 },
});
