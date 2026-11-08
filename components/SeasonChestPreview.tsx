import {ScaledText as Text} from "@/components/ScaledText";
import React,{useEffect,useRef} from 'react';
import {Animated, Image, StyleSheet, View} from 'react-native';
import {useReducedMotion} from './GameUi';
import {SeasonCatalogArtwork} from './SeasonCatalogArtwork';
import {seasonPreviewItems} from '@/constants/season-catalog';
import type {SeasonEventId} from '@/lib/season-calendar';
import {useAppActive} from '@/lib/use-app-active';

// Four authored chest frames, cross-faded on the native driver. No reward mutation.
export function SeasonChestPreview({event}:{event:SeasonEventId}){
 const reduced=useReducedMotion(),active=useAppActive(),open=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  if(reduced||!active){open.setValue(1);return;}
  open.setValue(0);
  const animation=Animated.timing(open,{toValue:1,delay:220,duration:1800,useNativeDriver:true});
  animation.start();
  return()=>{animation.stop();open.stopAnimation();};
 },[active,event,open,reduced]);
 const icon=seasonPreviewItems(event).find(item=>item.kind==='icon')!;
 const ranges=[{inputRange:[0,.18,.3,1],outputRange:[1,1,0,0]},{inputRange:[0,.18,.3,.42,.54,1],outputRange:[0,0,1,1,0,0]},{inputRange:[0,.42,.54,.66,.8,1],outputRange:[0,0,1,1,0,0]},{inputRange:[0,.66,.8,1],outputRange:[0,0,1,1]}];
 return <View style={s.stage}>
  {ranges.map((range,index)=><Animated.View key={index} pointerEvents="none" style={[s.frame,{opacity:open.interpolate(range)}]}><Image source={require('../assets/ui-2027/chest-animation-atlas.png')} resizeMode="stretch" fadeDuration={0} style={{position:'absolute',width:560,height:560,left:-(index%2)*280,top:-Math.floor(index/2)*280}}/></Animated.View>)}
  <Animated.View pointerEvents="none" style={[s.prize,{opacity:open.interpolate({inputRange:[0,.72,1],outputRange:[0,0,1]}),transform:[{translateY:open.interpolate({inputRange:[0,.72,1],outputRange:[50,50,-15]})}]}]}><SeasonCatalogArtwork item={icon} size={70}/></Animated.View>
  <Text style={s.note}>عرض فتح الصندوق · دون إضافة مكافأة إلى الحساب</Text>
 </View>;
}
const s=StyleSheet.create({stage:{width:280,height:300,overflow:'hidden'},frame:{position:'absolute',top:0,left:0,width:280,height:280,overflow:'hidden'},prize:{position:'absolute',top:108,left:105},note:{position:'absolute',bottom:5,left:4,right:4,textAlign:'center',fontFamily:'Cairo_400Regular',fontSize:10,color:'#CDBCDD'}});
