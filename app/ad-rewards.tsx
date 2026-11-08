import {getDailyAdProgress} from "@/services/rewarded-ads";
import {RewardedCoinsCard} from "@/components/RewardedCoinsCard";
import {useAppActive} from "@/lib/use-app-active";
import React,{useCallback,useEffect,useState} from 'react';
import {Platform,Pressable,ScrollView,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {GameHeader,GameModal,GameScreenBackground,CoinBalance} from '@/components/GameUi';
import {RoyalIcon,RoyalSurface} from '@/components/RoyalUi';
import {ScaledText as Text} from '@/components/ScaledText';
import {usePlayer} from '@/contexts/PlayerContext';
import {DAILY_AD_LIMIT,DAILY_AD_MILESTONES,DAILY_AD_TOTAL} from '@/constants/daily-ad-rewards';

export default function AdRewardsScreen(){
 const {preview}=useLocalSearchParams<{preview?:string}>(),design=__DEV__&&Platform.OS==='web'&&preview==='ads';
 const {profile,playerId,isReady}=usePlayer(),insets=useSafeAreaInsets();
 const active=useAppActive();
 const [available,setAvailable]=useState(false);
 const [completed,setCompleted]=useState(0),[watchOpen,setWatchOpen]=useState(false);
 const refresh=useCallback(async()=>{if(design||!playerId||!isReady)return;try{const progress=await getDailyAdProgress();setCompleted(progress.completed);setAvailable(true);}catch{setAvailable(false);}},[design,playerId,isReady]);
 useEffect(()=>{setCompleted(0);setWatchOpen(false);},[design]);
 useEffect(()=>{if(!active||design)return;void refresh();const timer=setInterval(()=>void refresh(),60000);return()=>clearInterval(timer);},[active,design,refresh]);
 const labelStyle={fontFamily:'Cairo_700Bold',fontSize:14,color:'#FFF0D6'} as const;
 return <View style={{flex:1,backgroundColor:'#171437',paddingTop:Math.max(insets.top,10)}}><GameScreenBackground/>
  <GameHeader brand={false} title="مكافآت الإعلانات" subtitle="شاهد إعلانات اختيارية واجمع العملات" onBack={()=>router.back()} trailing={<CoinBalance amount={profile.coins}/>}/>
  <ScrollView contentContainerStyle={{width:'100%',maxWidth:700,alignSelf:'center',paddingHorizontal:13,paddingBottom:Math.max(insets.bottom,18),gap:9}} showsVerticalScrollIndicator={false}>
   <RoyalSurface style={{padding:10,flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:8}}><View accessibilityLabel={`${completed} من ${DAILY_AD_LIMIT} إعلانات`} style={{flexDirection:'row',gap:5}}>{DAILY_AD_MILESTONES.map((_,i)=><View key={i} style={{width:13,height:13,borderRadius:8,borderWidth:1,borderColor:'#E5BE70',backgroundColor:i<completed?'#1AD7CA':'#261B43'}}/>)}</View><Text accessibilityLiveRegion="polite" style={{...labelStyle,fontSize:20,color:'#FFE3A6'}}>{completed} / {DAILY_AD_LIMIT}</Text><Text style={{...labelStyle,fontSize:11}}>يتجدد يومياً</Text></RoyalSurface>
   {!design&&!available?<Text style={{fontFamily:'Cairo_400Regular',fontSize:11,lineHeight:21,color:'#E0CADF',textAlign:'center'}}>المشاهدة والمكافآت غير متاحتين حالياً. لا تُصرف عملات من هذه الصفحة قبل تفعيل الخدمة.</Text>:design?<Text style={{fontFamily:'Cairo_400Regular',fontSize:10,color:'#CBB9DC',textAlign:'center'}}>معاينة تفاعلية فقط · الرصيد الحقيقي لا يتغيّر</Text>:null}
   {DAILY_AD_MILESTONES.map((coins,index)=>{
    const done=index<completed,next=index===completed&&completed<DAILY_AD_LIMIT;
    return <RoyalSurface key={index} selected={next} style={{padding:9,minHeight:77,flexDirection:'row-reverse',alignItems:'center',gap:8}}>
     <View style={{width:31,height:37,borderRadius:11,borderWidth:1.5,borderColor:'#E3B967',backgroundColor:'#173E55',justifyContent:'center',alignItems:'center'}}><Text style={{...labelStyle,fontSize:19,color:'#FFE3A6'}}>{index+1}</Text></View>
     <View style={{flex:1,minWidth:0}}><Text style={{...labelStyle,fontSize:12,textAlign:'right'}}>{index===0?'إعلان واحد':index===1?'إعلانان':`${index+1} إعلانات`}</Text></View>
     <View style={{flexDirection:'row',alignItems:'center',gap:3}}><RoyalIcon name={index===5?'gift':'coins'} size={index===5?34:29}/><Text style={{...labelStyle,fontSize:18,color:'#FFE3A6'}}>{coins}</Text></View>
     {!design&&available&&next?<View style={{width:98}}><RewardedCoinsCard compact expectedCoins={coins} onCredited={refresh}/></View>:<Pressable accessibilityRole="button" accessibilityLabel={done?`المرحلة ${index+1} مكتملة`:next?'شاهد الإعلان':`المرحلة ${index+1} مقفلة`} accessibilityState={{disabled:!design||!next}} disabled={!design||!next} onPress={()=>setWatchOpen(true)} style={{minWidth:86,minHeight:44,borderRadius:12,overflow:'hidden'}}><LinearGradient colors={next?['#24DECF','#077E92']:['#514362','#342B49']} style={{minHeight:44,alignItems:'center',justifyContent:'center',paddingHorizontal:6,flexDirection:'row-reverse',gap:3}}><Ionicons name={done?'checkmark-circle':next?'play-circle':'lock-closed'} size={15} color={next?'#082F42':'#E3D9EB'}/><Text style={{...labelStyle,fontSize:10,color:next?'#082F42':'#E3D9EB'}}>{done?'مكتمل':next?'شاهد الإعلان':'مقفل'}</Text></LinearGradient></Pressable>}
    </RoyalSurface>;
   })}
   <Text style={{...labelStyle,fontSize:12,textAlign:'center',color:'#E9CC8B'}}>الحد اليومي: {DAILY_AD_LIMIT} إعلانات · المجموع: {DAILY_AD_TOTAL} عملة</Text><Text style={{fontFamily:'Cairo_400Regular',fontSize:10,lineHeight:20,color:'#CEBFDC',textAlign:'center'}}>كل إعلان يضيف مكافأته الخاصة بعد تأكيد المشاهدة.</Text>
   {design&&completed>0?<Pressable accessibilityRole="button" onPress={()=>setCompleted(0)} style={{minHeight:44,justifyContent:'center'}}><Text style={{...labelStyle,fontSize:11,textAlign:'center',color:'#76E7DA'}}>إعادة المعاينة من البداية</Text></Pressable>:null}
  </ScrollView>
  <GameModal visible={watchOpen&&design} onRequestClose={()=>setWatchOpen(false)}><Text style={{...labelStyle,fontSize:20,textAlign:'center',color:'#FFE3A6'}}>معاينة المشاهدة</Text><Text style={{fontFamily:'Cairo_400Regular',fontSize:14,lineHeight:26,color:'#DDCFEA',textAlign:'center'}}>يمكنك تجربة انتقال المراحل فقط. لن يُعرض إعلان حقيقي، ولن تتغير عملاتك.</Text><Pressable accessibilityRole="button" onPress={()=>{setCompleted(value=>Math.min(DAILY_AD_LIMIT,value+1));setWatchOpen(false);}} style={{minHeight:48,borderRadius:12,backgroundColor:'#11A9AE',justifyContent:'center'}}><Text style={{...labelStyle,textAlign:'center'}}>محاكاة اكتمال المشاهدة</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setWatchOpen(false)} style={{minHeight:44,justifyContent:'center'}}><Text style={{...labelStyle,textAlign:'center',color:'#75E7DA'}}>إلغاء</Text></Pressable></GameModal>
 </View>;
}
