import React from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
export function RoyalPortrait({children}:{children:React.ReactNode}){return <View style={{width:210,height:190,alignItems:'center',justifyContent:'center'}}><Svg width={210} height={190} viewBox="0 0 210 190" style={StyleSheet.absoluteFill}><Path d="M105 3l22 18 28-3 10 25 26 11-3 28 19 20-20 20 2 28-28 8-11 25-28-4-20 18-20-19-29 3-10-26-26-10 4-29L3 94l19-20-2-28 28-8 10-25 28 5z" fill="#173F69" stroke="#F0CA7B" strokeWidth={4}/><Path d="M105 15L181 95 105 179 28 95zM25 95h162M105 15v165M47 38l116 116M164 38L48 154" fill="none" stroke="#41B8BD" strokeWidth={1} opacity={.55}/></Svg>{children}</View>;}
