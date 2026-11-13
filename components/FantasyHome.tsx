import React from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScaledText as Text } from "@/components/ScaledText";
import { usePlayer, getXpProgress } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CoinBalance, PlayerAvatar } from "@/components/GameUi";
import { GameModeCarousel } from "@/components/GameModeCarousel";
import { SeasonEventCarousel } from "@/components/SeasonEventCarousel";
import { HomeBannerAd } from "@/components/HomeBannerAd";
import { RoyalIcon } from "@/components/RoyalUi";

type QuickLink = { route: "/spin" | "/daily-challenge" | "/season" | "/clans" | "/ad-rewards"; label: string; icon: "gift" | "motion" | "scroll" | "clan" | "coins"; badge?: string };

export function FantasyHome({ onOfflinePress, onOnlinePress, hasLocalProfileError, onPreviewSeasonEvents }: { onOfflinePress:()=>void; onOnlinePress:()=>void; hasLocalProfileError:boolean; onPreviewSeasonEvents?:()=>void }) {
 const { profile } = usePlayer();
 const { t, isRTL } = useLanguage();
 const { width, height } = useWindowDimensions();
 const xp = getXpProgress(profile.xp);
 const compact = width < 500 && height < 740;
 const stageHeight = Math.min(width < 700 ? 430 : 560, Math.max(compact ? 370 : width < 700 ? 390 : 480, width * (width < 700 ? 1.04 : 0.78)));
 const stageTop = width < 500 ? 101 : width < 700 ? 112 : 136;
 const modeTop = stageTop + (width < 700 ? 12 : 14);
 const showAdDesign = (__DEV__ && Platform.OS === "web") || process.env.EXPO_PUBLIC_UI_PREVIEW_MODE === "1";
 const canPreviewSeasonEvents = __DEV__ || process.env.EXPO_PUBLIC_UI_PREVIEW_MODE === "1";
 const quickLinksLeft: QuickLink[] = [
  { route: "/spin", label: isRTL ? "هدية اليوم" : "Daily gift", icon: "gift", badge: isRTL ? "جاهز" : "Ready" },
  { route: "/daily-challenge", label: isRTL ? "تحدي اليوم" : "Daily challenge", icon: "motion" },
  { route: "/season", label: isRTL ? "أحداث" : "Events", icon: "scroll" },
 ];
 const quickLinksRight: QuickLink[] = [
  { route: "/clans", label: isRTL ? "العشائر" : "Clans", icon: "clan" },
  { route: "/ad-rewards", label: isRTL ? "مكافآت الإعلانات" : "Ad rewards", icon: "coins" },
 ];
 const openQuickLink = (item: QuickLink) => router.push(item.route === "/ad-rewards" && showAdDesign ? { pathname: "/ad-rewards", params: { preview: "ads" } } : item.route);

 return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
  <View style={s.content}>
   {hasLocalProfileError ? <Text accessibilityRole="alert" style={s.warning}>{isRTL ? "تعذّر تحميل بعض البيانات المحفوظة. أعد فتح اللعبة للمحاولة من جديد." : "Some saved data could not be loaded. Reopen the game to retry."}</Text> : null}

   <View style={[s.hud,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t.settings} onPress={()=>router.push("/settings")} style={s.utilityButton}><RoyalIcon name="settings" size={25}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={isRTL?"الإشعارات":"Notifications"} onPress={()=>router.push({pathname:"/friends",params:{section:"notifications"}})} style={s.utilityButton}>
     <RoyalIcon name="bell" size={25}/>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={isRTL?"الأصدقاء":"Friends"} onPress={()=>router.push("/friends")} style={s.utilityButton}><Ionicons name="people" size={25} color="#C99CF2"/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${t.coins}: ${profile.coins}`} accessibilityHint={t.dailyLoginReward} onPress={()=>router.push("/spin")} style={s.coins}><CoinBalance amount={profile.coins} label={t.coins} compact/><Ionicons name="add-circle" size={19} color="#4BE2D1"/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${profile.name}, ${t.level} ${profile.level}`} onPress={()=>router.push("/profile")} style={s.profile}>
     <PlayerAvatar size={38} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/>
     <View style={s.profileCopy}><Text numberOfLines={1} style={s.level}>{t.level} {profile.level}</Text><View style={s.miniTrack}><View style={[s.miniFill,{width:`${Math.max(0,Math.min(1,xp.progress))*100}%`}]}/></View></View>
    </Pressable>
   </View>

   <View style={[s.stage,{height:stageHeight}]}>
    <Image source={require("../assets/ui-2027/royal-courtyard.png")} accessibilityLabel={isRTL?"ساحة خيالية مغربية":"Fantasy Moroccan courtyard"} resizeMode="cover" fadeDuration={0} style={s.stageImage}/>
    <LinearGradient pointerEvents="none" colors={["#11102A10","#17102D23","#17102DF0"]} locations={[0,.45,1]} style={StyleSheet.absoluteFill}/>
    <View style={[s.brand,{width:width<500?78:96,height:width<500?78:96}]} accessibilityLabel={isRTL?"شعار حروف المغرب":"Horof Morocco game logo"}>
     <Image source={require("../assets/images/logo-transparent.png")} accessibilityLabel={isRTL?"شعار حروف المغرب":"Horof Morocco game logo"} resizeMode="contain" fadeDuration={0} style={s.brandLogo}/>
    </View>
    <View pointerEvents="none" style={s.stageSparkle}><Ionicons name="sparkles" size={22} color="#F5CF7D"/></View>

    <View pointerEvents="box-none" style={[s.quickRail,s.quickRailLeft,{top:stageTop+25}]}>
     {quickLinksLeft.map((item,index)=><Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>openQuickLink(item)} style={[s.quickLink,index===1&&s.quickOffset]}>
      <View style={s.quickIcon}><RoyalIcon name={item.icon} size={31}/>{item.badge?<Text numberOfLines={1} style={s.quickBadge}>{item.badge}</Text>:null}</View>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9} maxFontSizeMultiplier={1.2} style={s.quickLabel}>{item.label}</Text>
     </Pressable>)}
    </View>
    <View pointerEvents="box-none" style={[s.quickRail,s.quickRailRight,{top:stageTop+68}]}>
     {quickLinksRight.map(item=><Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>openQuickLink(item)} style={s.quickLink}>
      <View style={s.quickIcon}><RoyalIcon name={item.icon} size={31}/></View>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9} maxFontSizeMultiplier={1.2} style={s.quickLabel}>{item.label}</Text>
     </Pressable>)}
    </View>

    <View style={[s.modeSection,{top:modeTop,width:"100%"}]}>
     <GameModeCarousel homeCompact isRTL={isRTL} offlineTitle={t.offlineMode} offlineDescription={t.playOfflineHint} offlineButtonLabel={t.playOffline} onlineTitle={t.onlineMode} onlineDescription={t.onlineModeHint} onlineButtonLabel={t.playOnline} selectorLabel={t.chooseGameMode} swipeHint={isRTL?"اسحب لاختيار طريقة اللعب":t.swipeToChooseMode} onOfflinePress={onOfflinePress} onOnlinePress={onOnlinePress} onTeamPress={()=>router.push("/team-up")} onFourPress={()=>router.push("/four-players")} onFriendsPress={()=>router.push("/private-room")}/>
    </View>
   </View>

   <View style={s.lower}>
    <Pressable accessibilityRole="button" accessibilityLabel={isRTL?"المستوى والتقدم":"Level and progress"} onPress={()=>router.push("/profile")} style={s.progressCard}>
     <View style={s.progressMedal}><Ionicons name="ribbon" size={26} color="#F4C869"/></View>
     <View style={s.progressCopy}><View style={s.progressHeading}><Text style={s.progressTitle}>{isRTL?"المستوى التالي":"Next level"}</Text><Text style={s.nextLevel}>{profile.level+1}</Text></View><View style={s.xpTrack}><LinearGradient colors={["#18B9BB","#74E2D0"]} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.xpFill,{width:`${Math.max(0,Math.min(1,xp.progress))*100}%`}]}/></View><Text style={s.xpText}>{xp.current} / {xp.needed} XP</Text></View>
    </Pressable>
    <View style={s.eventsOffset}><SeasonEventCarousel/></View>
    {canPreviewSeasonEvents && onPreviewSeasonEvents ? <Pressable accessibilityRole="button" onPress={onPreviewSeasonEvents} style={s.seasonPreviewButton}><Text style={s.seasonPreviewText}>معاينة نوافذ الأحداث القادمة</Text></Pressable> : null}
    <HomeBannerAd/>
   </View>
  </View>
 </ScrollView>;
}

