import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { ScaledText as Text } from "@/components/ScaledText";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppActive } from "@/lib/use-app-active";
import { useStartupReady } from "@/contexts/StartupContext";

const LAST_PROMPT_KEY = "play_store_rating_prompt_at_v1";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.huroofalmaghrib";
const PLAY_STORE_MARKET_URL = "market://details?id=com.huroofalmaghrib";

export function RatingPrompt() {
  const { profile, playerId, isReady } = usePlayer();
  const { theme } = useTheme();
  const startupReady = useStartupReady();
  const active = useAppActive();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const handledRef = useRef(false);
  const eligible = isReady && startupReady && active && !!playerId
    && profile.gamesPlayed >= 5
    && (pathname === "/" || pathname === "/index");

  useEffect(() => {
    if (!eligible || handledRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedulePrompt = async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_PROMPT_KEY);
        if (cancelled) return;
        const lastPromptAt = Number(stored);
        if (Number.isFinite(lastPromptAt) && lastPromptAt > 0 && Date.now() - lastPromptAt < COOLDOWN_MS) {
          handledRef.current = true;
          return;
        }
        timer = setTimeout(() => {
          if (cancelled) return;
          handledRef.current = true;
          setVisible(true);
          void AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now())).catch(() => {});
        }, 12000);
      } catch {
        // If local storage is temporarily unavailable, skip this prompt.
      }
    };

    void schedulePrompt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [eligible]);

  const close = () => setVisible(false);

  const openStore = async () => {
    setVisible(false);
    try {
      await Linking.openURL(Platform.OS === "android" ? PLAY_STORE_MARKET_URL : PLAY_STORE_URL);
    } catch {
      try {
        await Linking.openURL(PLAY_STORE_URL);
      } catch {
        // Keep the game usable if no store handler is available.
      }
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <View style={[s.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[s.card, { backgroundColor: theme.modalBg, borderColor: theme.cardBorder }]}>
          <View style={[s.icon, { backgroundColor: theme.backgroundTertiary }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#F2C773" />
          </View>
          <Text style={[s.title, { color: theme.textPrimary }]}>هل تستمتع باللعبة؟</Text>
          <Text style={[s.body, { color: theme.textSecondary }]}>
            إذا رغبت، شارك رأيك الصادق على Google Play. تقييمك اختياري ويساعدنا على تحسين اللعبة.
          </Text>
          <Pressable accessibilityRole="button" onPress={openStore} style={s.primary}>
            <Ionicons name="open-outline" size={19} color="#281B3F" />
            <Text style={s.primaryText}>فتح Google Play</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={close} style={s.secondary}>
            <Text style={[s.secondaryText, { color: theme.textMuted }]}>لاحقاً</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 22 },
  card: { width: "100%", maxWidth: 380, borderRadius: 24, borderWidth: 1.5, padding: 24, alignItems: "center", gap: 14 },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Cairo_700Bold", fontSize: 21, textAlign: "center" },
  body: { fontFamily: "Cairo_400Regular", fontSize: 14, lineHeight: 23, textAlign: "center" },
  primary: { width: "100%", minHeight: 50, borderRadius: 15, backgroundColor: "#F2C773", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 2 },
  primaryText: { color: "#281B3F", fontFamily: "Cairo_700Bold", fontSize: 15 },
  secondary: { minHeight: 38, minWidth: 100, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
});
