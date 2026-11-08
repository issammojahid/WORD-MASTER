import {ScaledText as Text} from "@/components/ScaledText";
import React from 'react';
import {Pressable, View} from 'react-native';
import {router} from 'expo-router';
import {RoyalSurface} from './RoyalUi';
export function ProgressTabs({active}:{active:'tasks'|'achievements'}){return <View accessibilityRole="tablist" accessibilityLabel="المهام والإنجازات" style={{flexDirection:'row-reverse',gap:4,paddingHorizontal:18,paddingBottom:10}}>{([{id:'tasks',name:'المهام',route:'/tasks'},{id:'achievements',name:'الإنجازات',route:'/achievements'}] as const).map(tab=><Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.name} accessibilityState={{selected:active===tab.id}} aria-selected={active===tab.id} onPress={()=>{if(active!==tab.id)router.replace(tab.route);}} style={{flex:1}}><RoyalSurface selected={active===tab.id} style={{minHeight:44,alignItems:'center',justifyContent:'center',padding:7}}><Text style={{fontFamily:'Cairo_700Bold',fontSize:16,color:'#FFF0D6'}}>{tab.name}</Text></RoyalSurface></Pressable>)}</View>;}
