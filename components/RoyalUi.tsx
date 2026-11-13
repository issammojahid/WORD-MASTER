import {ClanEmblem} from "./ClanEmblem";
import {ScaledText as Text} from "@/components/ScaledText";
import React from 'react';
import {Text as NativeText, Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle,type ViewProps} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Svg,{Defs,LinearGradient as SvgGradient,Stop,Path} from 'react-native-svg';
import {useTheme} from '@/contexts/ThemeContext';

export type RoyalIconName='clan'|'podium'|'coins'|'trophy'|'swords'|'music'|'speaker'|'bell'|'motion'|'quality'|'globe'|'scroll'|'settings'|'home'|'store'|'tasks'|'gift'|'privacy';
const ICONS:RoyalIconName[]=['coins','trophy','swords','music','speaker','bell','motion','quality','globe','scroll','settings','home','store','tasks','gift','privacy'];
export function RoyalIcon({name,size=40}:{name:RoyalIconName;size?:number}){
 if(name==='clan')return <View pointerEvents="none" style={{width:size,height:size}}><ClanEmblem size={size}/></View>;
 if(name==='podium')return <View pointerEvents="none"><Image source={require('../assets/ui-2027/leaderboard-podium.png')} resizeMode="contain" fadeDuration={0} style={{width:size,height:size}}/></View>;
 const index=ICONS.indexOf(name);
 return <View pointerEvents="none" style={{width:size,height:size,overflow:'hidden'}}><Image source={require('../assets/ui-2027/royal-icons.png')} resizeMode="stretch" fadeDuration={0} style={{position:'absolute',width:size*4,height:size*4,left:-(index%4)*size,top:-Math.floor(index/4)*size}}/></View>;
}

export function RoyalSurface({children,style,selected=false,rounded=false,...props}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;selected?:boolean;rounded?:boolean}&Omit<ViewProps,"style"|"children">){
 const {theme}=useTheme();
 return <View {...props} style={[s.surface,{backgroundColor:selected?'#244654':theme.card,borderColor:selected?'#35D5C9':theme.cardBorder,borderRadius:rounded?22:17},style]}>{children}</View>;
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
const s=StyleSheet.create({surface:{position:'relative',padding:14,borderWidth:1.5,overflow:'hidden',shadowColor:'#080615',shadowOffset:{width:0,height:5},shadowOpacity:.2,shadowRadius:9,elevation:3},brandText:{fontFamily:'Cairo_700Bold',color:'#FFE5A0',textAlign:'center',textShadowColor:'#946124',textShadowOffset:{width:0,height:2},textShadowRadius:1},heading:{minHeight:48,width:'100%',maxWidth:530,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:4,gap:18},headingText:{fontFamily:'Cairo_700Bold',fontSize:22,color:'#FFF4D7',textAlign:'center',flexShrink:1},headingStar:{fontSize:24,color:'#E8BF6A'},subtitle:{fontFamily:'Cairo_600SemiBold',fontSize:12,color:'#E9DDBF',textAlign:'center'},toggleTarget:{minHeight:44,minWidth:114,alignItems:'center',justifyContent:'center'},toggle:{width:114,height:29,borderWidth:1.5,borderRadius:20,justifyContent:'center'},toggleText:{fontFamily:'Cairo_700Bold',fontSize:12,color:'#FFF9E5',textAlign:'center'},knob:{position:'absolute',width:23,height:23,borderRadius:14,top:1.5,borderWidth:1,borderColor:'#DBFAFA'}});
