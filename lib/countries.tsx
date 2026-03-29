import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

const CYAN = "#00F5FF";

export const COUNTRIES: { code: string; flag: string; nameAr: string }[] = [
  { code: "MA", flag: "🇲🇦", nameAr: "المغرب" },
  { code: "DZ", flag: "🇩🇿", nameAr: "الجزائر" },
  { code: "TN", flag: "🇹🇳", nameAr: "تونس" },
  { code: "EG", flag: "🇪🇬", nameAr: "مصر" },
  { code: "LY", flag: "🇱🇾", nameAr: "ليبيا" },
  { code: "SA", flag: "🇸🇦", nameAr: "السعودية" },
  { code: "AE", flag: "🇦🇪", nameAr: "الإمارات" },
  { code: "KW", flag: "🇰🇼", nameAr: "الكويت" },
  { code: "QA", flag: "🇶🇦", nameAr: "قطر" },
  { code: "BH", flag: "🇧🇭", nameAr: "البحرين" },
  { code: "OM", flag: "🇴🇲", nameAr: "عمان" },
  { code: "JO", flag: "🇯🇴", nameAr: "الأردن" },
  { code: "LB", flag: "🇱🇧", nameAr: "لبنان" },
  { code: "SY", flag: "🇸🇾", nameAr: "سوريا" },
  { code: "IQ", flag: "🇮🇶", nameAr: "العراق" },
  { code: "YE", flag: "🇾🇪", nameAr: "اليمن" },
  { code: "SD", flag: "🇸🇩", nameAr: "السودان" },
  { code: "MR", flag: "🇲🇷", nameAr: "موريتانيا" },
  { code: "SO", flag: "🇸🇴", nameAr: "الصومال" },
  { code: "DJ", flag: "🇩🇯", nameAr: "جيبوتي" },
  { code: "FR", flag: "🇫🇷", nameAr: "فرنسا" },
  { code: "ES", flag: "🇪🇸", nameAr: "إسبانيا" },
  { code: "DE", flag: "🇩🇪", nameAr: "ألمانيا" },
  { code: "IT", flag: "🇮🇹", nameAr: "إيطاليا" },
  { code: "GB", flag: "🇬🇧", nameAr: "بريطانيا" },
  { code: "US", flag: "🇺🇸", nameAr: "أمريكا" },
  { code: "CA", flag: "🇨🇦", nameAr: "كندا" },
  { code: "BE", flag: "🇧🇪", nameAr: "بلجيكا" },
  { code: "NL", flag: "🇳🇱", nameAr: "هولندا" },
  { code: "TR", flag: "🇹🇷", nameAr: "تركيا" },
];

export function getCountryInfo(code: string): { flag: string; nameAr: string } {
  return COUNTRIES.find((c) => c.code === code) ?? { flag: "🌍", nameAr: code };
}

export function CountryPickerModal({ visible, onClose, onSelect, currentCode }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
  currentCode: string;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: (theme as any).modalBg ?? theme.card }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>اختر بلدك 🌍</Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(item) => item.code}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              const active = item.code === currentCode;
              return (
                <TouchableOpacity
                  style={[styles.countryBtn, active && { borderColor: CYAN + "AA", backgroundColor: CYAN + "14" }]}
                  onPress={() => { onSelect(item.code); onClose(); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text
                    style={[styles.countryName, { color: active ? CYAN : ((theme as any).textSecondary ?? theme.textPrimary) }]}
                    numberOfLines={1}
                  >
                    {item.nameAr}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={14} color={CYAN} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.card }]} onPress={onClose}>
            <Text style={[styles.closeBtnText, { color: theme.textPrimary }]}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "80%" },
  handle: { width: 40, height: 4, backgroundColor: "#444", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "center", marginBottom: 16 },
  countryBtn: {
    flex: 1, margin: 5, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    padding: 10, alignItems: "center", flexDirection: "row", gap: 6, backgroundColor: "rgba(255,255,255,0.04)",
  },
  countryFlag: { fontSize: 22 },
  countryName: { fontFamily: "Cairo_600SemiBold", fontSize: 12, flex: 1 },
  closeBtn: { marginTop: 8, borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  closeBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15 },
});
