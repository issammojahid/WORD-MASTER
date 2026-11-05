import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameIcon, GameIllustration, type GameIconName } from "@/components/GameIcon";
import { GameModeCarousel } from "@/components/GameModeCarousel";
import { HomeBannerAd } from "@/components/HomeBannerAd";
import { CoinBalance, GameScreenBackground, PlayerAvatar, useReducedMotion } from "@/components/GameUi";
import { gameDesign } from "@/constants/game-design";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useStartupReady } from "@/contexts/StartupContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchWithTimeout } from "@/lib/network";
import { getApiUrl } from "@/lib/query-client";
import { markStartup, markStartupDuration, startupNow } from "@/lib/startup-performance";

const GOLD = gameDesign.colors.coins;
const HOME_BACKGROUND = gameDesign.colors.background;
const HOME_SHORTCUTS: {
  route: "/tasks" | "/achievements" | "/daily-challenge" | "/clans" | "/friends" | "/store";
  section?: "inbox";
  primary?: boolean;
  icon: GameIconName;
  titleKey?: "missions" | "achievements" | "dailyChallenge" | "clans";
  title?: string;
  accent: string;
}[] = [
  { route: "/tasks", icon: "missions", titleKey: "missions", accent: gameDesign.colors.missions, primary: true },
  { route: "/achievements", icon: "achievements", titleKey: "achievements", accent: gameDesign.colors.coins, primary: true },
  { route: "/daily-challenge", icon: "dailyChallenge", titleKey: "dailyChallenge", accent: gameDesign.colors.offline, primary: true },
  { route: "/clans", icon: "clans", titleKey: "clans", accent: gameDesign.colors.chat },
  { route: "/friends", icon: "friends", title: "الأصدقاء|Friends", accent: gameDesign.colors.friends },
  { route: "/friends", section: "inbox", icon: "invitations", title: "دعوات اللعب|Game invites", accent: gameDesign.colors.invitations },
];

