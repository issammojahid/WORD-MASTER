import React from "react";
import {StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {AvatarArtwork} from "./AvatarArtwork";
import {useTheme} from "@/contexts/ThemeContext";
import {usePlayer} from "@/contexts/PlayerContext";
import type {SkinId} from "@/contexts/PlayerContext";
export type RosterPlayer={id:string;name:string;score?:number;ready?:boolean;host?:boolean;connected?:boolean;teamId?:string|null};
const fallbackSkins:SkinId[]=["djellaba","amazigh","student","sport","king","astronaut","ninja"];
export function MatchRoster({players,ownId,lobby=false,capacity=players.length,compact=false}:{players:RosterPlayer[];ownId:string;lobby?:boolean;capacity?:number;compact?:boolean}){
 const {theme}=useTheme(),{profile}=usePlayer();
 const columns=capacity>2?4:2;
 return <View style={s.grid}>{Array.from({length:lobby?capacity:players.length},(_,index)=>{
  const player=players[index],self=player?.id===ownId;
  return <View key={player?.id??`empty-${index}`} style={[s.cell,{width:`${100/columns}%`}]}><View style={[s.tile,{backgroundColor:theme.card,borderColor:self?"#2ADDD0":theme.cardBorder+"88",paddingVertical:compact?5:10}]}>
   {player?<><AvatarArtwork skinId={self?profile.equippedSkin:fallbackSkins[index%fallbackSkins.length]} size={compact?28:lobby?50:36}/><Text numberOfLines={1} style={[s.name,{color:theme.textPrimary}]}>{self?"أنت":player.name}</Text>{lobby?<View style={s.status}><Ionicons name={player.host?"ribbon":player.ready?"checkmark-circle":"ellipse-outline"} color={player.ready?"#4DE3C9":"#E2BD7A"} size={13}/><Text style={[s.state,{color:theme.textSecondary}]}>{player.connected===false?"غير متصل":player.ready?"جاهز":"بانتظار"}</Text></View>:<Text style={s.score}>{player.score??0}</Text>}</>:<><Ionicons name="person-add-outline" color={theme.textMuted} size={34}/><Text style={[s.name,{color:theme.textMuted}]}>مكان شاغر</Text></>}
  </View></View>;
 })}</View>;
}
const s=StyleSheet.create({grid:{flexDirection:"row-reverse",flexWrap:"wrap",marginHorizontal:-3},cell:{padding:3},tile:{borderRadius:15,borderWidth:1,alignItems:"center",justifyContent:"center",gap:3,minHeight:64,paddingHorizontal:3},name:{fontFamily:"Cairo_700Bold",fontSize:11,alignSelf:"stretch",textAlign:"center"},status:{flexDirection:"row",gap:3,alignItems:"center"},state:{fontFamily:"Cairo_400Regular",fontSize:9},score:{fontFamily:"Cairo_700Bold",fontSize:16,color:"#F2C773"}});