export function FantasyHomeDock({ bottomInset = 0, pathname = "/" }: { bottomInset?: number; pathname?: string }){
 const {isRTL,t}=useLanguage();
 const tabs=[{route:"/leaderboard" as const,icon:"podium" as const,label:isRTL?"الترتيب":"Rank"},{route:"/tasks" as const,icon:"tasks" as const,label:t.missions},{route:"/" as const,icon:"home" as const,label:isRTL?"الرئيسية":"Home"},{route:"/achievements" as const,icon:"trophy" as const,label:t.achievements},{route:"/store" as const,icon:"store" as const,label:isRTL?"المتجر":"Store"}];
 return <View accessibilityRole="tablist" accessibilityLabel="التنقل الرئيسي" style={[s.dock,{flexDirection:isRTL?"row-reverse":"row",paddingBottom:Math.max(5,bottomInset)}]}>{tabs.map(tab=><Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected:tab.route===pathname}} aria-selected={tab.route===pathname} onPress={()=>{if(tab.route!==pathname){if(tab.route==="/")router.replace("/");else router.push(tab.route);}}} style={[s.dockTab,tab.route===pathname&&s.homeTab,tab.route==="/"&&s.centerTab]}><RoyalIcon name={tab.icon} size={tab.route==="/"?40:29}/><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2} style={[s.dockText,tab.route===pathname&&s.dockTextSelected]}>{tab.label}</Text></Pressable>)}</View>;
}

