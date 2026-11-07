import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
export function FantasySettingsSection({title,children,defaultExpanded=false}:{title:React.ReactNode;children:React.ReactNode;defaultExpanded?:boolean}){
 const [expanded,setExpanded]=useState(defaultExpanded),{theme}=useTheme();
 return <View style={[s.panel,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={s.heading}><Ionicons name={expanded?"chevron-up":"chevron-down"} size={17} color={theme.textSecondary}/><Text style={[s.title,{color:theme.textPrimary}]}>{title}</Text></Pressable>{expanded?<View style={s.body}>{children}</View>:null}</View>;
}
const s=StyleSheet.create({panel:{borderRadius:18,borderWidth:1,overflow:"hidden"},heading:{minHeight:56,paddingHorizontal:16,flexDirection:"row",alignItems:"center",gap:12},title:{fontFamily:"Cairo_700Bold",fontSize:14,flex:1,textAlign:"right"},body:{paddingHorizontal:12,paddingBottom:12,gap:10}});
