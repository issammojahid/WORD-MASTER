import React from 'react';
import {View,StyleSheet,useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GameHeader,GameScreenBackground} from './GameUi';
import {RoyalSurface} from './RoyalUi';
import {SeasonEventArtwork} from './SeasonEventArtwork';
import {ScaledText as Text} from './ScaledText';
import {SEASON_EVENTS,eventPhase,type SeasonEventId} from '@/lib/season-calendar';
export function SeasonAvailability({eventId,now}:{eventId:SeasonEventId;now:number}){
 const event=SEASON_EVENTS.find(item=>item.id===eventId)!,phase=eventPhase(event,now),{width}=useWindowDimensions(),insets=useSafeAreaInsets();
 return <View style={{flex:1,paddingTop:Math.max(12,insets.top),backgroundColor:'#171437'}}><GameScreenBackground/><GameHeader title={event.title} subtitle={event.dates} onBack={()=>router.back()}/>
  <RoyalSurface style={{margin:16,padding:12,gap:14,alignItems:'center'}}>
   <View style={{borderRadius:12,overflow:'hidden'}}><SeasonEventArtwork event={eventId} width={Math.min(width-58,650)} height={130}/></View>
   <Text style={s.title}>{phase==='upcoming'?'قريباً':phase==='ended'?'انتهى هذا الحدث':'الحدث غير متاح حالياً'}</Text>
   <Text style={s.body}>{phase==='upcoming'?`موعد الحدث: ${event.dates}. ستظهر التفاصيل عند إتاحتها.`:phase==='ended'?'يبقى كل مظهر تملكه محفوظاً في مجموعتك.':'يمكنك متابعة اللعب بالأوضاع المتاحة والعودة لاحقاً.'}</Text>
  </RoyalSurface>
 </View>;
}
const s=StyleSheet.create({title:{fontFamily:'Cairo_700Bold',fontSize:20,color:'#FFE3A6',textAlign:'center'},body:{fontFamily:'Cairo_400Regular',fontSize:14,lineHeight:26,color:'#E2D5EE',textAlign:'center'}});
