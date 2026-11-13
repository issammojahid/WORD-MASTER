import React, { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/components/AdsProvider";
import { getAdUnitId } from "@/lib/ad-config";
import { createAdRetry } from "@/lib/ads-runtime";
import { gameDesign } from "@/constants/game-design";
import { getGoogleMobileAds } from "@/lib/google-mobile-ads";

export function HomeBannerAd() {
  const gma = getGoogleMobileAds();
  const {
      canRequestAds,
      isFullScreenAdActive,
      reportAdEvent,
      adRequestVersion,
    } = useAds(),
    { t } = useLanguage();
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [width, setWidth] = useState(0);
  const failedRequest = useRef<string | null>(null);
  const loaded = useRef(false),
    retry = useRef<ReturnType<typeof createAdRetry> | null>(null),
    watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unitId = getAdUnitId("banner"),
    enabled =
      !!gma &&
      canRequestAds &&
      !!unitId &&
      !isFullScreenAdActive &&
      foreground &&
      width > 0;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const key = `${unitId}:${attempt}:${adRequestVersion}:${width}`;
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) =>
      setForeground(next === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = createAdRetry(() => {
      if (!enabledRef.current) return;
      setFailed(false);
      setAttempt((value) => value + 1);
    });
    retry.current = controller;
    return () => {
      controller.dispose();
      retry.current = null;
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) {
      loaded.current = false;
      return;
    }
    setFailed(false);
    loaded.current = false;
    retry.current?.reset();
  }, [enabled, adRequestVersion]);
  useEffect(() => {
    if (!enabled) return;
    loaded.current = false;
    failedRequest.current = null;
    const currentKey = key;
    reportAdEvent("banner", "loading");
    watchdog.current = setTimeout(() => {
      if (
        !enabledRef.current ||
        keyRef.current !== currentKey ||
        loaded.current
      )
        return;
      failedRequest.current = currentKey;
      setFailed(true);
      reportAdEvent("banner", "timeout", { code: "load_timeout" });
      retry.current?.schedule();
    }, 45_000);
    return () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = null;
    };
  }, [enabled, key, reportAdEvent]);

  if (!gma || !enabled || failed || !unitId) {
    return (
      <View
        style={styles.container}
        onLayout={(event) =>
          setWidth(Math.max(0, Math.floor(event.nativeEvent.layout.width)))
        }
      />
    );
  }

  const { BannerAd, BannerAdSize } = gma;

  return (
    <View
      style={styles.container}
      onLayout={(event) =>
        setWidth(Math.max(0, Math.floor(event.nativeEvent.layout.width)))
      }
    >
      <Text style={styles.label}>{t.advertisement}</Text>
      <BannerAd
        key={key}
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        width={width}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => {
          if (
            !enabledRef.current ||
            keyRef.current !== key ||
            failedRequest.current === key
          )
            return;
          loaded.current = true;
          if (watchdog.current) clearTimeout(watchdog.current);
          watchdog.current = null;
          retry.current?.reset();
          reportAdEvent("banner", "loaded");
        }}
        onAdFailedToLoad={(error) => {
          if (
            !enabledRef.current ||
            keyRef.current !== key ||
            failedRequest.current === key
          )
            return;
          failedRequest.current = key;
          if (watchdog.current) clearTimeout(watchdog.current);
          watchdog.current = null;
          loaded.current = false;
          setFailed(true);
          reportAdEvent("banner", "failed", error);
          retry.current?.schedule();
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingTop: 8,
  },
  label: {
    alignSelf: "flex-start",
    marginBottom: 4,
    color: gameDesign.colors.textMuted,
    fontFamily: gameDesign.typography.fontFamily.regular,
    fontSize: 11,
  },
});
