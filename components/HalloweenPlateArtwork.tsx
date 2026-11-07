import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { HalloweenPreviewAsset } from "@/constants/halloween-preview";

export function HalloweenPlateArtwork({ name, assetOverride, width = 240 }: { name: string; assetOverride?: HalloweenPreviewAsset; width?: number }) {
  const plate = assetOverride;
  const index = plate ? Number(plate.previewKey.slice(-2)) : 1;
  const accent = ["#BD93FF", "#FFBC5D", "#83E5C2", "#F49ED6"][index-1];
  return <View style={{width,height:width*62/240,alignItems:"center",justifyContent:"center"}}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 300 76">
        <Rect x="12" y="9" width="276" height="58" rx="20" fill="#241139" stroke={accent} strokeWidth="2" />
        <Rect x="18" y="15" width="264" height="46" rx="15" fill="none" stroke="#FFE6A5" strokeWidth="0.7" opacity="0.5" />
        <Path d="m14 23 10 15-10 15L3 38zM286 23l11 15-11 15-10-15z" fill={accent} stroke="#FFE6A5" strokeWidth="1" />
        <Path d="M122 9h56M122 67h56" stroke="#FFE6A5" strokeWidth="3" />
      </Svg>
    </View>
    <Text numberOfLines={1} style={{color:"#FFF3D8",fontFamily:"Cairo_700Bold",fontSize:width < 200 ? 12 : 20,maxWidth:width*0.78}}>{name}</Text>
  </View>;
}
