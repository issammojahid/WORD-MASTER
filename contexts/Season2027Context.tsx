import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {usePlayer} from './PlayerContext';
import {getApiUrl} from '@/lib/query-client';
import {installApiAuthentication} from '@/lib/api-auth';
import {getOnlineGuestToken} from '@/services/socket';
import {seasonalItem,type SeasonalSnapshot} from '@shared/season-2027';
import type {SeasonCategory} from '@/constants/season-catalog';

async function request(body?:Record<string,unknown>):Promise<SeasonalSnapshot>{
 installApiAuthentication(getApiUrl());await getOnlineGuestToken();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(new URL(`/api/seasonal-events/${body?'action':'state'}`,getApiUrl()),{method:body?'POST':'GET',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error??'season_unavailable');if(!Number.isFinite(Date.parse(data.serverTime))||!Array.isArray(data.items)||!data.states||!Number.isSafeInteger(data.coins))throw Error('invalid_season_state');return data;}finally{clearTimeout(timer);}
}
type Context={snapshot:SeasonalSnapshot|null;error:boolean;busy:boolean;refresh:()=>Promise<void>;action:(body:Record<string,unknown>)=>Promise<void>;equipped:Partial<Record<SeasonCategory,string>>;clearCategory:(kind:SeasonCategory)=>Promise<void>};
const SeasonContext=createContext<Context>({snapshot:null,error:false,busy:false,refresh:async()=>{},action:async()=>{throw Error('season_unavailable');},equipped:{},clearCategory:async()=>{}});
export function Season2027Provider({children}:{children:React.ReactNode}){
 const {isReady,playerId,refreshCoins}=usePlayer();const [snapshot,setSnapshot]=useState<SeasonalSnapshot|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false);const identity=useRef(playerId),sequence=useRef(0),acting=useRef(false),mounted=useRef(false);identity.current=playerId;
 const refresh=useCallback(async()=>{if(!isReady||!playerId)return;const owner=playerId,version=++sequence.current;try{const data=await request();if(mounted.current&&identity.current===owner&&sequence.current===version){setSnapshot(data);setError(false);}}catch{if(mounted.current&&identity.current===owner&&sequence.current===version)setError(true);}},[isReady,playerId]);
 useEffect(()=>{mounted.current=true;setSnapshot(null);setError(false);void refresh();const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},60000);const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});return()=>{clearInterval(timer);listener.remove();mounted.current=false;};},[refresh]);
 const action=useCallback(async(body:Record<string,unknown>)=>{if(acting.current)throw Error('request_pending');if(!playerId)throw Error('season_unavailable');const owner=playerId;acting.current=true;setBusy(true);++sequence.current;try{const data=await request(body);if(mounted.current&&identity.current===owner){setSnapshot(data);setError(false);await refreshCoins().catch(()=>{});}}finally{acting.current=false;setBusy(false);}},[playerId,refreshCoins]);
 const equipped:Context['equipped']={};for(const state of Object.values(snapshot?.states??{}))for(const [kind,id] of Object.entries(state?.equipped??{}))if(seasonalItem(id)&&state?.owned.includes(id))equipped[kind as SeasonCategory]=id;
 const clearCategory=async(kind:SeasonCategory)=>{const id=equipped[kind];if(id){const item=seasonalItem(id)!;await action({type:'unequip',eventId:item.event,category:kind});}};
 return <SeasonContext.Provider value={{snapshot,error,busy,refresh,action,equipped,clearCategory}}>{children}</SeasonContext.Provider>;
}
export const useSeason2027=()=>useContext(SeasonContext);
