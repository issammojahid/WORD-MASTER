import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { usePlayer, getXpProgress } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CoinBalance, PlayerAvatar } from "@/components/GameUi";
import { GameModeCarousel } from "@/components/GameModeCarousel";
import { HalloweenEntry } from "@/components/HalloweenEconomy";
import { HomeBannerAd } from "@/components/HomeBannerAd";

export function FantasyHome({ onOfflinePress, onOnlinePress, hasLocalProfileError }: { onOfflinePress:()=>void; onOnlinePress:()=>void; hasLocalProfileError:boolean }) {
 const { profile } = usePlayer();
 const { t, isRTL } = useLanguage();
 const { width, height } = useWindowDimensions();
 const xp = getXpProgress(profile.xp);
 const compact = width < 500 && height < 740;
 const heroHeight = compact ? Math.min(210, (width - 32) * 0.55) : Math.min(320, (width - 32) * 0.72);
 return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
  <View style={s.content}>
   {hasLocalProfileError ? <Text accessibilityRole="alert" style={s.warning}>{isRTL ? "تعذّر تحميل بعض البيانات المحفوظة. أعد فتح اللعبة للمحاولة من جديد." : "Some saved data could not be loaded. Reopen the game to retry."}</Text> : null}
   <View style={[s.hud,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${profile.name}, ${t.level} ${profile.level}`} onPress={()=>router.push("/profile")} style={s.profile}>
     <PlayerAvatar size={37} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/>
     <View style={s.profileCopy}><Text style={s.level}>{t.level} {profile.level}</Text><View style={s.miniTrack}><View style={[s.miniFill,{width:`${Math.max(0,Math.min(1,xp.progress))*100}%`}]} /></View></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${t.coins}: ${profile.coins}`} accessibilityHint={t.dailyLoginReward} onPress={()=>router.push("/spin")} style={s.coins}><CoinBalance amount={profile.coins} label={t.coins}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t.settings} onPress={()=>router.push("/settings")} style={s.settings}><Ionicons name="settings" size={23} color="#E4C080"/></Pressable>
   </View>
   <View style={[s.hero,{height:heroHeight}]}>
    <Image source={require("../assets/fantasy-menu/hero.png")} accessibilityLabel={isRTL?"عالم حروف المغرب الخيالي":"The fantasy world of Horof Morocco"} resizeMode="cover" style={s.heroImage}/>
    <LinearGradient colors={["#160D2700","#180C2700","#180C27"]} locations={[0,0.68,1]} style={StyleSheet.absoluteFill}/>
    <View style={s.brand}>
     <Svg width="100%" height="100%" viewBox="0 0 200 180" style={StyleSheet.absoluteFill}><Path d="M100 4 121 22h38l9 21 25 18-8 29 8 29-25 18-9 21h-38l-21 18-21-18H41l-9-21L7 119l8-29-8-29 25-18 9-21h38z" fill="#342044" stroke="#E5B967" strokeWidth="3"/><Path d="m100 12 18 17h36l8 20 23 15-8 26 8 26-23 15-8 20h-36l-18 17-18-17H46l-8-20-23-15 8-26-8-26 23-15 8-20h36z" fill="none" stroke="#8C5D9D" strokeWidth="1"/></Svg>
     <Ionicons name="sparkles" size={16} color="#F5D180"/><View accessibilityRole="header" accessibilityLabel={isRTL?"حروف المغرب":"Horof Morocco"} style={{width:"100%"}}>{(isRTL?["حروف","المغرب"]:["Horof","Morocco"]).map(word=><Text key={word} maxFontSizeMultiplier={1.2} adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={[s.brandTitle,{fontSize:width<360?24:width<500?28:34}]}>{word}</Text>)}</View><Text maxFontSizeMultiplier={1.2} style={s.brandTag}>{isRTL?"كل حرف، مغامرة":"Every letter, an adventure"}</Text>
    </View>
   </View>
   <View style={s.modeSection}>
    <GameModeCarousel isRTL={isRTL} offlineTitle={t.offlineMode} offlineDescription={t.playOfflineHint} offlineButtonLabel={t.playOffline} onlineTitle={t.onlineMode} onlineDescription={t.onlineModeHint} onlineButtonLabel={t.playOnline} selectorLabel={t.chooseGameMode} swipeHint={isRTL?"اسحب لاختيار طريقة اللعب":t.swipeToChooseMode} onOfflinePress={onOfflinePress} onOnlinePress={onOnlinePress} onTeamPress={()=>router.push("/team-up")} onFourPress={()=>router.push("/four-players")} onFriendsPress={()=>router.push("/private-room")}/>
   </View>
   <View style={s.lower}><HalloweenEntry/>
    <Pressable accessibilityRole="button" accessibilityLabel={isRTL?"المستوى والتقدم":"Level and progress"} onPress={()=>router.push("/profile")} style={s.progressCard}>
     <Ionicons name="ribbon" size={31} color="#EFC67D"/>
     <View style={s.progressCopy}><Text style={s.progressTitle}>{isRTL?"المستوى التالي":"Your next level"}</Text><View style={s.xpTrack}><LinearGradient colors={["#18B9BB","#74E2D0"]} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.xpFill,{width:`${Math.max(0,Math.min(1,xp.progress))*100}%`}]}/></View><Text style={s.xpText}>{xp.current} / {xp.needed} XP</Text></View>
     <Text style={s.nextLevel}>{profile.level+1}</Text>
    </Pressable>
    <View style={s.shortcuts}>
     {([{route:"/daily-challenge",icon:"flash-outline",label:isRTL?"تحدي اليوم":"Daily challenge"},{route:"/friends",icon:"people-outline",label:isRTL?"الأصدقاء":"Friends"},{route:"/clans",icon:"shield-outline",label:isRTL?"العشائر":"Clans"},{route:"/friends",icon:"notifications-outline",label:isRTL?"الإشعارات":"Notifications",section:"notifications"}] as const).map(item=><Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>router.push("section" in item?{pathname:item.route,params:{section:item.section}}:item.route)} style={s.shortcut}><Ionicons name={item.icon} size={20} color="#D7B5EB"/><Text style={s.shortcutText}>{item.label}</Text></Pressable>)}
    </View>
    <HomeBannerAd/>
   </View>
  </View>
 </ScrollView>;
}

