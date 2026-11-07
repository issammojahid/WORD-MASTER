import React from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "@/components/GameUi";
import { gameDesign } from "@/constants/game-design";

export default function SplashOverlay() {
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gameDesign.gradients.app}
        locations={[0, 0.56, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.ambientGlow} />

      <View style={styles.content}>
        <Image
          source={require("@/assets/images/logo.png")}
          accessibilityLabel="شعار حروف المغرب"
          resizeMode="contain"
          style={styles.logo}
        />
        <Text style={styles.title}>حروف المغرب</Text>
        <Text style={styles.subtitle}>لعبة الكلمات العربية</Text>
        <View style={styles.loadingRow}>
          {!reduceMotion && <ActivityIndicator size="small" color={gameDesign.colors.missions} />}
          <Text style={styles.loadingLabel}>جارٍ تجهيز اللعبة...</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: gameDesign.colors.background,
  },
  ambientGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#7A39C6",
    opacity: 0.12,
    transform: [{ translateY: -30 }],
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: `${gameDesign.colors.coins}AA`,
    backgroundColor: gameDesign.colors.surface,
  },
  title: {
    marginTop: 20,
    color: gameDesign.colors.textPrimary,
    fontFamily: gameDesign.typography.fontFamily.bold,
    fontSize: 30,
    lineHeight: 42,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 2,
    color: gameDesign.colors.textSecondary,
    fontFamily: gameDesign.typography.fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  loadingRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 36,
  },
  loadingLabel: {
    color: gameDesign.colors.textSecondary,
    fontFamily: gameDesign.typography.fontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
  },
});
