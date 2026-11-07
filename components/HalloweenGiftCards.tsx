import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { HALLOWEEN_ITEMS, type SeasonItem } from "@shared/halloween";
import { HALLOWEEN_PREVIEW_ASSETS } from "@/constants/halloween-preview";
import { useHalloweenAccount } from "@/contexts/HalloweenContext";
import { HalloweenFrame } from "@/components/HalloweenFrameArtwork";
import { useReducedMotion } from "@/components/GameUi";

const categories:Record<string,string>={avatar:"شخصية",frame:"إطار",background:"خلفية",victory:"تأثير"};
const gifts=HALLOWEEN_ITEMS.filter(item=>item.gift);

export function HalloweenGiftCards({ onSelectGift }: { onSelectGift?: () => void }){
 const {account,seasonActive,busy,error,act}=useHalloweenAccount();
 const [revealed,setRevealed]=useState<string[]>([]),[selected,setSelected]=useState<string|null>(null);
 if(!seasonActive||!account||account.state.giftItemId)return null;
 const allRevealed=gifts.every(item=>revealed.includes(item.id));
 const choice=gifts.find(item=>item.id===selected);
 return <View style={s.section}>
  <Text accessibilityRole="header" style={s.heading}>أربع بطاقات · هدية واحدة لك</Text>
  <Text style={s.description}>{allRevealed?"اختر الهدية التي أعجبتك، ثم أكّد اختيارك.":"اقلب البطاقات الأربع لاكتشاف الهدايا، ثم اختر إحداها."}</Text>
  <Text accessibilityLiveRegion="polite" style={s.counter}>الهدايا المكشوفة: {revealed.length} / 4</Text>
  <View style={s.grid}>{gifts.map((item,index)=><GiftCard key={item.id} item={item} index={index} revealed={revealed.includes(item.id)} selected={selected===item.id} canChoose={allRevealed&&!account.state.owned.includes(item.id)} owned={account.state.owned.includes(item.id)} busy={busy} onReveal={()=>setRevealed(previous=>previous.includes(item.id)?previous:[...previous,item.id])} onSelect={()=>setSelected(item.id)}/>)}</View>
  {choice?<View style={s.confirm} onLayout={onSelectGift}>
   <Text style={s.heading}>اختيارك: {choice.name}</Text>
   <Text style={s.description}>ستحصل على هذه الهدية مجاناً. لا يمكنك اختيار هدية بداية أخرى بعد التأكيد.</Text>
   <Pressable accessibilityRole="button" accessibilityLabel={`تأكيد هديتي ${choice.name}`} disabled={busy} onPress={()=>void act({type:"gift",itemId:choice.id})} style={[s.confirmButton,busy&&{opacity:0.5}]}><Text style={s.confirmText}>{busy?"جارٍ التأكيد…":"أكد هديتي"}</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setSelected(null)} style={s.cancel}><Text style={s.description}>تغيير الاختيار</Text></Pressable>
  </View>:allRevealed?<Text style={s.description}>اضغط على بطاقة مكشوفة لاختيارها.</Text>:null}
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
 </View>;
}

