import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Easing, Alert, Platform,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { usePlayer } from "@/contexts/PlayerContext";
import { getApiUrl } from "@/lib/query-client";

const { width: SW } = Dimensions.get("window");

const C = {
  bg: "#0A0A1A",
  card: "#12122A",
  cardBorder: "#1E1E3A",
  gold: "#F5C842",
  goldDark: "#2A2000",
  goldLight: "#F5C84240",
  cyan: "#00F5FF",
  purple: "#BF00FF",
  pink: "#FF006E",
  green: "#00FF87",
  textMain: "#E8E8FF",
  textSub: "#9898CC",
};

const VIP_BENEFITS = [
  { icon: "🪙", title: "عملات مضاعفة", desc: "احصل على ضعف العملات في كل مباراة وعجلة الحظ", color: C.gold },
  { icon: "🦁", title: "3 أزياء حصرية", desc: "العنقاء 🔥 · السلطان 👑 · السايبر 🤖", color: C.cyan },
  { icon: "🎖️", title: "لقب VIP ذهبي", desc: "لقب 'عضو VIP' المميز بالذهب", color: C.gold },
  { icon: "👑", title: "شارة التاج", desc: "تاج ذهبي بجوار اسمك في كل الغرف", color: C.pink },
  { icon: "⭐", title: "دعم المطور", desc: "ساهم في تطوير اللعبة ومحتوى جديد", color: C.purple },
];

const PARTICLES = ["👑", "⭐", "✨", "💎", "🪙", "👑", "⭐", "✨"];

