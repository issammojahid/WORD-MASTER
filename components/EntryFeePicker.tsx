import { ScaledText as Text } from "@/components/ScaledText";
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ENTRY_FEES } from "@shared/coin-entry";
import { publicQueueSize, type PublicQueueMode } from "@shared/public-game";
import { useTheme } from "@/contexts/ThemeContext";
import { RoyalSurface } from "@/components/RoyalUi";
import { GameIcon } from "@/components/GameIcon";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

const ART = {
  solo: require("../assets/fantasy-menu/online.png"),
  team: require("../assets/fantasy-menu/team-up.png"),
  four: require("../assets/fantasy-menu/four-players.png"),
};

export function EntryFeePicker({ mode, balance, fee, onSelect, disabled = false }: {
  mode: PublicQueueMode;
  balance: number | null;
  fee: number;
  onSelect: (fee: number) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const availableWidth = Math.max(0, viewportWidth || windowWidth - 40);
  const tileWidth = Math.min(340, availableWidth, Math.max(188, availableWidth * 0.76));
  const tileHeight = Math.round(Math.max(194, Math.min(260, tileWidth * 0.82)));
  const heroHeight = Math.round(Math.max(104, Math.min(152, availableWidth * 0.24)));
  const sidePadding = Math.max(0, (viewportWidth - tileWidth) / 2);
  const step = tileWidth + 12;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, ENTRY_FEES.findIndex((value) => value === fee)));

  useEffect(() => {
    const index = ENTRY_FEES.findIndex((value) => value === fee);
    if (index < 0) return;
    setActiveIndex(index);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: index * step, y: 0, animated: false }));
  }, [fee, step]);

  return (
    <View style={{ gap: 11 }}>
      <Image source={ART[mode]} style={[s.hero, { height: heroHeight }]} resizeMode="cover" />
      <View style={s.headingRow}><View style={s.headingLine} /><Ionicons name="sparkles" color="#F2C773" size={16} /><Text style={[s.title, { color: theme.textPrimary }]}>اختر قاعة اللعب</Text><Ionicons name="sparkles" color="#F2C773" size={16} /><View style={s.headingLine} /></View>

      <View style={s.carouselFrame}>
        <LinearGradient pointerEvents="none" colors={["#211536F2", "#1B1639F5", "#241540F0"]} style={StyleSheet.absoluteFill} />
        <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Path d="M-50 0L0 50 50 0 100 50 150 0M-50 50L0 100 50 50 100 100 150 50M-50 100L0 150 50 100 100 150 150 100" fill="none" stroke="#9276B4" strokeWidth=".55" opacity=".18" />
        </Svg>
        <View pointerEvents="none" style={s.frameInner} />
        <View pointerEvents="none" style={[s.frameDiamond, { top: 8, left: 9 }]} />
        <View pointerEvents="none" style={[s.frameDiamond, { top: 8, right: 9 }]} />
        <View pointerEvents="none" style={[s.frameDiamond, { bottom: 8, left: 9 }]} />
        <View pointerEvents="none" style={[s.frameDiamond, { bottom: 8, right: 9 }]} />
        <View style={s.carouselContent}>
          <View onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={step}
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={{ paddingHorizontal: sidePadding, gap: 12 }}
              onMomentumScrollEnd={(event) => {
                const index = Math.max(0, Math.min(ENTRY_FEES.length - 1, Math.round(event.nativeEvent.contentOffset.x / step)));
                setActiveIndex(index);
                const nextFee = ENTRY_FEES[index];
                if (!disabled && (balance === null || balance >= nextFee)) onSelect(nextFee);
              }}
            >
              {ENTRY_FEES.map((value) => {
                const insufficient = balance !== null && balance < value;
                const selected = value === fee;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={value + " عملة" + (insufficient ? "، رصيد غير كافٍ" : "")}
                    accessibilityState={{ checked: selected, disabled: disabled || insufficient }}
                    disabled={disabled || insufficient}
                    onPress={() => onSelect(value)}
                    style={[s.tilePressable, { width: tileWidth, opacity: insufficient ? 0.45 : 1 }, selected && s.selectedTile]}
                  >
                    <RoyalSurface selected={selected} rounded style={[s.tileSurface, { height: tileHeight, minHeight: tileHeight }]}>
                      <GameIcon name="coins" size={52} color="#EFC278" secondaryColor="#FFE2A3" />
                      <Text numberOfLines={1} adjustsFontSizeToFit style={s.tileAmount}>{value}</Text>
                      <Text numberOfLines={2} style={[s.tileUnit, { color: theme.textSecondary }]}>{insufficient ? "رصيد غير كافٍ" : "عملة"}</Text>
                      {selected ? <Ionicons name="checkmark-circle" size={23} color="#37DECB" style={s.check} /> : null}
                    </RoyalSurface>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={s.dots}>
            {ENTRY_FEES.map((value, index) => (
              <View key={value} style={[s.dot, { backgroundColor: index === activeIndex ? "#F2C773" : theme.textMuted }]} />
            ))}
          </View>
          <View style={s.swipeHint}>
            <Ionicons name="chevron-back" size={19} color="#27D5C8" />
            <Text style={[s.body, { color: theme.textSecondary }]}>اسحب يميناً أو يساراً لاختيار مبلغ آخر</Text>
            <Ionicons name="chevron-forward" size={19} color="#27D5C8" />
          </View>
        </View>
      </View>
      <RoyalSurface rounded style={s.balance}>
        <GameIcon name="coins" size={26} color="#F2C773" secondaryColor="#FFE2A3" />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={s.balanceText}>رصيدك {balance === null ? "…" : balance.toLocaleString()} عملة</Text>
      </RoyalSurface>

      {fee > 0 ? (
        <RoyalSurface rounded style={s.summary}>
          <View style={s.row}><Text style={s.gold}>{fee} عملة</Text><Text style={[s.body, { color: theme.textPrimary }]}>مبلغ الدخول لكل لاعب</Text></View>
          <View style={s.summaryDivider} />
          <View style={s.row}><Text style={s.gold}>{fee * publicQueueSize(mode)} عملة</Text><Text style={[s.body, { color: theme.textPrimary }]}>مجموع الجائزة</Text></View>
          {mode === "team" ? <Text style={[s.body, { color: theme.textSecondary }]}>نصيب كل لاعب في الفريق الفائز: {fee * 2} عملة</Text> : null}
          <Text style={[s.body, { color: theme.textMuted }]}>الجائزة تشمل الدخول · التعادل يعيد الدخول للجميع</Text>
        </RoyalSurface>
      ) : <Text style={[s.body, { color: theme.textPrimary }]}>تدريب مجاني دون مبلغ دخول</Text>}
      <Text style={[s.body, { color: theme.textMuted }]}>يُخصم مبلغ الدخول عند بدء المباراة فقط</Text>
    </View>
  );
}

const s = StyleSheet.create({
  carouselFrame: { position: "relative", width: "100%", borderRadius: 24, borderWidth: 2, borderColor: "#D2A957", paddingVertical: 10, overflow: "hidden", backgroundColor: "#211536", shadowColor: "#0D0921", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 },
  carouselContent: { gap: 8 },
  frameInner: { ...StyleSheet.absoluteFillObject, margin: 5, borderWidth: 1, borderColor: "#9C7BC355", borderRadius: 18 },
  frameDiamond: { position: "absolute", zIndex: 2, width: 11, height: 11, transform: [{ rotate: "45deg" }], borderWidth: 1.5, borderColor: "#46DACC", backgroundColor: "#D9B05B" },
  balance: { minHeight: 52, width: "100%", maxWidth: 360, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 8 },
  balanceText: { fontFamily: "Cairo_700Bold", fontSize: 17, color: "#FFE3A6" },
  hero: { height: 122, width: "100%", borderRadius: 16 },
  title: { fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "center" },
  body: { fontFamily: "Cairo_400Regular", fontSize: 11, lineHeight: 20, textAlign: "center" },
  amount: { fontFamily: "Cairo_700Bold", fontSize: 24, color: "#FFE3A6" },
  gold: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#FFE3A6" },
  tilePressable: { borderRadius: 22, shadowColor: "#2DE0D1", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 5 },
  selectedTile: { shadowOpacity: 0.55, shadowRadius: 20, elevation: 9 },
  tileSurface: { minHeight: 224, width: "100%", alignItems: "center", justifyContent: "center", gap: 7, padding: 14 },
  tileAmount: { width: "100%", fontFamily: "Cairo_700Bold", fontSize: 32, lineHeight: 44, color: "#FFE3A6", textAlign: "center" },
  tileUnit: { maxWidth: "100%", fontFamily: "Cairo_400Regular", fontSize: 13, lineHeight: 20, textAlign: "center" },
  check: { position: "absolute", top: 14, right: 14 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  headingLine: { height: 1, flex: 1, maxWidth: 52, backgroundColor: "#D5AE69" },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  summary: { width: "100%", minHeight: 120, justifyContent: "center", gap: 8, padding: 13 },
  summaryDivider: { height: 1, width: "100%", backgroundColor: "#B69BC755" },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
});
