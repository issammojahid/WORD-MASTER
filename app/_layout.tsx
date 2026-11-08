import {Season2027Provider} from '@/contexts/Season2027Context';
import {useAppActive} from "@/lib/use-app-active";
import {ScaledText as Text} from "@/components/ScaledText";
import { PlayerNameForm } from "@/components/PlayerNameForm";
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from "@expo-google-fonts/cairo";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { BottomNavigation } from "@/components/BottomNavigation";
import * as SystemUI from "expo-system-ui";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {Animated, Platform, StyleSheet, View, TouchableOpacity, Modal} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdsProvider } from "@/components/AdsProvider";
import { GameModal, useReducedMotion } from "@/components/GameUi";
import { queryClient } from "@/lib/query-client";
import { markStartup } from "@/lib/startup-performance";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import { HalloweenProvider } from "@/contexts/HalloweenContext";
import { HalloweenLaunchPopup } from "@/components/HalloweenLaunchPopup";
import { StartupProvider } from "@/contexts/StartupContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import SplashOverlay from "@/components/SplashOverlay";
import CinematicIntro, { INTRO_SEEN_KEY } from "@/components/CinematicIntro";
import { setLocalReminders, syncLocalReminders, getPermissionsStatus } from "@/lib/local-reminders";
import { gameDesign } from "@/constants/game-design";

SplashScreen.preventAutoHideAsync();

const NOTIF_PROMPT_KEY = "notif_prompt_shown_v1";

function PushNotificationRegistrar() {
  const active=useAppActive();
  const { playerId } = usePlayer();
  const [showModal, setShowModal] = useState(false);
  const checkedRef = useRef(false);
  useEffect(()=>{if(active)void syncLocalReminders().catch(()=>{});},[active]);

  useEffect(() => {
    if (!playerId || checkedRef.current) return;
    checkedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        if (Platform.OS === "web") return;
        const status = await getPermissionsStatus();
        if (status === "granted") {
          syncLocalReminders().catch(() => {});
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
    await setLocalReminders(true);
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
          <View style={np.icon}>
            <Ionicons name="notifications-outline" size={38} color={gameDesign.colors.friends} />
          </View>
          <Text style={np.title}>تفعيل الإشعارات</Text>
          <Text style={np.body}>
            {"خمسة تذكيرات يومياً للعب، بين العاشرة صباحاً والتاسعة مساءً.\n\nيمكنك إيقاف الإشعارات في أي وقت من الإعدادات."}
          </Text>
          <TouchableOpacity style={np.allowBtn} onPress={handleAllow} activeOpacity={0.85}>
            <LinearGradient colors={[gameDesign.colors.friends, "#0878B5"]} style={np.allowGrad}>
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
  card: { width: "100%", maxWidth: 360, backgroundColor: "#302044", borderRadius: 24, padding: 28, alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: `${gameDesign.colors.friends}50` },
  icon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: `${gameDesign.colors.friends}18` },
  title: { fontFamily: "Cairo_700Bold", fontSize: 22, color: "#FFF8FF", textAlign: "center" },
  body: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#E5D8EC", textAlign: "center", lineHeight: 22 },
  allowBtn: { width: "100%", borderRadius: 16, overflow: "hidden", marginTop: 4 },
  allowGrad: { paddingVertical: 14, alignItems: "center", borderRadius: 16 },
  allowText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#000" },
  declineBtn: { paddingVertical: 8 },
  declineText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#B9A6C5" },
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
  }, [playerId, qc]);

  return null;
}

