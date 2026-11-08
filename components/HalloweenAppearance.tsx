import { isHalloweenSeasonActive } from "@shared/halloween-update";
import {HALLOWEEN_PROMOTIONS_ENABLED} from "@/constants/release-content";
import React, { useSyncExternalStore, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { HalloweenFrame } from "@/components/HalloweenFrameArtwork";
import { HalloweenPlateArtwork } from "@/components/HalloweenPlateArtwork";
import { AvatarArtwork } from "@/components/AvatarArtwork";
import { HalloweenMotionLayer, HalloweenMotionScene } from "@/components/HalloweenMotion";
import { HALLOWEEN_PREVIEW_ASSETS, type HalloweenPreviewAsset, type HalloweenPreviewCategory } from "@/constants/halloween-preview";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SkinId } from "@/contexts/PlayerContext";
import type { CosmeticKind } from "@shared/cosmetics";
import { HALLOWEEN_ITEMS } from "@shared/halloween";
import { useHalloweenAccount } from "@/contexts/HalloweenContext";

type Look = Partial<Record<HalloweenPreviewCategory, string>>;
let look: Look = {};
const listeners = new Set<() => void>();
const empty: Look = {};
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const enabled = () => HALLOWEEN_PROMOTIONS_ENABLED&&isHalloweenSeasonActive();
function choose(asset: HalloweenPreviewAsset, owned: boolean) {
  if (!enabled() && !owned) return;
  look = { ...look, [asset.category]: asset.previewKey };
  listeners.forEach(listener => listener());
}
function reset() { look = {}; listeners.forEach(listener => listener()); }
export function useHalloweenAppearance() {
  const commerce = useHalloweenAccount();
  const equippedSignature = JSON.stringify(commerce.account?.state.equipped ?? {});
  const previousEquipment = useRef(equippedSignature);
  useEffect(() => {
    if (previousEquipment.current !== equippedSignature) {
      previousEquipment.current = equippedSignature;
      if (commerce.enabled) reset();
    }
  }, [commerce.enabled, equippedSignature]);
  const selected = useSyncExternalStore(subscribe, () => enabled() || commerce.enabled ? look : empty, () => empty);
  const asset = (category: HalloweenPreviewCategory) => {
    const equippedId = commerce.account?.state.equipped[category];
    const equippedKey = HALLOWEEN_ITEMS.find(item => item.id === equippedId)?.assetKey;
    return HALLOWEEN_PREVIEW_ASSETS.find(item => item.previewKey === (selected[category] ?? equippedKey));
  };
  return { enabled: enabled() || commerce.enabled, active: Object.keys(selected).length > 0 || Object.keys(commerce.account?.state.equipped ?? {}).length > 0, asset, reset, equipmentKey: equippedSignature, commerce: commerce.enabled, local: commerce.account?.local, coins: commerce.account?.coins, equipped: Object.keys(selected).length === 0 && Object.keys(commerce.account?.state.equipped ?? {}).length > 0 };
}

// Transparent code-native frame artwork extends the app's existing SVG system.
// Unlike the original opaque concept crops, these rings never cover the face.

export function HalloweenAvatar({ skinId, size = 112 }: { skinId: SkinId; size?: number }) {
  const { asset } = useHalloweenAppearance();
  const avatar = asset("avatar"), frame = asset("frame");
  return <View style={{width:size,height:size,alignItems:"center",justifyContent:"center"}}>
    <View style={{width:size*0.76,height:size*0.76,borderRadius:size,overflow:"hidden",backgroundColor:"#241139"}}>
      {avatar ? <Image source={avatar.source} accessibilityLabel={avatar.label} resizeMode="cover" style={{width:"100%",height:"100%"}} /> : <AvatarArtwork skinId={skinId} size={size*0.76} />}
    </View>
    {frame ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><HalloweenMotionLayer kind="frame"><HalloweenFrame asset={frame} size={size} /></HalloweenMotionLayer></View> : null}
  </View>;
}