function GiftCard({item,index,revealed,selected,canChoose,owned,busy,onReveal,onSelect}:{item:SeasonItem;index:number;revealed:boolean;selected:boolean;canChoose:boolean;owned:boolean;busy:boolean;onReveal:()=>void;onSelect:()=>void}){
 const progress=useRef(new Animated.Value(revealed?1:0)).current;
 const [turning,setTurning]=useState(false);
 const reduced=useReducedMotion();
 useEffect(()=>()=>progress.stopAnimation(),[progress]);
 const asset=HALLOWEEN_PREVIEW_ASSETS.find(image=>image.previewKey===item.assetKey);
 const flip=()=>{
  if(busy||turning)return;
  if(revealed){if(canChoose)onSelect();return;}
  setTurning(true);
  if(reduced){progress.setValue(1);setTurning(false);onReveal();return;}
  Animated.timing(progress,{toValue:1,duration:620,easing:Easing.inOut(Easing.cubic),useNativeDriver:true,isInteraction:false}).start(({finished})=>{setTurning(false);if(finished)onReveal();});
 };
 return <Pressable accessibilityRole="button" accessibilityLabel={!revealed?`اقلب البطاقة ${index+1}`:canChoose?`اختر ${item.name}`:`${categories[item.category]}: ${item.name}${owned?" · مملوك":" · اقلب البطاقات المتبقية"}`} accessibilityState={{expanded:revealed,selected,disabled:busy||turning}} disabled={busy||turning} onPress={flip} style={s.cardSlot}>
  <Animated.View pointerEvents="none" aria-hidden={revealed} accessibilityElementsHidden={revealed} importantForAccessibility={revealed?"no-hide-descendants":"auto"} style={[s.face,{opacity:progress.interpolate({inputRange:[0,0.49,0.5,1],outputRange:[1,1,0,0]}),transform:[{perspective:900},{rotateY:progress.interpolate({inputRange:[0,1],outputRange:["0deg","180deg"]})}]}]}>
   <LinearGradient colors={["#41205F","#211035","#3B204D"]} style={s.back}>
    <View style={s.innerBorder}/><Text style={s.number}>0{index+1}</Text>
    <View style={s.seal}><Ionicons name="gift-outline" size={37} color="#FFE2A0"/></View>
    <Text style={s.backTitle}>هدية مخفية</Text><Text style={s.backHint}>اضغط لقلب البطاقة</Text>
    <Text style={s.stars}>✦  ✧  ✦</Text>
   </LinearGradient>
  </Animated.View>
  <Animated.View pointerEvents="none" aria-hidden={!revealed} accessibilityElementsHidden={!revealed} importantForAccessibility={!revealed?"no-hide-descendants":"auto"} style={[s.face,s.front,selected&&s.selected,{opacity:progress.interpolate({inputRange:[0,0.49,0.5,1],outputRange:[0,0,1,1]}),transform:[{perspective:900},{rotateY:progress.interpolate({inputRange:[0,1],outputRange:["180deg","360deg"]})}]}]}>
   <Text style={s.category}>{categories[item.category]}</Text>
   <View style={s.art}>{asset?(item.category==="frame"?<HalloweenFrame asset={asset} size={72}/>:<Image source={asset.source} accessibilityLabel={item.name} resizeMode={item.category==="avatar"?"cover":"contain"} style={[s.image,item.category==="avatar"&&{borderRadius:35},item.category==="background"&&{width:"100%"}]}/>):null}</View>
   <Text numberOfLines={1} style={s.itemName}>{item.name}</Text>
   <Text style={s.choose}>{owned?"مملوك بالفعل":selected?"اختيارك ✓":canChoose?"اختر هذه":revealed?"اقلب البطاقات المتبقية":"هدية مجانية"}</Text>
  </Animated.View>
 </Pressable>;
}

const s=StyleSheet.create({section:{gap:12},heading:{fontFamily:"Cairo_700Bold",fontSize:17,color:"#FFE4A2",textAlign:"center"},description:{fontFamily:"Cairo_400Regular",fontSize:12,color:"#DDCDEB",textAlign:"center",lineHeight:22},counter:{fontFamily:"Cairo_600SemiBold",fontSize:11,color:"#CEADF4",textAlign:"center"},grid:{flexDirection:"row",flexWrap:"wrap",gap:12,justifyContent:"center"},cardSlot:{width:"46%",maxWidth:250,minWidth:120,height:174},face:{...StyleSheet.absoluteFillObject,borderRadius:20,overflow:"hidden",backfaceVisibility:"hidden",borderWidth:1.5,borderColor:"#9871BE"},back:{flex:1,alignItems:"center",justifyContent:"center",gap:9},innerBorder:{position:"absolute",top:7,left:7,right:7,bottom:7,borderRadius:14,borderWidth:1,borderColor:"#D7AE6D55"},number:{position:"absolute",top:12,left:15,fontFamily:"Cairo_700Bold",fontSize:11,color:"#D6AE70"},seal:{width:66,height:66,borderRadius:33,borderWidth:1,borderColor:"#CBA270",alignItems:"center",justifyContent:"center",backgroundColor:"#251339"},backTitle:{fontFamily:"Cairo_700Bold",fontSize:15,color:"#FFE4A2"},backHint:{fontFamily:"Cairo_400Regular",fontSize:10,color:"#D2BDE1"},stars:{color:"#E3BB73",fontSize:14},front:{padding:10,alignItems:"center",justifyContent:"center",gap:6,backgroundColor:"#30203F"},selected:{borderColor:"#FFD17B",borderWidth:2.5,backgroundColor:"#43264E"},category:{fontFamily:"Cairo_600SemiBold",fontSize:11,lineHeight:18,color:"#D4B5EE"},art:{height:72,flexShrink:0,width:"100%",alignItems:"center",justifyContent:"center"},image:{width:70,height:70},itemName:{fontFamily:"Cairo_700Bold",fontSize:12,lineHeight:20,color:"#FFF0CD",maxWidth:"100%"},choose:{fontFamily:"Cairo_600SemiBold",fontSize:11,lineHeight:18,color:"#FFD17B"},confirm:{padding:16,borderRadius:18,borderWidth:1,borderColor:"#BD935A",backgroundColor:"#352040",gap:10},confirmButton:{minHeight:48,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#F2C773"},confirmText:{fontFamily:"Cairo_700Bold",fontSize:15,color:"#251339"},cancel:{minHeight:36,alignItems:"center",justifyContent:"center"},error:{fontFamily:"Cairo_400Regular",fontSize:12,color:"#FFB8C8",textAlign:"center"}});
