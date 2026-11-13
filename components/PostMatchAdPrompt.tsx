import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { RewardedCoinsCard } from "@/components/RewardedCoinsCard";
import { GameModal } from "@/components/GameUi";
import { RoyalIcon } from "@/components/RoyalUi";
import { ScaledText as Text } from "@/components/ScaledText";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAds } from "@/components/AdsProvider";
import type { MatchOutcome } from "@/lib/match-outcome";
import { getRewardOffer, type RewardOffer } from "@/services/rewarded-ads";

const SKIPS_KEY = "post_match_ad_skips_v1";
const LAST_MATCH_KEY = "post_match_ad_last_offer_v1";

export function PostMatchAdPrompt({
  matchId,
  recoveryMatchId,
  entryFee,
  outcome,
}: {
  matchId: string;
  recoveryMatchId?: string;
  entryFee: number;
  outcome?: MatchOutcome | null;
}) {
  const { playerId } = usePlayer();
  const { showInterstitial, canRequestAds, isFullScreenAdActive } = useAds();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");
  const [offer, setOffer] = useState<RewardOffer | null>(null);
  const promptedMatch = useRef("");
  const recoveryId = recoveryMatchId && entryFee > 0 ? recoveryMatchId : undefined;
  const skipsKey = `${SKIPS_KEY}:${playerId ?? "guest"}`;
  const lastMatchKey = `${LAST_MATCH_KEY}:${playerId ?? "guest"}`;

  useEffect(() => {
    if (!playerId || !matchId || promptedMatch.current === matchId) return;
    let alive = true;
    promptedMatch.current = matchId;
    setChecking(true);
    setOffer(null);
    void (async () => {
      try {
        if (await AsyncStorage.getItem(lastMatchKey) === matchId) return;
        await AsyncStorage.setItem(lastMatchKey, matchId);
        const skips = Math.max(0, Number(await AsyncStorage.getItem(skipsKey)) || 0);
        if (skips >= 2 && canRequestAds && !isFullScreenAdActive) {
          const shown = await showInterstitial();
          if (shown) {
            await AsyncStorage.setItem(skipsKey, "0");
            return;
          }
          if (alive) setNotice("الإعلان العادي غير متاح حالياً.");
        }
        const nextOffer = await getRewardOffer(recoveryId ? "loss-recovery" : "coins", recoveryId);
        if (alive) {
          setOffer(nextOffer);
          if (nextOffer.enabled) setVisible(true);
        }
      } catch {
        // Avoid presenting an empty reward dialog when the reward service is unavailable.
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canRequestAds, isFullScreenAdActive, lastMatchKey, matchId, playerId, recoveryId, showInterstitial, skipsKey]);

  const dismiss = useCallback(async () => {
    try {
      const skips = Math.max(0, Number(await AsyncStorage.getItem(skipsKey)) || 0);
      await AsyncStorage.setItem(skipsKey, String(Math.min(2, skips + 1)));
    } catch {}
    setVisible(false);
  }, [skipsKey]);

  const onCredited = useCallback(async () => {
    try {
      await AsyncStorage.setItem(skipsKey, "0");
    } catch {}
    setVisible(false);
  }, [skipsKey]);

  if (Platform.OS === "web" || checking || !visible || !offer?.enabled) return null;

  const matchingArtwork = offer.coins === 50;
  const artwork = recoveryId
    ? { source: require("../assets/home-popups/post-loss-recovery.png"), ratio: 308 / 254, layout: "wide" as const }
    : outcome === "draw"
      ? { source: require("../assets/home-popups/post-match-coins.png"), ratio: 312 / 446, layout: "portrait" as const }
      : { source: require("../assets/home-popups/post-quick-reward.png"), ratio: 308 / 246, layout: "wide" as const };
  return (
    <GameModal visible onRequestClose={() => void dismiss()}>
      {matchingArtwork ? (
        <RewardedCoinsCard
          {...(recoveryId ? { matchId: recoveryId } : {})}
          expectedCoins={50}
          artworkSource={artwork.source}
          artworkAspectRatio={artwork.ratio}
          artworkButtonLayout={artwork.layout}
          onDismiss={() => void dismiss()}
          onCredited={onCredited}
        />
      ) : (
        <View style={{ alignItems: "center", gap: 10 }}>
          <RoyalIcon name="coins" size={48} />
          <Text accessibilityRole="header" style={{ fontFamily: "Cairo_700Bold", fontSize: 20, color: "#FFE3A6", textAlign: "center" }}>
            مكافأة بعد المباراة
          </Text>
          <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 13, lineHeight: 22, color: "#DDCFEA", textAlign: "center" }}>
            {recoveryId ? "يمكنك مشاهدة إعلان اختياري لاستعادة جزء من مبلغ الدخول." : "يمكنك مشاهدة إعلان اختياري للحصول على مكافأة العملات اليومية المتاحة."}
          </Text>
          <RewardedCoinsCard
            {...(recoveryId ? { matchId: recoveryId } : {})}
            expectedCoins={offer.coins}
            onCredited={onCredited}
          />
          <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, lineHeight: 19, color: "#CBB9DC", textAlign: "center" }}>
            بعد التأجيل مرتين، قد يظهر إعلان عادي بلا مكافأة عند نتيجة مباراة لاحقة.
          </Text>
          {notice ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: "#E9D7B8", textAlign: "center" }}>{notice}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void dismiss()} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#75E7DA", textAlign: "center" }}>لاحقاً</Text>
          </Pressable>
        </View>
      )}
    </GameModal>
  );
}