export function FantasyHomeDock({ bottomInset = 0, pathname = "/" }: { bottomInset?: number; pathname?: string }){
 const {isRTL,t}=useLanguage();
 const tabs=[{route:"/" as const,icon:"home" as const,label:isRTL?"الرئيسية":"Home"},{route:"/tasks" as const,icon:"clipboard-outline" as const,label:t.missions},{route:"/achievements" as const,icon:"trophy-outline" as const,label:t.achievements},{route:"/store" as const,icon:"storefront-outline" as const,label:isRTL?"المتجر":"Store"}];
 return <View accessibilityRole="tablist" style={[s.dock,{flexDirection:isRTL?"row-reverse":"row",paddingBottom:Math.max(5,bottomInset)}]}>{tabs.map(tab=><Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected:tab.route===pathname}} aria-selected={tab.route===pathname} onPress={()=>{if(tab.route!==pathname){if(tab.route==="/")router.replace("/");else router.push(tab.route);}}} style={[s.dockTab,tab.route===pathname&&s.homeTab]}><Ionicons name={tab.icon} size={26} color={tab.route===pathname?"#FFE6A2":"#CFABDA"}/><Text maxFontSizeMultiplier={1.3} style={[s.dockText,tab.route===pathname&&{color:"#FFF0CB"}]}>{tab.label}</Text></Pressable>)}</View>;
}

