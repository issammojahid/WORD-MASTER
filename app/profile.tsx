import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, type DimensionValue } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { usePlayer, getXpProgress } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { GameHeader, GameModal, GameScreenBackground, CoinBalance, PlayerAvatar } from "@/components/GameUi";
import { HalloweenAvatar, HalloweenProfileLook, HalloweenNameplate, useHalloweenAppearance } from "@/components/HalloweenAppearance";
import { CosmeticArtwork } from "@/components/CosmeticArtwork";
import { PlayerNameForm } from "@/components/PlayerNameForm";
import { getDisplayCode, getPlayerDisplayId } from "@/lib/player-code";
import { getCountryInfo } from "@/lib/countries";
import { gameDesign } from "@/constants/game-design";
export default function ProfileScreen() {
 const {profile,playerId}=usePlayer(),{theme}=useTheme(),halloween=useHalloweenAppearance(),insets=useSafeAreaInsets();
 const [editing,setEditing]=useState(false),[copied,setCopied]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const xp=getXpProgress(profile.xp),code=getPlayerDisplayId(profile.playerTag)||getDisplayCode(profile.name,playerId,profile.playerTag),country=getCountryInfo(profile.country||"MA");
 async function copy(){await Clipboard.setStringAsync(code);setCopied(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),2000);}
 const stats=[{label:"مباريات",value:profile.gamesPlayed},{label:"انتصارات",value:profile.wins},{label:"خسارات",value:Math.max(0,profile.gamesPlayed-profile.wins)},{label:"نسبة الفوز",value:(profile.gamesPlayed?Math.round(profile.wins/profile.gamesPlayed*100):0)+"%"}];
 return <View style={{flex:1,paddingTop:Platform.OS==="web"?20:insets.top,backgroundColor:theme.background}}>
  <GameScreenBackground accent="online"/>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.background+"A8"}]}/>
  <GameHeader title="الملف الشخصي" onBack={()=>router.back()} trailing={<CoinBalance amount={halloween.commerce?halloween.coins??profile.coins:profile.coins}/>}/>
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content,{paddingBottom:Math.max(20,insets.bottom)}]}>
   <View style={s.identity}>
    {halloween.active?<HalloweenProfileLook name={profile.name} skinId={profile.equippedSkin} compact/>:<View style={s.portrait}><View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity:profile.equippedCosmetics.background==="basic_background"?0:0.3}]}><CosmeticArtwork kind="background" itemId={profile.equippedCosmetics.background} size={280} height={190}/></View><PlayerAvatar size={148} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/></View>}
    <View style={[s.badge,{backgroundColor:theme.card,borderColor:gameDesign.colors.coins}]}><Text style={s.gold}>المستوى {profile.level}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="تعديل اسم اللاعب" onPress={()=>setEditing(true)} style={s.nameRow}>
     <Ionicons name="pencil-outline" size={17} color={gameDesign.colors.coins}/>
     {halloween.active&&halloween.asset("nameplate")?<HalloweenNameplate name={profile.name}/>:<View style={s.nameWrap}>{!halloween.active&&profile.equippedCosmetics.nameplate!=="basic_nameplate"?<View pointerEvents="none" style={StyleSheet.absoluteFill}><CosmeticArtwork kind="nameplate" itemId={profile.equippedCosmetics.nameplate} size={224} height={52}/></View>:null}<Text numberOfLines={1} style={[s.name,{color:theme.textPrimary}]}>{profile.name}</Text></View>}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="نسخ معرّف اللاعب" onPress={()=>void copy()} style={s.code}><Text style={[s.codeText,{color:theme.textSecondary}]}>{copied?"تم النسخ":code}</Text><Ionicons name={copied?"checkmark-circle":"copy-outline"} size={17} color={theme.textSecondary}/></Pressable>
   </View>
   <View style={s.progress}>
    <View style={s.progressLabels}><Text style={[s.small,{color:theme.textSecondary}]}>{xp.current} / {xp.needed} نقطة خبرة</Text><Text style={s.gold}>المستوى {profile.level}</Text></View>
    <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:xp.needed,now:xp.current}} style={[s.track,{backgroundColor:theme.card}]}><LinearGradient colors={["#0B8D91","#7CE0CE"]} start={{x:0,y:0}} end={{x:1,y:0}} style={{height:"100%",width:(Math.max(0,Math.min(1,xp.progress))*100+"%") as DimensionValue}}/></View>
   </View>
   <View style={[s.stats,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>{stats.map((stat,i)=><View key={stat.label} style={[s.stat,i>0&&{borderLeftWidth:1,borderColor:theme.cardBorder}]}><Text style={[s.small,{color:theme.textSecondary}]}>{stat.label}</Text><Text style={[s.value,{color:theme.textPrimary}]}>{stat.value}</Text></View>)}</View>
   <Pressable accessibilityRole="button" accessibilityLabel="تخصيص المظهر في المتجر" onPress={()=>router.push("/store")} style={[s.custom,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>
    <View style={s.customButton}><Text style={s.customText}>تخصيص</Text></View><View style={s.customCopy}><Text style={[s.rowTitle,{color:theme.textPrimary}]}>مظهري</Text><Text style={[s.small,{color:theme.textSecondary}]}>الشخصيات والإطارات والخلفيات</Text></View>{halloween.active?<HalloweenAvatar size={47} skinId={profile.equippedSkin}/>:<PlayerAvatar size={47} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/>}
   </Pressable>
   {!halloween.active&&profile.equippedCosmetics.seasonal!=="no_seasonal"?<View style={s.ornament}><CosmeticArtwork kind="seasonal" itemId={profile.equippedCosmetics.seasonal} size={32}/><Text style={[s.small,{color:theme.textSecondary}]}>الزينة الموسمية المجهزة</Text></View>:null}
   {halloween.active&&!halloween.equipped?<Pressable accessibilityRole="button" onPress={halloween.reset} style={s.code}><Text style={s.gold}>إلغاء معاينة هالوين</Text></Pressable>:null}
   <View style={[s.footer,{borderColor:theme.cardBorder}]}><Pressable accessibilityRole="button" onPress={()=>router.push("/achievements")} style={s.footerLink}><Ionicons name="medal-outline" size={24} color={gameDesign.colors.coins}/><Text style={[s.small,{color:theme.textPrimary}]}>إنجازاتي</Text></Pressable><View style={s.footerLink}><Text style={s.flag}>{country.flag}</Text><Text style={[s.small,{color:theme.textPrimary}]}>{country.nameAr}</Text></View></View>
  </ScrollView>
  <GameModal visible={editing} onRequestClose={()=>setEditing(false)}><PlayerNameForm onSaved={()=>setEditing(false)}/><Pressable accessibilityRole="button" onPress={()=>setEditing(false)} style={s.code}><Text style={{color:theme.textSecondary}}>إلغاء</Text></Pressable></GameModal>
 </View>;
}
const s=StyleSheet.create({content:{width:"100%",maxWidth:592,alignSelf:"center",paddingHorizontal:20,gap:12},identity:{alignItems:"center",paddingTop:8,gap:2},portrait:{width:"100%",height:164,alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:30},badge:{marginTop:-16,paddingHorizontal:14,paddingVertical:3,borderWidth:1,borderRadius:15},gold:{fontFamily:"Cairo_700Bold",color:gameDesign.colors.coinsText,fontSize:12},nameRow:{minHeight:48,flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center",maxWidth:"100%"},nameWrap:{maxWidth:240,minHeight:48,justifyContent:"center",paddingHorizontal:12},name:{fontFamily:"Cairo_700Bold",fontSize:23,textAlign:"center"},code:{minHeight:36,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"},codeText:{fontSize:13,fontFamily:"Cairo_600SemiBold"},progress:{gap:7},progressLabels:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},small:{fontFamily:"Cairo_400Regular",fontSize:11,lineHeight:18},track:{height:8,borderRadius:8,overflow:"hidden"},stats:{flexDirection:"row-reverse",borderWidth:1,borderRadius:20,paddingVertical:10},stat:{flex:1,alignItems:"center",gap:3},value:{fontFamily:"Cairo_700Bold",fontSize:21},custom:{borderRadius:20,borderWidth:1,padding:12,flexDirection:"row",alignItems:"center",gap:10,minHeight:82},customCopy:{flex:1,alignItems:"flex-end"},rowTitle:{fontFamily:"Cairo_700Bold",fontSize:16},customButton:{minHeight:44,paddingHorizontal:14,borderRadius:13,backgroundColor:"#14747C",alignItems:"center",justifyContent:"center"},customText:{fontFamily:"Cairo_700Bold",color:"#FFF0CB",fontSize:13},footer:{borderTopWidth:1,flexDirection:"row",paddingTop:12},footerLink:{flex:1,minHeight:44,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"},flag:{fontSize:25},ornament:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8}});