export function HalloweenNameplate({ name, assetOverride, width = 240 }: { name: string; assetOverride?: HalloweenPreviewAsset; width?: number }) {
  const { asset } = useHalloweenAppearance();
  return <HalloweenPlateArtwork name={name} assetOverride={assetOverride ?? asset("nameplate")} width={width} />;
}

export function HalloweenProfileLook({ name, skinId, compact = false }: { name: string; skinId: SkinId; compact?: boolean }) {
  const { asset } = useHalloweenAppearance();
  const bg=asset("background"), icon=asset("icon"), victory=asset("victory");
  return <HalloweenMotionScene style={[s.composition,compact&&{minHeight:164,padding:8,borderRadius:30}]} effects={!!victory}>
    {bg ? <HalloweenMotionLayer kind="background" style={StyleSheet.absoluteFill}><Image source={bg.source} resizeMode="cover" style={{ width: "100%", height: "100%" }} /></HalloweenMotionLayer> : null}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:"rgba(15,7,31,0.28)"}]} />
    <HalloweenMotionLayer kind="avatar"><HalloweenAvatar skinId={skinId} size={compact?148:120} /></HalloweenMotionLayer>
    {!compact && (asset("nameplate") ? <HalloweenMotionLayer kind="nameplate"><HalloweenNameplate name={name} /></HalloweenMotionLayer> : <Text style={s.name}>{name}</Text>)}
    {icon ? <HalloweenMotionLayer kind="icon" style={s.icon}><Image source={icon.source} accessibilityLabel={icon.label} style={{width:"100%",height:"100%"}} resizeMode="contain" /></HalloweenMotionLayer> : null}
    {victory ? <HalloweenMotionLayer kind="victory" style={s.victory}><Image source={victory.source} accessibilityLabel={victory.label} style={{width:"100%",height:"100%"}} resizeMode="contain" /></HalloweenMotionLayer> : null}
  </HalloweenMotionScene>;
}

export function HalloweenCategory({ kind, onSelect }: { kind: "skin" | CosmeticKind; onSelect: (asset: HalloweenPreviewAsset) => void }) {
  const appearance = useHalloweenAppearance();
  const commerce = useHalloweenAccount();
  const { language } = useLanguage();
  const ar = language === "ar";
  const [gridWidth, setGridWidth] = useState(0);
  const columns = 5;
  const cardWidth = gridWidth > 0 ? (gridWidth - (columns - 1) * 8) / columns : 120;
  const artSize = Math.max(30,Math.min(58,cardWidth-8));
  if (!appearance.enabled) return null;
  const category = kind === "skin" ? "avatar" : kind === "seasonal" ? "icon" : kind;
  const assets = HALLOWEEN_PREVIEW_ASSETS.filter(item => item.category === category && (commerce.seasonActive || commerce.account?.state.owned.some(id=>HALLOWEEN_ITEMS.some(product=>product.id===id&&product.assetKey===item.previewKey))));
  if(!assets.length)return null;
  const selected = appearance.asset(category);
  return <View style={s.section}>
    <View style={s.heading}>
      <Text style={s.headingText}>{ar ? commerce.seasonActive?"مجموعة هالوين":"مظاهري الموسمية السابقة" : "Seasonal collection"}</Text>
      {appearance.active && !appearance.equipped ? <Pressable accessibilityRole="button" onPress={appearance.reset}><Text style={s.reset}>{ar ? "إلغاء التجربة" : "Reset preview"}</Text></Pressable> : null}
    </View>
    <Text style={s.note}>{commerce.enabled ? (ar ? commerce.seasonActive ? "يمكن تجهيز العناصر المملوكة وشراء المظاهر بعملات اللعبة" : "انتهى الموسم · يمكنك تجهيز مظاهرك المكتسبة" : "Equip owned items · buy with game Coins") : ar ? "معاينة محلية للمظهر دون شراء" : "Local appearance preview · no purchase"}</Text>
    <View style={s.grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
      {assets.map((item) => <View key={item.previewKey} style={[s.card,{ width: cardWidth },selected?.previewKey===item.previewKey && s.selected]}><Pressable accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:selected?.previewKey===item.previewKey}} onPress={()=>{choose(item,!!commerce.account?.state.owned.some(id=>HALLOWEEN_ITEMS.some(product=>product.id===id&&product.assetKey===item.previewKey)));onSelect(item);}} style={{ alignItems: "center", gap: 5, width: "100%" }}>
        <View style={s.art}>
          {category === "frame" ? <HalloweenFrame asset={item} size={artSize} /> : category === "nameplate" ? <HalloweenNameplate name={ar ? "اسم اللاعب" : "Player name"} assetOverride={item} width={Math.min(124, cardWidth - 18)} /> : <Image source={item.source} accessibilityLabel={item.label} resizeMode={category==="avatar" ? "cover" : "contain"} style={[s.thumbnail,{width:artSize,height:artSize},category==="avatar" && {borderRadius:artSize/2},category==="background" && s.wide]} />}
        </View>
        <Text numberOfLines={2} style={s.itemName}>{item.label}</Text>
        <Text style={[s.action,{display:"none"}]}>{selected?.previewKey===item.previewKey ? appearance.equipped ? ar ? "مجهز ✓" : "Equipped ✓" : ar ? "قيد التجربة ✓" : "Previewing ✓" : ar ? "جرّب المظهر" : "Try this look"}</Text>
      </Pressable>
      <Text style={{fontFamily:"Cairo_700Bold",fontSize:10,color:"#FFE3A6"}}>{HALLOWEEN_ITEMS.find(product=>product.assetKey===item.previewKey)?.price??"★"}</Text>
      </View>)}
    </View>
    <Text style={s.limit}>{ar ? "الصور تجريبية بحركات عرض خفيفة. التجهيز والملكية محفوظان عند التأكيد." : "Prototype images with presentation animations. Your account is unchanged."}</Text>
  </View>;
}

