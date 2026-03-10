import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import Colors from "@/constants/colors";
import { MAPS, type MapId, type Language } from "@/constants/i18n";

const MAP_NAMES: Record<MapId, string> = {
  casablanca: "🏙 الدار البيضاء",
  marrakech: "🌹 مراكش",
  rabat: "🕌 الرباط",
  tangier: "⚓ طنجة",
  chefchaouen: "💙 شفشاون",
};

const MAP_DESCRIPTIONS: Record<MapId, string> = {
  casablanca: "أكبر مدن المغرب",
  marrakech: "المدينة الحمراء",
  rabat: "عاصمة المملكة",
  tangier: "بوابة أفريقيا",
  chefchaouen: "المدينة الزرقاء",
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, selectedMap, setSelectedMap } = useLanguage();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.settings}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Language section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language" size={20} color={Colors.gold} />
            <Text style={styles.sectionTitle}>{t.language}</Text>
          </View>
          <View style={styles.optionsRow}>
            {(["ar", "en"] as Language[]).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.languageOption,
                  language === lang && styles.languageOptionActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLanguage(lang);
                }}
              >
                <Text style={styles.languageFlag}>{lang === "ar" ? "🇲🇦" : "🇺🇸"}</Text>
                <Text style={[styles.languageLabel, language === lang && styles.languageLabelActive]}>
                  {lang === "ar" ? t.arabic : t.english}
                </Text>
                {language === lang && (
                  <Ionicons name="checkmark-circle" size={16} color={Colors.gold} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Map section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map" size={20} color={Colors.emerald} />
            <Text style={styles.sectionTitle}>{t.map}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>اختر مدينتك المفضلة كخلفية للعبة</Text>
          <View style={styles.mapGrid}>
            {MAPS.map((map) => {
              const active = selectedMap === map.id;
              return (
                <TouchableOpacity
                  key={map.id}
                  style={[
                    styles.mapCard,
                    active && styles.mapCardActive,
                    { borderColor: active ? map.color : Colors.cardBorder },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedMap(map.id as MapId);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.mapColorDot, { backgroundColor: map.color }]}>
                    {active && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                  </View>
                  <View style={styles.mapInfo}>
                    <Text style={[styles.mapName, active && { color: Colors.textPrimary }]}>
                      {MAP_NAMES[map.id as MapId]}
                    </Text>
                    <Text style={styles.mapDesc}>{MAP_DESCRIPTIONS[map.id as MapId]}</Text>
                  </View>
                  {active && (
                    <Ionicons name="radio-button-on" size={18} color={map.color} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Game rules */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle" size={20} color={Colors.sapphire} />
            <Text style={styles.sectionTitle}>كيفية اللعب</Text>
          </View>
          <View style={styles.rulesList}>
            {[
              { icon: "text", text: "سيظهر حرف عشوائي باللغة العربية", color: Colors.gold },
              { icon: "timer", text: "لديك 25 ثانية لكتابة كلمة من كل فئة", color: Colors.timerYellow },
              { icon: "trophy", text: "الإجابة الصحيحة = 3 نقاط", color: Colors.emerald },
              { icon: "copy", text: "الإجابة المكررة = 0 نقاط", color: Colors.scoreDuplicate },
              { icon: "close-circle", text: "الفئة الفارغة = 0 نقاط", color: Colors.ruby },
              { icon: "star", text: "الفائز الأول يحصل على 20 نقودة", color: Colors.gold },
            ].map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Ionicons name={rule.icon as any} size={18} color={rule.color} />
                <Text style={styles.ruleText}>{rule.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Score rules */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon" size={20} color={Colors.ruby} />
            <Text style={styles.sectionTitle}>نظام النقود</Text>
          </View>
          <View style={styles.coinRulesGrid}>
            {[
              { rank: "1", coins: "20", color: Colors.rank1 },
              { rank: "2", coins: "15", color: Colors.rank2 },
              { rank: "3", coins: "10", color: Colors.rank3 },
              { rank: "4+", coins: "5", color: Colors.textMuted },
            ].map((item) => (
              <View key={item.rank} style={[styles.coinRuleCard, { borderColor: item.color + "40" }]}>
                <Text style={[styles.coinRuleRank, { color: item.color }]}>#{item.rank}</Text>
                <View style={styles.coinRuleCoins}>
                  <Ionicons name="star" size={14} color={Colors.gold} />
                  <Text style={styles.coinRuleCoinsText}>{item.coins}</Text>
                </View>
              </View>
            ))}
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
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  languageOption: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flexDirection: "row",
    justifyContent: "center",
  },
  languageOptionActive: {
    borderColor: Colors.gold + "60",
    backgroundColor: Colors.gold + "10",
  },
  languageFlag: {
    fontSize: 20,
  },
  languageLabel: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  languageLabelActive: {
    color: Colors.gold,
  },
  mapGrid: {
    gap: 10,
  },
  mapCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
  },
  mapCardActive: {
    backgroundColor: Colors.backgroundTertiary,
  },
  mapColorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mapInfo: {
    flex: 1,
  },
  mapName: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  mapDesc: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  rulesList: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ruleText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  coinRulesGrid: {
    flexDirection: "row",
    gap: 10,
  },
  coinRuleCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  coinRuleRank: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
  },
  coinRuleCoins: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  coinRuleCoinsText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    color: Colors.gold,
  },
});
