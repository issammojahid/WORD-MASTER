import {ScaledText as Text} from '@/components/ScaledText';
import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,View} from 'react-native';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GameHeader,GameScreenBackground} from '@/components/GameUi';
import {RoyalSurface,RoyalIcon} from '@/components/RoyalUi';
import {usePlayer} from '@/contexts/PlayerContext';
import {getApiUrl} from '@/lib/query-client';
type Entry={rank:number;name:string;country:string;score:number;wins:number};
export default function Leaderboard(){
 const [scope,setScope]=useState<'global'|'country'>('global'),[entries,setEntries]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const insets=useSafeAreaInsets(),{profile}=usePlayer(),country=/^[A-Z]{2}$/.test(profile.country??'')?profile.country:'MA';
 useEffect(()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let active=true;
  setBusy(true);setError(false);setEntries([]);
  void fetch(new URL('/api/leaderboard'+(scope==='country'?`?country=${country}`:''),getApiUrl()).toString(),{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('unavailable');const data=await response.json();
   if(!Array.isArray(data.entries)||data.entries.length>50||data.entries.some((entry:Entry)=>!Number.isInteger(entry.rank)||entry.rank<1||typeof entry.name!=='string'||entry.name.length>100||!Number.isSafeInteger(entry.score)||entry.score<0))throw Error('invalid_results');
   if(active)setEntries(data.entries);
  }).catch(()=>{if(active)setError(true);}).finally(()=>{clearTimeout(timer);if(active)setBusy(false);});
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[scope,country,revision]);
 const text={fontFamily:'Cairo_700Bold',color:'#FFF0D6'} as const;
 return <View style={{flex:1,paddingTop:Math.max(12,insets.top),backgroundColor:'#171437'}}><GameScreenBackground/><GameHeader title="الترتيب العام" icon={<RoyalIcon name="podium" size={29}/>} onBack={()=>router.back()}/>
 <ScrollView contentContainerStyle={{padding:16,gap:12,width:'100%',maxWidth:760,alignSelf:'center'}}>
  <View accessibilityRole="tablist" accessibilityLabel="نطاق الترتيب" style={{flexDirection:'row-reverse',gap:6}}>{([{id:'global',label:'العالمي'},{id:'country',label:'بلدي'}] as const).map(tab=><Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} aria-selected={scope===tab.id} accessibilityState={{selected:scope===tab.id}} onPress={()=>setScope(tab.id)} style={{flex:1}}><RoyalSurface selected={scope===tab.id}><Text style={{...text,fontSize:16,textAlign:'center'}}>{tab.label}</Text></RoyalSurface></Pressable>)}</View>
  <View style={{alignItems:'center',gap:5}}><RoyalIcon name="podium" size={76}/><Text style={{...text,fontSize:13,color:'#E8C777'}}>الترتيب حسب مجموع نقاط اللعب</Text></View>
  {busy?<ActivityIndicator accessibilityLabel="جارٍ تحميل الترتيب" color="#39DDD1"/>:error?<RoyalSurface style={{padding:18,gap:9}}><Text style={{...text,textAlign:'center'}}>تعذر تحميل الترتيب. تحقق من اتصالك.</Text><Pressable accessibilityRole="button" onPress={()=>setRevision(value=>value+1)} style={{minHeight:44,justifyContent:'center'}}><Text style={{...text,color:'#72E9D8',textAlign:'center'}}>إعادة المحاولة</Text></Pressable></RoyalSurface>:entries.length===0?<Text style={{...text,textAlign:'center'}}>لا توجد نتائج بعد</Text>:entries.map(entry=><RoyalSurface key={entry.rank} selected={entry.rank===1} style={{minHeight:65,padding:10,flexDirection:'row-reverse',alignItems:'center',gap:12}}><Text style={{...text,fontSize:21,color:entry.rank<=3?'#F4CE77':'#C9BEDA'}}>#{entry.rank}</Text><View style={{flex:1}}><Text numberOfLines={1} style={{...text,fontSize:15,textAlign:'right'}}>{entry.name}</Text><Text style={{fontFamily:'Cairo_400Regular',fontSize:10,color:'#C9B8DB',textAlign:'right'}}>{entry.country??''}</Text></View><Text style={{...text,fontSize:17,color:'#F4CE77'}}>{entry.score.toLocaleString()}</Text></RoyalSurface>)}
 </ScrollView></View>;
}
