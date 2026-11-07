import { HalloweenCountdown } from "@/components/HalloweenCountdown";
import React, { useEffect, useSyncExternalStore } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHalloweenAccount } from "@/contexts/HalloweenContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStartupReady } from "@/contexts/StartupContext";
import { useReducedMotion } from "@/components/GameUi";

// A launch announcement is distinct from the server-owned one-time gift.
// Dismissal neither claims a gift nor changes the player's account.
let announced = false;
let open = false;
const listeners = new Set<() => void>();
const subscribe = (listener:()=>void) => {listeners.add(listener);return ()=>{listeners.delete(listener);};};
function setOpen(value:boolean){open=value;listeners.forEach(listener=>listener());}
export function useHalloweenLaunchPopupOpen(){return useSyncExternalStore(subscribe,()=>open,()=>false);}

export function HalloweenLaunchPopup(){
 const {enabled:installed,seasonActive,account}=useHalloweenAccount();
 const enabled=installed&&seasonActive;
 const ready=useStartupReady(),visible=useHalloweenLaunchPopupOpen(),reduced=useReducedMotion();
 const {language}=useLanguage(),{height}=useWindowDimensions();
 const ar=language==="ar";
 useEffect(()=>{if(enabled&&ready&&!announced){announced=true;setOpen(true);}if(!enabled&&open)setOpen(false);},[enabled,ready]);
 const close=()=>setOpen(false);
 const enter=()=>{close();router.push("/halloween");};
 return <Modal transparent visible={enabled&&ready&&visible} animationType={reduced?"none":"fade"} onRequestClose={close}>
  <View style={s.backdrop}>
   <View accessibilityViewIsModal style={[s.card,{maxHeight:height*0.9}]}>
    <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
     <View style={s.hero}>
      <Image source={require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_01.png")} resizeMode="cover" style={s.heroImage}/>
      <LinearGradient colors={["#15092410","#211133"]} style={StyleSheet.absoluteFill}/>
      <View style={s.badge}><Text style={s.badgeText}>{ar?"موسم خاص":"SEASONAL EVENT"}</Text></View>
      <View style={s.heroCopy}><Text style={s.eyebrow}>{ar?"حروف المغرب":"HOROF MOROCCO"}</Text><Text accessibilityRole="header" style={s.title}>{ar?"موسم هالوين":"Halloween season"}</Text><Text style={s.subtitle}>{ar?"سحر جديد ومظاهر تناسب ذوقك":"A little magic. A look of your own."}</Text></View>
     </View>
     <View style={s.body}>
      <HalloweenCountdown/>
      <View style={s.feature}><Ionicons name="gift-outline" size={23} color="#FFD489"/><Text style={s.featureText}>{account?.state.giftItemId ? ar?"هديتك محفوظة — أكمل مجموعتك":"Your gift is saved — grow your collection" : ar?"اختر هدية بداية واحدة تناسب ذوقك":"Choose one free welcome gift"}</Text></View>
      <View style={s.feature}><Ionicons name="sparkles-outline" size={23} color="#CBA7FF"/><Text style={s.featureText}>{ar?"شخصيات، إطارات، خلفيات وتأثيرات متحركة":"Avatars, frames, backgrounds and animated looks"}</Text></View>
      <View style={s.feature}><Ionicons name="trophy-outline" size={23} color="#FFD489"/><Text style={s.featureText}>{ar?"جوائز المهام والإنجازات، ومتجر بعملات اللعبة":"Task and achievement rewards, plus a Coin shop"}</Text></View>
      <Pressable accessibilityRole="button" onPress={enter} style={({pressed})=>[s.enter,{opacity:pressed?0.85:1}]}><Text style={s.enterText}>{ar?"دخول موسم هالوين":"Enter Halloween season"}</Text><Ionicons name={ar?"arrow-back":"arrow-forward"} size={20} color="#271537"/></Pressable>
      <Pressable accessibilityRole="button" onPress={close} style={s.later}><Text style={s.laterText}>{ar?"لاحقاً · الموسم متاح في القائمة الرئيسية":"Later · find the season in the main menu"}</Text></Pressable>
     </View>
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel={ar?"إغلاق إعلان هالوين":"Close Halloween announcement"} onPress={close} style={s.close}><Ionicons name="close" size={22} color="#FFF2D4"/></Pressable>
   </View>
  </View>
 </Modal>;
}
const s=StyleSheet.create({backdrop:{flex:1,padding:20,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(7,3,17,0.88)"},card:{width:"100%",maxWidth:460,borderRadius:28,overflow:"hidden",backgroundColor:"#211133",borderWidth:1.5,borderColor:"#CB9D5D"},hero:{height:210,justifyContent:"flex-end"},heroImage:{position:"absolute",top:0,left:0,width:"100%",height:"100%"},badge:{position:"absolute",top:18,left:18,paddingHorizontal:12,paddingVertical:5,borderRadius:12,borderWidth:1,borderColor:"#E7B96E80",backgroundColor:"#20132AE6"},badgeText:{color:"#FFE6A5",fontFamily:"Cairo_700Bold",fontSize:11},heroCopy:{paddingHorizontal:24,paddingBottom:10,gap:2},eyebrow:{color:"#E1C2FD",fontFamily:"Cairo_600SemiBold",fontSize:11},title:{color:"#FFE7B0",fontFamily:"Cairo_700Bold",fontSize:30,lineHeight:45},subtitle:{color:"#EEE0F7",fontFamily:"Cairo_400Regular",fontSize:13},body:{padding:24,paddingTop:14,gap:16},feature:{flexDirection:"row-reverse",alignItems:"center",gap:12},featureText:{flex:1,color:"#EBDFF4",fontFamily:"Cairo_600SemiBold",fontSize:12,textAlign:"right",lineHeight:22},enter:{minHeight:52,marginTop:4,backgroundColor:"#F2C773",borderRadius:16,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12},enterText:{color:"#271537",fontFamily:"Cairo_700Bold",fontSize:16},later:{minHeight:36,alignItems:"center",justifyContent:"center"},laterText:{color:"#C5B0D6",fontFamily:"Cairo_400Regular",fontSize:11,textAlign:"center"},close:{position:"absolute",top:12,right:12,width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#180C28E6",borderWidth:1,borderColor:"#E7C49355"}});
