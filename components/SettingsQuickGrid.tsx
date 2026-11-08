import React from "react";
import {Pressable,StyleSheet,Switch,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useTheme} from "@/contexts/ThemeContext";
import {useLanguage} from "@/contexts/LanguageContext";
import {setInterfacePreferences,useInterfacePreferences} from "@/lib/interface-preferences";
export function SettingsQuickGrid({notifications,onNotifications}:{notifications:boolean;onNotifications:(value:boolean)=>void}){
 const {theme}=useTheme(),language=useLanguage(),preferences=useInterfacePreferences();
 const toggles=[{label:"الموسيقى",icon:"musical-notes" as const,value:language.musicEnabled,set:language.setMusicEnabled},{label:"المؤثرات",icon:"volume-high" as const,value:language.soundEffects,set:language.setSoundEffects},{label:"الإشعارات",icon:"notifications" as const,value:notifications,set:onNotifications},{label:"تقليل الحركة",icon:"accessibility" as const,value:preferences.reduceMotion,set:(value:boolean)=>setInterfacePreferences({reduceMotion:value})}];
 return <View style={s.grid}>{toggles.map(item=><View key={item.label} style={s.slot}><View style={[s.tile,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><Ionicons name={item.icon} size={30} color="#E6BE79"/><Text style={[s.title,{color:theme.textPrimary}]}>{item.label}</Text><Switch accessibilityLabel={item.label} value={item.value} onValueChange={item.set} trackColor={{false:"#5E486D",true:"#147E85"}} thumbColor={item.value?"#33DED0":"#CEBDDA"}/></View></View>)}
 <View style={s.slot}><Pressable accessibilityRole="button" accessibilityLabel="تغيير اللغة" onPress={()=>language.setLanguage(language.language==="ar"?"en":"ar")} style={[s.tile,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><Text style={s.glyph}>ض</Text><Text style={[s.title,{color:theme.textPrimary}]}>اللغة</Text><Text style={s.value}>{language.language==="ar"?"العربية":"English"}</Text></Pressable></View>
 <View style={s.slot}><Pressable accessibilityRole="button" accessibilityLabel="جودة الرسوم" onPress={()=>setInterfacePreferences({quality:preferences.quality==="auto"?"low":"auto"})} style={[s.tile,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}><Ionicons name="sparkles" size={30} color="#E6BE79"/><Text style={[s.title,{color:theme.textPrimary}]}>جودة الرسوم</Text><Text style={s.value}>{preferences.quality==="low"?"اقتصادية":"تلقائية"}</Text></Pressable></View>
 </View>;
}
const s=StyleSheet.create({grid:{flexDirection:"row-reverse",flexWrap:"wrap",margin:-5},slot:{width:"50%",padding:5},tile:{minHeight:138,borderWidth:1,borderRadius:20,padding:14,alignItems:"center",justifyContent:"center",gap:5},title:{fontFamily:"Cairo_700Bold",fontSize:14,textAlign:"center"},value:{fontFamily:"Cairo_600SemiBold",fontSize:12,color:"#72E9DE"},glyph:{fontFamily:"Cairo_700Bold",fontSize:29,color:"#E6BE79",lineHeight:38}});
