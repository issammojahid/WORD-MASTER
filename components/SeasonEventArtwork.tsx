import React from 'react';
import {Image,View} from 'react-native';
import type {SeasonEventId} from '@/lib/season-calendar';

// Five authored banner scenes, separate from the cosmetic inventory atlas.
const ROW:Record<SeasonEventId,number>={atlas:0,arabic:1,winter:2,gifts:3,newyear:4};
export function SeasonEventArtwork({event,width,height}:{event:SeasonEventId;width:number;height:number}){
 const aspect=793*5/1983;
 const artWidth=Math.max(width,height*aspect),rowHeight=artWidth/aspect;
 return <View pointerEvents="none" style={{width,height,overflow:'hidden'}}>
  <Image source={require('../assets/seasons-2027/event-banners.png')} fadeDuration={0} resizeMode="stretch" style={{position:'absolute',width:artWidth,height:rowHeight*5,left:(width-artWidth)*.3,top:-ROW[event]*rowHeight+(height-rowHeight)/2}}/>
 </View>;
}
