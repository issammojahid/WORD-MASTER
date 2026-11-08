import React,{useId} from 'react';
import Svg,{Defs,LinearGradient,Stop,Path} from 'react-native-svg';
export function ClanEmblem({size=44}:{size?:number}){
 const id=useId().replace(/:/g,'');
 return <Svg width={size} height={size} viewBox="0 0 80 80" pointerEvents="none">
  <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFF1A5"/><Stop offset=".5" stopColor="#E7AA34"/><Stop offset="1" stopColor="#986122"/></LinearGradient></Defs>
  <Path d="M13 8v53M67 8v53" stroke={`url(#${id})`} strokeWidth="4"/>
  <Path d="M15 9h20v30L25 32 15 39ZM65 9H45v30l10-7 10 7Z" fill="#9161BC" stroke="#F5CC70" strokeWidth="2"/>
  <Path d="M40 21 65 32v19c0 13-14 21-25 26-11-5-25-13-25-26V32Z" fill="#096E7C" stroke={`url(#${id})`} strokeWidth="5"/>
  <Path d="m40 34 5 10 11 2-8 8 2 12-10-6-10 6 2-12-8-8 11-2Z" fill={`url(#${id})`}/>
 </Svg>;
}
