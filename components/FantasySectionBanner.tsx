import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export function FantasySectionBanner({kind}:{kind:"tasks"|"achievements"|"clans"}){
 const {isRTL}=useLanguage();const {theme,isDark}=useTheme();
 const content={
  tasks:{image:require("../assets/fantasy-menu/offline.png"),title:isRTL?"كل مهمة خطوة في المغامرة":"Every task, a step in the adventure",description:isRTL?"أكمل التحديات واجمع مكافآتك":"Complete challenges and collect your rewards"},
  achievements:{image:require("../assets/fantasy-menu/online.png"),title:isRTL?"إنجازاتك تصنع الحكاية":"Your achievements tell the story",description:isRTL?"اترك بصمتك مع كل إنجاز":"Make your mark with every milestone"},
  clans:{image:require("../assets/fantasy-menu/friends.png"),title:isRTL?"معاً نصنع القوة":"Stronger together",description:isRTL?"تعاونوا مع عشيرتكم واصنعوا مجدكم":"Build your clan's story together"},
 }[kind];
 return <View style={[s.banner,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>
  <Image source={content.image} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:"100%",height:"100%",opacity:isDark?0.65:0.3}]}/>
  <LinearGradient colors={isDark?["#26143522","#261435BB","#261435F5"]:["#FFF5E055","#FFF5E0DD"]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill}/>
  <View style={s.innerBorder}/>
  <View style={[s.copy,{alignItems:isRTL?"flex-end":"flex-start"}]}><Text style={[s.title,{color:isDark?"#FFE3A6":theme.textPrimary,textAlign:isRTL?"right":"left"}]}>{content.title}</Text><Text style={[s.description,{color:theme.textSecondary,textAlign:isRTL?"right":"left"}]}>{content.description}</Text></View>
 </View>;
}
const s=StyleSheet.create({banner:{minHeight:112,marginHorizontal:16,marginTop:10,marginBottom:8,borderWidth:1.5,borderRadius:23,overflow:"hidden",justifyContent:"center"},innerBorder:{position:"absolute",top:5,left:5,right:5,bottom:5,borderWidth:1,borderColor:"#CBA47055",borderRadius:18},copy:{paddingHorizontal:20,paddingVertical:16,gap:5,paddingLeft:60},title:{fontFamily:"Cairo_700Bold",fontSize:17,lineHeight:27,textAlign:"right"},description:{fontFamily:"Cairo_400Regular",fontSize:11,lineHeight:20,textAlign:"right"}});
