import {ScaledText as Text} from "@/components/ScaledText";
import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {usePlayer,getXpProgress} from '@/contexts/PlayerContext';
import {useLanguage} from '@/contexts/LanguageContext';
import {PlayerAvatar} from '@/components/GameUi';
import {RoyalBrand,RoyalIcon,RoyalSurface,type RoyalIconName} from '@/components/RoyalUi';
import {GameModeCarousel} from '@/components/GameModeCarousel';
import {SeasonEventCarousel} from '@/components/SeasonEventCarousel';
import {HomeBannerAd} from '@/components/HomeBannerAd';

export function FantasyHome({onOfflinePress,onOnlinePress,hasLocalProfileError}:{onOfflinePress:()=>void;onOnlinePress:()=>void;hasLocalProfileError:boolean}){
 const {profile}=usePlayer(),{t,isRTL}=useLanguage(),{width}=useWindowDimensions(),xp=getXpProgress(profile.xp),small=width<360;
 return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}><View style={s.content}>
  {hasLocalProfileError?<Text accessibilityRole="alert" style={s.warning}>تعذّر تحميل بعض البيانات المحفوظة. أعد فتح اللعبة للمحاولة.</Text>:null}
  <View style={[s.hero,{height:small?238:230}]}><Image source={require('../assets/ui-2027/royal-home-hero.png')} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:"100%",height:"100%"}]}/><LinearGradient colors={['#14144000','#17153B00','#171437']} locations={[0,.78,1]} style={StyleSheet.absoluteFill}/>
   <View style={[s.logo,{top:small?43:5}]}><RoyalBrand width={small?126:144}/></View>
   <Pressable accessibilityRole="button" accessibilityLabel={`${profile.name}، المستوى ${profile.level}`} onPress={()=>router.push('/profile')} style={[s.profile,{width:small?96:118}]}><RoyalSurface style={s.profilePanel}><PlayerAvatar size={35} skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame}/><View style={{flex:1,gap:4}}><Text style={s.level}>المستوى {profile.level}</Text><View style={s.track}><View style={[s.fill,{width:`${Math.max(0,Math.min(1,xp.progress))*100}%`}]}/></View></View></RoyalSurface></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`${profile.coins} عملة`} onPress={()=>router.push('/store')} style={[s.wallet,{width:small?80:91}]}><RoyalSurface style={s.walletPanel}><RoyalIcon name="coins" size={25}/><Text style={s.coins}>{profile.coins.toLocaleString()}</Text></RoyalSurface></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="الإعدادات" onPress={()=>router.push('/settings')} style={s.settings}><RoyalSurface style={{padding:4,alignItems:'center',justifyContent:'center',height:43}}><RoyalIcon name="settings" size={30}/></RoyalSurface></Pressable>
  </View>
  <GameModeCarousel isRTL={isRTL} offlineTitle={t.offlineMode} offlineDescription={t.playOfflineHint} offlineButtonLabel={t.playOffline} onlineTitle={t.onlineMode} onlineDescription={t.onlineModeHint} onlineButtonLabel={t.playOnline} selectorLabel={t.chooseGameMode} swipeHint="اسحب لاختيار الوضع" onOfflinePress={onOfflinePress} onOnlinePress={onOnlinePress} onTeamPress={()=>router.push('/team-up')} onFourPress={()=>router.push('/four-players')} onFriendsPress={()=>router.push('/private-room')}/>
  <View style={s.lower}><SeasonEventCarousel/>
   <View style={s.shortcutRow}>{([{route:'/daily-challenge',label:'تحدي اليوم',icon:'tasks'},{route:'/spin',label:'هدية اليوم',icon:'gift'},{route:'/clans',label:'العشائر',icon:'clan'}] as const).map(item=><Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>router.push(item.route)} style={{flex:1}}><RoyalSurface style={s.shortcut}><RoyalIcon name={item.icon} size={36}/><Text style={s.shortcutLabel}>{item.label}</Text></RoyalSurface></Pressable>)}</View>
<HomeBannerAd/>
  </View>
 </View></ScrollView>;
}
export function FantasyHomeDock({bottomInset=0,pathname='/'}:{bottomInset?:number;pathname?:string}){
 const tabs:{route:'/'|'/tasks'|'/achievements'|'/store'|'/leaderboard';icon:RoyalIconName;label:string}[]=[{route:'/leaderboard',icon:'podium',label:'الترتيب'},{route:'/tasks',icon:'tasks',label:'المهام'},{route:'/',icon:'home',label:'الرئيسية'},{route:'/achievements',icon:'trophy',label:'الإنجازات'},{route:'/store',icon:'store',label:'المتجر'}];
 return <View accessibilityRole="tablist" accessibilityLabel="التنقل الرئيسي" style={[s.dock,{paddingBottom:Math.max(4,bottomInset)}]}>{tabs.map(tab=><Pressable key={tab.route} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{selected:tab.route===pathname}} aria-selected={tab.route===pathname} onPress={()=>{if(tab.route!==pathname){if(tab.route==='/')router.replace('/');else router.push(tab.route);}}} style={{flex:1,minWidth:0}}><RoyalSurface selected={tab.route===pathname} style={s.dockTab}><RoyalIcon name={tab.icon} size={tab.route==="/"?36:32}/><Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={s.dockLabel}>{tab.label}</Text></RoyalSurface></Pressable>)}</View>;
}
const s=StyleSheet.create({scroll:{flexGrow:1,alignItems:'center',paddingBottom:12},content:{width:'100%',maxWidth:760},hero:{width:'100%',overflow:'hidden'},logo:{position:'absolute',left:'50%',marginLeft:-72},profile:{position:'absolute',top:10,left:8},profilePanel:{padding:5,height:46,flexDirection:'row',gap:5,alignItems:'center'},level:{fontFamily:'Cairo_700Bold',fontSize:9,color:'#FFF0D3',textAlign:'center'},track:{height:6,borderRadius:5,overflow:'hidden',backgroundColor:'#21162C',borderWidth:.5,borderColor:'#D1A662'},fill:{height:'100%',backgroundColor:'#2FD6CD'},wallet:{position:'absolute',right:49,top:11},walletPanel:{height:44,padding:5,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4},coins:{fontFamily:'Cairo_700Bold',fontSize:14,color:'#FFF0D3'},settings:{position:'absolute',right:7,top:11,width:38},lower:{paddingHorizontal:12,gap:9},shortcutRow:{flexDirection:'row-reverse',gap:8},shortcut:{minHeight:86,padding:7,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5},shortcutLabel:{fontFamily:'Cairo_700Bold',fontSize:12,color:'#FFF0D6',flexShrink:1,textAlign:'center'},links:{flexDirection:'row-reverse',justifyContent:'center',gap:6},link:{minHeight:44,justifyContent:'center',paddingHorizontal:9},linkText:{fontFamily:'Cairo_600SemiBold',fontSize:11,color:'#DCC58C'},dock:{width:'100%',maxWidth:760,alignSelf:'center',flexDirection:'row-reverse',gap:3,paddingHorizontal:5,paddingTop:3,backgroundColor:'#161535DD'},dockTab:{minHeight:73,paddingVertical:4,paddingHorizontal:2,alignItems:'center',justifyContent:'center',gap:1},dockLabel:{fontFamily:'Cairo_700Bold',fontSize:11,color:'#FFF0D6',textAlign:'center'},warning:{fontFamily:'Cairo_400Regular',fontSize:12,color:'#FFE2E8',padding:12,backgroundColor:'#532640'}});
