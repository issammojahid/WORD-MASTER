import React from "react";
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { GameModal } from "@/components/GameUi";
import { ScaledText as Text } from "@/components/ScaledText";
import type { SeasonEventId } from "@/lib/season-calendar";

const EVENT_ART: Record<SeasonEventId, { source: number; width: number; height: number }> = {
  atlas: { source: require("../assets/home-popups/event-atlas.png"), width: 305, height: 446 },
  arabic: { source: require("../assets/home-popups/event-arabic.png"), width: 248, height: 445 },
  winter: { source: require("../assets/home-popups/event-winter.png"), width: 250, height: 445 },
  gifts: { source: require("../assets/home-popups/event-gifts.png"), width: 250, height: 445 },
  newyear: { source: require("../assets/home-popups/event-newyear.png"), width: 250, height: 445 },
};

export function SeasonEventLaunchPopup({
  event,
  onDismiss,
  onOpen,
  preview,
}: {
  event: { id: SeasonEventId; title: string; dates: string } | null;
  onDismiss: () => void;
  onOpen: () => void;
  preview?: { position: number; total: number; onPrevious: () => void; onNext: () => void };
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const artwork = event ? EVENT_ART[event.id] : null;
  const width = artwork
    ? Math.max(180, Math.min(windowWidth - 80, 330, (windowHeight * 0.86 - 56) * artwork.width / artwork.height))
    : 0;
  const height = artwork ? width * artwork.height / artwork.width : 0;

  return (
    <GameModal visible={event !== null} onRequestClose={onDismiss}>
      {event && artwork ? (
        <View style={{ width, height, alignSelf: "center", overflow: "hidden", borderRadius: 17 }}>
          <Image
            accessible={false}
            source={artwork.source}
            resizeMode="stretch"
            style={{ width: "100%", height: "100%" }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`اكتشف ${event.title}`}
            accessibilityHint="يفتح صفحة الفعالية التي مدتها سارية الآن"
            onPress={onOpen}
            style={{ position: "absolute", left: "4%", bottom: "3%", width: "61%", height: "14%" }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="لاحقاً"
            onPress={onDismiss}
            style={{ position: "absolute", right: "3%", bottom: "3%", width: "32%", height: "14%" }}
          />
        </View>
      ) : null}
      {event && preview ? (
        <View style={styles.previewControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="الحدث السابق" onPress={preview.onPrevious} style={styles.previewButton}>
            <Text style={styles.previewButtonText}>السابق</Text>
          </Pressable>
          <Text style={styles.previewLabel}>معاينة فقط · {preview.position} / {preview.total}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="الحدث التالي" onPress={preview.onNext} style={styles.previewButton}>
            <Text style={styles.previewButtonText}>التالي</Text>
          </Pressable>
        </View>
      ) : null}
    </GameModal>
  );
}

const styles = StyleSheet.create({
  previewControls: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 4 },
  previewButton: { minWidth: 68, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: "#D0AC66", backgroundColor: "#34244D" },
  previewButtonText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#FFE7B3" },
  previewLabel: { flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#76E6DC", textAlign: "center" },
});
