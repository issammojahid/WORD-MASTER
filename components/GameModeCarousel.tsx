import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { gameDesign } from "@/constants/game-design";
import { GameModeIllustration } from "@/components/GameIcon";

type GameMode = {
  id: "offline" | "online";
  title: string;
  description: string;
  buttonLabel: string;
  hint: string;
  accent: string;
  onPress: () => void;
};

type GameModeCarouselProps = {
  isRTL: boolean;
  offlineTitle: string;
  offlineDescription: string;
  offlineButtonLabel: string;
  onlineTitle: string;
  onlineDescription: string;
  onlineButtonLabel: string;
  selectorLabel: string;
  swipeHint: string;
  onOfflinePress: () => void;
  onOnlinePress: () => void;
};

export function GameModeCarousel({
  isRTL,
  offlineTitle,
  offlineDescription,
  offlineButtonLabel,
  onlineTitle,
  onlineDescription,
  onlineButtonLabel,
  selectorLabel,
  swipeHint,
  onOfflinePress,
  onOnlinePress,
}: GameModeCarouselProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GameMode>>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const carouselWidth = Math.min(width - 32, 460);
  const cardWidth = Math.max(200, carouselWidth - 44);
  const stride = cardWidth + 12;
  const modes: GameMode[] = [
    {
      id: "offline",
      title: offlineTitle,
      description: offlineDescription,
      buttonLabel: offlineButtonLabel,
      hint: offlineDescription,
      accent: gameDesign.colors.offline,
      onPress: onOfflinePress,
    },
    {
      id: "online",
      title: onlineTitle,
      description: onlineDescription,
      buttonLabel: onlineButtonLabel,
      hint: onlineDescription,
      accent: gameDesign.colors.online,
      onPress: onOnlinePress,
    },
  ];

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const selectPage = (index: number) => {
    setSelectedIndex(index);
    listRef.current?.scrollToOffset({
      offset: index * stride,
      animated: !reduceMotion,
    });
  };

  const syncSelectedPage = (offset: number) => {
    setSelectedIndex(Math.max(0, Math.min(modes.length - 1, Math.round(offset / stride))));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.stage, { width: carouselWidth }]}>
        <View style={[styles.orb, styles.orbTop]} />
        <View style={[styles.orb, styles.orbBottom]} />
        <FlatList
          ref={listRef}
          data={modes}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          decelerationRate="fast"
          snapToInterval={stride}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => syncSelectedPage(event.nativeEvent.contentOffset.x)}
          getItemLayout={(_, index) => ({ length: stride, offset: index * stride, index })}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={ModeSeparator}
          contentContainerStyle={[
            styles.carouselContent,
            { paddingHorizontal: 12 },
          ]}
          style={{ width: carouselWidth, alignSelf: "center" }}
          renderItem={({ item, index }) => (
            <GameModeCard item={item} width={cardWidth} selected={index === selectedIndex} isRTL={isRTL} />
          )}
        />

        <View style={[styles.carouselFooter, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.pagination}>
            {modes.map((mode, index) => (
              <Pressable
                key={mode.id}
                accessibilityRole="button"
                accessibilityLabel={`${selectorLabel}: ${mode.title}`}
                accessibilityState={{ selected: index === selectedIndex }}
                onPress={() => selectPage(index)}
                style={styles.paginationTarget}
              >
                <View
                  style={[
                    styles.paginationDot,
                    { backgroundColor: index === selectedIndex ? "#FFFFFF" : "rgba(255,255,255,0.42)" },
                    index === selectedIndex && styles.paginationDotActive,
                  ]}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.swipeHint} numberOfLines={1}>{swipeHint}</Text>
        </View>
      </View>
    </View>
  );
}

function ModeSeparator() {
  return <View style={styles.modeSeparator} />;
}

function GameModeCard({ item, width, selected, isRTL }: { item: GameMode; width: number; selected: boolean; isRTL: boolean }) {
  const accent = item.accent;
  const buttonColors = item.id === "offline" ? gameDesign.gradients.offline : gameDesign.gradients.online;
  return (
    <View
      style={[
        styles.card,
        { width, borderColor: selected ? accent : `${accent}88` },
        Platform.OS === "web" ? styles.cardWebShadow : gameDesign.shadows.card,
      ]}
      accessible
      accessibilityLabel={`${item.title}. ${item.description}`}
    >
      <LinearGradient
        colors={["#1A1231", "#21153B", "#17112E"]}
        style={[StyleSheet.absoluteFill, styles.cardBackground]}
      />
      <View style={[styles.cardGlow, { backgroundColor: accent }]} />
      <View style={styles.cardContent}>
        <GameModeIllustration mode={item.id} size={Math.min(110, width * 0.5)} />
        <Text style={[styles.cardTitle, { color: "#FFFFFF" }]} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={1}>{item.description}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.buttonLabel}
          accessibilityHint={item.hint}
          onPress={item.onPress}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
        >
          <LinearGradient colors={[...buttonColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButtonGradient}>
            <Text style={styles.playButtonText}>{item.buttonLabel}</Text>
            <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={18} color="#17112E" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", alignItems: "center", overflow: "visible" },
  stage: {
    position: "relative",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#7A4BB8",
    backgroundColor: "#241047",
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 18px 36px rgba(6, 3, 20, 0.48)" },
      default: {
        shadowColor: gameDesign.colors.textPrimary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 8,
      },
    }),
  },
  orb: { position: "absolute", borderRadius: 999, opacity: 0.07, pointerEvents: "none" },
  orbTop: { width: 126, height: 126, top: -66, left: -38 },
  orbBottom: { width: 96, height: 96, bottom: 8, right: -44, opacity: 0.06 },
  carouselContent: { alignItems: "center" },
  modeSeparator: { width: 12 },
  card: {
    height: 204,
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#1B1433",
  },
  cardBackground: { zIndex: 0, pointerEvents: "none" },
  cardWebShadow: { boxShadow: "0 16px 34px rgba(6, 3, 20, 0.42)" },
  cardGlow: { position: "absolute", zIndex: 0, width: 128, height: 128, borderRadius: 64, top: -88, opacity: 0.16, pointerEvents: "none" },
  cardContent: { flex: 1, width: "100%", position: "relative", zIndex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  cardTitle: { fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 18, lineHeight: 26, textAlign: "center" },
  cardDescription: { color: "#E3D8EF", fontFamily: gameDesign.typography.fontFamily.regular, fontSize: 12, lineHeight: 17, textAlign: "center" },
  playButton: { width: "100%", minHeight: 44, borderRadius: 14, overflow: "hidden", marginTop: 4, borderWidth: 1, borderColor: "#FFFFFF66" },
  playButtonGradient: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  playButtonText: { color: "#17112E", fontFamily: gameDesign.typography.fontFamily.bold, fontSize: 14, lineHeight: 21 },
  playButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  carouselFooter: { alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, maxWidth: "100%" },
  pagination: { flexDirection: "row", alignItems: "center", gap: 2 },
  paginationTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  paginationDot: { width: 7, height: 7, borderRadius: 4 },
  paginationDotActive: { width: 18, borderRadius: 5 },
  swipeHint: { flexShrink: 1, color: "#D8C9EA", fontFamily: gameDesign.typography.fontFamily.semibold, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
