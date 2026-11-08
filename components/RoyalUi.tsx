import {ScaledText as Text} from "@/components/ScaledText";
import React,{useId} from 'react';
import {Text as NativeText, Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle,type ViewProps} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Svg,{Defs,LinearGradient as SvgGradient,Stop,Path,Pattern} from 'react-native-svg';

export type RoyalIconName='coins'|'trophy'|'swords'|'music'|'speaker'|'bell'|'motion'|'quality'|'globe'|'scroll'|'settings'|'home'|'store'|'tasks'|'gift'|'privacy';
const ICONS:RoyalIconName[]=['coins','trophy','swords','music','speaker','bell','motion','quality','globe','scroll','settings','home','store','tasks','gift','privacy'];
export function RoyalIcon({name,size=40}:{name:RoyalIconName;size?:number}){
 const index=ICONS.indexOf(name);
 return <View pointerEvents="none" style={{width:size,height:size,overflow:'hidden'}}><Image source={require('../assets/ui-2027/royal-icons.png')} resizeMode="stretch" fadeDuration={0} style={{position:'absolute',width:size*4,height:size*4,left:-(index%4)*size,top:-Math.floor(index/4)*size}}/></View>;
}

export function RoyalSurface({children,style,selected=false,rounded=false,...props}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;selected?:boolean;rounded?:boolean}&Omit<ViewProps,"style"|"children">){
 const id=useId().replace(/:/g,'');
 const edge=selected?'#4DF4EB':'#E8BD67';
 return <View {...props} style={[s.surface,style]}>
  <Svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
   <Defs><SvgGradient id={id+'fill'} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={selected?'#176D82':'#372257'}/><Stop offset=".5" stopColor={selected?'#0A4C69':'#211A45'}/><Stop offset="1" stopColor="#15172F"/></SvgGradient><SvgGradient id={id+'edge'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={selected?'#94FFF5':'#FFF0AE'}/><Stop offset=".4" stopColor={edge}/><Stop offset="1" stopColor={selected?'#10AFAA':'#996536'}/></SvgGradient><Pattern id={id+'pattern'} width="44" height="44" patternUnits="userSpaceOnUse"><Path d="M22 2l6 12 14 8-14 6-6 14-6-14L2 22l14-8zM0 0l44 44M44 0L0 44" fill="none" stroke="#BA91DD" strokeWidth=".8" opacity=".12"/></Pattern></Defs>
   <Path d={rounded?"M26 2H374Q398 2 398 26V154Q398 178 374 178H26Q2 178 2 154V26Q2 2 26 2Z":"M16 2H384L398 17V163L383 178H17L2 163V18Z"} fill={'url(#'+id+'fill)'} stroke={'url(#'+id+'edge)'} strokeWidth="2.5"/>
   <Path d={rounded?"M26 7H374Q392 7 392 26V154Q392 173 374 173H26Q8 173 8 154V26Q8 7 26 7Z":"M18 7H381L392 20V160L379 173H20L8 160V21Z"} fill={'url(#'+id+'pattern)'} stroke="#F1CB7B" strokeOpacity=".19" strokeWidth=".8"/>
   <Path d="M14 22l8-8 8 8-8 8zM370 22l8-8 8 8-8 8zM14 156l8-8 8 8-8 8zM370 156l8-8 8 8-8 8z" fill="none" stroke={edge} strokeWidth="1" opacity=".65"/>
  </Svg>
  {children}
 </View>;
}

export function RoyalBrand({width=160}:{width?:number}){
 return <View pointerEvents="none" accessibilityLabel="حروف المغرب" style={{width,height:width*.66,alignItems:'center',justifyContent:'center'}}>
  <Svg width="100%" height="100%" viewBox="0 0 240 160" style={StyleSheet.absoluteFill}><Defs><SvgGradient id="royal-brand" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#44265F"/><Stop offset="1" stopColor="#171A3A"/></SvgGradient></Defs><Path d="M24 41Q31 27 49 30L66 18 91 21 120 3 148 21 174 18 191 30Q210 27 216 41L234 55 225 81 234 105 212 120 192 124 181 141 151 138 120 156 89 138 59 141 48 124 27 120 6 105 15 81 6 55Z" fill="url(#royal-brand)" stroke="#F4CE78" strokeWidth="3"/><Path d="M58 144v-9h14v-6h8v6h20v-8h10v8h20v-8h10v8h18v-6h10v6h14v9z" fill="#D9AE5B"/><Path d="M120 6l3 10 10 1-8 6 2 10-7-6-8 6 3-10-9-6 11-1z" fill="#D9AE5B"/><Path d="M120 11l2 5 5 1-4 3 1 5-4-3-4 3 2-5-5-3 5-1z" fill="#198B83"/></Svg>
  <NativeText allowFontScaling={false} style={[s.brandText,{fontSize:width*.16,lineHeight:width*.19,marginTop:-width*.035}]}>حروف{`\n`}المغرب</NativeText>
 </View>;
}

export function RoyalHeading({title,subtitle}:{title:string;subtitle?:string}){
 return <View style={{alignItems:'center',gap:5}}><RoyalSurface style={s.heading}><Text style={s.headingStar}>✧</Text><Text accessibilityRole="header" style={s.headingText}>{title}</Text><Text style={s.headingStar}>✧</Text></RoyalSurface>{subtitle?<Text style={s.subtitle}>—　{subtitle}　—</Text>:null}</View>;
}

export function RoyalToggle({label,value,onChange}:{label:string;value:boolean;onChange:(value:boolean)=>void}){
 return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{checked:value}} aria-checked={value} onPress={()=>onChange(!value)} style={s.toggleTarget}><LinearGradient colors={value?['#35E2D0','#07858E','#055B6D']:['#5C6079','#30364C','#202338']} style={[s.toggle,{borderColor:value?'#5CFFF0':'#8E91AA'}]}><Text style={[s.toggleText,{paddingLeft:value?0:20,paddingRight:value?20:0}]}>{value?'مفعّل':'معطّل'}</Text><LinearGradient colors={['#FFFFFF','#CEDDE1']} style={[s.knob,value?{right:3}:{left:3}]}/></LinearGradient></Pressable>;
}
const s=StyleSheet.create({surface:{position:'relative',padding:14},brandText:{fontFamily:'Cairo_700Bold',color:'#FFE5A0',textAlign:'center',textShadowColor:'#946124',textShadowOffset:{width:0,height:2},textShadowRadius:1},heading:{minHeight:48,width:'100%',maxWidth:530,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:4,gap:18},headingText:{fontFamily:'Cairo_700Bold',fontSize:22,color:'#FFF4D7',textAlign:'center',flexShrink:1},headingStar:{fontSize:24,color:'#E8BF6A'},subtitle:{fontFamily:'Cairo_600SemiBold',fontSize:12,color:'#E9DDBF',textAlign:'center'},toggleTarget:{minHeight:44,minWidth:114,alignItems:'center',justifyContent:'center'},toggle:{width:114,height:29,borderWidth:1.5,borderRadius:20,justifyContent:'center'},toggleText:{fontFamily:'Cairo_700Bold',fontSize:12,color:'#FFF9E5',textAlign:'center'},knob:{position:'absolute',width:23,height:23,borderRadius:14,top:1.5,borderWidth:1,borderColor:'#DBFAFA'}});
