import {ScaledText as Text} from '@/components/ScaledText';
import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,View} from 'react-native';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LinearGradient} from 'expo-linear-gradient';
import Svg,{Circle,Ellipse,Path} from 'react-native-svg';
import {GameHeader,GameScreenBackground} from '@/components/GameUi';
import {RoyalSurface,RoyalIcon} from '@/components/RoyalUi';
import {AvatarArtwork} from '@/components/AvatarArtwork';
import {usePlayer} from '@/contexts/PlayerContext';
import type {SkinId} from '@/contexts/PlayerContext';
import {getApiUrl} from '@/lib/query-client';
type Entry={rank:number;name:string;country?:string;score:number;wins?:number;skinId?:string};
const SKIN_IDS=new Set<SkinId>(['student','djellaba','sport','champion','kaftan','fassi','sahrawi','amazigh','ninja','astronaut','king','hacker','superhero','legend','elite','tourChamp','vip_phoenix','vip_sultan','vip_cyber']);
function isSkinId(value:string|undefined):value is SkinId{return !!value&&SKIN_IDS.has(value as SkinId);}
function RankedPortrait({skinId,size,ring}:{skinId:SkinId;size:number;ring:string}){
 return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center',overflow:'hidden',borderRadius:size/2,borderWidth:2,borderColor:ring,backgroundColor:'#171437'}}><AvatarArtwork skinId={skinId} size={size-4}/></View>;
}
function LaureledPortrait({skinId,size,ring}:{skinId:SkinId;size:number;ring:string}){
 const frame=size+34;
 return <View style={{width:frame,height:frame,alignItems:'center',justifyContent:'center'}}>
  <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" style={{position:'absolute',left:0,top:0}}>
   <Circle cx="50" cy="50" r="34" fill="#241637" stroke={ring} strokeWidth="2.5"/>
   <Circle cx="50" cy="50" r="29" fill="none" stroke={`${ring}88`} strokeWidth="1"/>
   <Path d="M29 80C13 68 12 38 29 19M71 80C87 68 88 38 71 19" fill="none" stroke={ring} strokeWidth="2.3" strokeLinecap="round"/>
   {Array.from({length:5},(_,index)=>{
    const y=67-index*9,x=24-index*1.1;
    return <React.Fragment key={index}>
     <Ellipse cx={x} cy={y} rx="3.2" ry="6.1" transform={`rotate(-42 ${x} ${y})`} fill={ring}/>
     <Ellipse cx={100-x} cy={y} rx="3.2" ry="6.1" transform={`rotate(42 ${100-x} ${y})`} fill={ring}/>
    </React.Fragment>;
   })}
  </Svg>
  <View style={{position:'absolute',top:(frame-size)/2,left:(frame-size)/2}}><RankedPortrait skinId={skinId} size={size} ring={ring}/></View>
 </View>;
}
function PodiumEntry({entry,skinId}:{entry:Entry;skinId:SkinId}){
 const first=entry.rank===1,second=entry.rank===2,medal=first?'#FFC928':second?'#C0C0C0':'#CD7F32';
 return <View style={{flex:first?1.12:1,minWidth:0}}>
  <RoyalSurface accessibilityLabel={`المركز ${entry.rank}: ${entry.name}`} selected={first} rounded style={{minHeight:first?184:second?166:158,paddingHorizontal:4,paddingTop:10,paddingBottom:8,alignItems:'center',justifyContent:'flex-end',gap:3,borderRadius:18,borderWidth:first?2:1.5,overflow:'hidden'}}>
   <LinearGradient pointerEvents="none" colors={first?['#153D54','#24173F','#302044']:second?['#283144','#24183A','#211A3A']:['#422D38','#25183A','#211538']} style={{position:'absolute',left:0,right:0,top:0,bottom:0}} />
   <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,height:3,backgroundColor:medal,opacity:.75}}/>
   <View style={{position:'absolute',top:7,left:7,minWidth:26,height:26,paddingHorizontal:5,alignItems:'center',justifyContent:'center',backgroundColor:medal,borderRadius:first?14:second?12:7,transform:entry.rank===3?[{rotate:'45deg'}]:undefined,borderWidth:1,borderColor:'#FFF0C8'}}><Text style={{fontFamily:'Cairo_700Bold',fontSize:11,color:'#211832',transform:entry.rank===3?[{rotate:'-45deg'}]:undefined}}>#{entry.rank}</Text></View>
   <Text style={{fontFamily:'Cairo_700Bold',fontSize:first?20:16,color:first?'#FFE5A0':medal,lineHeight:first?22:18}}>{first?'♛':second?'✦':'✧'}</Text>
   <LaureledPortrait skinId={skinId} size={first?54:48} ring={medal}/>
   <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} maxFontSizeMultiplier={1.15} style={{width:'100%',fontFamily:'Cairo_700Bold',fontSize:11,lineHeight:14,color:'#FFF0D6',textAlign:'center'}}>{entry.name}</Text>
   <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{fontFamily:'Cairo_700Bold',fontSize:11,color:first?'#FFE18B':'#F4CE77',textAlign:'center'}}>{entry.score.toLocaleString()} نقطة</Text>
  </RoyalSurface>
 </View>;
}
export default function Leaderboard(){
 const [scope,setScope]=useState<'global'|'country'>('global'),[entries,setEntries]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const insets=useSafeAreaInsets(),{profile}=usePlayer(),country=/^[A-Z]{2}$/.test(profile.country??'')?profile.country:'MA';
 const skinFor=(entry:Entry):SkinId=>isSkinId(entry.skinId)?entry.skinId:entry.name===profile.name?profile.equippedSkin:'student';
 const ownEntry=entries.find(entry=>entry.name===profile.name),first=entries.find(entry=>entry.rank===1),second=entries.find(entry=>entry.rank===2),third=entries.find(entry=>entry.rank===3);
 const hasPodium=!!(first&&second&&third),visibleEntries=hasPodium?entries.filter(entry=>entry.rank>3):entries;
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
 <ScrollView contentContainerStyle={{padding:12,gap:10,width:'100%',maxWidth:760,alignSelf:'center'}}>
  <View accessibilityRole="tablist" accessibilityLabel="نطاق الترتيب" style={{flexDirection:'row-reverse',gap:6}}>{([{id:'global',label:'العالمي'},{id:'country',label:'بلدي'}] as const).map(tab=><Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} aria-selected={scope===tab.id} accessibilityState={{selected:scope===tab.id}} onPress={()=>setScope(tab.id)} style={{flex:1}}><RoyalSurface selected={scope===tab.id} style={{minHeight:52,width:'100%',alignItems:'center',justifyContent:'center',paddingHorizontal:8,paddingVertical:8}}><Text numberOfLines={1} adjustsFontSizeToFit style={{...text,fontSize:15,lineHeight:22,textAlign:'center',flexShrink:1}}>{tab.label}</Text></RoyalSurface></Pressable>)}</View>
  <RoyalSurface accessibilityLabel="ملفك الشخصي في الترتيب" style={{minHeight:58,padding:8,flexDirection:'row-reverse',alignItems:'center',gap:9}}><RankedPortrait skinId={profile.equippedSkin} size={42} ring="#E8BD67"/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{...text,fontSize:14,textAlign:'right'}}>{profile.name}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{fontFamily:'Cairo_400Regular',fontSize:10,color:'#C9B8DB',textAlign:'right'}}>ملفك الشخصي · المستوى {profile.level}</Text></View><Text style={{...text,fontSize:15,color:'#F4CE77'}}>{ownEntry?`#${ownEntry.rank}`:'—'}</Text></RoyalSurface>
  <View style={{alignItems:'center',gap:4}}><RoyalIcon name="podium" size={48}/><Text style={{...text,fontSize:12,color:'#E8C777'}}>الترتيب حسب مجموع نقاط اللعب</Text></View>
  {busy?<ActivityIndicator accessibilityLabel="جارٍ تحميل الترتيب" color="#39DDD1"/>:error?<RoyalSurface style={{padding:18,gap:9}}><Text style={{...text,textAlign:'center'}}>تعذر تحميل الترتيب. تحقق من اتصالك.</Text><Pressable accessibilityRole="button" onPress={()=>setRevision(value=>value+1)} style={{minHeight:44,justifyContent:'center'}}><Text style={{...text,color:'#72E9D8',textAlign:'center'}}>إعادة المحاولة</Text></Pressable></RoyalSurface>:entries.length===0?<Text style={{...text,textAlign:'center'}}>لا توجد نتائج بعد</Text>:<>
   {hasPodium&&<><Text style={{...text,fontSize:14,color:'#E8C777',textAlign:'center'}}>✧ أفضل ثلاثة لاعبين ✧</Text><View style={{flexDirection:'row-reverse',alignItems:'flex-end',gap:6}}><PodiumEntry entry={second!} skinId={skinFor(second!)}/><PodiumEntry entry={first!} skinId={skinFor(first!)}/><PodiumEntry entry={third!} skinId={skinFor(third!)}/></View></>}
   {visibleEntries.map(entry=><RoyalSurface key={entry.rank} accessibilityLabel={`المركز ${entry.rank}: ${entry.name}`} style={{minHeight:66,paddingHorizontal:10,paddingVertical:7,flexDirection:'row-reverse',alignItems:'center',gap:9,borderRadius:15,borderColor:entry.rank===ownEntry?.rank?'#42DCCF':'#675185'}}>
    <LinearGradient pointerEvents="none" colors={entry.rank===ownEntry?.rank?['#203E51','#281B40']:['#281B3D','#211735']} start={{x:0,y:0}} end={{x:1,y:1}} style={{position:'absolute',left:0,right:0,top:0,bottom:0}}/>
    <RankedPortrait skinId={skinFor(entry)} size={42} ring={entry.rank===ownEntry?.rank?'#4DF4EB':'#C9A4EF'}/>
    <Text style={{...text,minWidth:38,fontSize:18,color:entry.rank<=3?'#F4CE77':'#C9BEDA',textAlign:'center'}}>#{entry.rank}</Text>
    <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{...text,fontSize:14,textAlign:'right'}}>{entry.name}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{fontFamily:'Cairo_400Regular',fontSize:10,color:'#C9B8DB',textAlign:'right'}}>{entry.country??''}{entry.wins?` · ${entry.wins} انتصار`:''}</Text></View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{...text,fontSize:14,color:'#F4CE77'}}>{entry.score.toLocaleString()} نقطة</Text>
   </RoyalSurface>)}
  </>}
 </ScrollView></View>;
}
