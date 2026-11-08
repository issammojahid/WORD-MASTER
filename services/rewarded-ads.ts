import {getApiUrl} from '@/lib/query-client';
import {installApiAuthentication} from '@/lib/api-auth';
import {getOnlineGuestToken} from './socket';
export type RewardKind='coins'|'loss-recovery';
export type RewardOffer={enabled:boolean;coins:number};
export type RewardSession={id:string;customData:string;coins:number};
async function request(path:string,body?:unknown,signal?:AbortSignal){
 installApiAuthentication(getApiUrl());await getOnlineGuestToken();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)controller.abort();
 try{
  const response=await fetch(new URL(path,getApiUrl()),{method:body?'POST':'GET',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:controller.signal});
  if(!response.ok)throw Error(response.status===404||response.status===503?'reward_service_unavailable':'reward_request_failed');
  return await response.json();
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
export async function getRewardOffer(kind:RewardKind,matchId?:string,signal?:AbortSignal):Promise<RewardOffer>{
 const query=new URLSearchParams({kind,...(matchId?{matchId}:{})});
 const data=await request(`/api/rewarded-ads/offer?${query}`,undefined,signal);
 if(data.enabled!==true)return {enabled:false,coins:0};
 if(!Number.isSafeInteger(data.coins)||data.coins<=0||data.coins>10000)throw Error('invalid_reward_offer');
 return {enabled:true,coins:data.coins};
}
export async function startRewardSession(kind:RewardKind,matchId?:string):Promise<RewardSession>{
 const data=await request('/api/rewarded-ads/sessions',{kind,...(matchId?{matchId}:{})});
 if(typeof data.id!=='string'||!data.id||typeof data.customData!=='string'||!data.customData||!Number.isSafeInteger(data.coins)||data.coins<=0||data.coins>10000)throw Error('invalid_reward_session');
 return {id:data.id,customData:data.customData,coins:data.coins};
}
export async function getRewardReceipt(id:string):Promise<'pending'|'credited'|'expired'>{
 const data=await request(`/api/rewarded-ads/sessions/${encodeURIComponent(id)}`);
 if(!['pending','credited','expired'].includes(data.status))throw Error('invalid_reward_receipt');
 return data.status;
}
