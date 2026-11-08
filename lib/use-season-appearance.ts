import {useEffect,useState} from 'react';
import {getApiUrl} from './query-client';
import {getOnlineGuestToken} from '@/services/socket';
import {installApiAuthentication} from './api-auth';
import {seasonalItem,type SeasonalState} from '@shared/season-2027';
type Equipment=SeasonalState['equipped'];
const cache=new Map<string,{expires:number;equipment:Equipment}>(),pending=new Map<string,Promise<Equipment>>();
async function load(id:string):Promise<Equipment>{
 const cached=cache.get(id);if(cached&&cached.expires>Date.now())return cached.equipment;const inflight=pending.get(id);if(inflight)return inflight;
 const task=(async()=>{installApiAuthentication(getApiUrl());await getOnlineGuestToken();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(new URL('/api/seasonal-events/appearance/'+encodeURIComponent(id),getApiUrl()),{signal:controller.signal});if(!response.ok)return {};const data=await response.json(),equipment:Equipment={};for(const [kind,value]of Object.entries(data.equipped??{})){const item=seasonalItem(value);if(item&&item.kind===kind)equipment[item.kind]=item.id;}if(cache.size>200)cache.clear();cache.set(id,{equipment,expires:Date.now()+30000});return equipment;}catch{return {};}finally{clearTimeout(timer);pending.delete(id);}})();pending.set(id,task);return task;
}
export function useSeasonAppearance(id?:string){const [appearance,setAppearance]=useState<Equipment>({});useEffect(()=>{let alive=true;setAppearance({});if(id)void load(id).then(result=>{if(alive)setAppearance(result);});return()=>{alive=false;};},[id]);return appearance;}
