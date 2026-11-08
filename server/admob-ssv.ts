import {createPublicKey,verify, type KeyObject} from 'node:crypto';

export type VerifiedAdCallback={transactionId:string;userId:string;customData:string;adUnit:string;timestamp:number};
type KeyProvider=(keyId:string)=>Promise<KeyObject>;
const KEY_URL='https://www.gstatic.com/admob/reward/verifier-keys.json';
export function googleKeyProvider(fetchKeys:typeof fetch=fetch):KeyProvider{
 let keys=new Map<string,KeyObject>(),expires=0,inflight:Promise<void>|null=null,lastRefresh=0;
 async function refresh(){
  if(inflight)return inflight;
  inflight=(async()=>{
   const response=await fetchKeys(KEY_URL,{signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!response.ok)throw Error('ssv_keys_unavailable');
   const body=await response.text();if(body.length>100000)throw Error('ssv_keys_invalid');
   const data=JSON.parse(body);if(!Array.isArray(data.keys)||data.keys.length>20)throw Error('ssv_keys_invalid');
   const next=new Map<string,KeyObject>();
   for(const item of data.keys){if(!/^\d{1,12}$/.test(String(item.keyId))||typeof item.pem!=='string')throw Error('ssv_keys_invalid');const key=createPublicKey(item.pem);if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('ssv_keys_invalid');next.set(String(item.keyId),key);}
   if(!next.size)throw Error('ssv_keys_invalid');keys=next;lastRefresh=Date.now();expires=Date.now()+6*60*60*1000;
  })().finally(()=>{inflight=null;});return inflight;
 }
 return async id=>{if(Date.now()>=expires||(!keys.has(id)&&Date.now()-lastRefresh>60000))await refresh();const key=keys.get(id);if(!key)throw Error('ssv_key_unknown');return key;};
}
export function createAdmobVerifier(config:{adUnit:string;rewardItem:string;rewardAmount:string;getKey?:KeyProvider}){
 const getKey=config.getKey??googleKeyProvider();
 return async(rawQuery:string):Promise<VerifiedAdCallback>=>{
  if(rawQuery.length>8192||!config.adUnit||!config.rewardItem||!config.rewardAmount)throw Error('ssv_invalid');
  const match=/^(.*)&signature=([A-Za-z0-9_%=-]+)&key_id=(\d{1,12})$/.exec(rawQuery);if(!match)throw Error('ssv_invalid');
  const params=new URLSearchParams(rawQuery);const seen=new Set<string>();
  for(const [key]of params){if(seen.has(key))throw Error('ssv_duplicate_field');seen.add(key);}
  const signature=Buffer.from(decodeURIComponent(match[2]),'base64url');if(signature.length<64||signature.length>80)throw Error('ssv_invalid');
  const key=await getKey(match[3]);
  // Preserve ordering. Google's Java example uses URI.getQuery (percent decoded).
  // Both supported encodings must verify with the same trusted Google key.
  let valid=verify('sha256',Buffer.from(match[1]),key,signature);
  if(!valid&&match[1].includes('%'))valid=verify('sha256',Buffer.from(decodeURIComponent(match[1])),key,signature);
  if(!valid)throw Error('ssv_signature_invalid');
  const transactionId=params.get('transaction_id')??'',userId=params.get('user_id')??'',customData=params.get('custom_data')??'',timestamp=Number(params.get('timestamp'));
  const adUnit=params.get('ad_unit')??'';
  if(adUnit!==config.adUnit||params.get('reward_item')!==config.rewardItem||params.get('reward_amount')!==config.rewardAmount)throw Error('ssv_reward_mismatch');
  if(!/^[a-fA-F0-9]{16,128}$/.test(transactionId)||!/^[-\w]{1,128}$/.test(userId)||!/^[-\w.]{40,200}$/.test(customData)||!Number.isSafeInteger(timestamp))throw Error('ssv_invalid');
  return {transactionId,userId,customData,adUnit,timestamp};
 };
}
