import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer, SKINS, type SkinId } from "@/contexts/PlayerContext";
import Colors from "@/constants/colors";

const SKIN_DESCRIPTIONS: Record<SkinId, { ar: string; en: string }> = {
  student: { ar: "زي الطالب الكلاسيكي", en: "Classic student attire" },
  djellaba: { ar: "الزي المغربي التقليدي", en: "Traditional Moroccan robe" },
  sport: { ar: "الزي الرياضي العصري", en: "Modern sports outfit" },
  champion: { ar: "زي البطل المنتصر", en: "Champion victory outfit" },
};

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { profile, purchaseSkin, equipSkin } = usePlayer();
  const [selectedSkin, setSelectedSkin] = useState<SkinId | null>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSkinAction = (skinId: SkinId) => {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return;

    if (profile.ownedSkins.includes(skinId)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      equipSkin(skinId);
    } else {
      if (profile.coins < skin.price) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t.notEnoughCoins, `تحتاج ${skin.price} نقود`);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        t.buy + " " + (language === "ar" ? t["skin" + skinId.charAt(0).toUpperCase() + skinId.slice(1) as keyof typeof t] : skin.id),
        `هل تريد شراء هذا الزي مقابل ${skin.price} نقود؟`,
        [
          { text: t.cancel, style: "cancel" },
          {
            text: t.buy,
            onPress: () => {
              const success = purchaseSkin(skinId);
              if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ]
      );
    }
  };

  const getSkinLabel = (skinId: SkinId): string => {
    const map: Record<SkinId, string> = {
      student: t.skinStudent,
      djellaba: t.skinDjellaba,
      sport: t.skinSport,
      champion: t.skinChampion,
    };
    return map[skinId];
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.shop}</Text>
        <View style={styles.coinsBadge}>
          <Ionicons name="star" size={14} color={Colors.gold} />
          <Text style={styles.coinsText}>{profile.coins}</Text>
        </View>
      </View>

      {/* Preview card */}
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>زيّك الحالي</Text>
        {(() => {
          const current = SKINS.find((s) => s.id === profile.equippedSkin) || SKINS[0];
          return (
            <View style={styles.previewContent}>
              <View style={[styles.previewAvatarCircle, { backgroundColor: current.color + "33" }]}>
                <Text style={styles.previewEmoji}>{current.emoji}</Text>
              </View>
              <View>
                <Text style={styles.previewName}>{getSkinLabel(current.id)}</Text>
                <View style={styles.equippedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={Colors.emerald} />
                  <Text style={styles.equippedText}>{t.equipped}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>

      <ScrollView
        contentContainerStyle={styles.shopGrid}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>الأزياء المتاحة</Text>
        <View style={styles.grid}>
          {SKINS.map((skin) => {
            const owned = profile.ownedSkins.includes(skin.id);
            const equipped = profile.equippedSkin === skin.id;
            const canAfford = profile.coins >= skin.price;

            return (
              <TouchableOpacity
                key={skin.id}
                style={[
                  styles.skinCard,
                  equipped && styles.skinCardEquipped,
                  selectedSkin === skin.id && styles.skinCardSelected,
                  !owned && !canAfford && styles.skinCardLocked,
                ]}
                onPress={() => {
                  setSelectedSkin(skin.id);
                  handleSkinAction(skin.id);
                }}
                activeOpacity={0.85}
              >
                {/* Lock overlay */}
                {!owned && !canAfford && (
                  <View style={styles.lockedOverlay}>
                    <Ionicons name="lock-closed" size={20} color={Colors.textMuted} />
                  </View>
                )}

                {/* Equipped badge */}
                {equipped && (
                  <View style={styles.equippedOverlay}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.emerald} />
                  </View>
                )}

                <View style={[styles.skinAvatarCircle, { backgroundColor: skin.color + "33" }]}>
                  <Text style={styles.skinEmoji}>{skin.emoji}</Text>
                </View>
                <Text style={styles.skinName}>{getSkinLabel(skin.id)}</Text>
                <Text style={styles.skinDesc}>
                  {SKIN_DESCRIPTIONS[skin.id][language as "ar" | "en"]}
                </Text>

                <View style={styles.skinPriceRow}>
                  {owned ? (
                    <View style={[styles.skinAction, { backgroundColor: equipped ? Colors.emerald + "22" : Colors.card }]}>
                      <Text style={[styles.skinActionText, { color: equipped ? Colors.emerald : Colors.textSecondary }]}>
                        {equipped ? t.equipped : t.equip}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.skinAction, { backgroundColor: canAfford ? Colors.gold + "22" : Colors.cardBorder }]}>
                      <Ionicons name="star" size={12} color={canAfford ? Colors.gold : Colors.textMuted} />
                      <Text style={[styles.skinActionText, { color: canAfford ? Colors.gold : Colors.textMuted }]}>
                        {skin.price}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* How to earn coins */}
        <View style={styles.earnCoinsCard}>
          <Text style={styles.earnCoinsTitle}>كيف تكسب النقود؟</Text>
          <View style={styles.earnCoinsRow}>
            <View style={[styles.rankBadge, { backgroundColor: Colors.rank1 + "22" }]}>
              <Text style={[styles.rankBadgeText, { color: Colors.rank1 }]}>1</Text>
            </View>
            <Text style={styles.earnCoinsText}>المركز الأول = 20 نقود</Text>
          </View>
          <View style={styles.earnCoinsRow}>
            <View style={[styles.rankBadge, { backgroundColor: Colors.rank2 + "22" }]}>
              <Text style={[styles.rankBadgeText, { color: Colors.rank2 }]}>2</Text>
            </View>
            <Text style={styles.earnCoinsText}>المركز الثاني = 15 نقود</Text>
          </View>
          <View style={styles.earnCoinsRow}>
            <View style={[styles.rankBadge, { backgroundColor: Colors.rank3 + "22" }]}>
              <Text style={[styles.rankBadgeText, { color: Colors.rank3 }]}>3</Text>
            </View>
            <Text style={styles.earnCoinsText}>المركز الثالث = 10 نقود</Text>
          </View>
          <View style={styles.earnCoinsRow}>
            <View style={[styles.rankBadge, { backgroundColor: Colors.card }]}>
              <Text style={[styles.rankBadgeText, { color: Colors.textMuted }]}>+</Text>
            </View>
            <Text style={styles.earnCoinsText}>باقي المراكز = 5 نقود</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: Colors.textPrimary,
  },
  coinsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  coinsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.gold,
  },
  previewCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  previewLabel: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
    textAlign: "center",
  },
  previewContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    justifyContent: "center",
  },
  previewAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  previewEmoji: {
    fontSize: 32,
  },
  previewName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  equippedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  equippedText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    color: Colors.emerald,
  },
  shopGrid: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 14,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  skinCard: {
    width: "47%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: "relative",
  },
  skinCardEquipped: {
    borderColor: Colors.emerald + "60",
    backgroundColor: Colors.emerald + "08",
  },
  skinCardSelected: {
    borderColor: Colors.gold + "60",
  },
  skinCardLocked: {
    opacity: 0.7,
  },
  lockedOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
  equippedOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
  skinAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  skinEmoji: {
    fontSize: 34,
  },
  skinName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  skinDesc: {
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 10,
  },
  skinPriceRow: {
    width: "100%",
  },
  skinAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  skinActionText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
  },
  earnCoinsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  earnCoinsTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  earnCoinsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  rankBadgeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
  },
  earnCoinsText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
