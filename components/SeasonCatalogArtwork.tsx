import React from 'react';
import {Image,View} from 'react-native';
import {SEASON_ART} from '@/constants/season-art';
import {SEASON_CATEGORIES,type SeasonPreviewItem} from '@/constants/season-catalog';

export function SeasonCatalogArtwork({item,size=80}:{item:SeasonPreviewItem;size?:number}){
 const row=SEASON_CATEGORIES.findIndex(category=>category.kind===item.kind);
 return <View pointerEvents="none" style={{width:size,height:size,overflow:'hidden'}}>
  <Image source={SEASON_ART[item.event].catalog} fadeDuration={0} resizeMode="stretch" style={{position:'absolute',width:size*5,height:size*6,left:-item.variant*size,top:-row*size}}/>
 </View>;
}
