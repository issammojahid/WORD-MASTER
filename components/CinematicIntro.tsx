import AsyncStorage from "@react-native-async-storage/async-storage";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gameDesign } from "@/constants/game-design";

export const INTRO_SEEN_KEY = "cinematic_intro_seen_v2";

const introVideo = require("../assets/video/huroof-al-maghrib-intro-narrated.mp4");
const LOAD_TIMEOUT_MS = 15_000;

type Props = {
  onFinish: () => void;
};

function logIntroError(message: string, error: unknown) {
  if (__DEV__) console.warn(`[intro] ${message}`, error);
}

export default function CinematicIntro({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const finished = useRef(false);
  const finishCallback = useRef(onFinish);
  finishCallback.current = onFinish;

  const finish = useCallback((markSeen = true) => {
    if (finished.current) return;
    finished.current = true;
    if (markSeen) {
      void AsyncStorage.setItem(INTRO_SEEN_KEY, "1").catch((storageError: unknown) => {
        logIntroError("could not save intro completion", storageError);
      });
    }
    finishCallback.current();
  }, []);

  const showLoadError = useCallback((message?: string) => {
    if (finished.current) return;
    setError(message?.trim() || "The intro video could not be loaded.");
    setLoaded(false);
    logIntroError("video playback failed", message || "No playback error details were provided.");
  }, []);

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) showLoadError(status.error);
      return;
    }
    if (status.didJustFinish) finish();
  }, [finish, showLoadError]);

  const retry = useCallback(() => {
    finished.current = false;
    setError(null);
    setLoaded(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (loaded || error) return;
    const timeout = setTimeout(() => {
      showLoadError("The intro video did not load within the expected time.");
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [attempt, error, loaded, showLoadError]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      setAppActive(nextState === "active");
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  const top = Math.max(insets.top, 12);
  const bottom = Math.max(insets.bottom, 12);

  return (
    <View style={styles.container} accessibilityViewIsModal>
      <Video
        key={attempt}
        source={introVideo}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={appActive && !error}
        isMuted={muted}
        isLooping={false}
        useNativeControls={false}
        progressUpdateIntervalMillis={250}
        onLoad={() => {
          setLoaded(true);
          setError(null);
        }}
        onError={(message) => showLoadError(message)}
        onPlaybackStatusUpdate={handlePlaybackStatus}
      />

      {!loaded && !error ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator size="large" color={gameDesign.colors.coins} />
          <Text style={styles.loadingText}>جارٍ تحميل المقدمة...</Text>
        </View>
      ) : null}

      <View style={[styles.controls, { top, left: 16, right: 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? "تشغيل الصوت" : "كتم الصوت"}
          accessibilityState={{ selected: muted }}
          onPress={() => setMuted((value) => !value)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.label}>{muted ? "تشغيل الصوت" : "كتم"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تخطي المقدمة والانتقال إلى الرئيسية"
          onPress={() => finish()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.label}>تخطي</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorOverlay}>
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>تعذّر تحميل المقدمة</Text>
            <Text style={styles.errorMessage}>تحقق من ملف الفيديو، أو أعد المحاولة. يمكنك المتابعة إلى الرئيسية.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.retryLabel}>إعادة المحاولة</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => finish()}
              style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.continueLabel}>المتابعة إلى الرئيسية</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View pointerEvents="none" style={[styles.bottomFade, { height: bottom + 12 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10_000,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  controls: {
    position: "absolute",
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  button: {
    minHeight: 48,
    minWidth: 88,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5CC9A88",
    backgroundColor: "#221833E8",
  },
  buttonPressed: { opacity: 0.74 },
  label: {
    color: "#FFF",
    fontFamily: gameDesign.typography.fontFamily.bold,
    fontSize: 15,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#080610",
  },
  loadingText: {
    color: "#FFF",
    fontFamily: gameDesign.typography.fontFamily.semibold,
    fontSize: 16,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#090611D9",
  },
  errorCard: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: 12,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D8B97888",
    backgroundColor: "#21172F",
  },
  errorTitle: {
    color: "#FFF",
    fontFamily: gameDesign.typography.fontFamily.bold,
    fontSize: 21,
    textAlign: "center",
  },
  errorMessage: {
    color: "#E0D5E8",
    fontFamily: gameDesign.typography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 48,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: gameDesign.colors.coins,
  },
  retryLabel: {
    color: "#21172F",
    fontFamily: gameDesign.typography.fontFamily.bold,
    fontSize: 15,
  },
  continueButton: {
    minHeight: 48,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#8B6AA3",
    backgroundColor: "#342349",
  },
  continueLabel: {
    color: "#FFF",
    fontFamily: gameDesign.typography.fontFamily.semibold,
    fontSize: 15,
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#00000024",
  },
});
