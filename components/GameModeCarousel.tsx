import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlatList, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion } from "@/components/GameUi";

type Mode = { id: "offline" | "online" | "team" | "four" | "friends"; title: string; description: string; button: string; image: ImageSourcePropType; accent: string; onPress: () => void };
type Props = {
 isRTL: boolean; offlineTitle: string; offlineDescription: string; offlineButtonLabel: string;
 onlineTitle: string; onlineDescription: string; onlineButtonLabel: string;
 selectorLabel: string; swipeHint: string; onOfflinePress: () => void; onOnlinePress: () => void; onFriendsPress: () => void; onTeamPress:()=>void; onFourPress:()=>void;
};

export function GameModeCarousel(props: Props) {
 const { width, height, fontScale } = useWindowDimensions();
 const [trackWidth, setTrackWidth] = useState(Math.min(width - 32, 560));
 const [selected, setSelected] = useState(0);
 const selectedRef = useRef(0);
 const programmaticTarget = useRef<number|null>(null);
 const webSnap = useRef<ReturnType<typeof setTimeout> | null>(null);
 const list = useRef<FlatList<Mode>>(null);
 const reduced = useReducedMotion();
 const cardHeight = (width < 500 && height < 740 ? 235 : 260) + Math.ceil((Math.min(1.5, Math.max(1, fontScale)) - 1) * 180);
 const cardWidth = Math.max(204, trackWidth - 56), gap = 12, stride = cardWidth + gap;
 const modes: Mode[] = [
  { id: "offline", title: props.isRTL ? "دون اتصال" : props.offlineTitle, description: props.isRTL ? "لعبة فردية دون إنترنت" : props.offlineDescription, button: props.isRTL ? "العب الآن" : "Play now", image: require("../assets/fantasy-menu/offline.png"), accent: "#37DAD3", onPress: props.onOfflinePress },
  { id: "online", title: props.isRTL?"أونلاين فردي":"Online duel", description: props.isRTL ? "نافس لاعباً عبر الإنترنت" : props.onlineDescription, button: props.isRTL ? "ابحث عن منافس" : props.onlineButtonLabel, image: require("../assets/fantasy-menu/online.png"), accent: "#B99AFF", onPress: props.onOnlinePress },
  { id:"team",title:props.isRTL?"فرق — 2 ضد 2":"Team Up",description:props.isRTL?"فريقان · 2 ضد 2":"Four players, two teams, automatic matchmaking",button:props.isRTL?"ابحث عن فريق":"Find a team",image:require("../assets/fantasy-menu/team-up.png"),accent:"#67D9CD",onPress:props.onTeamPress },
  { id:"four",title:props.isRTL?"4 لاعبين":"4 Players",description:props.isRTL?"أربعة لاعبين · كل لاعب لنفسه":"Four players, everyone for themselves",button:props.isRTL?"ابحث عن لاعبين":"Find 3 opponents",image:require("../assets/fantasy-menu/four-players.png"),accent:"#F1BE79",onPress:props.onFourPress },
  { id: "friends", title: props.isRTL ? "غرفة مع الأصدقاء" : "Room with friends", description: props.isRTL ? "أنشئ غرفة أو انضم برمز" : "Create a room or join your friends with a code", button: props.isRTL ? "دخول الغرفة" : "Open rooms", image: require("../assets/fantasy-menu/friends.png"), accent: "#EBC375", onPress: props.onFriendsPress },
 ];
 useLayoutEffect(() => {
  if(webSnap.current)clearTimeout(webSnap.current);
  programmaticTarget.current=selectedRef.current===0?null:selectedRef.current;
  list.current?.scrollToOffset({ offset: selectedRef.current * stride, animated: false });
 }, [stride]);
 const select = (index: number) => {
  const next = Math.max(0, Math.min(modes.length-1, index));
  programmaticTarget.current=next;
  selectedRef.current = next; setSelected(next);
  list.current?.scrollToOffset({ offset: next * stride, animated: !reduced });
 };
 useEffect(() => () => { if (webSnap.current) clearTimeout(webSnap.current); }, []);
 const sync = (offset: number, measuredWidth?:number) => {
  if(measuredWidth!==undefined&&Math.abs(measuredWidth-trackWidth)>1)return;
  // Ignore intermediate offsets while selecting or restoring a card after rotation.
  if(programmaticTarget.current!==null){
   if(Math.abs(offset-programmaticTarget.current*stride)>1)return;
   programmaticTarget.current=null;
  }
  const next = Math.max(0, Math.min(modes.length-1, Math.round(offset / stride)));
  selectedRef.current = next; setSelected(previous => previous === next ? previous : next);
  if (Platform.OS === "web") {
    if (webSnap.current) clearTimeout(webSnap.current);
    webSnap.current = setTimeout(() => {
      if (Math.abs(offset - next * stride) > 1) list.current?.scrollToOffset({ offset: next * stride, animated: !reduced });
    }, 150);
  }
 };
 return <View style={s.container} onLayout={event => setTrackWidth(Math.max(240, event.nativeEvent.layout.width))}>
  <View accessibilityRole="tablist" style={[s.modeTabs,{flexDirection:props.isRTL?"row-reverse":"row"}]}>{modes.map((mode,index)=><Pressable key={mode.id} accessibilityRole="tab" accessibilityLabel={mode.title} accessibilityState={{selected:index===selected}} onPress={()=>select(index)} style={[s.modeTab,index===selected&&s.modeTabActive]}><Ionicons name={mode.id==="offline"?"cloud-offline-outline":mode.id==="online"?"globe-outline":mode.id==="team"?"people":mode.id==="four"?"game-controller-outline":"people-outline"} size={19} color={index===selected?"#65FFF0":"#F2D69E"}/><Text maxFontSizeMultiplier={1.3} style={s.modeTabText}>{props.isRTL?({offline:"دون اتصال",online:"أونلاين",team:"فرق",four:"4 لاعبين",friends:"الأصدقاء"}[mode.id]):({offline:"Offline",online:"Online",team:"Teams",four:"4 Players",friends:"Friends"}[mode.id])}</Text></Pressable>)}</View>
  <FlatList ref={list} horizontal data={modes} keyExtractor={mode => mode.id} showsHorizontalScrollIndicator={false}
   nestedScrollEnabled directionalLockEnabled decelerationRate="fast" snapToInterval={stride} snapToAlignment="start"
   getItemLayout={(_, index) => ({ length: stride, offset: stride * index, index })}
   onScrollBeginDrag={()=>{programmaticTarget.current=null;}}
   onTouchStart={()=>{programmaticTarget.current=null;}}
   onScroll={event => sync(event.nativeEvent.contentOffset.x,event.nativeEvent.layoutMeasurement.width)} scrollEventThrottle={32}
   onMomentumScrollEnd={event => sync(event.nativeEvent.contentOffset.x,event.nativeEvent.layoutMeasurement.width)}
   contentContainerStyle={{ paddingHorizontal: 28, paddingVertical: 6 }} style={{ width: "100%", direction: "ltr" }}
   ItemSeparatorComponent={() => <View style={{ width: gap }} />}
   renderItem={({ item, index }) => <View style={[s.card, { width: cardWidth, height: cardHeight, borderColor: index === selected ? "#E8C37C" : "#92704F", opacity: index === selected ? 1 : 0.84 }]}>
    <Image source={item.image} accessibilityLabel={props.isRTL ? `رسم وضع ${item.title}` : `${item.title} artwork`} resizeMode="cover" style={s.art} />
    <LinearGradient colors={["#26103800", "#23103233", "#26103DEB", "#22102FFF"]} locations={[0, 0.3, 0.62, 1]} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={s.innerBorder} />
    <View style={s.modeNumber}><Text style={s.modeNumberText}>0{index + 1}</Text></View>
    <View style={s.cardBody}>
     <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={[s.title, { fontSize: cardWidth < 280 ? 20 : 23 }]}>{item.title}</Text>
     <Text maxFontSizeMultiplier={1.5} style={s.description}>{item.description}</Text>
     <Pressable accessibilityRole="button" accessibilityLabel={item.button} accessibilityHint={item.description} onPress={item.onPress} style={({ pressed }) => [s.play, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
      <LinearGradient colors={["#35E5D8", "#07939E"]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.playFill}>
       <Text maxFontSizeMultiplier={1.5} style={[s.playText, { color: "#10243B" }]}>{item.button}</Text>
       <Ionicons name={props.isRTL ? "arrow-back" : "arrow-forward"} size={20} color={item.id === "offline" ? "#FFF8DE" : "#2B163D"} />
      </LinearGradient>
     </Pressable>
    </View>
   </View>} />
  <View style={s.controls}>
   <Pressable accessibilityRole="button" accessibilityLabel={props.isRTL ? "الوضع السابق" : "Previous mode"} disabled={selected === 0} onPress={() => select(selected - 1)} style={[s.arrow, selected === 0 && { opacity: 0.3 }]}><Ionicons name="chevron-back" size={25} color="#EEC47E" /></Pressable>
   <View style={s.dots}>{modes.map((mode, index) => <Pressable key={mode.id} accessibilityRole="button" accessibilityLabel={`${props.selectorLabel}: ${mode.title}`} accessibilityState={{selected:index===selected}} onPress={() => select(index)} style={s.dotTarget}><View style={[s.dot,index===selected&&s.activeDot]}/></Pressable>)}</View>
   <Pressable accessibilityRole="button" accessibilityLabel={props.isRTL ? "الوضع التالي" : "Next mode"} disabled={selected === modes.length-1} onPress={() => select(selected + 1)} style={[s.arrow, selected === modes.length-1 && { opacity: 0.3 }]}><Ionicons name="chevron-forward" size={25} color="#EEC47E" /></Pressable>
  </View>
  <Text style={s.hint}>{props.swipeHint}</Text>
 </View>;
}

const s = StyleSheet.create({
 modeTabs:{width:"100%",gap:4,paddingHorizontal:12,marginBottom:4},modeTab:{flex:1,minWidth:0,minHeight:56,borderRadius:12,borderWidth:1,borderColor:"#85619F",backgroundColor:"#30204D",alignItems:"center",justifyContent:"center",padding:3,gap:2},modeTabActive:{borderColor:"#4CEADE",backgroundColor:"#0D727E"},modeTabText:{fontFamily:"Cairo_700Bold",fontSize:9,color:"#FFF0D3",textAlign:"center"},container:{width:"100%",alignItems:"center"},card:{height:282,borderRadius:28,borderWidth:2,overflow:"hidden",backgroundColor:"#271239"},art:{position:"absolute",top:0,left:0,width:"100%",height:"100%"},innerBorder:{position:"absolute",top:5,left:5,right:5,bottom:5,borderRadius:22,borderWidth:1,borderColor:"#E6BB7048"},modeNumber:{position:"absolute",top:12,right:15,paddingHorizontal:8,borderRadius:8,backgroundColor:"#251136BB"},modeNumberText:{color:"#F3D49B",fontFamily:"Cairo_700Bold",fontSize:11},cardBody:{flex:1,justifyContent:"flex-end",alignItems:"center",padding:16,gap:3},title:{fontFamily:"Cairo_700Bold",color:"#FFE7A7",textAlign:"center"},description:{fontFamily:"Cairo_400Regular",fontSize:11,color:"#F5E6FA",textAlign:"center",minHeight:19},play:{width:"100%",borderRadius:17,borderWidth:1.5,borderColor:"#F5D08B",overflow:"hidden",marginTop:6},playFill:{minHeight:49,paddingVertical:9,paddingHorizontal:10,flexDirection:"row",gap:12,alignItems:"center",justifyContent:"center"},playText:{fontFamily:"Cairo_700Bold",fontSize:18,flexShrink:1,minWidth:0,textAlign:"center"},controls:{flexDirection:"row",alignItems:"center",gap:18,justifyContent:"center",height:38},arrow:{width:42,height:38,alignItems:"center",justifyContent:"center"},dots:{flexDirection:"row"},dotTarget:{width:30,height:36,alignItems:"center",justifyContent:"center"},dot:{width:7,height:7,borderRadius:4,backgroundColor:"#B7A3CC"},activeDot:{width:12,height:12,borderRadius:6,backgroundColor:"#F6C66F",borderWidth:2,borderColor:"#FFE7AB"},hint:{fontFamily:"Cairo_600SemiBold",color:"#E9D8F1",fontSize:11,lineHeight:18,textAlign:"center",marginBottom:8},
});
