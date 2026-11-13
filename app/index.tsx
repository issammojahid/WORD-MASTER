import {ScaledText as Text} from "@/components/ScaledText";
import React, { useEffect, useRef, useState } from "react";
import {Animated, Modal, Platform, Pressable, StyleSheet, View} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameIllustration } from "@/components/GameIcon";
import { useHalloweenLaunchPopupOpen } from "@/components/HalloweenLaunchPopup";
import { useReducedMotion } from "@/components/GameUi";
import { FantasyHome } from "@/components/FantasyHome";
import { gameDesign } from "@/constants/game-design";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useStartupReady } from "@/contexts/StartupContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SeasonEventLaunchPopup } from "@/components/SeasonEventLaunchPopup";
import { SEASON_EVENTS, eventPhase } from "@/lib/season-calendar";
import { useSeasonNow } from "@/lib/use-season-now";
import { fetchWithTimeout } from "@/lib/network";
import { getApiUrl } from "@/lib/query-client";
import { markStartup, markStartupDuration, startupNow } from "@/lib/startup-performance";

const UI_PREVIEW_MODE = process.env.EXPO_PUBLIC_UI_PREVIEW_MODE === "1";

const GOLD = gameDesign.colors.coins;
const HOME_BACKGROUND = gameDesign.colors.background;
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
  const { isReady, playerId, hasLocalProfileError, addCoins, updateProfile } = usePlayer();
  const startupReady = useStartupReady();
  const halloweenAnnouncementOpen = useHalloweenLaunchPopupOpen();
  const [loginReward, setLoginReward] = useState<number | null>(null);
  const [dailyRewardSettled, setDailyRewardSettled] = useState(false);
  const [seasonPopupEvent, setSeasonPopupEvent] = useState<(typeof SEASON_EVENTS)[number] | null>(null);
  const [seasonPreviewEvents, setSeasonPreviewEvents] = useState<Array<(typeof SEASON_EVENTS)[number]> | null>(null);
  const [seasonPreviewIndex, setSeasonPreviewIndex] = useState<number | null>(null);
  const seasonNow = useSeasonNow();
  const currentEvent = SEASON_EVENTS.find((event) => eventPhase(event, seasonNow) === "active") ?? null;
  const upcomingEvents = SEASON_EVENTS.filter((event) => eventPhase(event, seasonNow) === "upcoming");
  const previewingSeasonEvent = seasonPreviewEvents !== null && seasonPreviewIndex !== null;
  const displayedSeasonEvent = previewingSeasonEvent
    ? seasonPreviewEvents?.[seasonPreviewIndex] ?? null
    : seasonPopupEvent;
  const rewardCheckStarted = useRef(false);
  const updateProfileRef = useRef(updateProfile);
  const addCoinsRef = useRef(addCoins);
  updateProfileRef.current = updateProfile;
  addCoinsRef.current = addCoins;

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  // The bottom dock owns the device safe-area inset.

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
      } finally {
        if (active) setDailyRewardSettled(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [isReady, playerId, startupReady]);

  useEffect(() => {
    if (
      !startupReady || !isReady || !playerId || !dailyRewardSettled || loginReward !== null
      || halloweenAnnouncementOpen || !currentEvent || seasonPopupEvent || previewingSeasonEvent
    ) return;
    let cancelled = false;
    const event = currentEvent;
    void AsyncStorage.getItem(`season_event_popup_seen_v1:${event.id}`).then((seen) => {
      if (!cancelled && !seen) setSeasonPopupEvent(event);
    }).catch(() => {
      if (!cancelled) setSeasonPopupEvent(event);
    });
    return () => { cancelled = true; };
  }, [currentEvent, dailyRewardSettled, halloweenAnnouncementOpen, isReady, loginReward, playerId, previewingSeasonEvent, seasonPopupEvent, startupReady]);

  useEffect(() => {
    if (seasonPopupEvent && eventPhase(seasonPopupEvent, seasonNow) !== "active") {
      setSeasonPopupEvent(null);
    }
  }, [seasonNow, seasonPopupEvent]);

  const closeSeasonPopup = () => {
    if (previewingSeasonEvent) {
      setSeasonPreviewEvents(null);
      setSeasonPreviewIndex(null);
      return;
    }
    if (seasonPopupEvent) {
      void AsyncStorage.setItem(`season_event_popup_seen_v1:${seasonPopupEvent.id}`, "1").catch(() => {});
    }
    setSeasonPopupEvent(null);
  };

  const openSeasonEvent = () => {
    const event = displayedSeasonEvent;
    if (previewingSeasonEvent) {
      setSeasonPreviewEvents(null);
      setSeasonPreviewIndex(null);
    }
    else closeSeasonPopup();
    if (event) router.push({ pathname: "/season", params: { event: event.id, ...(previewingSeasonEvent && (__DEV__ || UI_PREVIEW_MODE) ? { preview: "1" } : {}) } });
  };

  const previewUpcomingEvents = () => {
    if ((__DEV__ || UI_PREVIEW_MODE) && upcomingEvents.length > 0) {
      setSeasonPreviewEvents(upcomingEvents);
      setSeasonPreviewIndex(0);
    }
  };

  const moveSeasonPreview = (direction: -1 | 1) => {
    setSeasonPreviewIndex((current) => {
      const count = seasonPreviewEvents?.length ?? 0;
      if (current === null || count === 0) return current;
      return (current + direction + count) % count;
    });
  };

  const navigate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/offline");
  };

  const navigateOnline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/online");
  };

  return (
    <View style={[styles.container, { backgroundColor: HOME_BACKGROUND, paddingTop: topInset, paddingBottom: 0 }]}>
      <FantasyHome onOfflinePress={navigate} onOnlinePress={navigateOnline} hasLocalProfileError={hasLocalProfileError} onPreviewSeasonEvents={( __DEV__ || UI_PREVIEW_MODE) && upcomingEvents.length > 0 ? previewUpcomingEvents : undefined} />
      {loginReward !== null && !halloweenAnnouncementOpen && (
        <DailyRewardModal reward={loginReward} onClaim={() => setLoginReward(null)} />
      )}
      <SeasonEventLaunchPopup
        event={displayedSeasonEvent}
        onDismiss={closeSeasonPopup}
        onOpen={openSeasonEvent}
        preview={previewingSeasonEvent && displayedSeasonEvent && seasonPreviewIndex !== null ? {
          position: seasonPreviewIndex + 1,
          total: seasonPreviewEvents.length,
          onPrevious: () => moveSeasonPreview(-1),
          onNext: () => moveSeasonPreview(1),
        } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  pressed: { opacity: 0.8 }
});
