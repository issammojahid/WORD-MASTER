import {ScaledText as Text} from "@/components/ScaledText";
import React,{useEffect,useRef,useState} from 'react';
import {Animated, AppState, StyleSheet, View} from 'react-native';
import {SeasonCatalogArtwork} from './SeasonCatalogArtwork';
import {PlayerAvatar,useReducedMotion} from './GameUi';
import {usePlayer} from '@/contexts/PlayerContext';
import type {SeasonPreviewItem} from '@/constants/season-catalog';

export function SeasonItemPreview({item}:{item:SeasonPreviewItem}){
 const {profile}=usePlayer(),reduced=useReducedMotion(),progress=useRef(new Animated.Value(0)).current;
 const [active,setActive]=useState(AppState.currentState==='active');
 useEffect(()=>{const subscription=AppState.addEventListener('change',state=>setActive(state==='active'));return()=>subscription.remove();},[]);
 useEffect(()=>{
  progress.setValue(0);
  if(reduced||!active)return;
  const loop=Animated.loop(Animated.timing(progress,{toValue:1,duration:item.kind==='victory'?2600:4200,useNativeDriver:true}));
  loop.start();return()=>{loop.stop();progress.stopAnimation();};
 },[active,item.key,item.kind,progress,reduced]);
 const float=progress.interpolate({inputRange:[0,.5,1],outputRange:[0,-6,0]});
 const pulse=progress.interpolate({inputRange:[0,.5,1],outputRange:[1,1.035,1]});
 return <View style={s.stage}>
  {item.kind==='background'?<View style={StyleSheet.absoluteFill}><SeasonCatalogArtwork item={item} size={280}/></View>:null}
  {item.kind==='frame'?<><PlayerAvatar skinId={profile.equippedSkin} size={164} frameId="basic_frame"/><View style={s.overlay}><SeasonCatalogArtwork item={item} size={230}/></View></>:null}
  {item.kind==='nameplate'?<><PlayerAvatar skinId={profile.equippedSkin} size={100}/><View style={s.plate}><SeasonCatalogArtwork item={item} size={250}/><Text numberOfLines={1} style={[s.playerName,((item.event==="gifts"&&item.variant>=3)||(item.event==="winter"&&item.variant>=3)||(item.event==="newyear"&&item.variant===1))&&{color:"#FFF0D6"}]}>{profile.name}</Text></View></>:null}
  {item.kind==='background'?<PlayerAvatar skinId={profile.equippedSkin} frameId={profile.equippedCosmetics.frame} size={120}/>:null}
  {item.kind==='avatar'||item.kind==='icon'||item.kind==='victory'?<Animated.View style={{transform:[{translateY:item.kind==='avatar'?float:0},{scale:pulse}]}}><SeasonCatalogArtwork item={item} size={item.kind==='icon'?150:230}/></Animated.View>:null}
  {!reduced&&active&&item.kind==='victory'?Array.from({length:12},(_,index)=>{
   const angle=index*Math.PI/6,radius=85;
   let x:number|Animated.AnimatedInterpolation<number>=0,y:number|Animated.AnimatedInterpolation<number>=0;
   if(item.variant===4){x=(index-5.5)*20;y=progress.interpolate({inputRange:[0,1],outputRange:[-130,140]});}
   else if(item.variant===2){x=progress.interpolate({inputRange:[0,.5,1],outputRange:[0,Math.cos(angle)*radius,Math.cos(angle)*radius*1.2]});y=progress.interpolate({inputRange:[0,.5,1],outputRange:[75,-75-Math.abs(Math.sin(angle))*30,100]});}
   else{x=progress.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(angle)*radius]});y=progress.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(angle)*radius]});}
   return <Animated.View key={index} pointerEvents="none" style={[s.particle,{opacity:progress.interpolate({inputRange:[0,.15,.8,1],outputRange:[0,1,1,0]}),transform:[{rotate:item.variant===1||item.variant===3?progress.interpolate({inputRange:[0,1],outputRange:['0deg',item.variant===1?'540deg':'360deg']}):'0deg'},{translateX:x},{translateY:y}]}]}><Text style={s.spark}>{index%3===0?'✦':'·'}</Text></Animated.View>;
  }):null}
 </View>;
}
const s=StyleSheet.create({stage:{width:280,height:280,borderRadius:22,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:'#171331',borderWidth:1,borderColor:'#8F724D'},overlay:{position:'absolute',top:25,left:25},plate:{width:250,height:100,alignItems:'center',justifyContent:'center',overflow:'hidden'},playerName:{position:'absolute',width:164,textAlign:'center',fontFamily:'Cairo_700Bold',fontSize:16,color:'#392040'},particle:{position:'absolute',left:130,top:124,width:24,height:28,alignItems:'center',justifyContent:'center'},spark:{fontSize:25,color:'#FFE39C'}});
