import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/components/AdsProvider";
import { getAdUnitId } from "@/lib/ad-config";
import { gameDesign } from "@/constants/game-design";

export function HomeBannerAd() {
  const { canRequestAds, isFullScreenAdActive } = useAds();
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const [failed, setFailed] = useState(false);
  const loadedRef = useRef(false);
  const unitId = getAdUnitId("banner");
  const bannerWidth = Math.max(0, Math.min(screenWidth - 48, 860));
  useEffect(() => {
    if (!canRequestAds || !unitId || isFullScreenAdActive) return;
    const timeout = setTimeout(() => {
      if (!loadedRef.current) setFailed(true);
    }, 15_000);
    return () => clearTimeout(timeout);
  }, [canRequestAds, isFullScreenAdActive, unitId]);

  if (!canRequestAds || !unitId || isFullScreenAdActive || failed) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.advertisement}</Text>
      <View style={styles.adSlot}>
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          width={bannerWidth}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => {
            loadedRef.current = true;
          }}
          onAdFailedToLoad={(error) => {
            const code = error && "code" in error ? String(error.code) : "unknown";
            console.warn(`[ads] banner failed to load (${code})`);
            setFailed(true);
          }}
        />
      </View>
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
  adSlot: {
    alignSelf: "center",
  },
});
