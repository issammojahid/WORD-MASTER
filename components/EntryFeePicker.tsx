import {ScaledText as Text} from "@/components/ScaledText";
import React from "react";
import {Image, Pressable, StyleSheet, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {ENTRY_FEES} from "@shared/coin-entry";
import {publicQueueSize,type PublicQueueMode} from "@shared/public-game";
import {useTheme} from "@/contexts/ThemeContext";
const ART={solo:require("../assets/fantasy-menu/online.png"),team:require("../assets/fantasy-menu/team-up.png"),four:require("../assets/fantasy-menu/four-players.png")};
export function EntryFeePicker({mode,balance,fee,onSelect,disabled=false}:{mode:PublicQueueMode;balance:number|null;fee:number;onSelect:(fee:number)=>void;disabled?:boolean}){
 const {theme}=useTheme();
 return <View style={{gap:14}}>
  <View style={[s.balance,{borderColor:theme.cardBorder,backgroundColor:theme.card}]}><Ionicons name="layers" color="#F2C773" size={21}/><Text style={s.amount}>{balance===null?"…":balance.toLocaleString()}</Text><Text style={[s.body,{color:theme.textPrimary}]}>رصيدك</Text></View>
  <Image source={ART[mode]} style={s.hero} resizeMode="cover"/>
  <Text style={[s.title,{color:theme.textPrimary}]}>اختر قاعة اللعب</Text><Text style={[s.body,{color:theme.textSecondary}]}>المطابقة مع لاعبين اختاروا مبلغ الدخول نفسه</Text>
  <View style={s.grid}>{ENTRY_FEES.map(value=>{const insufficient=balance!==null&&balance<value,selected=value===fee;return <View key={value} style={s.slot}><Pressable accessibilityRole="radio" accessibilityLabel={`${value} عملة${insufficient?"، رصيد غير كافٍ":""}`} accessibilityState={{checked:selected,disabled:disabled||insufficient}} disabled={disabled||insufficient} onPress={()=>onSelect(value)} style={[s.tile,{backgroundColor:theme.card,borderColor:selected?"#2DE0D1":theme.cardBorder,opacity:insufficient?.45:1}]}><Ionicons name="layers" size={32} color="#EFC278"/><Text style={s.amount}>{value}</Text><Text style={[s.body,{color:theme.textSecondary}]}>{insufficient?"رصيد غير كافٍ":"عملة"}</Text>{selected?<Ionicons name="checkmark-circle" size={20} color="#37DECB" style={s.check}/>:null}</Pressable></View>;})}</View>
  {fee>0?<View style={[s.summary,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><View style={s.row}><Text style={s.gold}>{fee} عملة</Text><Text style={[s.body,{color:theme.textPrimary}]}>مبلغ الدخول لكل لاعب</Text></View><View style={s.row}><Text style={s.gold}>{fee*publicQueueSize(mode)} عملة</Text><Text style={[s.body,{color:theme.textPrimary}]}>مجموع الجائزة</Text></View>{mode==="team"?<Text style={[s.body,{color:theme.textSecondary}]}>نصيب كل لاعب في الفريق الفائز: {fee*2} عملة</Text>:null}<Text style={[s.body,{color:theme.textMuted}]}>الجائزة تشمل الدخول · التعادل يعيد الدخول للجميع</Text></View>:<Text style={[s.body,{color:theme.textPrimary}]}>تدريب مجاني دون مبلغ دخول</Text>}
  <Text style={[s.body,{color:theme.textMuted}]}>يُخصم مبلغ الدخول عند بدء المباراة فقط</Text>
 </View>;
}
const s=StyleSheet.create({balance:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10,borderWidth:1,borderRadius:24,padding:8},hero:{height:145,width:"100%",borderRadius:18},title:{fontFamily:"Cairo_700Bold",fontSize:22,textAlign:"center"},body:{fontFamily:"Cairo_400Regular",fontSize:11,lineHeight:20,textAlign:"center"},amount:{fontFamily:"Cairo_700Bold",fontSize:26,color:"#FFE3A6"},gold:{fontFamily:"Cairo_700Bold",fontSize:13,color:"#FFE3A6"},grid:{flexDirection:"row-reverse",flexWrap:"wrap",margin:-5},slot:{width:"50%",padding:5},tile:{borderWidth:1.5,borderRadius:19,minHeight:128,alignItems:"center",justifyContent:"center",gap:4},check:{position:"absolute",top:9,right:9},summary:{borderWidth:1,borderRadius:18,padding:12,gap:10},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8}});
