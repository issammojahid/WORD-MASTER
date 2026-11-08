import {ScaledText as Text} from "@/components/ScaledText";
import React from 'react';
import {Pressable, View} from 'react-native';
import {router} from 'expo-router';
import {useQuery} from '@tanstack/react-query';
import {usePlayer} from '@/contexts/PlayerContext';
import {getApiUrl} from '@/lib/query-client';
import {RoyalSurface,RoyalIcon} from './RoyalUi';
type Achievement={key:string;titleAr:string;unlocked:boolean};
export function EarnedAchievements(){
 const {playerId}=usePlayer();
 const {data=[]}=useQuery<Achievement[]>({queryKey:['/api/achievements',playerId],enabled:!!playerId,queryFn:async()=>{const response=await fetch(new URL(`/api/achievements/${playerId}`,getApiUrl()));if(!response.ok)return [];const value=await response.json();return Array.isArray(value)?value:[];},staleTime:30000});
 const earned=data.filter(item=>item.unlocked).slice(0,3);
 return <RoyalSurface style={{gap:10,padding:14}}><Text style={{fontFamily:'Cairo_700Bold',fontSize:16,color:'#FFF0D6',textAlign:'center'}}>✧　آخر الإنجازات　✧</Text><View style={{flexDirection:'row-reverse',gap:6,justifyContent:'center'}}>{earned.length?earned.map((item,index)=><Pressable key={item.key} accessibilityRole="button" onPress={()=>router.push('/achievements')} style={{flex:1,alignItems:'center',minHeight:75,gap:4}}><RoyalIcon name={index===0?'trophy':index===1?'scroll':'privacy'} size={47}/><Text numberOfLines={2} style={{fontFamily:'Cairo_700Bold',fontSize:10,color:'#FFE6AB',textAlign:'center'}}>{item.titleAr}</Text></Pressable>):<Pressable accessibilityRole="button" onPress={()=>router.push('/achievements')} style={{minHeight:60,justifyContent:'center'}}><Text style={{fontFamily:'Cairo_400Regular',fontSize:12,color:'#D6C6E7',textAlign:'center'}}>رحلتك تبدأ هنا · استكشف الإنجازات</Text></Pressable>}</View></RoyalSurface>;
}
