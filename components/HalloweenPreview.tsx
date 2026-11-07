import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  HALLOWEEN_PREVIEW_ASSETS,
  HALLOWEEN_PREVIEW_EXPECTED_COUNTS,
  isHalloweenPreviewEnabled,
} from "@/constants/halloween-preview";

// No player context, persistence, purchase/equip actions, or network requests.
export function HalloweenPreview() {
  const [expanded, setExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = HALLOWEEN_PREVIEW_ASSETS.find(asset => asset.previewKey === selectedKey);
  if (!isHalloweenPreviewEnabled(__DEV__, process.env.EXPO_PUBLIC_HALLOWEEN_PREVIEW)) return null;

  return (
    <View style={s.panel}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}>
        <Text style={s.title}>Halloween · معاينة تجريبية / Prototype</Text>
        <Text style={s.note}>{expanded ? "إخفاء / Hide" : "عرض / Show"}</Text>
      </Pressable>
      {expanded ? (
        <View style={s.content}>
          <Text style={s.note}>صور مقصوصة وثابتة، ليست أصولاً نهائية شفافة أو متحركة.</Text>
          <Text style={s.note}>Cropped, static prototypes. Frames are shown separately; victory images do not animate.</Text>
          {selected ? (
            <View style={s.content}>
              <Image source={selected.source} resizeMode="contain" accessibilityLabel={selected.label} style={s.detail} />
              <Text style={s.note}>{selected.label} · Prototype / معاينة فقط</Text>
            </View>
          ) : null}
          {HALLOWEEN_PREVIEW_ASSETS.length === 0 ? (
            <Text style={s.note}>ZIP غير متوفر محلياً / Preview ZIP not available locally. No assets imported yet.</Text>
          ) : null}
          {Object.entries(HALLOWEEN_PREVIEW_EXPECTED_COUNTS).map(([category, expected]) => (
            <View key={category} style={s.content}>
              <Text style={s.title}>{category} · {HALLOWEEN_PREVIEW_ASSETS.filter(asset => asset.category === category).length}/{expected}</Text>
              <View style={s.grid}>
                {HALLOWEEN_PREVIEW_ASSETS.filter(asset => asset.category === category).map(asset => (
                  <Pressable key={asset.previewKey} style={s.tile} accessibilityRole="button" accessibilityLabel={asset.label} accessibilityState={{ selected: selectedKey === asset.previewKey }} onPress={() => setSelectedKey(asset.previewKey)}>
                    <Image source={asset.source} resizeMode="contain" accessibilityLabel={asset.label} style={s.image} />
                    <Text style={s.note}>{asset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#D8A332", backgroundColor: "#211335", marginVertical: 12 },
  title: { color: "#FFE6A5", fontSize: 15, fontWeight: "700", flexShrink: 1 },
  note: { color: "#E4DCF2", fontSize: 13, flexShrink: 1 },
  content: { gap: 10, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: 120, gap: 6 },
  detail: { width: "100%", height: 220, backgroundColor: "#100B24" },
  image: { width: 120, height: 120, backgroundColor: "#100B24" },
});
