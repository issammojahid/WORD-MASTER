import {useEffect,useState} from 'react';
import {useAppActive} from './use-app-active';
export function useSeasonNow(){
 const active=useAppActive(),[now,setNow]=useState(Date.now);
 useEffect(()=>{setNow(Date.now());if(!active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active]);
 return now;
}
