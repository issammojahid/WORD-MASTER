import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SEASON_CATEGORIES, seasonPreviewItems, type SeasonCategory, type SeasonPreviewItem } from "@/constants/season-catalog";
import type { SeasonEventId } from "@/lib/season-calendar";
import { SeasonCatalogArtwork } from "@/components/SeasonCatalogArtwork";
import { SeasonItemPreview } from "@/components/SeasonItemPreview";
import { GameModal } from "@/components/GameUi";
import { ScaledText as Text } from "@/components/ScaledText";

export function SeasonEventPreviewCollection({ eventId }: { eventId: SeasonEventId }) {
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<SeasonCategory>("avatar");
  const [selected, setSelected] = useState<SeasonPreviewItem | null>(null);
  const allItems = seasonPreviewItems(eventId);
  const items = allItems.filter((item) => item.kind === category);
  const columns = width < 360 ? 3 : 4;
  const contentWidth = Math.min(width, 760) - 32;
  const tile = Math.max(68, (contentWidth - (columns - 1) * 8) / columns);
  const previewSize = Math.max(180, Math.min(280, width - 72));

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>محتوى الحدث</Text>
        <Text style={styles.note}>معاينة محلية فقط · لا شراء ولا استلام للمكافآت</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {SEASON_CATEGORIES.map((item) => (
          <Pressable
            key={item.kind}
            accessibilityRole="tab"
            accessibilityState={{ selected: category === item.kind }}
            onPress={() => setCategory(item.kind)}
            style={[styles.tab, category === item.kind && styles.selectedTab]}
          >
            <Text style={[styles.tabText, category === item.kind && styles.selectedTabText]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`معاينة ${item.name}`}
            onPress={() => setSelected(item)}
            style={[styles.tile, { width: tile }]}
          >
            <SeasonCatalogArtwork item={item} size={tile - 10} />
            <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemTag}>معاينة</Text>
          </Pressable>
        ))}
      </View>

      <GameModal visible={selected !== null} onRequestClose={() => setSelected(null)}>
        {selected ? (
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <View style={{ width: previewSize, height: previewSize, overflow: "hidden" }}>
              <View style={{ position: "absolute", left: (previewSize - 280) / 2, top: (previewSize - 280) / 2, transform: [{ scale: previewSize / 280 }] }}>
                <SeasonItemPreview item={selected} />
              </View>
            </View>
            <Text style={styles.note}>حركة وتصميم للمعاينة فقط</Text>
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.closeButton}>
              <Text style={styles.closeText}>إغلاق المعاينة</Text>
            </Pressable>
          </View>
        ) : null}
      </GameModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  heading: { alignItems: "flex-end", gap: 3 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 17, color: "#FFE3A6", textAlign: "right" },
  note: { fontFamily: "Cairo_400Regular", fontSize: 11, lineHeight: 17, color: "#CDB9DD", textAlign: "right" },
  tabs: { flexDirection: "row-reverse", gap: 6, paddingVertical: 2 },
  tab: { minHeight: 40, paddingHorizontal: 10, justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: "#725B88", backgroundColor: "#292043" },
  selectedTab: { backgroundColor: "#116C79", borderColor: "#38DDD0" },
  tabText: { fontFamily: "Cairo_600SemiBold", fontSize: 10, color: "#D8C8E7" },
  selectedTabText: { color: "#FFF0D6" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "flex-start", gap: 8 },
  tile: { minHeight: 132, alignItems: "center", justifyContent: "flex-start", padding: 5, borderRadius: 13, borderWidth: 1, borderColor: "#92734E", backgroundColor: "#261C3D", overflow: "hidden" },
  itemName: { width: "100%", minHeight: 28, fontFamily: "Cairo_600SemiBold", fontSize: 9, lineHeight: 14, color: "#FFF0D6", textAlign: "center" },
  itemTag: { fontFamily: "Cairo_600SemiBold", fontSize: 9, color: "#72DED5", textAlign: "center" },
  detail: { alignItems: "center", gap: 10 },
  detailTitle: { fontFamily: "Cairo_700Bold", fontSize: 19, color: "#FFE3A6", textAlign: "center" },
  closeButton: { minHeight: 44, minWidth: 150, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#38DDD0", borderRadius: 12, backgroundColor: "#116C79" },
  closeText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#FFF0D6" },
});