const s=StyleSheet.create({
 scroll:{flexGrow:1,alignItems:"center",paddingBottom:10},content:{width:"100%",maxWidth:620},
 hud:{height:54,paddingHorizontal:12,gap:7,alignItems:"center",justifyContent:"space-between",zIndex:2,backgroundColor:"#19142C",borderBottomWidth:1,borderColor:"#795C85"},
 utilityButton:{width:38,height:38,borderRadius:20,borderWidth:1,borderColor:"#967744",backgroundColor:"#2E1E3D",alignItems:"center",justifyContent:"center",position:"relative"},
 coins:{minHeight:38,minWidth:91,maxWidth:134,paddingHorizontal:8,borderRadius:20,borderWidth:1,borderColor:"#D6B36E",backgroundColor:"#33213F",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,flexShrink:1},
 profile:{minHeight:42,flex:1,maxWidth:126,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:5,paddingVertical:3,borderRadius:24,borderWidth:1,borderColor:"#D6B36E",backgroundColor:"#33213F"},profileCopy:{flex:1,gap:2,minWidth:0},level:{fontFamily:"Cairo_700Bold",fontSize:10,lineHeight:14,color:"#FFF0D6"},miniTrack:{height:5,borderRadius:4,overflow:"hidden",backgroundColor:"#1C102A",borderWidth:.5,borderColor:"#9C7550"},miniFill:{height:"100%",backgroundColor:"#3DD8CD"},
 stage:{width:"100%",overflow:"hidden",backgroundColor:"#21153B"},stageImage:{position:"absolute",top:0,left:0,width:"100%",height:"100%"},brand:{position:"absolute",top:9,left:10,alignItems:"center",justifyContent:"center",zIndex:1},brandLogo:{width:"100%",height:"100%"},stageSparkle:{position:"absolute",left:"48%",top:45},
 quickRail:{position:"absolute",width:62,zIndex:2,alignItems:"center",gap:7},quickRailLeft:{left:3},quickRailRight:{right:3},quickLink:{width:62,minHeight:63,alignItems:"center",justifyContent:"center",paddingVertical:2},quickOffset:{marginTop:1},quickIcon:{width:43,height:43,borderRadius:22,borderWidth:1,borderColor:"#B58C52",backgroundColor:"#362344E8",alignItems:"center",justifyContent:"center",overflow:"visible"},quickBadge:{position:"absolute",top:-6,right:-7,maxWidth:38,paddingHorizontal:4,borderRadius:7,overflow:"hidden",backgroundColor:"#148777",borderWidth:1,borderColor:"#EAD083",fontFamily:"Cairo_700Bold",fontSize:7,lineHeight:12,color:"#FFF4D5",textAlign:"center"},quickLabel:{fontFamily:"Cairo_700Bold",fontSize:11,lineHeight:14,color:"#FFE6AE",textAlign:"center",textShadowColor:"#130D26",textShadowRadius:3,textShadowOffset:{width:0,height:1}},
 modeSection:{position:"absolute",left:0,right:0,zIndex:1},lower:{paddingHorizontal:12,gap:10,paddingBottom:10,marginTop:-2},progressCard:{minHeight:56,flexDirection:"row",alignItems:"center",gap:10,borderRadius:17,borderWidth:1.2,borderColor:"#B38C57",paddingHorizontal:12,paddingVertical:7,backgroundColor:"#282044E8"},progressMedal:{width:33,height:36,alignItems:"center",justifyContent:"center"},progressCopy:{flex:1,gap:2},progressHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},progressTitle:{fontFamily:"Cairo_700Bold",fontSize:11,color:"#F3DFB3"},xpTrack:{height:8,borderRadius:5,overflow:"hidden",backgroundColor:"#1C102B",borderWidth:1,borderColor:"#BA975D"},xpFill:{height:"100%",borderRadius:5},xpText:{fontFamily:"Cairo_400Regular",fontSize:8,lineHeight:11,color:"#D6C2DE",textAlign:"center"},nextLevel:{fontFamily:"Cairo_700Bold",fontSize:17,lineHeight:22,color:"#F6CB78",paddingHorizontal:4},
 seasonPreviewButton:{alignSelf:"center",borderWidth:1,borderColor:"#7E68A0",borderRadius:12,paddingHorizontal:14,paddingVertical:7,backgroundColor:"#2D2047"},seasonPreviewText:{fontFamily:"Cairo_600SemiBold",fontSize:11,color:"#D6C2DE",textAlign:"center"},
 eventsOffset:{marginTop:8},
 warning:{margin:12,padding:10,borderRadius:12,backgroundColor:"#622947",color:"#FFE4EB",fontFamily:"Cairo_400Regular",fontSize:12},
 dock:{width:"100%",maxWidth:620,alignSelf:"center",minHeight:72,borderTopLeftRadius:22,borderTopRightRadius:22,borderWidth:1.5,borderBottomWidth:0,borderColor:"#C5A061",backgroundColor:"#2D193C",paddingHorizontal:5,paddingTop:5,marginBottom:0,alignItems:"stretch",gap:3},dockTab:{flex:1,minWidth:0,paddingHorizontal:2,paddingVertical:4,alignItems:"center",justifyContent:"center",gap:0,borderRadius:14,minHeight:58},centerTab:{transform:[{translateY:-9}],minHeight:66,borderTopLeftRadius:20,borderTopRightRadius:20},homeTab:{backgroundColor:"#146A73",borderWidth:1,borderColor:"#E9C780"},dockText:{fontFamily:"Cairo_600SemiBold",fontSize:9,lineHeight:13,textAlign:"center",alignSelf:"stretch",color:"#D2BBDC"},dockTextSelected:{color:"#FFF0CB"},
});
