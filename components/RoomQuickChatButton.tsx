import React,{useState} from "react";
import {Pressable,ScrollView,StyleSheet,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {GameModal} from "./GameUi";
import {RoomQuickChat} from "./RoomQuickChat";
import type {Socket} from "socket.io-client";
import type {QuickRoomMessage} from "@shared/friends-room";
export function RoomQuickChatButton(props:{socket:Socket|null;matchId:string;history?:QuickRoomMessage[];connected:boolean}){
 const [open,setOpen]=useState(false);
 return <><Pressable accessibilityRole="button" accessibilityLabel="الرسائل السريعة" onPress={()=>setOpen(true)} style={s.button}><Ionicons name="chatbubble-ellipses-outline" size={21} color="#EAC582"/></Pressable><GameModal visible={open} onRequestClose={()=>setOpen(false)}><View style={{alignItems:"flex-start"}}><Pressable accessibilityRole="button" accessibilityLabel="إغلاق الرسائل" onPress={()=>setOpen(false)} style={s.button}><Ionicons name="close" color="#F2C773" size={21}/></Pressable></View><ScrollView style={{maxHeight:430}}><RoomQuickChat {...props}/></ScrollView></GameModal></>;
}
const s=StyleSheet.create({button:{width:44,height:44,borderWidth:1,borderColor:"#9475AD",borderRadius:14,backgroundColor:"#2B1940",alignItems:"center",justifyContent:"center"}});
