import {useSeason2027} from '@/contexts/Season2027Context';
import {ScaledText as Text} from "@/components/ScaledText";
import {RoyalSurface,RoyalIcon} from "@/components/RoyalUi";
import {RoyalPortrait} from "@/components/RoyalPortrait";
import {EarnedAchievements} from "@/components/EarnedAchievements";
import React, { useEffect, useRef, useState } from "react";
import {View, StyleSheet, Pressable, ScrollView, Platform, type DimensionValue} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { usePlayer, getXpProgress } from "@/contexts/PlayerContext";
import { useTheme } from "@/contexts/ThemeContext";
import { GameHeader, GameModal, GameScreenBackground, CoinBalance, PlayerAvatar } from "@/components/GameUi";
import { HalloweenProfileLook, HalloweenNameplate, useHalloweenAppearance } from "@/components/HalloweenAppearance";
import { CosmeticArtwork } from "@/components/CosmeticArtwork";
import { PlayerNameForm } from "@/components/PlayerNameForm";
import { getDisplayCode, getPlayerDisplayId } from "@/lib/player-code";
import { getCountryInfo } from "@/lib/countries";
import { gameDesign } from "@/constants/game-design";
export default function ProfileScreen() {
 const seasons=useSeason2027();
 const {profile,playerId}=usePlayer(),{theme}=useTheme(),halloween=useHalloweenAppearance(),insets=useSafeAreaInsets();
 const [editing,setEditing]=useState(false),[copied,setCopied]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const xp=getXpProgress(profile.xp),code=getPlayerDisplayId(profile.playerTag)||getDisplayCode(profile.name,playerId,profile.playerTag),country=getCountryInfo(profile.country||"MA");
 async function copy(){await Clipboard.setStringAsync(code);setCopied(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),2000);}
 const stats=[{label:"المباريات",value:profile.gamesPlayed},{label:"الانتصارات",value:profile.wins},{label:"النقاط",value:profile.totalScore},{label:"أفضل سلسلة",value:profile.bestStreak}];
 return <View style={{flex:1,paddingTop:Platform.OS==="web"?20:insets.top,backgroundColor:theme.background}}>
  <GameScreenBackground accent="online"/>

  <GameHeader brand={false} title="الملف الشخصي" onBack={()=>router.back()} trailing={<CoinBalance amount={halloween.commerce?halloween.coins??profile.coins:profile.coins}/>}/>
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content,{paddingBottom:Math.max(20,insets.bottom)}]}>
   <View style={s.identity}>
    {halloween.active?<HalloweenProfileLook name={profile.name} skinId={profile.equippedSkin} compact/>:<View style={s.portrait}><View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity:!seasons.equipped.background&&profile.equippedCosmetics.background==="basic_background"?0:0.3}]}><CosmeticArtwork kind="background" itemId={seasons.equipped.background??profile.equippedCosmetics.background} size={280} height={190}/></View><RoyalPortrait><PlayerAvatar own size={148} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/></RoyalPortrait></View>}
    <View style={[s.badge,{backgroundColor:theme.card,borderColor:gameDesign.colors.coins}]}><Text style={s.gold}>المستوى {profile.level}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="تعديل اسم اللاعب" onPress={()=>setEditing(true)} style={s.nameRow}>
     <RoyalSurface style={{flexDirection:"row",alignItems:"center",justifyContent:"center",minHeight:44,width:"100%",padding:4}}><Ionicons name="pencil-outline" size={17} color={gameDesign.colors.coins}/>
     {halloween.active&&halloween.asset("nameplate")?<HalloweenNameplate name={profile.name}/>:<View style={s.nameWrap}>{!halloween.active&&(!!seasons.equipped.nameplate||profile.equippedCosmetics.nameplate!=="basic_nameplate")?<View pointerEvents="none" style={StyleSheet.absoluteFill}><CosmeticArtwork kind="nameplate" itemId={seasons.equipped.nameplate??profile.equippedCosmetics.nameplate} size={224} height={52}/></View>:null}<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[s.name,{color:theme.textPrimary}]}>{profile.name}</Text></View>}
    </RoyalSurface></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="نسخ معرّف اللاعب" onPress={()=>void copy()} style={s.code}><RoyalSurface style={{width:"100%",minHeight:42,paddingVertical:4,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"}}><Text style={[s.codeText,{color:theme.textSecondary}]}>{copied?"تم النسخ":code}</Text><Ionicons name={copied?"checkmark-circle":"copy-outline"} size={17} color={theme.textSecondary}/></RoyalSurface></Pressable>
   </View>
   <View style={s.progress}>
    <View style={s.progressLabels}><Text style={[s.small,{color:theme.textSecondary}]}>{xp.current} / {xp.needed} نقطة خبرة</Text><Text style={s.gold}>المستوى {profile.level}</Text></View>
    <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:xp.needed,now:xp.current}} style={[s.track,{backgroundColor:theme.card}]}><LinearGradient colors={["#0B8D91","#7CE0CE"]} start={{x:0,y:0}} end={{x:1,y:0}} style={{height:"100%",width:(Math.max(0,Math.min(1,xp.progress))*100+"%") as DimensionValue}}/></View>
   </View>
   <View style={s.stats}>{stats.map((stat,i)=><RoyalSurface key={stat.label} style={{width:"48%",minHeight:85,padding:10,flexDirection:"row-reverse",alignItems:"center",justifyContent:"center",gap:7}}><RoyalIcon name={i===0?"swords":i===1?"trophy":i===2?"coins":"quality"} size={43}/><View style={{alignItems:"center"}}><Text style={[s.small,{color:theme.textPrimary,fontFamily:"Cairo_700Bold"}]}>{stat.label}</Text><Text style={[s.value,{color:theme.textPrimary}]}>{stat.value}</Text></View></RoyalSurface>)}</View>
   <RoyalSurface style={{padding:12,gap:10}}><Text style={[s.rowTitle,{color:theme.textPrimary,textAlign:"center"}]}>✧　مظهري　✧</Text><View style={s.slots}>{([{kind:"skin",label:"الشخصية"},{kind:"frame",label:"الإطار"},{kind:"background",label:"الخلفية"},{kind:"victory",label:"تأثير الفوز"}] as const).map(slot=><Pressable key={slot.kind} accessibilityRole="button" accessibilityLabel={`تخصيص ${slot.label}`} onPress={()=>router.push({pathname:"/store",params:{category:slot.kind}})} style={[s.slot,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>{slot.kind==="skin"?<PlayerAvatar own size={46} skinId={profile.equippedSkin}/>:<CosmeticArtwork kind={slot.kind} itemId={seasons.equipped[slot.kind]??profile.equippedCosmetics[slot.kind]} size={46}/>}<Text style={[s.small,{color:theme.textPrimary}]}>{slot.label}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="تخصيص المظهر في المتجر" onPress={()=>router.push("/store")} style={{flex:1,minWidth:0,minHeight:78,alignItems:"center",justifyContent:"center",gap:4}}><RoyalIcon name="store" size={40}/><Text style={[s.small,{color:"#71EDE3"}]}>تخصيص</Text></Pressable></View></RoyalSurface>
   {!halloween.active&&(!!seasons.equipped.icon||profile.equippedCosmetics.seasonal!=="no_seasonal")?<View style={s.ornament}><CosmeticArtwork kind="seasonal" itemId={seasons.equipped.icon??profile.equippedCosmetics.seasonal} size={32}/><Text style={[s.small,{color:theme.textSecondary}]}>الزينة الموسمية المجهزة</Text></View>:null}
   {halloween.active&&!halloween.equipped?<Pressable accessibilityRole="button" onPress={halloween.reset} style={s.code}><Text style={s.gold}>إلغاء معاينة هالوين</Text></Pressable>:null}
   <EarnedAchievements/>
   <View style={[s.footer,{borderColor:theme.cardBorder}]}><Pressable accessibilityRole="button" onPress={()=>router.push("/achievements")} style={s.footerLink}><Ionicons name="medal-outline" size={24} color={gameDesign.colors.coins}/><Text style={[s.small,{color:theme.textPrimary}]}>إنجازاتي</Text></Pressable><View style={s.footerLink}><Text style={s.flag}>{country.flag}</Text><Text style={[s.small,{color:theme.textPrimary}]}>{country.nameAr}</Text></View></View>
  </ScrollView>
  <GameModal visible={editing} onRequestClose={()=>setEditing(false)}><PlayerNameForm onSaved={()=>setEditing(false)}/><Pressable accessibilityRole="button" onPress={()=>setEditing(false)} style={s.code}><Text style={{color:theme.textSecondary}}>إلغاء</Text></Pressable></GameModal>
 </View>;
}
const s=StyleSheet.create({slots:{flexDirection:"row",gap:6},slot:{flex:1,minWidth:0,borderWidth:0,borderRadius:14,padding:2,minHeight:78,alignItems:"center",justifyContent:"center",gap:4},content:{width:"100%",maxWidth:592,alignSelf:"center",paddingHorizontal:20,gap:12},identity:{alignItems:"center",paddingTop:8,gap:2},portrait:{width:"100%",height:198,alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:30},badge:{marginTop:-16,paddingHorizontal:14,paddingVertical:3,borderWidth:1,borderRadius:15},gold:{fontFamily:"Cairo_700Bold",color:gameDesign.colors.coinsText,fontSize:12},nameRow:{width:"100%",minHeight:48,flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center",maxWidth:"100%"},nameWrap:{maxWidth:240,minHeight:48,justifyContent:"center",paddingHorizontal:12},name:{fontFamily:"Cairo_700Bold",fontSize:23,textAlign:"center"},code:{width:"100%",minHeight:36,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"},codeText:{fontSize:13,fontFamily:"Cairo_600SemiBold"},progress:{gap:7},progressLabels:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},small:{fontFamily:"Cairo_400Regular",fontSize:11,lineHeight:18},track:{height:12,borderRadius:8,overflow:"hidden"},stats:{flexDirection:"row",flexWrap:"wrap",gap:10},stat:{width:"48%",minHeight:94,borderRadius:17,padding:12,alignItems:"center",justifyContent:"center",gap:6},value:{fontFamily:"Cairo_700Bold",fontSize:21},custom:{borderRadius:20,borderWidth:1,padding:12,flexDirection:"row",alignItems:"center",gap:10,minHeight:82},customCopy:{flex:1,alignItems:"flex-end"},rowTitle:{fontFamily:"Cairo_700Bold",fontSize:16},customButton:{minHeight:44,paddingHorizontal:14,borderRadius:13,backgroundColor:"#14747C",alignItems:"center",justifyContent:"center"},customText:{fontFamily:"Cairo_700Bold",color:"#FFF0CB",fontSize:13},footer:{borderTopWidth:1,flexDirection:"row",paddingTop:12},footerLink:{flex:1,minHeight:44,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"},flag:{fontSize:25},ornament:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8}});
