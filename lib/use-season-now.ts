import {useSeason2027} from '@/contexts/Season2027Context';
import {useEffect,useMemo,useState} from 'react';
import {useAppActive} from './use-app-active';
export function useSeasonNow(){
 const {snapshot}=useSeason2027();
 const serverTime=snapshot?.serverTime;
 const offset=useMemo(()=>serverTime?Date.parse(serverTime)-Date.now():0,[serverTime]);
 const active=useAppActive(),[now,setNow]=useState(Date.now);
 useEffect(()=>{setNow(Date.now());if(!active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active]);
 return now+offset;
}