const s=StyleSheet.create({
 scroll:{flexGrow:1,alignItems:"center",paddingBottom:24},content:{width:"100%",maxWidth:592},hud:{paddingHorizontal:16,gap:8,alignItems:"center",justifyContent:"space-between",zIndex:1},profile:{minHeight:49,flexDirection:"row",alignItems:"center",gap:7,flex:1,maxWidth:190,paddingHorizontal:8,paddingVertical:5,borderRadius:23,borderWidth:1.5,borderColor:"#DCB473",backgroundColor:"#36213F"},profileCopy:{flex:1,gap:5},level:{fontFamily:"Cairo_700Bold",fontSize:12,lineHeight:18,color:"#FFF0D6"},miniTrack:{height:6,borderRadius:5,overflow:"hidden",backgroundColor:"#1C102A",borderWidth:0.5,borderColor:"#9C7550"},miniFill:{height:"100%",backgroundColor:"#3DD8CD"},coins:{paddingHorizontal:9,minHeight:44,borderRadius:23,borderWidth:1.5,borderColor:"#D9B073",backgroundColor:"#36213F",justifyContent:"center"},settings:{width:42,height:44,borderRadius:15,borderWidth:1.5,borderColor:"#CFA96E",backgroundColor:"#36213F",alignItems:"center",justifyContent:"center"},hero:{marginTop:6,overflow:"hidden"},heroImage:{position:"absolute",top:0,left:0,width:"100%",height:"100%"},brand:{position:"absolute",top:20,left:14,width:"43%",maxWidth:216,aspectRatio:1.11,alignItems:"center",justifyContent:"center",padding:12,gap:2},brandTitle:{fontFamily:"Cairo_700Bold",fontSize:34,textAlign:"center",color:"#FFE2A0",textShadowColor:"#160A25",textShadowOffset:{width:0,height:3},textShadowRadius:3},brandTag:{position:"absolute",bottom:-18,left:0,right:0,fontFamily:"Cairo_600SemiBold",fontSize:9,color:"#E9CFA9",textAlign:"center"},modeSection:{marginTop:-20,zIndex:1,paddingHorizontal:4},lower:{paddingHorizontal:16,gap:2},progressCard:{minHeight:76,flexDirection:"row",alignItems:"center",gap:12,borderRadius:23,borderWidth:1.5,borderColor:"#B38C57",padding:12,backgroundColor:"#34213F",marginTop:8},progressCopy:{flex:1,gap:5},progressTitle:{fontFamily:"Cairo_700Bold",fontSize:13,color:"#F3DFB3",textAlign:"center"},xpTrack:{height:9,borderRadius:6,overflow:"hidden",backgroundColor:"#1C102B",borderWidth:1,borderColor:"#BA975D"},xpFill:{height:"100%",borderRadius:6},xpText:{fontFamily:"Cairo_400Regular",fontSize:9,color:"#D6C2DE",textAlign:"center"},nextLevel:{fontFamily:"Cairo_700Bold",fontSize:21,color:"#F6CB78",minWidth:28,textAlign:"center"},shortcuts:{flexDirection:"row",flexWrap:"wrap",gap:8,marginVertical:12,justifyContent:"center"},shortcut:{minWidth:100,flex:1,minHeight:54,alignItems:"center",justifyContent:"center",gap:4,borderRadius:15,borderWidth:1,borderColor:"#75517E",backgroundColor:"#281A37"},shortcutText:{fontFamily:"Cairo_600SemiBold",fontSize:10,color:"#E5D7EC"},warning:{margin:12,padding:10,borderRadius:12,backgroundColor:"#622947",color:"#FFE4EB",fontFamily:"Cairo_400Regular",fontSize:12},dock:{width:"100%",maxWidth:592,alignSelf:"center",minHeight:74,borderRadius:24,borderWidth:1.5,borderColor:"#C5A061",backgroundColor:"#2D193C",padding:5,marginBottom:6,alignItems:"stretch",gap:4},dockTab:{flex:1,minWidth:0,paddingHorizontal:2,paddingVertical:5,alignItems:"center",justifyContent:"center",gap:3,borderRadius:18,minHeight:60},homeTab:{backgroundColor:"#146A73",borderWidth:1,borderColor:"#E9C780"},dockText:{fontFamily:"Cairo_600SemiBold",fontSize:10,textAlign:"center",alignSelf:"stretch",color:"#D2BBDC"},
});
