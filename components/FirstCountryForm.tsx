import { ScaledText as Text } from "@/components/ScaledText";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COUNTRIES } from "@/lib/countries";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";

export function FirstCountryForm() {
  const { setPlayerCountry } = usePlayer();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = async (code: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await setPlayerCountry(code);
    } catch {
      setError("تعذر حفظ البلد. حاول مرة أخرى.");
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={[styles.icon, { backgroundColor: theme.card }]}>
        <Ionicons name="globe-outline" size={32} color="#42D7CF" />
      </View>
      <Text style={[styles.title, { color: theme.textPrimary }]}>اختر بلدك</Text>
      <Text style={[styles.note, { color: theme.textSecondary }]}>اختر بلدك ليظهر علمه بجانب ملفك وترتيبك</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator color="#42D7CF" /> : null}
      <FlatList
        data={COUNTRIES}
        keyExtractor={(item) => item.code}
        numColumns={2}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void choose(item.code)}
              style={[styles.country, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Text style={styles.flag}>{item.flag}</Text>
              <Text numberOfLines={1} style={[styles.countryName, { color: theme.textPrimary }]}>{item.nameAr}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: "100%", alignItems: "center", gap: 10 },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "center" },
  note: { fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center" },
  list: { width: "100%", maxHeight: 390 },
  listContent: { paddingVertical: 4 },
  cell: { width: "50%", padding: 4 },
  country: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  flag: { fontSize: 20 },
  countryName: { fontFamily: "Cairo_600SemiBold", fontSize: 12 },
  error: { color: "#FF8FA0", textAlign: "center", fontFamily: "Cairo_600SemiBold" },
});