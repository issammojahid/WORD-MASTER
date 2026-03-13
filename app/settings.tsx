import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  BackHandler,
  Alert,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import Colors from "@/constants/colors";
import { type Language } from "@/constants/i18n";

const LOGO = {
  cyan:   "#00D4E8",
  pink:   "#FF3D9A",
  purple: "#A855F7",
  yellow: "#F5C842",
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, soundEffects, setSoundEffects, musicEnabled, setMusicEnabled } = useLanguage();
  const [showExitModal, setShowExitModal] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleExit = () => {
    setShowExitModal(false);
    if (Platform.OS === "android") {
      BackHandler.exitApp();
    } else {
      Alert.alert("الخروج", "يمكنك الخروج من اللعبة عبر زر الإغلاق في جهازك.");
    }
  };

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Language ────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language" size={20} color={LOGO.yellow} />
            <Text style={styles.sectionTitle}>{t.language}</Text>
          </View>
          <View style={styles.optionsRow}>
            {(["ar", "en"] as Language[]).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.languageOption, language === lang && styles.languageOptionActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLanguage(lang); }}
              >
                <Text style={styles.languageFlag}>{lang === "ar" ? "🇲🇦" : "🇺🇸"}</Text>
                <Text style={[styles.languageLabel, language === lang && styles.languageLabelActive]}>
                  {lang === "ar" ? t.arabic : t.english}
                </Text>
                {language === lang && <Ionicons name="checkmark-circle" size={16} color={LOGO.yellow} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Sound Settings ──────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="volume-high" size={20} color={LOGO.cyan} />
            <Text style={styles.sectionTitle}>الصوت والموسيقى</Text>
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="musical-note" size={20} color={LOGO.cyan} />
                <View style={styles.toggleTexts}>
                  <Text style={styles.toggleTitle}>المؤثرات الصوتية</Text>
                  <Text style={styles.toggleSub}>أصوات الزر والتحذير</Text>
                </View>
              </View>
              <Switch
                value={soundEffects}
                onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSoundEffects(v); }}
                trackColor={{ false: Colors.cardBorder, true: LOGO.cyan + "80" }}
                thumbColor={soundEffects ? LOGO.cyan : Colors.textMuted}
              />
            </View>

            <View style={styles.toggleDivider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="headset" size={20} color={LOGO.purple} />
                <View style={styles.toggleTexts}>
                  <Text style={styles.toggleTitle}>الموسيقى</Text>
                  <Text style={styles.toggleSub}>موسيقى الخلفية</Text>
                </View>
              </View>
              <Switch
                value={musicEnabled}
                onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMusicEnabled(v); }}
                trackColor={{ false: Colors.cardBorder, true: LOGO.purple + "80" }}
                thumbColor={musicEnabled ? LOGO.purple : Colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* ── Game Rules ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle" size={20} color={Colors.sapphire} />
            <Text style={styles.sectionTitle}>كيفية اللعب</Text>
          </View>
          <View style={styles.rulesList}>
            {[
              { icon: "text",         text: "سيظهر حرف عشوائي باللغة العربية",    color: LOGO.yellow },
              { icon: "timer",        text: "لديك 25 ثانية لكتابة كلمة من كل فئة", color: LOGO.yellow },
              { icon: "trophy",       text: "الإجابة الصحيحة = 3 نقاط",            color: Colors.emerald },
              { icon: "copy",         text: "الإجابة المكررة = 0 نقاط",             color: Colors.scoreDuplicate },
              { icon: "close-circle", text: "الفئة الفارغة = 0 نقاط",              color: Colors.ruby },
              { icon: "star",         text: "الفائز الأول يحصل على 20 عملة",       color: LOGO.yellow },
            ].map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Ionicons name={rule.icon as any} size={18} color={rule.color} />
                <Text style={styles.ruleText}>{rule.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Coin Rewards ───────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon" size={20} color={Colors.ruby} />
            <Text style={styles.sectionTitle}>نظام النقود</Text>
          </View>
          <View style={styles.coinRulesGrid}>
            {[
              { rank: "1",  coins: "20", color: Colors.rank1 },
              { rank: "2",  coins: "15", color: Colors.rank2 },
              { rank: "3",  coins: "10", color: Colors.rank3 },
              { rank: "4+", coins: "5",  color: Colors.textMuted },
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

        {/* ── Level Rewards ──────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={20} color={LOGO.purple} />
            <Text style={styles.sectionTitle}>مكافآت المستويات</Text>
          </View>
          <View style={styles.rulesList}>
            {[
              { level: 5,  reward: "+300 عملة",            icon: "🎉" },
              { level: 10, reward: "+500 عملة",            icon: "🔥" },
              { level: 15, reward: "فتح شخصية رائد الفضاء 👨‍🚀", icon: "🚀" },
              { level: 20, reward: "+1000 عملة",           icon: "👑" },
            ].map((item, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                <Text style={styles.ruleText}>
                  <Text style={{ color: LOGO.purple, fontFamily: "Cairo_700Bold" }}>المستوى {item.level}</Text>
                  {"  →  "}{item.reward}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Exit Button ────────────────────────────── */}
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setShowExitModal(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="exit-outline" size={20} color="#fff" />
          <Text style={styles.exitBtnText}>الخروج من اللعبة</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Exit confirmation modal ─────────────────── */}
      <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>🚪</Text>
            <Text style={styles.modalTitle}>هل تريد الخروج من اللعبة؟</Text>
            <Text style={styles.modalSub}>سيتم إغلاق التطبيق</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalNo} onPress={() => setShowExitModal(false)}>
                <Text style={styles.modalNoText}>لا</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalYes} onPress={handleExit}>
                <Text style={styles.modalYesText}>نعم</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0C0A1E" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.textPrimary },
  content: { padding: 16, gap: 20, paddingBottom: 40 },

  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.textPrimary },

  optionsRow: { flexDirection: "row", gap: 10 },
  languageOption: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
    padding: 14, alignItems: "center", gap: 6, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)", flexDirection: "row", justifyContent: "center",
  },
  languageOptionActive: { borderColor: LOGO.yellow + "60", backgroundColor: LOGO.yellow + "12" },
  languageFlag: { fontSize: 20 },
  languageLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  languageLabelActive: { color: LOGO.yellow },

  toggleCard: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, justifyContent: "space-between",
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleTexts: { gap: 2 },
  toggleTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: Colors.textPrimary },
  toggleSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: Colors.textMuted },
  toggleDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 16 },

  rulesList: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1 },

  coinRulesGrid: { flexDirection: "row", gap: 10 },
  coinRuleCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
    padding: 14, alignItems: "center", gap: 8, borderWidth: 1,
  },
  coinRuleRank: { fontFamily: "Cairo_700Bold", fontSize: 18 },
  coinRuleCoins: { flexDirection: "row", alignItems: "center", gap: 3 },
  coinRuleCoinsText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: Colors.gold },

  exitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.ruby, borderRadius: 16, paddingVertical: 16,
    shadowColor: Colors.ruby, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8, marginTop: 8,
  },
  exitBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#fff" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#160D33", borderRadius: 24,
    padding: 28, alignItems: "center",
    borderWidth: 1, borderColor: LOGO.purple + "40",
  },
  modalIcon: { fontSize: 44, marginBottom: 12 },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: Colors.textPrimary, textAlign: "center", marginBottom: 6 },
  modalSub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: Colors.textMuted, marginBottom: 24 },
  modalButtons: { flexDirection: "row", gap: 12, width: "100%" },
  modalNo: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  modalNoText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: Colors.textSecondary },
  modalYes: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.ruby, alignItems: "center" },
  modalYesText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#fff" },
});