function RootLayoutNav() {
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const transition = (animation: "fade" | "slide_from_right" | "slide_from_bottom") =>
    reduceMotion ? "none" as const : animation;

  return (
    <>
      <DailyResetChecker />
      <PushNotificationRegistrar />
      <View style={[styles.navigationFrame, { backgroundColor: theme.background }]}>
        <Stack screenOptions={{
          headerShown: false,
          animation: transition("slide_from_right"),
          contentStyle: { backgroundColor: theme.background },
        }}>
          <Stack.Screen name="index" options={{ animation: transition("fade") }} />
          <Stack.Screen name="settings" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="profile" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="store" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="offline" options={{ animation: transition("fade") }} />
          <Stack.Screen name="online" options={{ animation: transition("fade") }} />
          <Stack.Screen name="team-up" options={{ animation: transition("fade") }} />
          <Stack.Screen name="four-players" options={{ animation: transition("fade") }} />
          <Stack.Screen name="private-room" options={{ animation: transition("slide_from_right") }} />
          <Stack.Screen name="friends" options={{ animation: transition("slide_from_right") }} />
          <Stack.Screen name="chat/[conversationId]" options={{ animation: transition("slide_from_right") }} />
          <Stack.Screen name="tasks" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="achievements" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="spin" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="daily-challenge" options={{ animation: transition("slide_from_bottom") }} />
          <Stack.Screen name="clans" options={{ animation: transition("slide_from_right") }} />
          <Stack.Screen name="+not-found" options={{ animation: transition("fade") }} />
        </Stack>
        <View style={styles.bottomNavigationContainer}>
          <BottomNavigation />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  navigationFrame: { flex: 1 },
  bottomNavigationContainer: { width: "100%", paddingHorizontal: 8 },
});

function StartupShell({ fontsReady }: { fontsReady: boolean }) {
  const router = useRouter();
  const { isReady: playerReady, needsName } = usePlayer();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [navigationReady, setNavigationReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);
  const introCheckStarted = useRef(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const startupReady = fontsReady && playerReady && navigationReady;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch((error: unknown) => {
      if (__DEV__) console.warn("[startup] unable to set system background color", error);
    });
  }, [theme.background]);

  useEffect(() => {
    if (!startupReady) return;

    markStartup("first-screen-ready");
    const frame = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch((error: unknown) => {
        if (__DEV__) console.warn("[startup] unable to hide native splash screen", error);
      });

      if (reduceMotion) {
        setSplashVisible(false);
        return;
      }

      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSplashVisible(false);
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      splashOpacity.stopAnimation();
    };
  }, [reduceMotion, splashOpacity, startupReady]);

  useEffect(() => {
    if (!startupReady || splashVisible || introCheckStarted.current) return;
    introCheckStarted.current = true;
    void AsyncStorage.getItem(INTRO_SEEN_KEY).then((seen) => {
      if (seen !== "1") setIntroVisible(true);
    }).catch((error: unknown) => {
      if (__DEV__) console.warn("[startup] unable to read intro completion", error);
      setIntroVisible(true);
    }).finally(() => setIntroChecked(true));
  }, [splashVisible, startupReady]);

  const closeIntro = useCallback(() => {
    setIntroVisible(false);
    router.replace("/");
  }, [router]);

  return (
    <StartupProvider ready={!splashVisible && introChecked && !introVisible && !needsName}>
      <View
        style={[styles.navigationFrame, { backgroundColor: theme.background }]}
        onLayout={() => {
          if (!navigationReady) {
            setNavigationReady(true);
            markStartup("root-layout");
          }
        }}
      >
        <RootLayoutNav />
        <StatusBar
          style={theme.statusBar === "light" ? "light" : "dark"}
          backgroundColor={theme.background}
          translucent={false}
        />
        {splashVisible && (
          <Animated.View
            pointerEvents={startupReady ? "none" : "auto"}
            style={[StyleSheet.absoluteFillObject, { opacity: splashOpacity, zIndex: 9999 }]}
          >
            <SplashOverlay />
          </Animated.View>
        )}
        {introVisible && !splashVisible && <CinematicIntro onFinish={closeIntro} />}
        <GameModal visible={!splashVisible && introChecked && !introVisible && needsName} onRequestClose={() => {}}><PlayerNameForm /></GameModal>
        <HalloweenLaunchPopup />
      </View>
    </StartupProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });
  const [forceReady, setForceReady] = useState(false);
  const fontsReady = fontsLoaded || !!fontError || forceReady;

  useEffect(() => {
    markStartup("root-mounted");
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      markStartup(fontError ? "font-load-failed" : "fonts-ready");
      return;
    }

    const t = setTimeout(() => {
      setForceReady(true);
      markStartup("font-load-fallback");
    }, 2500);
    return () => clearTimeout(t);
  }, [fontError, fontsLoaded]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <PlayerProvider>
            <ThemeProvider>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: gameDesign.colors.background }}>
                <KeyboardProvider>
                  <AdsProvider>
                    <Season2027Provider><HalloweenProvider><StartupShell fontsReady={fontsReady} /></HalloweenProvider></Season2027Provider>
                  </AdsProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ThemeProvider>
          </PlayerProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