const s=StyleSheet.create({
  section:{gap:12,paddingVertical:16},heading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},headingText:{fontFamily:"Cairo_700Bold",fontSize:20,color:"#FFE6A5"},reset:{fontFamily:"Cairo_600SemiBold",fontSize:12,color:"#C8B5F0"},note:{fontFamily:"Cairo_400Regular",fontSize:12,color:"#C8B5DC"},grid:{flexDirection:"row",flexWrap:"wrap",gap:8},card:{padding:3,gap:3,borderRadius:14,borderWidth:1,borderColor:"#543965",backgroundColor:"#241833",alignItems:"center"},selected:{borderColor:"#FFC46B",backgroundColor:"#392245"},art:{height:52,width:"100%",alignItems:"center",justifyContent:"center"},thumbnail:{width:92,height:92},round:{borderRadius:46},wide:{width:"100%",height:58},itemName:{fontFamily:"Cairo_600SemiBold",color:"#FFF3DD",fontSize:9,lineHeight:14,minHeight:28,textAlign:"center"},action:{fontFamily:"Cairo_700Bold",color:"#FFD489",fontSize:10,lineHeight:15},limit:{fontFamily:"Cairo_400Regular",fontSize:11,color:"#B7A5C9"},composition:{width:"100%",minHeight:250,borderRadius:24,overflow:"hidden",alignItems:"center",justifyContent:"center",padding:20,gap:8,backgroundColor:"#241139"},name:{fontFamily:"Cairo_700Bold",fontSize:22,color:"#FFF3DD"},icon:{position:"absolute",right:14,top:14,width:36,height:36},victory:{position:"absolute",left:10,bottom:10,width:56,height:56},plateSwatch:{width:"100%",height:42,borderWidth:2,borderRadius:12,backgroundColor:"#241139",alignItems:"center",justifyContent:"center"},plateText:{color:"#FFF3DD",fontFamily:"Cairo_600SemiBold",fontSize:12},
});