function DailyRewardModal({ reward, onClaim }: { reward: number; onClaim: () => void }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    const animation = Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, scale]);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClaim}>
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <Animated.View
          style={[
            styles.rewardCard,
            { backgroundColor: theme.card, borderColor: `${GOLD}80`, transform: [{ scale }] },
          ]}
        >
          <View style={styles.rewardIcon}>
            <GameIllustration name="reward" size={90} />
          </View>
          <Text style={[styles.rewardTitle, { color: theme.textPrimary }]}>{t.dailyLoginReward}</Text>
          <Text style={styles.rewardAmount}>+{reward} {t.coins}</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.rewardButton, pressed && styles.pressed]}
            onPress={onClaim}
          >
            <Text style={styles.rewardButtonText}>{t.ok}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, isRTL } = useLanguage();
  const { profile, isReady, playerId, hasLocalProfileError, addCoins, updateProfile } = usePlayer();
  const startupReady = useStartupReady();
  const { theme } = useTheme();
  const [loginReward, setLoginReward] = useState<number | null>(null);
  const rewardCheckStarted = useRef(false);
  const updateProfileRef = useRef(updateProfile);
  const addCoinsRef = useRef(addCoins);
  updateProfileRef.current = updateProfile;
  addCoinsRef.current = addCoins;
  const isWide = width >= 720;

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 24 : insets.bottom;

  useEffect(() => {
    markStartup("home-rendered");
  }, []);

  useEffect(() => {
    if (!startupReady || !isReady || !playerId || rewardCheckStarted.current) return;
    rewardCheckStarted.current = true;
    const requestStartedAt = startupNow();
    let active = true;

    void (async () => {
      try {
        const url = new URL(`/api/player/${playerId}/daily-login`, getApiUrl());
        const response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          markStartupDuration("daily-login-unavailable", requestStartedAt);
          return;
        }

        const data: unknown = await response.json();
        if (!data || typeof data !== "object") {
          markStartupDuration("daily-login-invalid-response", requestStartedAt);
          return;
        }

        const result = data as { success?: unknown; reward?: unknown; coins?: unknown };
        if (
          result.success !== true
          || typeof result.reward !== "number"
          || !Number.isFinite(result.reward)
        ) {
          markStartupDuration("daily-login-not-eligible", requestStartedAt);
          return;
        }

        if (typeof result.coins === "number" && Number.isFinite(result.coins)) {
          updateProfileRef.current({ coins: result.coins });
        } else {
          addCoinsRef.current(result.reward);
        }
        if (active) setLoginReward(result.reward);
        markStartupDuration("daily-login-claimed", requestStartedAt);
      } catch {
        if (__DEV__) console.warn("[startup] daily login check unavailable");
        markStartupDuration("daily-login-unavailable", requestStartedAt);
      }
    })();

    return () => {
      active = false;
    };
  }, [isReady, playerId, startupReady]);

  const navigate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/offline");
  };

  const navigateOnline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/online");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: HOME_BACKGROUND, paddingTop: topInset, paddingBottom: bottomInset },
      ]}
    >
      <GameScreenBackground accent="offline" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, isWide && styles.wideContent]}>
          {hasLocalProfileError && (
            <View style={[styles.startupWarning, { flexDirection: isRTL ? "row-reverse" : "row", borderColor: `${gameDesign.colors.danger}70` }]}>
              <Ionicons name="alert-circle-outline" size={22} color={gameDesign.colors.dangerOnDark} />
              <Text style={[styles.startupWarningText, { color: theme.textPrimary, textAlign: isRTL ? "right" : "left" }]}>
                {isRTL
                  ? "تعذر تحميل بيانات اللاعب المحفوظة. تقدر تكمل اللعب، لكن حاول تعاود فتح التطبيق."
                  : "Saved player data could not be loaded. You can keep playing; please restart the app to retry."}
              </Text>
            </View>
          )}
          <View style={[styles.topBar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.name}, ${t.level} ${profile.level}`}
              onPress={() => router.push("/profile")}
              style={({ pressed }) => [
                styles.profileButton,
                { opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <PlayerAvatar size={32} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame} accessibilityLabel={profile.name} />
              <View style={styles.profileCopy}>
                <Text style={[styles.profileName, { color: theme.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
                <Text style={[styles.profileLevel, { color: theme.textSecondary }]} numberOfLines={1}>{t.level} {profile.level}</Text>
              </View>
            </Pressable>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isRTL ? "الإشعارات" : "Notifications"}
                onPress={() => router.push({ pathname: "/friends", params: { section: "notifications" } })}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  { borderColor: `${gameDesign.colors.friends}88`, opacity: pressed ? 0.78 : 1 },
                ]}
              >
                <Ionicons name="notifications-outline" size={21} color={gameDesign.colors.friends} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.settings}
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  { borderColor: theme.cardBorder, opacity: pressed ? 0.78 : 1 },
                ]}
              >
                <Ionicons name="settings-outline" size={21} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.brandRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Image
                source={require("@/assets/images/logo.png")}
                accessibilityLabel={t.appName}
                resizeMode="cover"
                style={styles.logo}
              />
              <View style={[styles.brandCopy, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                <Text style={styles.brandTitle}>{t.appName}</Text>
                <Text style={styles.brandSubtitle}>{t.homeSubtitle}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.coins}: ${profile.coins}`}
              accessibilityHint={t.dailyLoginReward}
              style={({ pressed }) => [
                styles.coinsPill,
                { backgroundColor: theme.card, borderColor: `${gameDesign.colors.coins}88`, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => router.push("/spin")}
            >
              <CoinBalance amount={profile.coins} label={t.coins} />
            </Pressable>
          </View>

          <View style={{ marginTop: 8 }}>
            <GameModeCarousel
              isRTL={isRTL}
              offlineTitle={t.offlineMode}
              offlineDescription={t.playOfflineHint}
              offlineButtonLabel={t.playOffline}
              onlineTitle={t.onlineMode}
              onlineDescription={t.onlineModeHint}
              onlineButtonLabel={t.playOnline}
              selectorLabel={t.chooseGameMode}
              swipeHint={t.swipeToChooseMode}
              onOfflinePress={navigate}
              onOnlinePress={navigateOnline}
            />
          </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.privateRooms}
              accessibilityHint={isRTL
                ? "تتطلب اتصالاً بالإنترنت ولا تمنح مكافآت عملات"
                : "Requires internet; private rooms do not award coins"}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/private-room");
              }}
              style={({ pressed }) => [
                styles.privateRoomsCard,
                {
                  borderColor: `${gameDesign.colors.friends}90`,
                  flexDirection: isRTL ? "row-reverse" : "row",
                  opacity: pressed ? 0.84 : 1,
                },
              ]}
            >
              <View style={[styles.privateRoomsIcon, { backgroundColor: `${gameDesign.colors.friends}24` }]}>
                <Ionicons name="people-outline" size={28} color={gameDesign.colors.friends} />
              </View>
              <View style={styles.privateRoomsCopy}>
                <Text style={[styles.privateRoomsTitle, { textAlign: isRTL ? "right" : "left" }]}>{t.privateRooms}</Text>
                <Text style={[styles.privateRoomsDescription, { textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? "العب مع أصدقائك عبر الإنترنت" : "Play online with your friends"}
                </Text>
              </View>
              <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={21} color={gameDesign.colors.friends} />
            </Pressable>

            <View style={[styles.shortcuts, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {HOME_SHORTCUTS.map((shortcut) => {
              const label = shortcut.titleKey
                ? t[shortcut.titleKey]
                : (isRTL ? shortcut.title?.split("|")[0] : shortcut.title?.split("|")[1]) ?? "";
              return (
                <Pressable
                  key={`${shortcut.route}:${shortcut.section ?? "default"}`}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => router.push(shortcut.section
                    ? { pathname: shortcut.route, params: { section: shortcut.section } }
                    : shortcut.route)}
                  style={({ pressed }) => [
                    styles.shortcutCard,
                    shortcut.primary ? styles.primaryShortcutCard : styles.secondaryShortcutCard,
                    { borderColor: `${shortcut.accent}70`, opacity: pressed ? 0.82 : 1 },
                  ]}
                >
                  <View style={[styles.shortcutIcon, shortcut.primary ? styles.primaryShortcutIcon : styles.secondaryShortcutIcon, { backgroundColor: `${shortcut.accent}20` }]}>
                    <GameIcon name={shortcut.icon} size={shortcut.primary ? 28 : 23} color={shortcut.accent} secondaryColor={shortcut.accent} />
                  </View>
                  <Text style={[styles.shortcutLabel, shortcut.primary ? styles.primaryShortcutLabel : styles.secondaryShortcutLabel]} numberOfLines={2}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <HomeBannerAd />
      </ScrollView>

      {loginReward !== null && (
        <DailyRewardModal
          reward={loginReward}
          onClaim={() => {
            setLoginReward(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: "center", paddingHorizontal: 16, paddingBottom: 90 },
  content: { width: "100%", maxWidth: 560, paddingTop: 4 },
  wideContent: { maxWidth: 860 },
  privateRoomsCard: {
    minHeight: 78,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: "rgba(31, 21, 54, 0.96)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  privateRoomsIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  privateRoomsCopy: { flex: 1, gap: 2 },
  privateRoomsTitle: { color: "#FFF8FF", fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 16 },
  privateRoomsDescription: { color: "#E3D8EF", fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 12 },
  topBar: { width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: "rgba(27,20,51,0.92)" },
  brandRow: { width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
  brand: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
  logo: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: `${gameDesign.colors.missions}99` },
  brandCopy: { flex: 1, minWidth: 0, gap: 0 },
  brandTitle: { color: "#FFF8FF", fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 18, lineHeight: 26 },
  brandSubtitle: { color: "#E3D8EF", fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 12, lineHeight: 18 },
  shortcuts: { flexWrap: "wrap", justifyContent: "space-between", gap: 9, marginTop: 10, paddingHorizontal: 2 },
  startupWarning: { alignItems: "center", gap: 8, marginBottom: 10, padding: 12, borderWidth: 1, borderRadius: 14, backgroundColor: "rgba(255, 102, 142, 0.12)" },
  startupWarningText: { flex: 1, fontFamily: gameDesign.typography.fontFamily.semibold, fontSize: 13, lineHeight: 20 },
  shortcutCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderWidth: 1,
    backgroundColor: "rgba(31, 21, 54, 0.92)",
    shadowColor: "#080615",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryShortcutCard: { width: "30.5%", minHeight: 92, borderRadius: 18, borderColor: `${gameDesign.colors.online}70` },
  secondaryShortcutCard: { width: "30.5%", minHeight: 78, borderRadius: 16, marginTop: 1 },
  shortcutIcon: { alignItems: "center", justifyContent: "center" },
  primaryShortcutIcon: { width: 40, height: 40, borderRadius: 14 },
  secondaryShortcutIcon: { width: 34, height: 34, borderRadius: 12 },
  shortcutLabel: { color: "#F7F1FF", fontFamily: gameDesign.typography.fontFamily.semibold, textAlign: "center" },
  primaryShortcutLabel: { fontSize: 12, lineHeight: 18 },
  secondaryShortcutLabel: { fontSize: 11, lineHeight: 16 },
  profileButton: { flex: 1, minWidth: 0, maxWidth: 220, height: 50, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1, borderColor: `${gameDesign.colors.profile}70`, backgroundColor: "rgba(27,20,51,0.92)" },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 13, lineHeight: 18 },
  profileLevel: { fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 11, lineHeight: 16 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8EBFF",
  },
  coinsPill: {
    minWidth: 96,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: `${gameDesign.colors.coins}88`,
  },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  rewardCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 5,
    borderWidth: 2,
    padding: 26,
    gap: 12,
  },
  rewardIcon: {
    width: 96,
    height: 88,
    borderRadius: 4,
    backgroundColor: `${GOLD}18`,
    justifyContent: "center",
    alignItems: "center",
  },
  rewardTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "center" },
  rewardAmount: { fontFamily: "Cairo_700Bold", fontSize: 24, color: "#A66D00", marginBottom: 4 },
  rewardButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#33243B",
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardButtonText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#171717" },
  pressed: { opacity: 0.8 },
});
