import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from "@expo-google-fonts/cairo";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Platform, StyleSheet, View, Text, TouchableOpacity, Modal, Dimensions, Easing } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient, getApiUrl } from "@/lib/query-client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import SplashOverlay from "@/components/SplashOverlay";
import { preloadAllSounds } from "@/lib/sound-manager";
import { registerForPushNotifications, getPermissionsStatus } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

type RoomInvite = {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  roomId: string;
  status: string;
};

function InvitePoller() {
  const { playerId } = usePlayer();
  const seenInvites = useRef<Set<string>>(new Set());
  const alertShowing = useRef(false);

  useEffect(() => {
    if (!playerId) return;

    const poll = async () => {
      if (alertShowing.current) return;
      try {
        const url = new URL(`/api/room-invites/${playerId}`, getApiUrl());
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const invites: RoomInvite[] = await res.json();
        const fresh = invites.filter((i) => i.status === "pending" && !seenInvites.current.has(i.id));
        if (fresh.length === 0) return;

        const invite = fresh[0];
        seenInvites.current.add(invite.id);
        alertShowing.current = true;

        Alert.alert(
          "دعوة للغرفة 🎮",
          `دعاك ${invite.fromPlayerName} للانضمام إلى غرفته`,
          [
            {
              text: "رفض",
              style: "cancel",
              onPress: async () => {
                alertShowing.current = false;
                try {
                  const u = new URL(`/api/room-invites/${invite.id}/respond`, getApiUrl());
                  await fetch(u.toString(), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decline" }) });
                } catch {}
              },
            },
            {
              text: "قبول ✅",
              onPress: async () => {
                alertShowing.current = false;
                try {
                  const u = new URL(`/api/room-invites/${invite.id}/respond`, getApiUrl());
                  await fetch(u.toString(), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept" }) });
                } catch {}
                router.push({ pathname: "/lobby", params: { join: invite.roomId } });
              },
            },
          ]
        );
      } catch {}
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [playerId]);

  return null;
}

function GiftPoller() {
  const { playerId } = usePlayer();
  const alertShowing = useRef(false);

  useEffect(() => {
    if (!playerId) return;

    const poll = async () => {
      if (alertShowing.current) return;
      try {
        const url = new URL(`/api/friends/gifts/pending/${playerId}`, getApiUrl());
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const gifts = await res.json();
        if (!Array.isArray(gifts) || gifts.length === 0) return;

        alertShowing.current = true;
        const totalCoins = gifts.reduce((sum: number, g: { amount?: number }) => sum + (g.amount || 0), 0);
        const names = [...new Set(gifts.map((g: { fromPlayerName?: string }) => g.fromPlayerName))].join("، ");

        try {
          const markUrl = new URL(`/api/friends/gifts/seen/${playerId}`, getApiUrl());
          await fetch(markUrl.toString(), { method: "PUT" });
        } catch {}

        Alert.alert(
          "هدية! 🎁",
          `${names} أرسل${gifts.length > 1 ? "وا" : ""} لك ${totalCoins} عملة`,
          [{
            text: "رائع!",
            onPress: () => { alertShowing.current = false; },
          }]
        );
      } catch {}
    };

    const interval = setInterval(poll, 15000);
    poll();
    return () => clearInterval(interval);
  }, [playerId]);

  return null;
}

const NOTIF_PROMPT_KEY = "notif_prompt_shown_v1";

function PushNotificationRegistrar() {
  const { playerId } = usePlayer();
  const [showModal, setShowModal] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!playerId || checkedRef.current) return;
    checkedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        if (Platform.OS === "web") return;
        const status = await getPermissionsStatus();
        if (status === "granted") {
          registerForPushNotifications(playerId).catch(() => {});
          return;
        }
        if (status === null) return;
        const alreadyShown = await AsyncStorage.getItem(NOTIF_PROMPT_KEY);
        if (!alreadyShown) setShowModal(true);
      } catch {}
    }, 4000);

    return () => clearTimeout(timer);
  }, [playerId]);

  const handleAllow = async () => {
    setShowModal(false);
    await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "1");
    if (playerId) registerForPushNotifications(playerId).catch(() => {});
  };

  const handleDecline = async () => {
    setShowModal(false);
    await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "1");
  };

  if (!showModal) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleDecline}>
      <View style={np.overlay}>
        <View style={np.card}>
          <Text style={np.icon}>🔔</Text>
          <Text style={np.title}>تفعيل الإشعارات</Text>
          <Text style={np.body}>
            {"ابق على اطلاع بدعوات الأصدقاء والمهام اليومية ومكافآت التحدي!\n\nيمكنك إيقاف الإشعارات في أي وقت من الإعدادات."}
          </Text>
          <TouchableOpacity style={np.allowBtn} onPress={handleAllow} activeOpacity={0.85}>
            <LinearGradient colors={["#00F5FF", "#0099CC"]} style={np.allowGrad}>
              <Text style={np.allowText}>السماح بالإشعارات</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={np.declineBtn} onPress={handleDecline} activeOpacity={0.7}>
            <Text style={np.declineText}>لاحقاً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const np = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  card: { width: "100%", maxWidth: 360, backgroundColor: "#12122A", borderRadius: 24, padding: 28, alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: "#00F5FF30" },
  icon: { fontSize: 48 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#E8E8FF", textAlign: "center" },
  body: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#9898CC", textAlign: "center", lineHeight: 22 },
  allowBtn: { width: "100%", borderRadius: 16, overflow: "hidden", marginTop: 4 },
  allowGrad: { paddingVertical: 14, alignItems: "center", borderRadius: 16 },
  allowText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#000" },
  declineBtn: { paddingVertical: 8 },
  declineText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#5A5A88" },
});

