import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  ImageBackground,
  Easing,
} from "react-native";
const BG_BP = require("@/assets/images/bg_battle_pass.png");
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { purchaseBattlePassPremium, getLocalizedBattlePassPrice } from "@/lib/iap";

// ── Types ─────────────────────────────────────────────────────────────────────
type BpTier = {
  id: string;
  seasonId: string;
  tier: number;
  freeRewardType: string;
  freeRewardId: string | null;
  freeRewardAmount: number;
  premiumRewardType: string;
  premiumRewardId: string | null;
  premiumRewardAmount: number;
};

type BpIap = {
  enabled: boolean;
  productId: string;
  price: { amount: number; currency: string; display: string };
};

type BpState = {
  season: { id: string; name: string; endDate: string };
  passXp: number;
  currentTier: number;
  premiumUnlocked: boolean;
  claimedTiers: string[];
  xpPerTier: number;
  iap?: BpIap;
  tiers: BpTier[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const REWARD_ICON: Record<string, string> = {
  hint: "💡",
  freeze: "❄️",
  time: "⏱️",
};

function rewardIcon(type: string, id: string | null): string {
  if (type === "coins") return "🪙";
  if (type === "powerCard") return REWARD_ICON[id ?? ""] ?? "🃏";
  if (type === "skin") return "👗";
  if (type === "title") return "👑";
  return "🎁";
}

function rewardAmountText(type: string, amount: number): string {
  if (type === "coins") return `${amount}`;
  if (type === "powerCard") return `×${amount}`;
  return "";
}

function rewardSubLabel(type: string, id: string | null): string {
  if (type === "skin") return id ?? "";
  if (type === "title") return id ?? "";
  return "";
}

function formatCountdown(endIso: string): { days: number; hours: number; minutes: number; expired: boolean } {
  const end = new Date(endIso).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, expired: false };
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function BattlePassScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const { profile, playerId, updateProfile } = usePlayer();

  const [bpState, setBpState] = useState<BpState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [localizedPrice, setLocalizedPrice] = useState<string | null>(null);
  const [iapClientReady, setIapClientReady] = useState(false);

  const claimAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Countdown ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Pulsing glow for claimable rewards & CTA
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    ).start();
  }, [glowAnim]);

  const load = useCallback(async () => {
    if (!playerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/battle-pass/${playerId}`);
      const data = await res.json();
      if (res.ok) setBpState(data as BpState);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  // Pull localized store price (e.g. MAD 19,99 / SAR 7,99 / $1.99) from RevenueCat.
  // Returns null if SDK unavailable or RC not configured — fallback to backend display.
  useEffect(() => {
    if (!playerId || !bpState?.iap?.enabled) return;
    let cancelled = false;
    (async () => {
      const p = await getLocalizedBattlePassPrice(playerId);
      if (cancelled) return;
      if (p) {
        setLocalizedPrice(p);
        setIapClientReady(true); // SDK reachable AND product is in store
      }
    })();
    return () => { cancelled = true; };
  }, [playerId, bpState?.iap?.enabled]);

  const buyPremium = async () => {
    if (!playerId || !bpState) return;
    const iap = bpState.iap;

    // Show "coming soon" unless BOTH the backend IAP flag is on AND the client SDK
    // has successfully loaded the product from the store. This avoids showing a
    // failure when only one side is configured.
    if (!iap?.enabled || !iapClientReady) {
      Alert.alert(
        "قريباً 🔜",
        `الباس المميز سيكون متاح قريباً بـ ${localizedPrice ?? iap?.price.display ?? "€1.99"} عبر متجر Google Play.`,
        [{ text: "حسناً" }]
      );
      return;
    }

    const displayPrice = localizedPrice ?? iap.price.display;
    Alert.alert(
      "فتح الباس المميز",
      `هل تريد شراء الباس المميز مقابل ${displayPrice}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "شراء",
          onPress: async () => {
            setBuying(true);
            try {
              // 1) Open native Google Play / App Store billing sheet via RevenueCat SDK
              const purchase = await purchaseBattlePassPremium(playerId);
              if (!purchase.ok) {
                if (purchase.cancelled) {
                  Alert.alert("تم الإلغاء", "لم يتم إتمام الشراء. يمكنك المحاولة في أي وقت.");
                } else if (purchase.error === "iap_unavailable") {
                  Alert.alert("غير متاح", "الدفع غير مفعّل في هذا الإصدار. حدّث التطبيق من المتجر.");
                } else if (purchase.error === "no_package" || purchase.error === "no_offerings") {
                  Alert.alert("غير متاح حالياً", "المنتج غير متوفر في متجرك حالياً. حاول لاحقاً.");
                } else {
                  Alert.alert("فشل الشراء", "تعذّر إتمام عملية الشراء. حاول مرة أخرى.");
                }
                return;
              }

              // 2) Tell server to verify the entitlement and flip premium_unlocked
              const res = await fetch(`${getApiUrl()}/api/battle-pass/${playerId}/unlock-premium-iap`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              if (!res.ok) {
                Alert.alert("خطأ في التفعيل", "تم الدفع، لكن التفعيل فشل. حاول إعادة فتح الصفحة بعد قليل.");
              } else {
                await load();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("مبروك! 🎉", "تم تفعيل الباس المميز");
              }
            } catch {
              Alert.alert("خطأ", "فشل الاتصال بالخادم");
            } finally {
              setBuying(false);
            }
          },
        },
      ]
    );
  };

  const claimReward = async (tierNum: number, track: "free" | "premium") => {
    if (!playerId || !bpState) return;
    const key = `${tierNum}_${track}`;
    if (claiming) return;
    setClaiming(key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(claimAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(claimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    try {
      const res = await fetch(`${getApiUrl()}/api/battle-pass/${playerId}/claim/${tierNum}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("خطأ", data.error ?? "حدث خطأ");
      } else {
        if (typeof data.newCoins === "number") updateProfile({ coins: data.newCoins });
        if (data.rewardType === "skin" && data.rewardId) {
          const ownedSkins = Array.isArray(profile.ownedSkins) ? (profile.ownedSkins as string[]) : [];
          if (!ownedSkins.includes(data.rewardId)) updateProfile({ ownedSkins: [...ownedSkins, data.rewardId] });
        } else if (data.rewardType === "title" && data.rewardId) {
          const ownedTitles = Array.isArray(profile.ownedTitles) ? (profile.ownedTitles as string[]) : [];
          if (!ownedTitles.includes(data.rewardId)) updateProfile({ ownedTitles: [...ownedTitles, data.rewardId] });
        } else if (data.rewardType === "powerCard" && data.rewardId) {
          const pc = (profile.powerCards ?? { time: 0, freeze: 0, hint: 0 }) as Record<string, number>;
          updateProfile({ powerCards: { ...pc, [data.rewardId]: (pc[data.rewardId] ?? 0) + (data.rewardAmount ?? 1) } });
        }
        await load();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("خطأ", "فشل الاتصال بالخادم");
    } finally {
      setClaiming(null);
    }
  };

  const countdown = useMemo(
    () => (bpState ? formatCountdown(bpState.season.endDate) : null),
    [bpState, now]
  );

  if (loading) {
    return (
      <ImageBackground source={BG_BP} style={{ flex: 1 }} resizeMode="cover">
        <LinearGradient colors={["rgba(5,10,25,0.92)", "rgba(5,10,25,0.78)", "rgba(5,10,25,0.92)"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#FFD24A" size="large" />
          <Text style={{ marginTop: 12, color: "#fff", fontFamily: "Cairo_400Regular" }}>تحميل الباس...</Text>
        </LinearGradient>
      </ImageBackground>
    );
  }

  if (!bpState) {
    return (
      <ImageBackground source={BG_BP} style={{ flex: 1 }} resizeMode="cover">
        <LinearGradient colors={["rgba(5,10,25,0.92)", "rgba(5,10,25,0.78)", "rgba(5,10,25,0.92)"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Text style={{ color: "#fff", fontFamily: "Cairo_700Bold", fontSize: 16 }}>لا يوجد موسم نشط</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#FFD24A", fontFamily: "Cairo_400Regular" }}>العودة</Text>
          </TouchableOpacity>
        </LinearGradient>
      </ImageBackground>
    );
  }

  const { passXp, currentTier, premiumUnlocked, claimedTiers, xpPerTier, tiers, season, iap } = bpState;
  const xpInCurrentTier = passXp % xpPerTier;
  const xpProgressPct = currentTier >= 30 ? 1 : Math.min(1, xpInCurrentTier / xpPerTier);
  // Prefer the locale-formatted price string from the device's store (RevenueCat),
  // falling back to the backend's base EUR display only when the SDK can't reach the store.
  const priceLabel = localizedPrice ?? iap?.price.display ?? "€1.99";

  return (
    <ImageBackground source={BG_BP} style={{ flex: 1 }} resizeMode="cover">
      <LinearGradient
        colors={["rgba(5,10,25,0.94)", "rgba(8,15,32,0.85)", "rgba(5,10,25,0.94)"]}
        style={{ flex: 1 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[S.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={S.iconBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFD24A" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={S.seasonName}>{season.name}</Text>
            <Text style={S.seasonSub}>باس الموسم • Battle Pass</Text>
          </View>
          <View style={S.coinsChip}>
            <Text style={S.coinsText}>🪙 {profile.coins}</Text>
          </View>
        </View>

        {/* ── Season banner: countdown + tier progress ─────────────────── */}
        <LinearGradient
          colors={["#1a0d2e", "#3a1854", "#1a0d2e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.heroCard}
        >
          {/* Countdown */}
          {countdown && !countdown.expired && (
            <View style={S.countdownRow}>
              <Ionicons name="time-outline" size={14} color="#FFD24A" />
              <Text style={S.countdownText}>
                ينتهي في {countdown.days}ي {countdown.hours}س {countdown.minutes}د
              </Text>
            </View>
          )}

          {/* Big tier display */}
          <View style={S.heroTierRow}>
            <View style={S.heroTierBadge}>
              <Text style={S.heroTierLabel}>المستوى</Text>
              <Text style={S.heroTierNum}>{currentTier}</Text>
              <Text style={S.heroTierMax}>/ 30</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={S.xpBarTrack}>
                <LinearGradient
                  colors={["#FFD24A", "#FF9500"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[S.xpBarFill, { width: `${xpProgressPct * 100}%` }]}
                />
              </View>
              <View style={S.xpRow}>
                <Text style={S.xpSmall}>
                  {currentTier >= 30 ? "MAX ✓" : `${xpInCurrentTier} / ${xpPerTier} XP`}
                </Text>
                <Text style={S.xpSmall}>إجمالي: {passXp} XP</Text>
              </View>
            </View>
          </View>

          <View style={S.xpHint}>
            <Text style={S.xpHintText}>فوز: +20 XP   •   لعبة: +10 XP</Text>
          </View>
        </LinearGradient>

        {/* ── Tier path ─────────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + (premiumUnlocked ? 24 : 110) }}
          showsVerticalScrollIndicator={false}
        >
          {/* Track headers */}
          <View style={S.trackHeaderRow}>
            <View style={S.trackHeaderCol}>
              <Text style={[S.trackHeaderText, { color: "#9DCFFF" }]}>المسار المجاني</Text>
            </View>
            <View style={{ width: 48 }} />
            <View style={S.trackHeaderCol}>
              <Text style={[S.trackHeaderText, { color: "#FFD24A" }]}>المسار المميز ⭐</Text>
            </View>
          </View>

          {tiers.map((tier) => {
            const reached = currentTier >= tier.tier;
            const freeKey = `${tier.tier}_free`;
            const premKey = `${tier.tier}_premium`;
            const freeClaimed = claimedTiers.includes(freeKey);
            const premClaimed = claimedTiers.includes(premKey);
            const freeClaimable = reached && !freeClaimed;
            const premClaimable = reached && premiumUnlocked && !premClaimed;

            return (
              <View key={tier.id} style={S.tierRow}>
                {/* Free reward (left) */}
                <RewardCell
                  type={tier.freeRewardType}
                  id={tier.freeRewardId}
                  amount={tier.freeRewardAmount}
                  claimed={freeClaimed}
                  claimable={freeClaimable}
                  locked={!reached}
                  busy={claiming === freeKey}
                  onPress={() => claimReward(tier.tier, "free")}
                  glowAnim={glowAnim}
                  accent="#9DCFFF"
                />

                {/* Center tier number with connecting line */}
                <View style={S.centerCol}>
                  <View style={[S.connectorLine, { opacity: tier.tier === 1 ? 0 : 1 }]} />
                  <LinearGradient
                    colors={
                      reached
                        ? ["#FFD24A", "#FF9500"]
                        : ["#2a2a3e", "#1a1a2a"]
                    }
                    style={[S.tierBadge, reached && S.tierBadgeReached, { transform: [{ scale: tier.tier === currentTier + 1 ? claimAnim : 1 }] }]}
                  >
                    <Animated.Text style={[S.tierBadgeText, { color: reached ? "#1a0d2e" : "#666" }]}>
                      {tier.tier}
                    </Animated.Text>
                  </LinearGradient>
                  <View style={[S.connectorLine, { opacity: tier.tier === 30 ? 0 : 1 }]} />
                </View>

                {/* Premium reward (right) */}
                <RewardCell
                  type={tier.premiumRewardType}
                  id={tier.premiumRewardId}
                  amount={tier.premiumRewardAmount}
                  claimed={premClaimed}
                  claimable={premClaimable}
                  locked={!reached || !premiumUnlocked}
                  premiumLocked={reached && !premiumUnlocked}
                  busy={claiming === premKey}
                  onPress={() => claimReward(tier.tier, "premium")}
                  glowAnim={glowAnim}
                  accent="#FFD24A"
                />
              </View>
            );
          })}
        </ScrollView>

        {/* ── Sticky Premium CTA ────────────────────────────────────────── */}
        {!premiumUnlocked && (
          <View style={[S.stickyWrap, { paddingBottom: insets.bottom + 10 }]}>
            <Animated.View
              style={{
                shadowColor: "#FFD24A",
                shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
                elevation: 8,
              }}
            >
              <TouchableOpacity activeOpacity={0.88} onPress={buyPremium} disabled={buying}>
                <LinearGradient
                  colors={["#FF9500", "#FFD24A", "#FF9500"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={S.ctaCard}
                >
                  <View style={S.ctaIconWrap}>
                    <Text style={{ fontSize: 26 }}>⭐</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.ctaTitle}>فعّل الباس المميز</Text>
                    <Text style={S.ctaSub}>افتح كل المكافآت المميزة + 30 درجة</Text>
                  </View>
                  {buying ? (
                    <ActivityIndicator color="#1a0d2e" size="small" />
                  ) : (
                    <View style={S.ctaPriceChip}>
                      <Text style={S.ctaPriceText}>{priceLabel}</Text>
                      {!iap?.enabled && <Text style={S.ctaPriceHint}>قريباً</Text>}
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {premiumUnlocked && (
          <LinearGradient
            colors={["#0f5132", "#198754"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[S.unlockedBanner, { marginBottom: insets.bottom + 8 }]}
          >
            <Text style={{ fontSize: 18 }}>✅</Text>
            <Text style={S.unlockedText}>الباس المميز مفعّل لهذا الموسم</Text>
          </LinearGradient>
        )}
      </LinearGradient>
    </ImageBackground>
  );
}

// ── Reward cell ─────────────────────────────────────────────────────────────
type RewardCellProps = {
  type: string;
  id: string | null;
  amount: number;
  claimed: boolean;
  claimable: boolean;
  locked: boolean;
  premiumLocked?: boolean;
  busy: boolean;
  onPress: () => void;
  glowAnim: Animated.Value;
  accent: string;
};

function RewardCell({
  type, id, amount, claimed, claimable, locked, premiumLocked, busy, onPress, glowAnim, accent,
}: RewardCellProps) {
  const icon = rewardIcon(type, id);
  const amt = rewardAmountText(type, amount);
  const sub = rewardSubLabel(type, id);

  const shadowOpacity = claimable
    ? glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] })
    : 0;

  return (
    <Animated.View
      style={{
        flex: 1,
        shadowColor: accent,
        shadowOpacity,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
        elevation: claimable ? 6 : 0,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={!claimable || busy}
        onPress={onPress}
        style={[
          S.rewardCell,
          {
            borderColor: claimed
              ? "#3a3a4e"
              : claimable
              ? accent
              : locked
              ? "#2a2a3e"
              : "#3a3a4e",
            backgroundColor: claimed
              ? "rgba(255,255,255,0.04)"
              : claimable
              ? "rgba(255,210,74,0.08)"
              : "rgba(20,20,35,0.55)",
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={accent} size="small" />
        ) : claimed ? (
          <>
            <Text style={[S.rewardIcon, { opacity: 0.4 }]}>{icon}</Text>
            <Text style={[S.rewardClaimedTag, { color: "#4ade80" }]}>✓ تم</Text>
          </>
        ) : premiumLocked ? (
          <>
            <Text style={[S.rewardIcon, { opacity: 0.45 }]}>{icon}</Text>
            <Text style={S.rewardLockedTag}>⭐ مميز</Text>
          </>
        ) : locked ? (
          <>
            <Text style={[S.rewardIcon, { opacity: 0.35 }]}>🔒</Text>
            <Text style={S.rewardLockedTag}>مغلق</Text>
          </>
        ) : (
          <>
            <Text style={S.rewardIcon}>{icon}</Text>
            {amt ? <Text style={[S.rewardAmount, { color: accent }]}>{amt}</Text> : null}
            {sub ? <Text style={S.rewardSub} numberOfLines={1}>{sub}</Text> : null}
            {claimable && <Text style={[S.rewardClaim, { color: accent }]}>اضغط للاستلام</Text>}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,210,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,210,74,0.3)",
  },
  seasonName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  seasonSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: -2,
  },
  coinsChip: {
    backgroundColor: "rgba(245,200,66,0.18)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#F5C84240",
  },
  coinsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#FFD24A",
  },

  heroCard: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,210,74,0.25)",
    gap: 12,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countdownText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    color: "#FFD24A",
  },
  heroTierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroTierBadge: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 2,
    borderColor: "#FFD24A",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTierLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
  },
  heroTierNum: {
    fontFamily: "Cairo_700Bold",
    fontSize: 28,
    color: "#FFD24A",
    lineHeight: 32,
  },
  heroTierMax: {
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: -3,
  },
  xpBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,210,74,0.2)",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  xpSmall: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  xpHint: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  xpHintText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },

  trackHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  trackHeaderCol: {
    flex: 1,
    alignItems: "center",
  },
  trackHeaderText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
  },

  tierRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 6,
    gap: 6,
  },
  centerCol: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  connectorLine: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(255,210,74,0.25)",
  },
  tierBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tierBadgeReached: {
    borderColor: "#FFD24A",
    shadowColor: "#FFD24A",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tierBadgeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
  },

  rewardCell: {
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  rewardIcon: {
    fontSize: 24,
  },
  rewardAmount: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
  },
  rewardSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    maxWidth: "100%",
  },
  rewardClaim: {
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    marginTop: 2,
  },
  rewardClaimedTag: {
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
  },
  rewardLockedTag: {
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },

  stickyWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
  },
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: "#1a0d2e",
  },
  ctaSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: "rgba(26,13,46,0.75)",
  },
  ctaPriceChip: {
    backgroundColor: "rgba(26,13,46,0.85)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  ctaPriceText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: "#FFD24A",
  },
  ctaPriceHint: {
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    color: "rgba(255,210,74,0.7)",
    marginTop: -2,
  },

  unlockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginHorizontal: 14,
  },
  unlockedText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#fff",
  },
});
