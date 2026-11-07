import React, { useEffect, useState } from "react";
import { AppState, Text, StyleSheet } from "react-native";
import { HALLOWEEN_END_LABEL, halloweenTimeLeft } from "@shared/halloween-update";
export function HalloweenCountdown(){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const tick=()=>setNow(Date.now()),timer=setInterval(tick,1000),subscription=AppState.addEventListener("change",state=>{if(state==="active")tick();});return ()=>{clearInterval(timer);subscription.remove();};},[]);
 const left=halloweenTimeLeft(now),pad=(n:number)=>String(n).padStart(2,"0");
 const dayText=left.days===0?"أقل من يوم":left.days===1?"يوم واحد":left.days===2?"يومان":left.days<=10?left.days+" أيام":left.days+" يوماً";
 return <Text style={s.text}>{left.totalSeconds>0?"ينتهي في "+HALLOWEEN_END_LABEL+" · متبقٍ "+dayText+" · "+pad(left.hours)+":"+pad(left.minutes)+":"+pad(left.seconds):"انتهى موسم هالوين · مجموعتك المكتسبة محفوظة"}</Text>;
}
const s=StyleSheet.create({text:{fontFamily:"Cairo_600SemiBold",fontSize:11,lineHeight:20,color:"#FFE1A0",textAlign:"right"}});
