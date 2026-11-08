import {RoyalSurface,RoyalIcon} from "./RoyalUi";
import {ScaledText as Text} from "@/components/ScaledText";
import React,{useCallback,useEffect,useRef,useState} from "react";
import {AppState, FlatList, Pressable, StyleSheet, View} from "react-native";
import {useIsFocused} from "@react-navigation/native";
import {router} from "expo-router";
import {LinearGradient} from "expo-linear-gradient";
import {Ionicons} from "@expo/vector-icons";
import {useReducedMotion} from "./GameUi";
import {SEASON_EVENTS,eventPhase,initialSeasonIndex} from "@/lib/season-calendar";
import {SeasonCatalogArtwork} from "./SeasonCatalogArtwork";
import {seasonPreviewItems} from "@/constants/season-catalog";

export function SeasonEventCarousel(){
 const [now,setNow]=useState(Date.now),[index,setIndex]=useState(()=>initialSeasonIndex(Date.now())),[width,setWidth]=useState(300),[paused,setPaused]=useState(false),[active,setActive]=useState(AppState.currentState==="active");
 const reduced=useReducedMotion(),focused=useIsFocused(),list=useRef<FlatList<typeof SEASON_EVENTS[number]>>(null),interacted=useRef(0),indexRef=useRef(index);indexRef.current=index;
 const cardWidth=(width-28)/2,stride=cardWidth+10;
 const select=useCallback((next:number,manual=false)=>{if(manual)interacted.current=Date.now();const bounded=(next+SEASON_EVENTS.length)%SEASON_EVENTS.length;setIndex(bounded);list.current?.scrollToOffset({offset:bounded*stride,animated:!reduced});},[reduced,stride]);
 useEffect(()=>{const sub=AppState.addEventListener("change",state=>setActive(state==="active"));return()=>sub.remove();},[]);
 useEffect(()=>{if(!focused||!active)return;const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[active,focused]);
 useEffect(()=>{list.current?.scrollToOffset({offset:indexRef.current*stride,animated:false});},[stride]);
 useEffect(()=>{if(reduced||paused||!focused||!active)return;const timer=setInterval(()=>{if(Date.now()-interacted.current>10000)select(indexRef.current+1);},6000);return()=>clearInterval(timer);},[reduced,paused,focused,active,select]);
 return <RoyalSurface style={[s.section,{borderWidth:0,backgroundColor:"transparent"}]} onLayout={e=>setWidth(e.nativeEvent.layout.width)}>
  <View style={s.heading}><Text style={s.date}>دجنبر 2026</Text><View style={{flexDirection:"row-reverse",alignItems:"center",gap:5}}><RoyalIcon name="tasks" size={29}/><Text accessibilityRole="header" style={s.title}>أحداث الموسم</Text></View></View>
  <FlatList<typeof SEASON_EVENTS[number]> ref={list} horizontal data={SEASON_EVENTS} keyExtractor={item=>item.id} style={{direction:"ltr"}} showsHorizontalScrollIndicator={false} snapToInterval={stride} decelerationRate="fast" contentContainerStyle={{gap:10,paddingHorizontal:4}} onScrollBeginDrag={()=>{interacted.current=Date.now();}} onMomentumScrollEnd={e=>setIndex(Math.max(0,Math.min(4,Math.round(e.nativeEvent.contentOffset.x/stride))))} getItemLayout={(_,i)=>({length:stride,offset:i*stride,index:i})} renderItem={({item})=>{
   const phase=eventPhase(item,now),label=phase==="active"?"هذا الموسم":phase==="upcoming"?"قريباً":"انتهى";
   return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}، ${item.dates}، ${label}`} onPress={()=>{interacted.current=Date.now();router.push({pathname:"/season",params:{event:item.id}});}} style={[s.card,{width:cardWidth}]}>
    <View style={{position:"absolute",top:0,left:0}}><SeasonCatalogArtwork item={seasonPreviewItems(item.id).find(asset=>asset.kind==="background")!} size={cardWidth}/></View>
    <LinearGradient colors={["#100B2400","#20183FF2","#20183F"]} locations={[0,.55,1]} style={StyleSheet.absoluteFill}/>
    <View style={[s.badge,phase==="active"&&{backgroundColor:"#087F80"}]}><Text style={s.badgeText}>{label}</Text></View>
    <View style={s.copy}><Text style={s.name}>{item.title}</Text><Text style={s.dates}>{item.dates}</Text><View style={s.action}><Ionicons name="chevron-back" color="#75F1E7" size={14}/><Text style={s.actionText}>استكشف المجموعة</Text></View></View>
   </Pressable>;
  }}/>
  <View style={s.controls}><Pressable accessibilityRole="button" accessibilityLabel="الحدث السابق" onPress={()=>select(index-1,true)} style={s.control}><Ionicons name="chevron-back" color="#F2C773" size={18}/></Pressable>{SEASON_EVENTS.map((event,i)=><Pressable key={event.id} accessibilityRole="button" accessibilityLabel={event.title} accessibilityState={{selected:i===index}} onPress={()=>select(i,true)} style={s.dotTarget}><View style={[s.dot,i===index&&s.selected]}/></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel={reduced?"العرض التلقائي متوقف لتقليل الحركة":paused?"تشغيل العرض التلقائي":"إيقاف العرض التلقائي"} disabled={reduced} onPress={()=>setPaused(p=>!p)} style={s.control}><Ionicons name={paused||reduced?"play":"pause"} color="#F2C773" size={17}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="الحدث التالي" onPress={()=>select(index+1,true)} style={s.control}><Ionicons name="chevron-forward" color="#F2C773" size={18}/></Pressable></View>

 </RoyalSurface>;
}
const s=StyleSheet.create({section:{borderWidth:1,borderColor:"#AF8A57",borderRadius:20,backgroundColor:"#20183F",padding:8,gap:6},heading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:6},title:{fontFamily:"Cairo_700Bold",fontSize:17,color:"#FFE3A6"},date:{fontFamily:"Cairo_600SemiBold",fontSize:10,color:"#CDB9DD"},card:{height:180,borderRadius:16,borderWidth:1,borderColor:"#846348",overflow:"hidden",backgroundColor:"#201237"},art:{position:"absolute",width:"100%",height:360,top:0},badge:{position:"absolute",top:8,right:8,borderRadius:12,paddingHorizontal:9,paddingVertical:3,backgroundColor:"#463053",borderWidth:1,borderColor:"#C49B68"},badgeText:{fontFamily:"Cairo_700Bold",fontSize:10,color:"#FFF0D6"},copy:{flex:1,justifyContent:"flex-end",alignItems:"flex-end",padding:8,gap:2},name:{fontFamily:"Cairo_700Bold",fontSize:13,color:"#FFE3A6"},dates:{fontFamily:"Cairo_600SemiBold",fontSize:10,color:"#EFE0F5"},action:{flexDirection:"row",gap:4,alignItems:"center",marginTop:4},actionText:{fontFamily:"Cairo_700Bold",fontSize:11,color:"#75F1E7"},controls:{flexDirection:"row",justifyContent:"center",alignItems:"center"},control:{width:32,height:30,margin:3,borderWidth:1,borderRadius:9,borderColor:"#D2AF6A",backgroundColor:"#31244D",alignItems:"center",justifyContent:"center"},dotTarget:{width:25,height:38,alignItems:"center",justifyContent:"center"},dot:{width:6,height:6,borderRadius:4,backgroundColor:"#8D70AA"},selected:{width:10,height:10,backgroundColor:"#30DCD1"}});
