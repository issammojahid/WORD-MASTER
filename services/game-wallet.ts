import {getOnlineGuestToken,refreshOnlineGuestToken} from "./socket";
import {getApiUrl} from "@/lib/query-client";
import {installApiAuthentication} from "@/lib/api-auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {LEVEL_REWARD_VALUES} from "../shared/game-wallet";
const QUEUE='game_wallet_offline_queue_v1';
async function walletFetch(path:string,body:Record<string,unknown>){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{return await fetch(new URL(path,getApiUrl()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});}finally{clearTimeout(timer);}
}
export async function initializeGameWallet():Promise<{playerId:string;coins:number;name:string;unified:boolean}>{
 installApiAuthentication(getApiUrl());await getOnlineGuestToken();
 const initialize=()=>walletFetch('/api/game-wallet/initialize',{});
 let response=await initialize();
 if(response.status===401){await refreshOnlineGuestToken();response=await initialize();}
 if(!response.ok)throw Error('wallet_unavailable');return response.json();
}
export async function gameWalletAction(body:Record<string,unknown>){
 const response=await walletFetch('/api/game-wallet/action',body);
 const result=await response.json();if(!response.ok)throw Error(result.error??'wallet_unavailable');return result as {coins:number;xp:number;level:number;gamesPlayed:number;totalScore:number;owned?:string[]};
}
let storageQueue:Promise<unknown>=Promise.resolve();
function serializeStorage<T>(operation:()=>Promise<T>):Promise<T>{const next=storageQueue.then(operation,operation);storageQueue=next.catch(()=>{});return next;}
export function queueOfflineMatch(score:number){return serializeStorage(async()=>{
 const queue=JSON.parse(await AsyncStorage.getItem(QUEUE)??'[]') as Record<string,unknown>[];
 queue.push({operationId:`offline:${Date.now()}:${Math.random().toString(36).slice(2)}`,kind:'offline_match',score});
 await AsyncStorage.setItem(QUEUE,JSON.stringify(queue));
});}
let flushing:Promise<void>|null=null;
export function flushOfflineMatches(){
 if(flushing)return flushing;
 flushing=(async()=>{let queue=JSON.parse(await AsyncStorage.getItem(QUEUE)??'[]') as Record<string,unknown>[];
  while(queue.length){const operation=queue[0];const result=await gameWalletAction(operation);for(const reward of LEVEL_REWARD_VALUES){if(result.level>=reward.level)await gameWalletAction({operationId:`level_reward:${reward.level}`,kind:'level_reward',level:reward.level});}queue=await serializeStorage(async()=>{const current=JSON.parse(await AsyncStorage.getItem(QUEUE)??'[]') as Record<string,unknown>[];const remaining=current.filter(item=>item.operationId!==operation.operationId);await AsyncStorage.setItem(QUEUE,JSON.stringify(remaining));return remaining;});}
 })().finally(()=>{flushing=null;});return flushing;
}
