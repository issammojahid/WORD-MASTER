import React from 'react';
import {Platform,ScrollView,View,useWindowDimensions} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GameHeader,GameScreenBackground} from '@/components/GameUi';
import {SeasonEventArtwork} from '@/components/SeasonEventArtwork';
import {Season2027Collection} from '@/components/Season2027Collection';
import {ScaledText as Text} from '@/components/ScaledText';
import {useSeason2027} from '@/contexts/Season2027Context';
import {SEASON_EVENTS,eventPhase} from '@/lib/season-calendar';
export default function SeasonScreen(){
 const {event:requested}=useLocalSearchParams<{event?:string}>(),{snapshot,error}=useSeason2027(),insets=useSafeAreaInsets(),{width}=useWindowDimensions();
 const event=SEASON_EVENTS.find(event=>event.id===requested)??SEASON_EVENTS[0];
 const phase=snapshot?eventPhase(event,Date.parse(snapshot.serverTime)):null;
 const active=!error&&snapshot?.activeEvent===event.id;
 return <View style={{flex:1,backgroundColor:'#171437',paddingTop:Platform.OS==='web'?16:insets.top}}><GameScreenBackground/><GameHeader title={event.title} subtitle={event.dates} onBack={()=>router.back()}/><ScrollView contentContainerStyle={{width:'100%',maxWidth:760,alignSelf:'center',padding:14,paddingBottom:Math.max(28,insets.bottom),gap:16}}><View style={{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:'#B9915B'}}><SeasonEventArtwork event={event.id} width={Math.min(width,760)-28} height={120}/></View><Text style={{color:'#FFE3A6',fontSize:18,textAlign:'center'}}>{active?'الحدث متاح الآن':phase==='upcoming'?'قريباً':phase==='ended'?'انتهى الحدث':'الحدث غير متاح حالياً'}</Text><Text style={{color:'#E2D8EF',lineHeight:24,textAlign:'center'}}>{active?'اختر هدية البداية، وأكمل مهام الحدث أو اقتنِ مظاهرك بعملات اللعبة.':'تظهر العناصر الجديدة خلال فترة الحدث فقط. تبقى المظاهر المملوكة متاحة للتجهيز بعد انتهائه.'}</Text><Season2027Collection eventId={event.id}/></ScrollView></View>;
}