export default function VipScreen() {
  const insets = useSafeAreaInsets();
  const { playerId, profile, updateProfile } = usePlayer();
  const [loading, setLoading] = useState(false);
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const isActive = profile.isVip && (!profile.vipExpiresAt || new Date(profile.vipExpiresAt) > new Date());

  const crownPulse = useRef(new Animated.Value(1)).current;
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(Math.random()))
  ).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(crownPulse, { toValue: 1.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(crownPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]).start(pulse);
    };
    pulse();

    particleAnims.forEach((anim, i) => {
      const loop = () => {
        anim.setValue(1);
        Animated.timing(anim, {
          toValue: 0,
          duration: 4000 + i * 800,
          delay: i * 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(loop);
      };
      loop();
    });
  }, []);

  const handleSubscribe = async () => {
    if (isActive) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/player/${playerId}/activate-vip`, baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: 30 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          updateProfile({
            isVip: true,
            vipExpiresAt: data.profile.vipExpiresAt,
            ownedSkins: [...new Set([...profile.ownedSkins, "vip_phoenix", "vip_sultan", "vip_cyber"])] as any,
            ownedTitles: [...new Set([...profile.ownedTitles, "vip_gold"])] as any,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("🎉 مبروك!", "تم تفعيل اشتراك VIP بنجاح!\nاستمتع بالمزايا الحصرية.");
        }
      } else {
        Alert.alert("خطأ", "تعذر تفعيل الاشتراك، حاول مرة أخرى.");
      }
    } catch {
      Alert.alert("خطأ", "تحقق من اتصال الإنترنت وحاول مرة أخرى.");
    }
    setLoading(false);
  };

  const expiryText = isActive && profile.vipExpiresAt
    ? `ينتهي: ${new Date(profile.vipExpiresAt).toLocaleDateString("ar-MA")}`
    : null;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <LinearGradient colors={["#1A0A00", "#0A0A1A", "#0A0020"]} style={StyleSheet.absoluteFillObject} />

      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {PARTICLES.map((sym, i) => (
          <Animated.Text
            key={i}
            style={{
              position: "absolute",
              left: 15 + ((i * 83) % (SW - 50)),
              fontSize: 14 + (i % 3) * 4,
              opacity: 0.12,
              transform: [{
                translateY: particleAnims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 700],
                }),
              }],
            }}
          >
            {sym}
          </Animated.Text>
        ))}
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <LinearGradient colors={[C.gold + "20", C.pink + "18"]} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="arrow-back" size={22} color={C.textMain} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>👑</Text>
          <Text style={styles.headerTitle}>الاشتراك المميز</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.crownSection}>
          <Animated.Text style={[styles.bigCrown, { transform: [{ scale: crownPulse }] }]}>
            👑
          </Animated.Text>
          <Text style={styles.vipTitle}>VIP</Text>
          <Text style={styles.vipSubtitle}>اشتراك مميز · مزايا حصرية</Text>
          {isActive && (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color={C.green} />
              <Text style={styles.activeBadgeText}>مفعّل</Text>
            </View>
          )}
          {expiryText && <Text style={styles.expiryText}>{expiryText}</Text>}
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsHeader}>مزايا الاشتراك</Text>
          {VIP_BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitCard}>
              <LinearGradient
                colors={[b.color + "15", "transparent"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <View style={styles.benefitTexts}>
                <Text style={[styles.benefitTitle, { color: b.color }]}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={isActive ? C.green : C.textSub + "40"} />
            </View>
          ))}
        </View>

        <View style={styles.priceSection}>
          <LinearGradient
            colors={[C.gold + "25", C.goldDark, C.gold + "15"]}
            style={styles.priceCard}
          >
            <View style={styles.priceBadge}>
              <Text style={styles.priceLabel}>شهري</Text>
            </View>
            <Text style={styles.priceAmount}>100 درهم</Text>
            <Text style={styles.pricePerMonth}>/ شهر</Text>
            <Text style={styles.priceSub}>يتجدد تلقائياً · إلغاء في أي وقت</Text>
          </LinearGradient>
        </View>

        <TouchableOpacity
          style={[styles.subscribeBtn, isActive && styles.subscribeBtnActive]}
          onPress={handleSubscribe}
          disabled={loading || isActive}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isActive ? [C.green + "30", C.green + "15"] : [C.gold, "#D4A017"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          {isActive ? (
            <View style={styles.subscribeBtnContent}>
              <Ionicons name="checkmark-circle" size={22} color={C.green} />
              <Text style={[styles.subscribeBtnText, { color: C.green }]}>الاشتراك مفعّل</Text>
            </View>
          ) : (
            <View style={styles.subscribeBtnContent}>
              <Text style={styles.subscribeBtnEmoji}>👑</Text>
              <Text style={styles.subscribeBtnText}>
                {loading ? "جاري التفعيل..." : "اشترك الآن"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          سيتم الخصم من حسابك في Google Play. يتجدد الاشتراك تلقائياً ما لم يتم إلغاؤه قبل 24 ساعة من تاريخ التجديد.
        </Text>
      </ScrollView>
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
  headerEmoji: { fontSize: 22 },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: C.gold },
  content: { padding: 20, paddingBottom: 40 },

  crownSection: { alignItems: "center", marginBottom: 28 },
  bigCrown: { fontSize: 72, marginBottom: 8 },
  vipTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 36, color: C.gold,
    letterSpacing: 6, textShadowColor: C.gold + "60",
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  vipSubtitle: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: C.textSub, marginTop: 4 },
  activeBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.green + "20", paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: C.green + "40",
  },
  activeBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: C.green },
  expiryText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: C.textSub, marginTop: 6 },

  benefitsSection: { marginBottom: 24 },
  benefitsHeader: {
    fontFamily: "Cairo_700Bold", fontSize: 18, color: C.textMain,
    textAlign: "center", marginBottom: 14,
  },
  benefitCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 14,
    padding: 14, marginBottom: 10, borderWidth: 1,
    borderColor: C.cardBorder, overflow: "hidden",
  },
  benefitIcon: { fontSize: 28, marginRight: 12 },
  benefitTexts: { flex: 1 },
  benefitTitle: { fontFamily: "Cairo_700Bold", fontSize: 14 },
  benefitDesc: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: C.textSub, marginTop: 2 },

  priceSection: { marginBottom: 20 },
  priceCard: {
    borderRadius: 18, padding: 24, alignItems: "center",
    borderWidth: 1, borderColor: C.gold + "40",
  },
  priceBadge: {
    backgroundColor: C.gold, paddingHorizontal: 16, paddingVertical: 4,
    borderRadius: 12, marginBottom: 12,
  },
  priceLabel: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#000" },
  priceAmount: {
    fontFamily: "Cairo_700Bold", fontSize: 32, color: C.gold,
    textShadowColor: C.gold + "40", textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  pricePerMonth: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: C.textSub, marginTop: -4 },
  priceSub: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: C.textSub + "80", marginTop: 8 },

  subscribeBtn: {
    borderRadius: 16, overflow: "hidden", marginBottom: 16,
  },
  subscribeBtnActive: { borderWidth: 1, borderColor: C.green + "40" },
  subscribeBtnContent: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  subscribeBtnEmoji: { fontSize: 22 },
  subscribeBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#000" },

  disclaimer: {
    fontFamily: "Cairo_600SemiBold", fontSize: 10, color: C.textSub + "60",
    textAlign: "center", lineHeight: 16,
  },
});
