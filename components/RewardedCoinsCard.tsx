import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, View, type ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAds } from "./AdsProvider";
import { usePlayer } from "@/contexts/PlayerContext";
import { getRewardOffer, startRewardSession, getRewardReceipt, type RewardOffer, type RewardKind } from "@/services/rewarded-ads";
import { runRewardedAd } from "@/lib/rewarded-ad";
import { RoyalSurface, RoyalIcon } from "./RoyalUi";
import { ScaledText as Text } from "./ScaledText";

export function RewardedCoinsCard({
  matchId,
  compact = false,
  expectedCoins,
  artworkSource,
  artworkAspectRatio,
  artworkButtonLayout = "wide",
  onDismiss,
  onCredited,
}: {
  matchId?: string;
  compact?: boolean;
  expectedCoins?: number;
  artworkSource?: ImageSourcePropType;
  artworkAspectRatio?: number;
  artworkButtonLayout?: "wide" | "portrait";
  onDismiss?: () => void;
  onCredited?: () => Promise<void>;
}) {
  const kind: RewardKind = matchId ? "loss-recovery" : "coins";
  const ads = useAds();
  const { playerId, refreshCoins } = usePlayer();
  const [offer, setOffer] = useState<RewardOffer | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const epoch = useRef(0);
  const alive = useRef(false);
  const lock = useRef(false);
  const release = useRef<null | (() => void)>(null);
  const controller = useRef<AbortController | null>(null);
  const allowed = useRef(false);
  allowed.current = ads.canRequestAds;
  const key = `rewarded-pending-v1:${playerId}:${kind}:${matchId ?? "coins"}`;

  useEffect(() => {
    alive.current = true;
    epoch.current++;
    let cancelled = false;
    const abort = new AbortController();
    void AsyncStorage.getItem(key).then((value) => {
      if (!cancelled && alive.current) setPending(value);
    }).catch(() => {});
    void getRewardOffer(kind, matchId, abort.signal).then((value) => {
      if (!cancelled && alive.current) setOffer(value);
    }).catch(() => {
      if (!cancelled && alive.current) setMessage("الخدمة غير متاحة حالياً.");
    });
    return () => {
      cancelled = true;
      alive.current = false;
      abort.abort();
      controller.current?.abort();
      release.current?.();
      release.current = null;
    };
  }, [key, kind, matchId]);

  async function verify(id: string) {
    const status = await getRewardReceipt(id);
    if (status === "credited") {
      await refreshCoins();
      await AsyncStorage.removeItem(key);
      await onCredited?.();
      if (alive.current) {
        setPending(null);
        setOffer(null);
        setMessage("تم تأكيد المكافأة وتحديث رصيدك.");
      }
    } else if (status === "expired") {
      await AsyncStorage.removeItem(key);
      if (alive.current) {
        setPending(null);
        setMessage("انتهت صلاحية الطلب دون مكافأة.");
      }
    } else if (alive.current) setMessage("بانتظار تأكيد المكافأة. يمكنك التحقق مجدداً.");
  }

  async function watch() {
    if (lock.current || !playerId) return;
    const generation = epoch.current;
    const current = () => alive.current && generation === epoch.current;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (pending) {
        await verify(pending);
        return;
      }
      if (!offer?.enabled || !ads.canRequestAds || Platform.OS === "web") throw Error("unavailable");
      const slot = ads.acquireRewardedSlot();
      if (!slot) throw Error("busy");
      release.current = slot;
      const session = await startRewardSession(kind, matchId);
      if (!current()) throw Error("cancelled");
      if (expectedCoins !== undefined && session.coins !== expectedCoins) {
        await onCredited?.();
        throw Error("reward_offer_changed");
      }
      await AsyncStorage.setItem(key, session.id);
      if (alive.current) setPending(session.id);
      const abort = new AbortController();
      controller.current = abort;
      const earned = await runRewardedAd({
        userId: playerId,
        customData: session.customData,
        allowed: () => current() && allowed.current,
        signal: abort.signal,
      });
      slot();
      release.current = null;
      if (earned) await verify(session.id);
      else {
        await AsyncStorage.removeItem(key);
        if (alive.current) {
          setPending(null);
          setMessage("لم تكتمل مشاهدة الإعلان، ولم تُضف مكافأة.");
        }
      }
    } catch {
      if (alive.current) setMessage("تعذر إكمال الطلب. أعد المحاولة؛ لا تُضاف العملات إلا بعد التأكيد.");
    } finally {
      release.current?.();
      release.current = null;
      controller.current = null;
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  if (!offer?.enabled && !pending) {
    return compact ? <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 10, color: "#C9BADB", textAlign: "center" }}>غير متاح حالياً</Text> : null;
  }

  const disabled = busy || !playerId || (!pending && (!offer?.enabled || !ads.canRequestAds || ads.isFullScreenAdActive || Platform.OS === "web"));
  const imageOffer = Boolean(
    artworkSource && !compact && offer?.enabled && (expectedCoins === undefined || expectedCoins === offer.coins),
  );

  if (imageOffer && artworkSource) {
    return (
      <View style={{ width: "100%", gap: 6 }}>
        <View style={{ width: "100%", aspectRatio: artworkAspectRatio ?? 308 / 254, overflow: "hidden", borderRadius: 15 }}>
          <Image
            accessible={false}
            source={artworkSource}
            resizeMode="stretch"
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? "جارٍ تشغيل الإعلان" : `شاهد الإعلان: ${offer!.coins} عملة`}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            onPress={() => void watch()}
            style={artworkButtonLayout === "portrait"
              ? { position: "absolute", left: "5%", bottom: "3%", width: "56%", height: "13%" }
              : { position: "absolute", left: "4%", bottom: "4%", width: "48%", height: "19%" }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="لاحقاً"
            onPress={onDismiss}
            style={artworkButtonLayout === "portrait"
              ? { position: "absolute", right: "4%", bottom: "3%", width: "34%", height: "13%" }
              : { position: "absolute", right: "4%", bottom: "4%", width: "42%", height: "19%" }}
          />
        </View>
        {message ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: "Cairo_400Regular", fontSize: 11, lineHeight: 20, color: "#E9D7B8", textAlign: "center" }}>{message}</Text> : null}
      </View>
    );
  }

  const Wrapper = compact ? View : RoyalSurface;
  return (
    <Wrapper style={compact ? { gap: 3 } : { padding: 12, gap: 9, marginTop: 8 }}>
      {!compact ? (
        <View style={{ flexDirection: "row-reverse", gap: 10, alignItems: "center" }}>
          <RoyalIcon name={matchId ? "gift" : "coins"} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: "#FFE4A3", textAlign: "right" }}>{matchId ? "عوّض جزءاً من مبلغ الدخول" : "اربح عملات بمشاهدة إعلان"}</Text>
            <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: "#D8C9E4", textAlign: "right" }}>{offer?.enabled ? `المكافأة: ${offer.coins} عملة` : "يتطلب اتصالاً وخدمة مكافآت متاحة."}</Text>
          </View>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={() => void watch()}
        style={{ minHeight: 46, borderRadius: 12, backgroundColor: disabled ? "#4A405F" : "#0E8C92", justifyContent: "center", opacity: disabled ? 0.65 : 1 }}
      >
        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 13, color: "#FFF0D6", textAlign: "center" }}>{busy ? "جارٍ المعالجة…" : pending ? "التحقق من المكافأة" : offer?.enabled ? "شاهد الإعلان" : "الإعلان غير متاح حالياً"}</Text>
      </Pressable>
      {message ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: "Cairo_400Regular", fontSize: 11, lineHeight: 21, color: "#E9D7B8", textAlign: "center" }}>{message}</Text> : null}
    </Wrapper>
  );
}
