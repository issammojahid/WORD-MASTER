import { HalloweenCountdown } from "@/components/HalloweenCountdown";
import React, { useRef } from "react";
import { ScrollView, View, Image, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameHeader, GameScreenBackground, CoinBalance, useReducedMotion } from "@/components/GameUi";
import { FantasySettingsSection } from "@/components/FantasySettingsSection";
import { useTheme } from "@/contexts/ThemeContext";
import { useHalloweenAccount } from "@/contexts/HalloweenContext";
import { HalloweenAccountStatus, HalloweenRewards, HalloweenWelcome } from "@/components/HalloweenEconomy";
export default function HalloweenScreen(){
 const insets=useSafeAreaInsets(),scroll=useRef<ScrollView>(null),reduced=useReducedMotion(),{theme}=useTheme(),{account,seasonActive}=useHalloweenAccount();
 const choosing=seasonActive&&!!account&&!account.state.giftItemId;
 return <View style={{flex:1,paddingTop:Platform.OS==="web"?20:insets.top,backgroundColor:theme.background}}>
  <GameScreenBackground accent="reward"/><View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:theme.background+"A8"}]}/>
  <GameHeader title={seasonActive?"موسم هالوين":"المجموعة السابقة"} subtitle={seasonActive?"هدايا ومظاهر ومكافآت موسمية":"انتهى الحدث · مظاهرك المكتسبة محفوظة"} onBack={()=>router.back()} trailing={account?<CoinBalance amount={account.coins}/>:null}/>
  <ScrollView ref={scroll} contentContainerStyle={[s.content,{paddingBottom:insets.bottom+24}]} showsVerticalScrollIndicator={false}>
   {seasonActive&&<View style={s.hero}><Image source={require("../assets/seasonal/halloween-preview/backgrounds/backgrounds_01.png")} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:"100%",height:"100%"}]}/><LinearGradient colors={["#24123622","#241236F5"]} style={StyleSheet.absoluteFill}/><View style={s.heroCopy}><Text style={s.title}>اكتشف سحر الموسم</Text><Text style={s.subtitle}>{choosing?"اكشف أربع بطاقات، ثم اختر هديتك المجانية":"أكمل مجموعتك وعبّر عن أسلوبك"}</Text></View></View>}
   {seasonActive&&<HalloweenCountdown/>}
   {seasonActive?<HalloweenWelcome onSelectGift={()=>scroll.current?.scrollToEnd({animated:!reduced})}/>:<Text style={[s.limit,{color:theme.textSecondary}]}>موسم هالوين مؤرشف. يمكنك تجهيز المظاهر التي تمتلكها من مجموعتك في المتجر.</Text>}
   {!choosing?<><HalloweenAccountStatus compact/>{seasonActive&&<><FantasySettingsSection title="مكافآت المهام"><HalloweenRewards source="task"/></FantasySettingsSection><FantasySettingsSection title="مكافآت الإنجازات"><HalloweenRewards source="achievement"/></FantasySettingsSection></>}</>:null}
   <Text style={[s.limit,{color:theme.textSecondary}]}>صور المظاهر نماذج تجريبية، مع حركات عرض خفيفة.</Text>
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({content:{width:"100%",maxWidth:592,alignSelf:"center",padding:16,gap:10},hero:{height:112,borderRadius:23,borderWidth:1,borderColor:"#AD8759",overflow:"hidden",justifyContent:"flex-end"},heroCopy:{padding:14,gap:3,alignItems:"flex-end"},title:{fontFamily:"Cairo_700Bold",fontSize:22,color:"#FFE4AC"},subtitle:{fontFamily:"Cairo_400Regular",fontSize:11,color:"#E5D7EC"},limit:{fontFamily:"Cairo_400Regular",fontSize:10,textAlign:"center",lineHeight:18}});
