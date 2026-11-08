import {ScaledText as Text} from "@/components/ScaledText";
import React from "react";
import {useWindowDimensions, Pressable, StyleSheet, View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {router} from "expo-router";
import {SEASON_EVENTS,initialSeasonIndex} from "@/lib/season-calendar";
import {SeasonEventArtwork} from "./SeasonEventArtwork";

export function SeasonCollectionBanner(){const {width}=useWindowDimensions();const artWidth=Math.min(width,760)-32;const event=SEASON_EVENTS[initialSeasonIndex(Date.now())];return <Pressable accessibilityRole="button" accessibilityLabel={`استكشف ${event.title}`} onPress={()=>router.push({pathname:"/season",params:{event:event.id}})} style={s.banner}><View style={{position:"absolute",left:0,top:0}}><SeasonEventArtwork event={event.id} width={artWidth} height={76}/></View><LinearGradient colors={["#20183F11","#20183FBB"]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill}/><View style={s.copy}><Text style={s.title}>{event.title}</Text><Text style={s.dates}>{event.dates} · استكشف المظاهر</Text></View></Pressable>;}
const s=StyleSheet.create({banner:{height:76,borderWidth:1,borderColor:"#B9915B",borderRadius:17,overflow:"hidden",justifyContent:"center"},art:{position:"absolute",width:"100%",height:550,top:-45},copy:{padding:12,alignItems:"flex-end"},title:{fontFamily:"Cairo_700Bold",fontSize:17,color:"#FFE3A6"},dates:{fontFamily:"Cairo_600SemiBold",fontSize:10,color:"#E6D4EF"}});
