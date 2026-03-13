import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from "@expo-google-fonts/cairo";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient, getApiUrl } from "@/lib/query-client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import SplashOverlay from "@/components/SplashOverlay";

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

function RootLayoutNav() {
  return (
    <>
      <InvitePoller />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lobby" />
        <Stack.Screen name="game" />
        <Stack.Screen name="ai-game" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="offline" />
        <Stack.Screen name="+not-found" />
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
          </PlayerProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
