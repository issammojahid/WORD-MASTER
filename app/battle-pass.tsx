import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

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

type BpState = {
  season: { id: string; name: string; endDate: string };
  passXp: number;
  currentTier: number;
  premiumUnlocked: boolean;
  claimedTiers: string[];
  xpPerTier: number;
  premiumCost: number;
  tiers: BpTier[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function rewardLabel(type: string, id: string | null, amount: number): string {
  if (type === "coins") return `🪙 ${amount}`;
  if (type === "powerCard") {
    const icons: Record<string, string> = { hint: "💡", freeze: "❄️", time: "⏱️" };
    return `${icons[id ?? ""] ?? "🃏"} ×${amount}`;
  }
  if (type === "skin") return `👗 ${id}`;
  if (type === "title") return `👑 ${id}`;
  return `🎁 ${amount}`;
}

function tierBgColor(tier: number): [string, string] {
  if (tier <= 10) return ["#1a2a1a", "#2a3e2a"];
  if (tier <= 20) return ["#1a1a2e", "#2d2d5e"];
  return ["#2e1a00", "#5e3800"];
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function BattlePassScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, playerId, updateProfile } = usePlayer();

  const [bpState, setBpState] = useState<BpState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const claimAnim = useRef(new Animated.Value(1)).current;

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
      // silently fail — user sees loading state cleared
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  const buyPremium = async () => {
    if (!playerId || !bpState) return;
    const cost = bpState.premiumCost;
    Alert.alert(
      "فتح الباس المميز",
      `هل تريد شراء الباس المميز مقابل ${cost} 🪙؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "شراء",
          onPress: async () => {
            setBuying(true);
            try {
              const res = await fetch(`${getApiUrl()}/api/battle-pass/${playerId}/buy-premium`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              const data = await res.json();
              if (!res.ok) {
                Alert.alert("خطأ", data.error === "insufficient_coins" ? "ليس لديك كافي عملات" : data.error);
              } else {
                if (typeof data.coins === "number") {
                  updateProfile({ coins: data.coins });
                }
                await load();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        // Update local profile state with new coin balance (always returned)
        if (typeof data.newCoins === "number") {
          updateProfile({ coins: data.newCoins });
        }
        // For non-coin rewards, also update inventory in local state
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

  if (loading) {
    return (
      <LinearGradient colors={isDark ? ["#0c0a1e", "#120b2a"] : ["#f0f4ff", "#e8f0ff"]} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#00CFFF" size="large" />
        </View>
      </LinearGradient>
    );
  }

  if (!bpState) {
    return (
      <LinearGradient colors={isDark ? ["#0c0a1e", "#120b2a"] : ["#f0f4ff", "#e8f0ff"]} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
          <Text style={{ color: theme.textPrimary, fontFamily: "Cairo_700Bold", fontSize: 16 }}>لا يوجد موسم نشط</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#00CFFF", fontFamily: "Cairo_400Regular" }}>العودة</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const { passXp, currentTier, premiumUnlocked, claimedTiers, xpPerTier, tiers, season } = bpState;
  const xpInCurrentTier = passXp % xpPerTier;
  const xpProgressPct = Math.min(1, xpInCurrentTier / xpPerTier);

  return (
    <LinearGradient
      colors={isDark ? ["#000c1a", "#001830", "#000c1a"] : ["#e8f4ff", "#d0e8ff", "#e8f4ff"]}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <LinearGradient
        colors={["#00192D", "#003060"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#00CFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>🎫 باس الموسم</Text>
          <Text style={styles.headerSub}>{season.name}</Text>
        </View>
        <View style={styles.coinsChip}>
          <Text style={styles.coinsText}>🪙 {profile.coins}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

        {/* XP Progress Card */}
        <View style={[styles.xpCard, { backgroundColor: isDark ? "#001830" : "#d0e8ff", borderColor: "#00CFFF30" }]}>
          <View style={styles.xpRow}>
            <Text style={[styles.xpLabel, { color: theme.textPrimary }]}>المستوى الحالي</Text>
            <Text style={[styles.xpTier, { color: "#00CFFF" }]}>المستوى {currentTier} / 30</Text>
          </View>
          <View style={[styles.xpBarBg, { backgroundColor: isDark ? "#00CFFF20" : "#a0d0e8" }]}>
            <View style={[styles.xpBarFill, { width: `${xpProgressPct * 100}%` }]} />
          </View>
          <View style={styles.xpRow}>
            {currentTier >= 30 ? (
              <>
                <Text style={[styles.xpSmall, { color: "#00CFFF" }]}>MAX ✓</Text>
                <Text style={[styles.xpSmall, { color: "#00CFFF" }]}>الحد الأقصى مكتمل!</Text>
              </>
            ) : (
              <>
                <Text style={[styles.xpSmall, { color: theme.textMuted }]}>{xpInCurrentTier} / {xpPerTier} XP</Text>
                <Text style={[styles.xpSmall, { color: theme.textMuted }]}>متبقي: {xpPerTier - xpInCurrentTier} XP</Text>
              </>
            )}
          </View>
          <Text style={[styles.xpTotal, { color: theme.textMuted }]}>إجمالي XP: {passXp} | فوز: +20 XP • لعبة: +10 XP</Text>
        </View>

        {/* Premium Banner */}
        {!premiumUnlocked ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={buyPremium}
            style={{ marginHorizontal: 16, marginBottom: 12 }}
            disabled={buying}
          >
            <LinearGradient
              colors={["#7B2D00", "#D4500A", "#7B2D00"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.premiumBanner}
            >
              <Text style={{ fontSize: 22 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitle}>فعّل الباس المميز</Text>
                <Text style={styles.premiumSub}>احصل على مكافآت المسار المميز لكامل الموسم</Text>
              </View>
              {buying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.premiumCostChip}>
                  <Text style={styles.premiumCostText}>🪙 {bpState.premiumCost}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={["#1a4d00", "#2e7d00"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.premiumBanner, { marginHorizontal: 16, marginBottom: 12 }]}
          >
            <Text style={{ fontSize: 22 }}>✅</Text>
            <Text style={styles.premiumTitle}>الباس المميز مفعّل</Text>
          </LinearGradient>
        )}

        {/* Tier Rows */}
        {tiers.map((tier) => {
          const reached = currentTier >= tier.tier;
          const freeKey = `${tier.tier}_free`;
          const premKey = `${tier.tier}_premium`;
          const freeClaimed = claimedTiers.includes(freeKey);
          const premClaimed = claimedTiers.includes(premKey);
          const [bg1] = tierBgColor(tier.tier);

          return (
            <View key={tier.id} style={[styles.tierRow, { backgroundColor: isDark ? bg1 : "#e8f4ff", borderColor: reached ? "#00CFFF40" : "#ffffff10" }]}>
              {/* Tier number */}
              <LinearGradient
                colors={reached ? ["#00CFFF", "#0080AA"] : ["#333", "#555"]}
                style={styles.tierNumBadge}
              >
                <Text style={styles.tierNumText}>{tier.tier}</Text>
              </LinearGradient>

              {/* Free track reward */}
              <View style={styles.rewardBlock}>
                <Text style={[styles.rewardTrackLabel, { color: theme.textMuted }]}>مجاني</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!reached || freeClaimed || claiming !== null}
                  onPress={() => claimReward(tier.tier, "free")}
                  style={[
                    styles.rewardBtn,
                    freeClaimed && styles.rewardBtnClaimed,
                    !reached && styles.rewardBtnLocked,
                    reached && !freeClaimed && { borderColor: "#00CFFF80" },
                  ]}
                >
                  {claiming === freeKey ? (
                    <ActivityIndicator color="#00CFFF" size="small" />
                  ) : (
                    <Text style={[styles.rewardBtnText, { color: freeClaimed ? "#888" : reached ? "#00CFFF" : "#555" }]}>
                      {freeClaimed ? "✓" : !reached ? "🔒" : rewardLabel(tier.freeRewardType, tier.freeRewardId, tier.freeRewardAmount)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: isDark ? "#ffffff15" : "#00000015" }]} />

              {/* Premium track reward */}
              <View style={styles.rewardBlock}>
                <Text style={[styles.rewardTrackLabel, { color: "#D4500A" }]}>مميز ⭐</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!reached || !premiumUnlocked || premClaimed || claiming !== null}
                  onPress={() => claimReward(tier.tier, "premium")}
                  style={[
                    styles.rewardBtn,
                    premClaimed && styles.rewardBtnClaimed,
                    (!reached || !premiumUnlocked) && styles.rewardBtnLocked,
                    reached && premiumUnlocked && !premClaimed && { borderColor: "#D4500A80" },
                  ]}
                >
                  {claiming === premKey ? (
                    <ActivityIndicator color="#D4500A" size="small" />
                  ) : (
                    <Text style={[styles.rewardBtnText, { color: premClaimed ? "#888" : !premiumUnlocked ? "#555" : reached ? "#D4500A" : "#555" }]}>
                      {premClaimed ? "✓" : (!reached || !premiumUnlocked) ? "🔒" : rewardLabel(tier.premiumRewardType, tier.premiumRewardId, tier.premiumRewardAmount)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#00CFFF20",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,207,255,0.12)",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 17,
    color: "#fff",
  },
  headerSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: -2,
  },
  coinsChip: {
    backgroundColor: "rgba(245,200,66,0.15)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#F5C84230",
  },
  coinsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#F5C842",
  },
  xpCard: {
    margin: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpLabel: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
  },
  xpTier: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
  },
  xpBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#00CFFF",
  },
  xpSmall: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
  },
  xpTotal: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  premiumBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  premiumTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  premiumSub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  premiumCostChip: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumCostText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#FFD700",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  tierNumBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tierNumText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  rewardBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  rewardTrackLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
  },
  rewardBtn: {
    borderWidth: 1,
    borderColor: "#ffffff20",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
  },
  rewardBtnClaimed: {
    borderColor: "#ffffff20",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rewardBtnLocked: {
    borderColor: "#ffffff10",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  rewardBtnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 40,
  },
});
