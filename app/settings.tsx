import React, { useState, useEffect } from "react";
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
  TextInput,
  Share,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import Colors from "@/constants/colors";
import { type Language } from "@/constants/i18n";
import { getDisplayCode } from "@/lib/player-code";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

const LOGO = {
  cyan:   "#00F5FF",
  pink:   "#FF006E",
  purple: "#BF00FF",
  yellow: "#F5C842",
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, soundEffects, setSoundEffects, musicEnabled, setMusicEnabled } = useLanguage();
  const { playerId, profile, addCoins } = usePlayer();
  const { theme } = useTheme();
  const [showExitModal, setShowExitModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [refCopied, setRefCopied] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [refClaiming, setRefClaiming] = useState(false);
  const [refAlreadyClaimed, setRefAlreadyClaimed] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const myDisplayCode = getDisplayCode(profile.name, playerId, profile.playerTag);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(myDisplayCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleExit = () => {
    setShowExitModal(false);
    if (Platform.OS === "android") {
      BackHandler.exitApp();
    } else {
      Alert.alert("الخروج", "يمكنك الخروج من اللعبة عبر زر الإغلاق في جهازك.");
    }
  };

  useEffect(() => {
    if (!playerId) return;
    (async () => {
      try {
        const url = new URL(`/api/referral/${playerId}`, getApiUrl());
        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setReferralCode(data.referralCode || "");
          setReferralCount(data.referralCount || 0);
          if (data.referredBy) setRefAlreadyClaimed(true);
        }
      } catch {}
    })();
  }, [playerId]);

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
  };

  const handleShareReferral = async () => {
    if (!referralCode) return;
    try {
      await Share.share({ message: `انضم لحروف المغرب واستخدم كود الإحالة: ${referralCode} واحصل على 100 عملة مجاناً! 🎁` });
    } catch {}
  };

  const handleClaimReferral = async () => {
    if (!refInput.trim() || refClaiming) return;
    setRefClaiming(true);
    try {
      const url = new URL("/api/referral/claim", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, referralCode: refInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        addCoins(data.reward);
        setRefAlreadyClaimed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("مبروك! 🎉", `حصلت على ${data.reward} عملة مجاناً!`);
      } else if (data.error === "already_claimed") {
        setRefAlreadyClaimed(true);
        Alert.alert("", "لقد استخدمت كود إحالة من قبل");
      } else if (data.error === "invalid_code") {
        Alert.alert("", "كود الإحالة غير صالح");
      } else if (data.error === "self_referral") {
        Alert.alert("", "لا يمكنك استخدام كودك الخاص");
      }
    } catch {
      Alert.alert("", "حدث خطأ، حاول مرة أخرى");
    }
    setRefClaiming(false);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient
        colors={["#0A0E1A", "#0D1526", "#0A0E1A"]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <LinearGradient
            colors={[LOGO.pink + "20", LOGO.purple + "18"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>⚙️</Text>
          <Text style={styles.headerTitle}>{t.settings}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Player Code ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="id-card" size={20} color={LOGO.pink} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>كود اللاعب</Text>
          </View>
          <TouchableOpacity style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={handleCopyCode} activeOpacity={0.7}>
            <Text style={styles.codeValue}>{myDisplayCode}</Text>
            <View style={styles.codeCopyBtn}>
              <Ionicons name={codeCopied ? "checkmark-circle" : "copy-outline"} size={18} color={codeCopied ? Colors.emerald : theme.textMuted} />
              <Text style={[styles.codeCopyText, { color: theme.textMuted }, codeCopied && { color: Colors.emerald }]}>
                {codeCopied ? "تم النسخ" : "نسخ"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Referral System ──────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="gift" size={20} color={Colors.emerald} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>نظام الإحالة</Text>
          </View>
          <View style={[styles.refCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.refLabel, { color: theme.textMuted }]}>كود الإحالة الخاص بك:</Text>
            <View style={styles.refCodeRow}>
              {referralCode ? (
                <Text style={styles.refCodeValue}>{referralCode}</Text>
              ) : (
                <ActivityIndicator size="small" color={Colors.gold} />
              )}
              <TouchableOpacity onPress={handleCopyReferral} style={styles.refCopyBtn}>
                <Ionicons name={refCopied ? "checkmark-circle" : "copy-outline"} size={18} color={refCopied ? Colors.emerald : theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareReferral} style={styles.refShareBtn}>
                <Ionicons name="share-social" size={18} color={LOGO.cyan} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.refStats, { color: theme.textMuted }]}>
              عدد الإحالات: {referralCount} · مكافأة: 100 عملة لكل إحالة
            </Text>
          </View>

          {!refAlreadyClaimed && (
            <View style={[styles.refInputCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.refLabel, { color: theme.textMuted }]}>هل لديك كود إحالة؟</Text>
              <View style={styles.refInputRow}>
                <TextInput
                  style={[styles.refTextInput, { color: theme.textPrimary, backgroundColor: theme.inputBg || "#0A0A1A", borderColor: theme.cardBorder }]}
                  placeholder="أدخل كود الإحالة..."
                  placeholderTextColor={theme.textMuted}
                  value={refInput}
                  onChangeText={setRefInput}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.refClaimBtn, !refInput.trim() && { opacity: 0.5 }]}
                  onPress={handleClaimReferral}
                  disabled={!refInput.trim() || refClaiming}
                >
                  {refClaiming ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.refClaimBtnText}>تفعيل</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Language ────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language" size={20} color={LOGO.yellow} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{t.language}</Text>
          </View>
          <View style={styles.optionsRow}>
            {(["ar", "en"] as Language[]).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.languageOption, { backgroundColor: theme.card, borderColor: theme.cardBorder }, language === lang && styles.languageOptionActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLanguage(lang); }}
              >
                <Text style={styles.languageFlag}>{lang === "ar" ? "🇲🇦" : "🇺🇸"}</Text>
                <Text style={[styles.languageLabel, { color: theme.textSecondary }, language === lang && styles.languageLabelActive]}>
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
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>الصوت والموسيقى</Text>
          </View>

          <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="musical-note" size={20} color={LOGO.cyan} />
                <View style={styles.toggleTexts}>
                  <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>المؤثرات الصوتية</Text>
                  <Text style={[styles.toggleSub, { color: theme.textMuted }]}>أصوات الزر والتحذير</Text>
                </View>
              </View>
              <Switch
                value={soundEffects}
                onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSoundEffects(v); }}
                trackColor={{ false: theme.cardBorder, true: LOGO.cyan + "80" }}
                thumbColor={soundEffects ? LOGO.cyan : theme.textMuted}
              />
            </View>

            <View style={[styles.toggleDivider, { backgroundColor: theme.cardBorder }]} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="headset" size={20} color={LOGO.purple} />
                <View style={styles.toggleTexts}>
                  <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>الموسيقى</Text>
                  <Text style={[styles.toggleSub, { color: theme.textMuted }]}>موسيقى الخلفية</Text>
                </View>
              </View>
              <Switch
                value={musicEnabled}
                onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMusicEnabled(v); }}
                trackColor={{ false: theme.cardBorder, true: LOGO.purple + "80" }}
                thumbColor={musicEnabled ? LOGO.purple : theme.textMuted}
              />
            </View>
          </View>
        </View>

        {/* ── Game Rules ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle" size={20} color={Colors.sapphire} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>كيفية اللعب</Text>
          </View>
          <View style={[styles.rulesList, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {([
              { icon: "text" as const,         text: "سيظهر حرف عشوائي باللغة العربية",    color: LOGO.yellow },
              { icon: "timer" as const,        text: "لديك 25 ثانية لكتابة كلمة من كل فئة", color: LOGO.yellow },
              { icon: "trophy" as const,       text: "الإجابة الصحيحة = 3 نقاط",            color: Colors.emerald },
              { icon: "copy" as const,         text: "الإجابة المكررة = 0 نقاط",             color: Colors.scoreDuplicate },
              { icon: "close-circle" as const, text: "الفئة الفارغة = 0 نقاط",              color: Colors.ruby },
              { icon: "star" as const,         text: "الفائز الأول يحصل على 20 عملة",       color: LOGO.yellow },
            ]).map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Ionicons name={rule.icon} size={18} color={rule.color} />
                <Text style={[styles.ruleText, { color: theme.textSecondary }]}>{rule.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Coin Rewards ───────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon" size={20} color={Colors.ruby} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>نظام النقود</Text>
          </View>
          <View style={styles.coinRulesGrid}>
            {[
              { rank: "1",  coins: "20", color: Colors.rank1 },
              { rank: "2",  coins: "15", color: Colors.rank2 },
              { rank: "3",  coins: "10", color: Colors.rank3 },
              { rank: "4+", coins: "5",  color: theme.textMuted },
            ].map((item) => (
              <View key={item.rank} style={[styles.coinRuleCard, { borderColor: item.color + "40", backgroundColor: theme.card }]}>
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
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>مكافآت المستويات</Text>
          </View>
          <View style={[styles.rulesList, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {[
              { level: 5,  reward: "+300 عملة",            icon: "🎉" },
              { level: 10, reward: "+500 عملة",            icon: "🔥" },
              { level: 15, reward: "فتح شخصية رائد الفضاء 👨‍🚀", icon: "🚀" },
              { level: 20, reward: "+1000 عملة",           icon: "👑" },
            ].map((item, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                <Text style={[styles.ruleText, { color: theme.textSecondary }]}>
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
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.modalBg }]}>
            <Text style={styles.modalIcon}>🚪</Text>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>هل تريد الخروج من اللعبة؟</Text>
            <Text style={[styles.modalSub, { color: theme.textMuted }]}>سيتم إغلاق التطبيق</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalNo, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => setShowExitModal(false)}>
                <Text style={[styles.modalNoText, { color: theme.textSecondary }]}>لا</Text>
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
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF" },
  content: { padding: 16, gap: 20, paddingBottom: 40 },

  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#E8E8FF" },

  codeCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  codeValue: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.gold },
  codeCopyBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  codeCopyText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#5A5A88" },

  optionsRow: { flexDirection: "row", gap: 10 },
  languageOption: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
    padding: 14, alignItems: "center", gap: 6, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)", flexDirection: "row", justifyContent: "center",
  },
  languageOptionActive: { borderColor: LOGO.yellow + "60", backgroundColor: LOGO.yellow + "12" },
  languageFlag: { fontSize: 20 },
  languageLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#9898CC" },
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
  toggleTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#E8E8FF" },
  toggleSub: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88" },
  toggleDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 16 },

  rulesList: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleText: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#9898CC", flex: 1 },

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
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#E8E8FF", textAlign: "center", marginBottom: 6 },
  modalSub: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#5A5A88", marginBottom: 24 },
  modalButtons: { flexDirection: "row", gap: 12, width: "100%" },
  modalNo: {
    flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  modalNoText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#9898CC" },
  modalYes: { flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 16, backgroundColor: Colors.ruby, alignItems: "center" },
  modalYesText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#fff" },
  refCard: {
    borderRadius: 14, padding: 16, gap: 10,
    borderWidth: 1, backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)",
  },
  refLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#5A5A88" },
  refCodeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  refCodeValue: { fontFamily: "Cairo_700Bold", fontSize: 18, color: Colors.emerald },
  refCopyBtn: { padding: 6 },
  refShareBtn: { padding: 6 },
  refStats: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#5A5A88" },
  refInputCard: {
    borderRadius: 14, padding: 16, gap: 10, marginTop: 10,
    borderWidth: 1, backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)",
  },
  refInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  refTextInput: {
    flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 14,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  refClaimBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.emerald,
  },
  refClaimBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#000" },
});
