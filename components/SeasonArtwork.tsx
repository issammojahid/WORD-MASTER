import React from "react";
import {Image,View} from "react-native";
import {SEASON_CONCEPT_ART as SEASON_ART} from "@/constants/season-concept-art";
import type {SeasonEventId} from "@/lib/season-calendar";
export const SEASON_SPRITES=["avatar","frame","chest","medallion","gift","victory"] as const;
export function SeasonArtwork({event,sprite,size=80}:{event:SeasonEventId;sprite:typeof SEASON_SPRITES[number];size?:number}){
 const index=SEASON_SPRITES.indexOf(sprite),column=index%2,row=Math.floor(index/2);
 return <View pointerEvents="none" style={{width:size,height:size,overflow:"hidden"}}><Image source={SEASON_ART[event].atlas} fadeDuration={0} resizeMode="stretch" style={{position:"absolute",width:size*2,height:size*3,left:-column*size,top:-row*size}}/></View>;
}