const LAST_RESET_DATE_KEY = "daily_reset_date_v1";

function DailyResetChecker() {
  const { playerId } = usePlayer();
  const qc = useQueryClient();

  useEffect(() => {
    const check = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const stored = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);
        if (stored !== today) {
          await AsyncStorage.setItem(LAST_RESET_DATE_KEY, today);
          qc.invalidateQueries({ queryKey: ["/api/tasks"] });
          qc.invalidateQueries({ queryKey: ["/api/achievements"] });
        }
      } catch {}
    };
    check();
  }, [playerId]);

  return null;
}

const STREAK_DAY_REWARDS = [15, 20, 30, 25, 35, 50, 100];
const STREAK_EMOJIS = ["🪙", "🪙", "💰", "🪙", "💰", "💎", "🏆"];

function DailyLoginPopup() {
  const { playerId, addCoins } = usePlayer();
  const [visible, setVisible] = useState(false);
  const [streakData, setStreakData] = useState<{ streak: number; reward: number; longestStreak: number } | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const coinAnim = useRef(new Animated.Value(0)).current;
  const calledRef = useRef(false);

  useEffect(() => {
    if (!playerId || calledRef.current) return;
    calledRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const url = new URL(`/api/player/${playerId}/daily-login`, getApiUrl());
        const res = await fetch(url.toString(), { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        setStreakData({ streak: data.streak, reward: data.reward, longestStreak: data.longestStreak });
        addCoins(data.reward);
        setVisible(true);

        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
          Animated.timing(coinAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      } catch {}
    }, 6000);
    return () => clearTimeout(timer);
  }, [playerId]);

  if (!visible || !streakData) return null;

  const currentDayIndex = ((streakData.streak - 1) % 7);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={() => setVisible(false)}>
      <View style={lp.overlay}>
        <Animated.View style={[lp.popup, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={["#0E0E24", "#12122A", "#0A0A1A"]} style={lp.popupGrad}>
            <Text style={lp.title}>{"تسجيل دخول يومي 📅"}</Text>
            <Text style={lp.streakNum}>{"🔥"} {streakData.streak} {"يوم متتالي"}</Text>

            <View style={lp.calendarRow}>
              {STREAK_DAY_REWARDS.map((reward, i) => {
                const isDone = i < currentDayIndex;
                const isToday = i === currentDayIndex;
                return (
                  <View key={i} style={[lp.dayCell, isDone && lp.dayCellDone, isToday && lp.dayCellToday]}>
                    <Text style={lp.dayEmoji}>{isDone ? "✅" : STREAK_EMOJIS[i]}</Text>
                    <Text style={[lp.dayNum, isToday && lp.dayNumToday]}>{"يوم"} {i + 1}</Text>
                    <Text style={[lp.dayReward, isToday && lp.dayRewardToday]}>{reward}</Text>
                  </View>
                );
              })}
            </View>

            <Animated.View style={[lp.rewardBanner, { opacity: coinAnim, transform: [{ translateY: coinAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              <Text style={lp.rewardText}>{"🪙"} +{streakData.reward} {"عملة"}</Text>
            </Animated.View>

            <TouchableOpacity style={lp.claimBtn} onPress={() => setVisible(false)} activeOpacity={0.8}>
              <LinearGradient colors={["#F5C842", "#E6A800"]} style={lp.claimBtnGrad}>
                <Text style={lp.claimBtnText}>{"رائع! 🎉"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width: SCREEN_W } = Dimensions.get("window");
const lp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  popup: { width: "100%", maxWidth: 380, borderRadius: 24, overflow: "hidden", borderWidth: 1.5, borderColor: "#F5C84240" },
  popupGrad: { padding: 24, alignItems: "center", gap: 16 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  streakNum: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#F5C842" },
  calendarRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, width: "100%" },
  dayCell: {
    width: (SCREEN_W - 80) / 7 - 8, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  dayCellDone: { backgroundColor: "rgba(0,255,135,0.08)", borderColor: "#00FF8740" },
  dayCellToday: { backgroundColor: "rgba(245,200,66,0.12)", borderColor: "#F5C84260", borderWidth: 2 },
  dayEmoji: { fontSize: 16 },
  dayNum: { fontFamily: "Cairo_400Regular", fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  dayNumToday: { color: "#F5C842" },
  dayReward: { fontFamily: "Cairo_700Bold", fontSize: 10, color: "rgba(255,255,255,0.5)" },
  dayRewardToday: { color: "#F5C842" },
  rewardBanner: { backgroundColor: "rgba(245,200,66,0.15)", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#F5C84230" },
  rewardText: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#F5C842" },
  claimBtn: { width: "100%", borderRadius: 16, overflow: "hidden" },
  claimBtnGrad: { paddingVertical: 14, alignItems: "center", borderRadius: 16 },
  claimBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000" },
});

function RootLayoutNav() {
  return (
    <>
      <InvitePoller />
      <GiftPoller />
      <DailyResetChecker />
      <DailyLoginPopup />
      <PushNotificationRegistrar />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="lobby" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="game" options={{ animation: "fade" }} />
        <Stack.Screen name="ai-game" options={{ animation: "fade" }} />
        <Stack.Screen name="leaderboard" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="shop" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="settings" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="offline" options={{ animation: "fade" }} />
        <Stack.Screen name="friends" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="tasks" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="achievements" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="spin" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="league" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="tournament" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="rapid" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="+not-found" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the native OS splash screen as soon as fonts are ready
      SplashScreen.hideAsync();

      // Preload all game sounds during the splash screen display period
      preloadAllSounds();

      // Show our custom in-app splash for ~4.5 s, then fade it out
      const displayTimer = setTimeout(() => {
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }).start(() => setSplashVisible(false));
      }, 4500);

      return () => clearTimeout(displayTimer);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <PlayerProvider>
            <ThemeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>

            {/* Custom in-app splash — renders above everything, fades out after delay */}
            {splashVisible && (
              <Animated.View
                style={[StyleSheet.absoluteFillObject, { opacity: splashOpacity, zIndex: 9999 }]}
                pointerEvents="none"
              >
                <SplashOverlay />
              </Animated.View>
            )}
            </ThemeProvider>
          </PlayerProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
