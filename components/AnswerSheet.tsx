import {ScaledText as Text} from "@/components/ScaledText";
import React,{useRef,useState} from "react";
import {StyleSheet, TextInput, View} from "react-native";
import {GAME_CATEGORIES,type GameCategory} from "@/constants/i18n";
import {useTheme} from "@/contexts/ThemeContext";
import {useLanguage} from "@/contexts/LanguageContext";

export function AnswerSheet({answers,onChange,onSubmit,disabled=false,maxLength=80}:{answers:Partial<Record<GameCategory,string>>;onChange:(category:GameCategory,value:string)=>void;onSubmit:()=>void;disabled?:boolean;maxLength?:number}){
 const {theme}=useTheme(),{t,isRTL}=useLanguage(),[focused,setFocused]=useState<GameCategory|null>(null),inputs=useRef<(TextInput|null)[]>([]);
 const completed=GAME_CATEGORIES.filter(category=>answers[category]?.trim()).length;
 return <View style={[s.panel,{backgroundColor:theme.card,borderColor:theme.cardBorder}]}>
  {GAME_CATEGORIES.map((category,index)=><View key={category} style={[s.row,{flexDirection:isRTL?"row-reverse":"row",borderBottomColor:theme.cardBorder+"55"}]}>
   <Text style={[s.label,{color:theme.textSecondary,textAlign:isRTL?"right":"left"}]}>{t[category]}</Text>
   <TextInput ref={input=>{inputs.current[index]=input;}} accessibilityLabel={t[category]} editable={!disabled} value={answers[category]??""} onChangeText={value=>onChange(category,value)} onFocus={()=>setFocused(category)} onBlur={()=>setFocused(current=>current===category?null:current)} placeholder={isRTL?"اكتب إجابتك…":"Your answer…"} placeholderTextColor={theme.inputPlaceholder} maxLength={maxLength} autoCorrect={false} autoCapitalize="none" returnKeyType={index===GAME_CATEGORIES.length-1?"done":"next"} blurOnSubmit={index===GAME_CATEGORIES.length-1} onSubmitEditing={()=>{if(index<GAME_CATEGORIES.length-1)inputs.current[index+1]?.focus();else onSubmit();}} style={[s.input,{color:theme.inputText,textAlign:isRTL?"right":"left",borderBottomColor:focused===category?"#31DED3":"transparent"}]}/>
  </View>)}
  <Text accessibilityLiveRegion="polite" style={[s.progress,{color:theme.textMuted}]}>{isRTL?`${completed} من ${GAME_CATEGORIES.length}`:`${completed} / ${GAME_CATEGORIES.length}`}</Text>
 </View>;
}
const s=StyleSheet.create({panel:{borderWidth:1,borderRadius:20,paddingHorizontal:12,overflow:"hidden"},row:{minHeight:58,alignItems:"center",gap:10,borderBottomWidth:StyleSheet.hairlineWidth},label:{width:"35%",fontFamily:"Cairo_600SemiBold",fontSize:12,lineHeight:21},input:{flex:1,minWidth:0,minHeight:52,fontFamily:"Cairo_600SemiBold",fontSize:17,borderBottomWidth:2,paddingVertical:8,paddingHorizontal:4},progress:{fontFamily:"Cairo_600SemiBold",fontSize:11,textAlign:"center",paddingVertical:8}});
